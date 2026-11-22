import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import { useLocalization } from '@/src/hooks/useLocalization';
import {
  ClientAuthErrorCode,
  validateEmailInput,
  validatePasswordInput,
} from '@/src/services/authService';
import { ModalFrame } from './ModalFrame';

export type AuthModalMode = 'LOGIN' | 'REGISTER';

interface AuthModalProps {
  initialMode?: AuthModalMode;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode = 'LOGIN',
  onClose,
}) => {
  const { t } = useLocalization();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<ClientAuthErrorCode | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const switchMode = (nextMode: AuthModalMode) => {
    setMode(nextMode);
    setErrorCode(null);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorCode(null);

    if (!validateEmailInput(email)) {
      setErrorCode('INVALID_EMAIL');
      return;
    }

    if (mode === 'LOGIN') {
      if (!password) {
        setErrorCode('INVALID_CREDENTIALS');
        return;
      }
      setSubmitting(true);
      try {
        const res = await login(email, password, rememberMe);
        if (res.ok) {
          onClose();
        } else {
          setErrorCode(res.errorCode);
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!validatePasswordInput(password)) {
      setErrorCode('WEAK_PASSWORD');
      return;
    }
    if (password !== confirmPassword) {
      setErrorCode('PASSWORD_MISMATCH');
      return;
    }

    setSubmitting(true);
    try {
      const res = await register(email, password, confirmPassword, rememberMe);
      if (res.ok) {
        onClose();
      } else {
        setErrorCode(res.errorCode);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalFrame
      title={mode === 'LOGIN' ? t('auth.loginTitle') : t('auth.registerTitle')}
      subtitle={mode === 'LOGIN' ? t('auth.loginSubtitle') : t('auth.registerSubtitle')}
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4 text-[14px]">
        {errorCode && (
          <div
            role="alert"
            className="bg-[#D68B7B]/20 border border-[#D68B7B] px-3.5 py-2.5 text-[14px] font-bold text-[#303B38]"
          >
            {t(`auth.errors.${errorCode}`)}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="auth-email" className="block font-bold text-[#303B38]">
            {t('auth.emailLabel')}
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            disabled={submitting}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.emailPlaceholder')}
            className="w-full min-h-[42px] bg-[#FAF8F2] border border-[#303B38]/35 px-3 py-2 text-[15px] text-[#303B38] focus:outline-2 focus:outline-[#78978A] disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="auth-password" className="block font-bold text-[#303B38]">
            {t('auth.passwordLabel')}
          </label>
          <div className="relative flex items-center">
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'LOGIN' ? 'current-password' : 'new-password'}
              value={password}
              disabled={submitting}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-[42px] bg-[#FAF8F2] border border-[#303B38]/35 pl-3 pr-11 py-2 text-[15px] text-[#303B38] focus:outline-2 focus:outline-[#78978A] disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              title={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              className="absolute right-1 min-w-[36px] min-h-[36px] flex items-center justify-center text-[#303B38]/75 hover:bg-[#EAE5D8] cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {mode === 'REGISTER' && (
            <p className="text-[12px] text-[#303B38]/75">{t('auth.passwordRule')}</p>
          )}
        </div>

        {mode === 'REGISTER' && (
          <div className="space-y-1.5">
            <label htmlFor="auth-confirm-password" className="block font-bold text-[#303B38]">
              {t('auth.confirmPasswordLabel')}
            </label>
            <div className="relative flex items-center">
              <input
                id="auth-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                disabled={submitting}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full min-h-[42px] bg-[#FAF8F2] border border-[#303B38]/35 pl-3 pr-11 py-2 text-[15px] text-[#303B38] focus:outline-2 focus:outline-[#78978A] disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={
                  showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')
                }
                title={
                  showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')
                }
                className="absolute right-1 min-w-[36px] min-h-[36px] flex items-center justify-center text-[#303B38]/75 hover:bg-[#EAE5D8] cursor-pointer"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}

        <label className="flex items-center gap-2.5 cursor-pointer select-none min-h-[36px]">
          <input
            type="checkbox"
            checked={rememberMe}
            disabled={submitting}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 accent-[#78978A]"
          />
          <span className="text-[14px] text-[#303B38]">{t('auth.rememberMe')}</span>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-[#78978A] hover:bg-[#6A897C] border-2 border-[#303B38] text-[#303B38] text-[15px] font-bold py-2 px-4 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {mode === 'LOGIN' ? (
            <LogIn className="w-4 h-4" aria-hidden="true" />
          ) : (
            <UserPlus className="w-4 h-4" aria-hidden="true" />
          )}
          <span>
            {submitting
              ? t('auth.submitting')
              : mode === 'LOGIN'
                ? t('auth.loginBtn')
                : t('auth.createAccountBtn')}
          </span>
        </button>

        <div className="pt-2 border-t border-[#303B38]/20 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => switchMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN')}
            className="min-h-[38px] px-2 py-1 text-[14px] font-bold text-[#303B38] underline underline-offset-4 hover:text-[#303B38]/80 cursor-pointer"
          >
            {mode === 'LOGIN' ? t('auth.createAccountBtn') : t('auth.backToLoginBtn')}
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="min-h-[38px] px-3 py-1 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/30 text-[14px] font-bold text-[#303B38] cursor-pointer"
          >
            {t('auth.continueGuestBtn')}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
};
