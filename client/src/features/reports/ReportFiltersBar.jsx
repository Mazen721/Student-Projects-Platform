import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import {
  PROJECT_FIELD_VALUES,
  PROPOSAL_STATUS_VALUES,
  ROLES,
} from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Button, Card, Field, Select } from '@/components/ui';
import {
  useAcademicYearsQuery,
  useCollegesQuery,
  useDepartmentsQuery,
} from '@/features/organization/orgApi';
import { downloadReportFile } from './reportsApi';

export function KpiTile({ label, value, formattedValue, icon: Icon }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-muted">{label}</p>
          <p className="mt-1 text-2xl font-black text-navy">
            {formattedValue !== undefined ? formattedValue : formatNumber(Number(value || 0))}
          </p>
        </div>
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#faf3d7] text-[#7c5e0b]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
      </div>
    </Card>
  );
}

export function useReportFilterState() {
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const activeRoleId = useAuthStore((s) => s.activeRoleId);
  const activeAssignment =
    roles.find((r) => String(r._id) === String(activeRoleId)) || roles[0] || null;
  const isUniversityAdmin = roles.some((r) => r.role === ROLES.UNIVERSITY_ADMIN);
  const isAdmin = roles.some((r) =>
    [ROLES.UNIVERSITY_ADMIN, ROLES.COLLEGE_ADMIN, ROLES.DEPARTMENT_ADMIN].includes(r.role)
  );

  const defaultCollegeId =
    !isUniversityAdmin && (activeAssignment?.collegeId || user?.collegeId)
      ? String(activeAssignment?.collegeId || user?.collegeId)
      : '';
  const defaultDepartmentId =
    activeAssignment?.role === ROLES.DEPARTMENT_ADMIN && activeAssignment?.departmentId
      ? String(activeAssignment.departmentId)
      : '';

  const [collegeId, setCollegeId] = useState(defaultCollegeId);
  const [departmentId, setDepartmentId] = useState(defaultDepartmentId);
  const [academicYearId, setAcademicYearId] = useState('');
  const [yearLabel, setYearLabel] = useState('');
  const [compareYearId, setCompareYearId] = useState('');
  const [compareYearLabel, setCompareYearLabel] = useState('');
  const [field, setField] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [freshNonce, setFreshNonce] = useState(0);

  const collegesQuery = useCollegesQuery({ limit: 100 });
  const colleges = useMemo(() => collegesQuery.data?.items || [], [collegesQuery.data]);

  const yearSourceCollegeId = collegeId || colleges[0]?.id || colleges[0]?._id || '';
  const yearsQuery = useAcademicYearsQuery(yearSourceCollegeId);
  const years = useMemo(() => yearsQuery.data || [], [yearsQuery.data]);
  const departmentsQuery = useDepartmentsQuery(collegeId);
  const departments = useMemo(() => departmentsQuery.data?.items || [], [departmentsQuery.data]);

  useEffect(() => {
    if (years.length === 0) return;
    const current = years.find((y) => y.isCurrent) || years[0];
    if (collegeId && !academicYearId) {
      setAcademicYearId(String(current.id || current._id));
      setYearLabel('');
    } else if (!collegeId && !yearLabel) {
      setYearLabel(current.label);
      setAcademicYearId('');
    }
  }, [years, collegeId, academicYearId, yearLabel]);

  const queryParams = useMemo(() => {
    const params = {
      collegeId: collegeId || undefined,
      departmentId: departmentId || undefined,
      field: field || undefined,
      status: status || undefined,
      fresh: freshNonce > 0 ? 'true' : undefined,
    };
    if (collegeId && academicYearId) {
      params.academicYearId = academicYearId;
    } else if (yearLabel) {
      params.yearLabel = yearLabel;
    } else if (academicYearId) {
      params.academicYearId = academicYearId;
    }
    if (collegeId && compareYearId) {
      params.compareYearId = compareYearId;
    } else if (compareYearLabel) {
      params.compareYearLabel = compareYearLabel;
    }
    return params;
  }, [
    collegeId,
    departmentId,
    academicYearId,
    yearLabel,
    compareYearId,
    compareYearLabel,
    field,
    status,
    freshNonce,
  ]);

  function handleCollegeChange(nextCollegeId) {
    setCollegeId(nextCollegeId);
    setDepartmentId('');
    setAcademicYearId('');
    setCompareYearId('');
    setPage(1);
  }

  return {
    isUniversityAdmin,
    isAdmin,
    colleges,
    departments,
    years,
    collegeId,
    setCollegeId: handleCollegeChange,
    departmentId,
    setDepartmentId: (val) => {
      setDepartmentId(val);
      setPage(1);
    },
    academicYearId,
    setAcademicYearId,
    yearLabel,
    setYearLabel,
    compareYearId,
    setCompareYearId,
    compareYearLabel,
    setCompareYearLabel,
    field,
    setField: (val) => {
      setField(val);
      setPage(1);
    },
    status,
    setStatus: (val) => {
      setStatus(val);
      setPage(1);
    },
    page,
    setPage,
    triggerFresh: () => setFreshNonce((n) => n + 1),
    queryParams,
  };
}

