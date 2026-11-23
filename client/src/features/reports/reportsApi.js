import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

function buildParams(params = {}) {
  const clean = {};
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      clean[key] = val;
    }
  }
  return clean;
}

function hasYearParam(params = {}) {
  return Boolean(params.academicYearId || params.yearLabel);
}

export function useReportDashboardQuery(params = {}) {
  const clean = buildParams(params);
  return useQuery({
    queryKey: ['reports', 'dashboard', clean],
    enabled: hasYearParam(clean),
    queryFn: async () => (await api.get('/reports/dashboard', { params: clean })).data,
  });
}

export function useReportProjectsQuery(params = {}) {
  const clean = buildParams(params);
  return useQuery({
    queryKey: ['reports', 'projects', clean],
    enabled: hasYearParam(clean),
    queryFn: async () => (await api.get('/reports/projects', { params: clean })).data,
  });
}

export function useReportCompletionQuery(params = {}) {
  const clean = buildParams(params);
  return useQuery({
    queryKey: ['reports', 'completion', clean],
    enabled: hasYearParam(clean),
    queryFn: async () => (await api.get('/reports/completion', { params: clean })).data,
  });
}

export function useReportSupervisorsQuery(params = {}) {
  const clean = buildParams(params);
  return useQuery({
    queryKey: ['reports', 'supervisor-distribution', clean],
    enabled: hasYearParam(clean),
    queryFn: async () =>
      (await api.get('/reports/supervisor-distribution', { params: clean })).data,
  });
}

export function useReportEvaluationQuery(params = {}) {
  const clean = buildParams(params);
  return useQuery({
    queryKey: ['reports', 'evaluation', clean],
    enabled: hasYearParam(clean),
    queryFn: async () => (await api.get('/reports/evaluation', { params: clean })).data,
  });
}

export function useReportInsightsQuery(params = {}) {
  const clean = buildParams(params);
  return useQuery({
    queryKey: ['reports', 'insights', clean],
    enabled: hasYearParam(clean),
    queryFn: async () => (await api.get('/reports/insights', { params: clean })).data,
  });
}

export function useSupervisorSelfReportQuery(params = {}, enabled = true) {
  const clean = buildParams(params);
  return useQuery({
    queryKey: ['reports', 'supervisor', 'me', clean],
    enabled,
    queryFn: async () => (await api.get('/reports/supervisor/me', { params: clean })).data,
  });
}

export async function downloadReportFile({ endpoint, params = {}, format, fallbackFilename }) {
  const clean = buildParams({ ...params, format });
  const res = await api.get(endpoint, {
    params: clean,
    responseType: 'blob',
  });
  const blobUrl = URL.createObjectURL(res.data);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fallbackFilename || `report.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}
