import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';
import { ActiveModal } from '@/src/components/GameHUD';
import { CameraActionHandle, ScreenRect, WorldTutorialTarget } from '@/src/components/OfficeCanvas';
import { useLocalization } from '@/src/hooks/useLocalization';
import { useResizeObserver } from '@/src/hooks/useResizeObserver';
import { GameState, TutorialStepId } from '@/src/types/game';
import { TutorialArrow, TutorialArrowDirection } from './TutorialArrow';

interface TutorialManagerProps {
  state: GameState;
  activeModal: ActiveModal;
  selectedEmployeeId: string | null;
  cameraActionRef: React.MutableRefObject<CameraActionHandle | null>;
}

interface ResolvedTutorialTarget {
  kind: 'UI' | 'WORLD';
  rect: ScreenRect;
  direction: TutorialArrowDirection;
  tooltip: string;
  targetKey: string;
}

function findVisibleElementRect(targetId: string): { el: Element; rect: ScreenRect; occluded: boolean } | null {
  if (typeof document === 'undefined') return null;
  const nodes = document.querySelectorAll(`[data-tutorial-target="${targetId}"]`);
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;

    const scrollParent = el.closest('[data-modal-scroll-body="true"]');
    if (scrollParent) {
      const cr = scrollParent.getBoundingClientRect();
      const visibleTop = Math.max(r.top, cr.top);
      const visibleBottom = Math.min(r.bottom, cr.bottom);
      const visibleLeft = Math.max(r.left, cr.left);
      const visibleRight = Math.min(r.right, cr.right);
      const visibleHeight = visibleBottom - visibleTop;
      const visibleWidth = visibleRight - visibleLeft;
      if (visibleHeight < Math.min(18, r.height * 0.4) || visibleWidth <= 0) {
        return {
          el,
          occluded: true,
          rect: {
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          },
        };
      }
      return {
        el,
        occluded: false,
        rect: {
          left: visibleLeft,
          top: visibleTop,
          right: visibleRight,
          bottom: visibleBottom,
          width: visibleWidth,
          height: visibleHeight,
        },
      };
    }

    return {
      el,
      occluded: false,
      rect: {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      },
    };
  }
  return null;
}

