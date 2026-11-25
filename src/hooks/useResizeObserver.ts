import { RefObject, useEffect, useRef, useState } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

export type ResizeObserverTarget =
  | Element
  | null
  | undefined
  | RefObject<Element | null>;

export interface UseResizeObserverOptions {
  /** Whether resize observation is active (defaults to true). */
  enabled?: boolean;
  /** Callback invoked whenever an observed element resizes. */
  onResize?: (entry: ResizeObserverEntry, size: ElementSize) => void;
  /** Box model option passed to ResizeObserver.observe(). */
  box?: ResizeObserverBoxOptions;
  /** Whether to store the first target's width/height in React state (defaults to true). */
  trackSize?: boolean;
}

function isElementLike(value: unknown): value is Element {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Element).getBoundingClientRect === 'function'
  );
}

function extractEntrySize(entry: ResizeObserverEntry): ElementSize {
  const borderBox = entry.borderBoxSize?.[0];
  if (borderBox) {
    return {
      width: borderBox.inlineSize,
      height: borderBox.blockSize,
    };
  }
  const contentRect = entry.contentRect;
  return {
    width: contentRect.width,
    height: contentRect.height,
  };
}

function resolveTargets(
  target: ResizeObserverTarget | readonly ResizeObserverTarget[] | undefined,
  internalRef: RefObject<Element | null>
): Element[] {
  const rawList =
    target === undefined
      ? [internalRef]
      : Array.isArray(target)
        ? target
        : [target];

  const unique: Element[] = [];
  for (const item of rawList) {
    if (!item) continue;
    const candidate = 'current' in item ? item.current : item;
    if (isElementLike(candidate) && !unique.includes(candidate)) {
      unique.push(candidate);
    }
  }
  return unique;
}

/**
 * Safely tracks DOM element size changes via ResizeObserver with SSR guards,
 * multi-target support, ref or direct-Element targets, and clean teardown.
 */
export function useResizeObserver<T extends Element = Element>(
  target?: ResizeObserverTarget | readonly ResizeObserverTarget[],
  options: UseResizeObserverOptions = {}
): {
  ref: RefObject<T | null>;
  size: ElementSize | null;
  entry: ResizeObserverEntry | null;
} {
  const { enabled = true, onResize, box, trackSize = true } = options;

  const internalRef = useRef<T | null>(null);
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  const [size, setSize] = useState<ElementSize | null>(null);
  const [entry, setEntry] = useState<ResizeObserverEntry | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') {
      return;
    }

    const elements = resolveTargets(target, internalRef);
    if (elements.length === 0) return;

    let disposed = false;

    const observer = new ResizeObserver((entries) => {
      if (disposed || entries.length === 0) return;

      for (const currentEntry of entries) {
        const nextSize = extractEntrySize(currentEntry);
        onResizeRef.current?.(currentEntry, nextSize);

        if (trackSize && currentEntry.target === elements[0]) {
          setEntry(currentEntry);
          setSize((prev) => {
            if (
              prev &&
              Math.abs(prev.width - nextSize.width) < 0.5 &&
              Math.abs(prev.height - nextSize.height) < 0.5
            ) {
              return prev;
            }
            return nextSize;
          });
        }
      }
    });

    for (const el of elements) {
      try {
        observer.observe(el, box ? { box } : undefined);
      } catch {
        // Fallback when a browser does not support the requested box option
        observer.observe(el);
      }
    }

    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [box, enabled, target, trackSize]);

  return { ref: internalRef, size, entry };
}
