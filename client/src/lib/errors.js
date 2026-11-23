import ar from '@/locales/ar';

export function getApiErrorMessage(error) {
  return error?.response?.data?.error?.message || ar.common.errorDescription;
}

export function applyServerValidationErrors(error, setError) {
  const fields = error?.response?.data?.error?.fields;
  if (!Array.isArray(fields) || typeof setError !== 'function') return false;
  let applied = false;
  for (const field of fields) {
    if (field?.path && field?.message) {
      setError(field.path, { type: 'server', message: field.message });
      applied = true;
    }
  }
  return applied;
}