export const TutorialManager: React.FC<TutorialManagerProps> = ({
  state,
  activeModal,
  selectedEmployeeId,
  cameraActionRef,
}) => {
  const { t } = useLocalization();
  const [resolved, setResolved] = useState<ResolvedTutorialTarget | null>(null);
  const [milestoneBanner, setMilestoneBanner] = useState<string | null>(null);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    let node = document.getElementById('tutorial-overlay-root');
    if (!node) {
      node = document.createElement('div');
      node.id = 'tutorial-overlay-root';
      document.body.appendChild(node);
    }
    setPortalNode(node);
  }, []);

  const prevStepRef = useRef<TutorialStepId | null>(null);
  const prevCompletedRef = useRef<boolean>(Boolean(state.tutorial?.completed));
  const bannerTimerRef = useRef<number | null>(null);
  const lastScrolledKeyRef = useRef<string>('');
  const updatePositionRef = useRef<() => void>(() => {});

  const tut = state.tutorial;
  const tutorialRunning =
    state.screen === 'PLAYING' &&
    Boolean(tut?.active) &&
    !tut?.completed &&
    !tut?.skipped;

  // Show encouraging localized feedback banner when advancing steps or completing tutorial
  useEffect(() => {
    if (state.screen !== 'PLAYING' || !tut) return;

    const wasCompleted = prevCompletedRef.current;
    const isCompleted = Boolean(tut.completed);
    const prevStep = prevStepRef.current;

    if (!wasCompleted && isCompleted) {
      setMilestoneBanner(t('tutorialArrow.completedTutorial'));
      if (bannerTimerRef.current !== null) window.clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = window.setTimeout(() => {
        setMilestoneBanner(null);
        bannerTimerRef.current = null;
      }, 3200);
    } else if (
      prevStep !== null &&
      tut.active &&
      !tut.skipped &&
      tut.currentStep > prevStep
    ) {
      setMilestoneBanner(t('tutorialArrow.greatJob'));
      if (bannerTimerRef.current !== null) window.clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = window.setTimeout(() => {
        setMilestoneBanner(null);
        bannerTimerRef.current = null;
      }, 2200);
    }

    prevStepRef.current = tut.currentStep;
    prevCompletedRef.current = isCompleted;
  }, [state.screen, tut, tut?.active, tut?.completed, tut?.currentStep, tut?.skipped, t]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  const resolveCurrentTarget = useCallback((): ResolvedTutorialTarget | null => {
    if (!tutorialRunning || !tut) return null;

    // Suspend arrow guidance during cinematics, story events, blocking reports, events, or utility dialogs
    if (
      state.story?.activeCinematic ||
      state.story?.activeStoryEvent ||
      state.activeEvent ||
      state.pendingDailyReport ||
      state.pendingMonthlyReport ||
      activeModal === 'SETTINGS' ||
      activeModal === 'SAVE_LOAD'
    ) {
      return null;
    }

    const step = tut.currentStep;

    const uiTarget = (
      targetId: string,
      direction: TutorialArrowDirection,
      tooltip: string
    ): ResolvedTutorialTarget | null => {
      const hit = findVisibleElementRect(targetId);
      if (!hit || hit.occluded) return null;
      return {
        kind: 'UI',
        rect: hit.rect,
        direction,
        tooltip,
        targetKey: `ui:${step}:${targetId}`,
      };
    };

    const worldTarget = (
      world: WorldTutorialTarget,
      tooltip: string,
      key: string
    ): ResolvedTutorialTarget | null => {
      const rect = cameraActionRef.current?.getWorldTargetRect(world) ?? null;
      if (!rect) return null;
      return {
        kind: 'WORLD',
        rect,
        direction: 'curved',
        tooltip,
        targetKey: `world:${step}:${key}`,
      };
    };

    const menuNavTarget = (
      navId: 'nav-employees' | 'nav-products' | 'nav-market' | 'nav-finance',
      tooltip: string,
      sectionLabel: string
    ): ResolvedTutorialTarget | null => {
      return (
        uiTarget(navId, 'right', tooltip) ??
        uiTarget(
          'management-menu-btn',
          'down',
          t('tutorialArrow.openMenuFor', { section: sectionLabel })
        )
      );
    };

    switch (step) {
      case 1: {
        if (activeModal) {
          return uiTarget('modal-close-btn', 'down', t('tutorialArrow.closeModalFirst'));
        }
        if (state.employees.length > 0) {
          const empWorld = worldTarget(
            { kind: 'EMPLOYEE', employeeId: state.employees[0].id },
            t('tutorialArrow.step1Employee'),
            state.employees[0].id
          );
          if (empWorld) return empWorld;
        }
        return menuNavTarget('nav-employees', t('tutorialArrow.step1Nav'), t('hud.nav.employees'));
      }

      case 2: {
        if (activeModal) {
          return uiTarget('modal-close-btn', 'down', t('tutorialArrow.closeModalFirst'));
        }
        if (!tut.exploredCeoOffice) {
          return worldTarget(
            { kind: 'ROOM', roomId: 'CEO_OFFICE' },
            t('tutorialArrow.step2CeoOffice'),
            'CEO_OFFICE'
          );
        }
        if (!tut.exploredEngineering) {
          return worldTarget(
            { kind: 'ROOM', roomId: 'ENGINEERING' },
            t('tutorialArrow.step2Engineering'),
            'ENGINEERING'
          );
        }
        return null;
      }

      case 3: {
        if (activeModal !== 'PRODUCTS') {
          return menuNavTarget(
            'nav-products',
            t('tutorialArrow.step3OpenProducts'),
            t('hud.nav.products')
          );
        }
        const nameHit = findVisibleElementRect('product-name-input');
        if (nameHit) {
          const val = (nameHit.el as HTMLInputElement).value ?? '';
          if (val.trim().length === 0) {
            return {
              kind: 'UI',
              rect: nameHit.rect,
              direction: 'down',
              tooltip: t('tutorialArrow.step3NameInput'),
              targetKey: 'ui:3:product-name-input',
            };
          }
          return (
            uiTarget('product-create-submit', 'down', t('tutorialArrow.step3Submit')) ??
            uiTarget('product-new-idea-btn', 'down', t('tutorialArrow.step3NewIdea'))
          );
        }
        return uiTarget('product-new-idea-btn', 'down', t('tutorialArrow.step3NewIdea'));
      }

      case 4: {
        if (activeModal === 'EMPLOYEES') {
          return (
            uiTarget('employee-task-select', 'down', t('tutorialArrow.step4TaskSelect')) ??
            uiTarget('employee-roster-tab', 'down', t('tutorialArrow.step4RosterTab'))
          );
        }
        if (!activeModal && selectedEmployeeId) {
          const drawerHit = uiTarget('drawer-task-select', 'down', t('tutorialArrow.step4TaskSelect'));
          if (drawerHit) return drawerHit;
        }
        return menuNavTarget(
          'nav-employees',
          t('tutorialArrow.step4OpenEmployees'),
          t('hud.nav.employees')
        );
      }

      case 5: {
        if (activeModal !== 'PRODUCTS') {
          return menuNavTarget(
            'nav-products',
            t('tutorialArrow.step5OpenProducts'),
            t('hud.nav.products')
          );
        }
        return (
          uiTarget('product-launch-mvp-btn', 'down', t('tutorialArrow.step5LaunchMvp')) ??
          uiTarget('product-build-sprint-btn', 'down', t('tutorialArrow.step5BuildSprint'))
        );
      }

      case 6: {
        if (activeModal !== 'MARKET') {
          return menuNavTarget(
            'nav-market',
            t('tutorialArrow.step6OpenMarket'),
            t('hud.nav.market')
          );
        }
        return uiTarget('market-launch-campaign-btn', 'down', t('tutorialArrow.step6LaunchCampaign'));
      }

      case 7: {
        return menuNavTarget(
          'nav-finance',
          t('tutorialArrow.step7OpenFinance'),
          t('hud.nav.finance')
        );
      }

      case 8: {
        if (activeModal) {
          return uiTarget('modal-close-btn', 'down', t('tutorialArrow.closeModalFirst'));
        }
        return uiTarget('end-day-btn', 'up', t('tutorialArrow.step8EndDay'));
      }

      default:
        return null;
    }
  }, [
    activeModal,
    cameraActionRef,
    selectedEmployeeId,
    state.activeEvent,
    state.employees,
    state.pendingDailyReport,
    state.pendingMonthlyReport,
    t,
    tut,
    tutorialRunning,
  ]);

  // Keep UI and world-space arrow aligned across layout shifts, scrolling, camera pan/zoom, and entity motion
  useEffect(() => {
    if (!tutorialRunning) {
      setResolved(null);
      return;
    }

    let rafId = 0;
    let alive = true;

    const updateNow = () => {
      if (!alive) return;
      const next = resolveCurrentTarget();
      if (next && next.kind === 'UI' && next.targetKey !== lastScrolledKeyRef.current) {
        lastScrolledKeyRef.current = next.targetKey;
        const targetId = next.targetKey.split(':').pop();
        if (targetId) {
          const hit = findVisibleElementRect(targetId);
          hit?.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
      setResolved((prev) => {
        if (!prev && !next) return prev;
        if (
          prev &&
          next &&
          prev.targetKey === next.targetKey &&
          prev.direction === next.direction &&
          prev.tooltip === next.tooltip &&
          Math.abs(prev.rect.left - next.rect.left) < 0.75 &&
          Math.abs(prev.rect.top - next.rect.top) < 0.75 &&
          Math.abs(prev.rect.width - next.rect.width) < 0.75 &&
          Math.abs(prev.rect.height - next.rect.height) < 0.75
        ) {
          return prev;
        }
        return next;
      });
    };

    updatePositionRef.current = updateNow;

    const tick = () => {
      updateNow();
      rafId = window.requestAnimationFrame(tick);
    };

    updateNow();
    rafId = window.requestAnimationFrame(tick);

    const onViewportChange = () => updateNow();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);

    return () => {
      alive = false;
      updatePositionRef.current = () => {};
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [resolveCurrentTarget, tutorialRunning]);

  const observedResizeTargets = useMemo<Element[]>(() => {
    if (!tutorialRunning || typeof document === 'undefined') return [];
    const targets: Element[] = [document.body];
    if (resolved?.kind === 'UI') {
      const targetId = resolved.targetKey.split(':').pop();
      const targetEl = targetId
        ? document.querySelector(`[data-tutorial-target="${targetId}"]`)
        : null;
      if (targetEl) {
        targets.push(targetEl);
        const scrollParent = targetEl.closest('[data-modal-scroll-body="true"]');
        if (scrollParent && scrollParent !== targetEl && scrollParent !== document.body) {
          targets.push(scrollParent);
        }
      }
    }
    return targets;
  }, [resolved?.kind, resolved?.targetKey, tutorialRunning]);

  useResizeObserver(observedResizeTargets, {
    enabled: tutorialRunning,
    trackSize: false,
    onResize: () => {
      updatePositionRef.current();
    },
  });

  // Diagnostic tool: log getBoundingClientRect vs visual overlay position for active tutorial targets
  useEffect(() => {
    if (!resolved || typeof document === 'undefined') return;
    const targetId = resolved.targetKey.split(':').pop();
    const el = targetId ? document.querySelector(`[data-tutorial-target="${targetId}"]`) : null;
    const clientRect = el ? el.getBoundingClientRect() : null;

    console.debug('[TutorialDiagnostic] Target vs Overlay Alignment:', {
      step: tut?.currentStep,
      targetKey: resolved.targetKey,
      kind: resolved.kind,
      elementClientRect: clientRect
        ? {
            left: Math.round(clientRect.left * 10) / 10,
            top: Math.round(clientRect.top * 10) / 10,
            width: Math.round(clientRect.width * 10) / 10,
            height: Math.round(clientRect.height * 10) / 10,
          }
        : 'World / Canvas Object',
      overlayVisualPosition: {
        left: Math.round(resolved.rect.left * 10) / 10,
        top: Math.round(resolved.rect.top * 10) / 10,
        width: Math.round(resolved.rect.width * 10) / 10,
        height: Math.round(resolved.rect.height * 10) / 10,
      },
      deltaX: clientRect ? Math.round((resolved.rect.left - clientRect.left) * 10) / 10 : 0,
      deltaY: clientRect ? Math.round((resolved.rect.top - clientRect.top) * 10) / 10 : 0,
    });
  }, [resolved, tut?.currentStep]);

  const content = (
    <>
      {tutorialRunning && resolved && (
        <TutorialArrow
          targetRect={resolved.rect}
          direction={resolved.direction}
          tooltip={resolved.tooltip}
          showTooltip={Boolean(activeModal || (selectedEmployeeId && tut?.currentStep === 4))}
          dimBackground={false}
          pulseTargetFrame
          currentStep={tut?.currentStep}
          totalSteps={8}
        />
      )}

      {milestoneBanner && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 -translate-x-1/2 top-20 z-40 animate-shortcut-pop"
        >
          <div className="bg-[#F3F0E7] border-2 border-[#303B38] px-4 py-2 flex items-center gap-2.5 shadow-sm">
            <span className="w-6 h-6 bg-[#D9A66C] border border-[#303B38] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-[#303B38]" aria-hidden="true" />
            </span>
            <span className="text-[15px] font-bold text-[#303B38] whitespace-nowrap">
              {milestoneBanner}
            </span>
          </div>
        </div>
      )}
    </>
  );

  if (!portalNode) return null;
  return createPortal(content, portalNode);
};
