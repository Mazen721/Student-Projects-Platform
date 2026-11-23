import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema } from '@spp/shared/schemas';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Button, Field, Input } from '@/components/ui';
import { useChangePasswordMutation } from './authApi';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const addToast = useUiStore((s) => s.addToast);
  const mutation = useChangePasswordMutation();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  async function onSubmit(values) {
    setServerError('');
    try {
      const payload = values.currentPassword
        ? values
        : { newPassword: values.newPassword };
      await mutation.mutateAsync(payload);
      addToast({ message: ar.auth.passwordChanged, tone: 'success' });
      navigate('/app', { replace: true });
    } catch (err) {
      setServerError(getApiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      <Helmet title={`${ar.auth.changePassword} — ${ar.common.platformName}`} />

      <div>
        <h2 className="text-xl font-extrabold text-navy">{ar.auth.changePassword}</h2>
        {user?.mustChangePassword && (
          <p className="mt-2 rounded-xl bg-[#fef3c7] px-3 py-2 text-xs font-bold text-[#b45309]">
            {ar.auth.mustChangePasswordNotice}
          </p>
        )}
      </div>

      {serverError && (
        <div role="alert" className="rounded-xl bg-[#fee2e2] px-4 py-3 text-sm font-bold text-[#b91c1c]">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {!user?.mustChangePassword && (
          <Field
            label={ar.auth.currentPassword}
            id="chg-current"
            required
            error={t(errors.currentPassword?.message)}
          >
            <Input
              id="chg-current"
              type="password"
              dir="ltr"
              error={Boolean(errors.currentPassword)}
              {...register('currentPassword')}
            />
          </Field>
        )}

        <Field
          label={ar.auth.newPassword}
          id="chg-new"
          required
          error={t(errors.newPassword?.message)}
        >
          <Input
            id="chg-new"
            type="password"
            dir="ltr"
            error={Boolean(errors.newPassword)}
            {...register('newPassword')}
          />
        </Field>

        <Button type="submit" variant="gold" className="w-full" loading={mutation.isPending}>
          {ar.common.save}
        </Button>
      </form>
    </div>
  );
}
