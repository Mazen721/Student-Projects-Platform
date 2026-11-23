import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@spp/shared/schemas';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { Button, Field, Input } from '@/components/ui';
import { useDemoLoginInfoQuery, useDemoLoginMutation, useLoginMutation } from './authApi';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const loginMutation = useLoginMutation();
  const demoInfoQuery = useDemoLoginInfoQuery();
  const demoLoginMutation = useDemoLoginMutation();
  const [serverError, setServerError] = useState('');
  const [pendingDemoKey, setPendingDemoKey] = useState('');

  const demoAccounts = demoInfoQuery.data?.accounts || [];

  async function onDemoLogin(accountKey) {
    setServerError('');
    setPendingDemoKey(accountKey);
    try {
      await demoLoginMutation.mutateAsync(accountKey);
      const from = location.state?.from?.pathname || '/app';
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(getApiErrorMessage(err));
    } finally {
      setPendingDemoKey('');
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values) {
    setServerError('');
    try {
      const data = await loginMutation.mutateAsync(values);
      if (data.mustChangePassword) {
        navigate('/change-password', { replace: true });
        return;
      }
      const from = location.state?.from?.pathname || '/app';
      navigate(from, { replace: true });
    } catch (err) {
      const rejectionReason = err?.response?.data?.error?.details?.rejectionReason;
      const baseMsg = getApiErrorMessage(err);
      setServerError(rejectionReason ? `${baseMsg}: ${rejectionReason}` : baseMsg);
    }
  }

  return (
    <div className="space-y-5">
      <Helmet title={`${ar.auth.loginTitle} — ${ar.common.platformName}`} />

      <div>
        <h2 className="text-xl font-extrabold text-navy">{ar.auth.loginTitle}</h2>
        <p className="mt-1 text-sm text-muted">{ar.auth.loginSubtitle}</p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="rounded-xl border border-[#b91c1c]/30 bg-[#fee2e2] px-4 py-3 text-sm font-bold text-[#b91c1c]"
        >
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label={ar.auth.email} id="login-email" required error={t(errors.email?.message)}>
          <Input
            id="login-email"
            type="email"
            dir="ltr"
            autoComplete="email"
            error={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field
          label={ar.auth.password}
          id="login-password"
          required
          error={t(errors.password?.message)}
        >
          <Input
            id="login-password"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            error={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>

        <Button
          type="submit"
          variant="gold"
          className="w-full"
          loading={loginMutation.isPending}
        >
          {ar.auth.loginSubmit}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        <span>{ar.auth.noAccountPrompt}</span>{' '}
        <Link to="/register" className="font-extrabold text-navy underline hover:text-navy-light">
          {ar.nav.register}
        </Link>
      </p>

      {demoAccounts.length > 0 && (
        <div className="space-y-3 border-t border-line pt-5">
          <div>
            <h3 className="text-sm font-extrabold text-navy">{ar.auth.demoLoginTitle}</h3>
            <p className="mt-1 text-xs text-muted">{ar.auth.demoLoginNote}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map((account) => (
              <Button
                key={account.key}
                type="button"
                variant="outline"
                loading={pendingDemoKey === account.key}
                disabled={Boolean(pendingDemoKey) && pendingDemoKey !== account.key}
                onClick={() => onDemoLogin(account.key)}
              >
                {account.title}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