export function ReportFiltersBar({
  filters,
  endpoint,
  exportBasename,
  computedAt,
  showCompare = false,
  showProjectFilters = false,
}) {
  const addToast = useUiStore((s) => s.addToast);
  const [downloading, setDownloading] = useState('');

  const uniqueYearLabels = useMemo(
    () => [...new Set(filters.years.map((y) => y.label))],
    [filters.years]
  );

  async function handleExport(format) {
    setDownloading(format);
    try {
      await downloadReportFile({
        endpoint,
        params: filters.queryParams,
        format,
        fallbackFilename: `${exportBasename || 'report'}.${format}`,
      });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    } finally {
      setDownloading('');
    }
  }

  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={ar.reports.academicYear}>
          {filters.collegeId ? (
            <Select
              value={filters.academicYearId}
              onChange={(e) => filters.setAcademicYearId(e.target.value)}
            >
              {filters.years.length === 0 && (
                <option value="">{ar.reports.noYearAvailable}</option>
              )}
              {filters.years.map((y) => (
                <option key={y.id || y._id} value={y.id || y._id}>
                  {y.label}
                </option>
              ))}
            </Select>
          ) : (
            <Select
              value={filters.yearLabel}
              onChange={(e) => filters.setYearLabel(e.target.value)}
            >
              {uniqueYearLabels.length === 0 && (
                <option value="">{ar.reports.noYearAvailable}</option>
              )}
              {uniqueYearLabels.map((lbl) => (
                <option key={lbl} value={lbl}>
                  {lbl}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {showCompare && (
          <Field label={ar.reports.compareYear}>
            {filters.collegeId ? (
              <Select
                value={filters.compareYearId}
                onChange={(e) => filters.setCompareYearId(e.target.value)}
              >
                <option value="">{ar.reports.noCompare}</option>
                {filters.years
                  .filter((y) => String(y.id || y._id) !== String(filters.academicYearId))
                  .map((y) => (
                    <option key={y.id || y._id} value={y.id || y._id}>
                      {y.label}
                    </option>
                  ))}
              </Select>
            ) : (
              <Select
                value={filters.compareYearLabel}
                onChange={(e) => filters.setCompareYearLabel(e.target.value)}
              >
                <option value="">{ar.reports.noCompare}</option>
                {uniqueYearLabels
                  .filter((lbl) => lbl !== filters.yearLabel)
                  .map((lbl) => (
                    <option key={lbl} value={lbl}>
                      {lbl}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        )}

        {filters.isUniversityAdmin && (
          <Field label={ar.auth.college}>
            <Select
              value={filters.collegeId}
              onChange={(e) => filters.setCollegeId(e.target.value)}
            >
              <option value="">{ar.reports.allColleges}</option>
              {filters.colleges.map((c) => (
                <option key={c.id || c._id} value={c.id || c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {filters.collegeId && (
          <Field label={ar.auth.department}>
            <Select
              value={filters.departmentId}
              onChange={(e) => filters.setDepartmentId(e.target.value)}
            >
              <option value="">{ar.reports.allDepartments}</option>
              {filters.departments.map((d) => (
                <option key={d.id || d._id} value={d.id || d._id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {showProjectFilters && (
          <>
            <Field label={ar.projects.field}>
              <Select value={filters.field} onChange={(e) => filters.setField(e.target.value)}>
                <option value="">{ar.reports.allFields}</option>
                {PROJECT_FIELD_VALUES.map((f) => (
                  <option key={f} value={f}>
                    {t(`fields.${f}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={ar.common.status}>
              <Select value={filters.status} onChange={(e) => filters.setStatus(e.target.value)}>
                <option value="">{ar.reports.allStatuses}</option>
                {PROPOSAL_STATUS_VALUES.map((st) => (
                  <option key={st} value={st}>
                    {t(`statuses.${st}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <div className="flex items-center gap-3 text-xs text-muted">
          {computedAt && (
            <span>{t('reports.lastUpdated', { time: formatDateTime(computedAt) })}</span>
          )}
          {filters.isAdmin && (
            <Button type="button" variant="outline" onClick={filters.triggerFresh}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>{ar.reports.refreshNow}</span>
            </Button>
          )}
        </div>

        {endpoint && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="navy"
              loading={downloading === 'xlsx'}
              onClick={() => handleExport('xlsx')}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{ar.reports.exportExcel}</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={downloading === 'pdf'}
              onClick={() => handleExport('pdf')}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{ar.reports.exportPdf}</span>
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
