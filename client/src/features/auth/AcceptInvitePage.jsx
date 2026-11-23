import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { acceptInviteSchema } from '@spp/shared/schemas';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { Badge, Button, CardSkeleton, Field, Input } from '@/components/ui';
import { useAcceptInviteMutation, useInvitePreviewQuery } from './authApi';

export default function AcceptInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data: invite, isLoading, isError, error } = useInvitePreviewQuery(token);
  const acceptMutation = useAcceptInviteMutation(token);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  async function onSubmit(values) {
    setServerError('');
    try {
      const payload = user ? {} : values;
      await acceptMutation.mutateAsync(payload);
      navigate('/app', { replace: true });
    } catch (err) {
      setServerError(getApiErrorMessage(err));
    }
  }

  if (isLoading) {
    return <CardSkeleton />;
  }

  if (isError || !invite) {
    return (
      <div className="space-y-4 text-center">
        <Helmet title={`${ar.auth.acceptInvite} — ${ar.common.platformName}`} />
        <p role="alert" className="rounded-xl bg-[#fee2e2] p-4 text-sm font-bold text-[#b91c1c]">
          {getApiErrorMessage(error) || ar.errors.INVITE_UNAVAILABLE}
        </p>
        <Link to="/login" className="inline-block text-sm font-extrabold text-navy underline">
          {ar.nav.login}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Helmet title={`${ar.auth.acceptInvite} — ${ar.common.platformName}`} />

      <div>
        <h2 className="text-xl font-extrabold text-navy">{ar.auth.acceptInvite}</h2>
        <p className="mt-1 text-sm text-muted">{ar.auth.inviteSubtitle}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="featured">{t(`roles.${invite.role}`)}</Badge>
          <Badge tone="info">{invite.scopeLabel}</Badge>
          <span className="text-xs text-muted">{formatDate(invite.expiresAt)}</span>
        </div>
      </div>

      {serverError && (
        <div role="alert" className="rounded-xl bg-[#fee2e2] px-4 py-3 text-sm font-bold text-[#b91c1c]">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {!user && (
          <>
            <Field label={ar.auth.name} id="inv-name" required error={t(errors.name?.message)}>
              <Input id="inv-name" error={Boolean(errors.name)} {...register('name')} />
            </Field>
            <Field label={ar.auth.email} id="inv-email" required error={t(errors.email?.message)}>
              <Input id="inv-email" type="email" dir="ltr" error={Boolean(errors.email)} {...register('email')} />
            </Field>
            <Field label={ar.auth.password} id="inv-pass" required error={t(errors.password?.message)}>
              <Input id="inv-pass" type="password" dir="ltr" error={Boolean(errors.password)} {...register('password')} />
            </Field>
          </>
        )}

        <Button type="submit" variant="gold" className="w-full" loading={acceptMutation.isPending}>
          {ar.auth.acceptInvite}
        </Button>
      </form>
    </div>
  );
}
