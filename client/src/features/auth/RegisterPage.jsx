import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  registerInvestorSchema,
  registerStudentSchema,
  registerVisitorSchema,
} from '@spp/shared/schemas';
import ar, { t } from '@/locales/ar';
import { applyServerValidationErrors, getApiErrorMessage } from '@/lib/errors';
import { Button, Field, Input, Select, Tabs } from '@/components/ui';
import {
  usePublicCollegesQuery,
  usePublicDepartmentsQuery,
  useRegisterInvestorMutation,
  useRegisterStudentMutation,
  useRegisterVisitorMutation,
} from './authApi';

function StudentRegisterForm() {
  const navigate = useNavigate();
  const mutation = useRegisterStudentMutation();
  const [serverError, setServerError] = useState('');
  const { data: colleges = [] } = usePublicCollegesQuery();

  const {
    register,
    watch,
    setValue,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerStudentSchema),
    defaultValues: { name: '', email: '', studentId: '', password: '', collegeId: '', departmentId: '' },
  });

  const selectedCollegeId = watch('collegeId');
  const { data: departments = [] } = usePublicDepartmentsQuery(selectedCollegeId);

  async function onSubmit(values) {
    setServerError('');
    try {
      await mutation.mutateAsync(values);
      navigate('/app', { replace: true });
    } catch (err) {
      if (!applyServerValidationErrors(err, setError)) {
        setServerError(getApiErrorMessage(err));
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
      {serverError && (
        <div role="alert" className="rounded-xl bg-[#fee2e2] px-4 py-2.5 text-sm font-bold text-[#b91c1c]">
          {serverError}
        </div>
      )}
      <Field label={ar.auth.name} id="reg-st-name" required error={t(errors.name?.message)}>
        <Input id="reg-st-name" error={Boolean(errors.name)} {...register('name')} />
      </Field>
      <Field label={ar.auth.email} id="reg-st-email" required error={t(errors.email?.message)}>
        <Input id="reg-st-email" type="email" dir="ltr" error={Boolean(errors.email)} {...register('email')} />
      </Field>
      <Field label={ar.auth.studentId} id="reg-st-id" required error={t(errors.studentId?.message)}>
        <Input id="reg-st-id" dir="ltr" error={Boolean(errors.studentId)} {...register('studentId')} />
      </Field>
      <Field label={ar.auth.college} id="reg-st-college" required error={t(errors.collegeId?.message)}>
        <Select
          id="reg-st-college"
          error={Boolean(errors.collegeId)}
          options={colleges.map((c) => ({ value: c._id, label: c.name }))}
          {...register('collegeId', {
            onChange: () => setValue('departmentId', ''),
          })}
        />
      </Field>
      <Field label={ar.auth.department} id="reg-st-dept" required error={t(errors.departmentId?.message)}>
        <Select
          id="reg-st-dept"
          disabled={!selectedCollegeId}
          error={Boolean(errors.departmentId)}
          options={departments.map((d) => ({ value: d._id, label: d.name }))}
          {...register('departmentId')}
        />
      </Field>
      <Field label={ar.auth.password} id="reg-st-pass" required error={t(errors.password?.message)}>
        <Input id="reg-st-pass" type="password" dir="ltr" error={Boolean(errors.password)} {...register('password')} />
      </Field>
      <Button type="submit" variant="gold" className="w-full" loading={mutation.isPending}>
        {ar.auth.registerSubmit}
      </Button>
    </form>
  );
}

function InvestorRegisterForm() {
  const navigate = useNavigate();
  const mutation = useRegisterInvestorMutation();
  const [serverError, setServerError] = useState('');
  const {
    register,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerInvestorSchema),
    defaultValues: { name: '', organization: '', email: '', password: '', fieldOfInterest: '' },
  });

  async function onSubmit(values) {
    setServerError('');
    try {
      await mutation.mutateAsync(values);
      navigate('/app', { replace: true });
    } catch (err) {
      if (!applyServerValidationErrors(err, setError)) {
        setServerError(getApiErrorMessage(err));
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
      {serverError && (
        <div role="alert" className="rounded-xl bg-[#fee2e2] px-4 py-2.5 text-sm font-bold text-[#b91c1c]">
          {serverError}
        </div>
      )}
      <Field label={ar.auth.name} id="reg-inv-name" required error={t(errors.name?.message)}>
        <Input id="reg-inv-name" error={Boolean(errors.name)} {...register('name')} />
      </Field>
      <Field label={ar.auth.organization} id="reg-inv-org" required error={t(errors.organization?.message)}>
        <Input id="reg-inv-org" error={Boolean(errors.organization)} {...register('organization')} />
      </Field>
      <Field label={ar.auth.fieldOfInterest} id="reg-inv-field" required error={t(errors.fieldOfInterest?.message)}>
        <Input id="reg-inv-field" error={Boolean(errors.fieldOfInterest)} {...register('fieldOfInterest')} />
      </Field>
      <Field label={ar.auth.email} id="reg-inv-email" required error={t(errors.email?.message)}>
        <Input id="reg-inv-email" type="email" dir="ltr" error={Boolean(errors.email)} {...register('email')} />
      </Field>
      <Field label={ar.auth.password} id="reg-inv-pass" required error={t(errors.password?.message)}>
        <Input id="reg-inv-pass" type="password" dir="ltr" error={Boolean(errors.password)} {...register('password')} />
      </Field>
      <Button type="submit" variant="gold" className="w-full" loading={mutation.isPending}>
        {ar.auth.registerSubmit}
      </Button>
    </form>
  );
}

function VisitorRegisterForm() {
  const navigate = useNavigate();
  const mutation = useRegisterVisitorMutation();
  const [serverError, setServerError] = useState('');
  const {
    register,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerVisitorSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  async function onSubmit(values) {
    setServerError('');
    try {
      await mutation.mutateAsync(values);
      navigate('/app', { replace: true });
    } catch (err) {
      if (!applyServerValidationErrors(err, setError)) {
        setServerError(getApiErrorMessage(err));
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
      {serverError && (
        <div role="alert" className="rounded-xl bg-[#fee2e2] px-4 py-2.5 text-sm font-bold text-[#b91c1c]">
          {serverError}
        </div>
      )}
      <Field label={ar.auth.name} id="reg-vis-name" required error={t(errors.name?.message)}>
        <Input id="reg-vis-name" error={Boolean(errors.name)} {...register('name')} />
      </Field>
      <Field label={ar.auth.email} id="reg-vis-email" required error={t(errors.email?.message)}>
        <Input id="reg-vis-email" type="email" dir="ltr" error={Boolean(errors.email)} {...register('email')} />
      </Field>
      <Field label={ar.auth.password} id="reg-vis-pass" required error={t(errors.password?.message)}>
        <Input id="reg-vis-pass" type="password" dir="ltr" error={Boolean(errors.password)} {...register('password')} />
      </Field>
      <Button type="submit" variant="gold" className="w-full" loading={mutation.isPending}>
        {ar.auth.registerSubmit}
      </Button>
    </form>
  );
}

export default function RegisterPage() {
  const [tab, setTab] = useState('student');
  const tabItems = [
    { value: 'student', label: ar.auth.registerStudent },
    { value: 'investor', label: ar.auth.registerInvestor },
    { value: 'visitor', label: ar.auth.registerVisitor },
  ];

  return (
    <div className="space-y-5">
      <Helmet title={`${ar.auth.registerTitle} — ${ar.common.platformName}`} />

      <div>
        <h2 className="text-xl font-extrabold text-navy">{ar.auth.registerTitle}</h2>
        <p className="mt-1 text-sm text-muted">{ar.auth.registerSubtitle}</p>
      </div>

      <Tabs items={tabItems} value={tab} onChange={setTab} />

      {tab === 'student' && <StudentRegisterForm />}
      {tab === 'investor' && <InvestorRegisterForm />}
      {tab === 'visitor' && <VisitorRegisterForm />}

      <p className="text-center text-sm text-muted">
        <span>{ar.auth.hasAccountPrompt}</span>{' '}
        <Link to="/login" className="font-extrabold text-navy underline hover:text-navy-light">
          {ar.nav.login}
        </Link>
      </p>
    </div>
  );
}
