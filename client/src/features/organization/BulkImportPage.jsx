import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Download, FileSpreadsheet } from 'lucide-react';
import ar, { t } from '@/locales/ar';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/errors';
import { useUiStore } from '@/stores/uiStore';
import { Button, Card, Field, ResponsiveTable, Select } from '@/components/ui';
import { useCollegesQuery } from './orgApi';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export default function BulkImportPage() {
  const addToast = useUiStore((s) => s.addToast);
  const { data: collegesRes } = useCollegesQuery({ limit: 100 });
  const colleges = collegesRes?.data || [];

  const [collegeId, setCollegeId] = useState('');
  const [kind, setKind] = useState('students');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  async function handleDownloadTemplate() {
    try {
      const res = await api.get(`/imports/template?kind=${kind}`, { responseType: 'blob' });
      downloadBlob(
        res.data,
        kind === 'students' ? 'قالب-استيراد-الطلاب.xlsx' : 'قالب-استيراد-المشرفين.xlsx'
      );
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleRunImport(e) {
    e.preventDefault();
    if (!collegeId || !file) return;
    setSubmitting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/colleges/${collegeId}/imports?kind=${kind}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data.data);
      addToast({
        message: t('org.importCreatedCount', { count: res.data.data.created }),
        tone: 'success',
      });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  const rejectedColumns = [
    { key: 'row', header: ar.org.rowNumber },
    { key: 'field', header: ar.org.fieldName },
    { key: 'message', header: ar.org.failureReason },
  ];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.org.bulkImport} — ${ar.common.platformName}`} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-navy">{ar.org.bulkImport}</h1>
        <Button variant="outline" onClick={handleDownloadTemplate}>
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>{ar.org.downloadTemplate}</span>
        </Button>
      </div>

      <Card>
        <form onSubmit={handleRunImport} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={ar.auth.college} id="imp-college" required>
              <Select
                id="imp-college"
                options={colleges.map((c) => ({ value: c._id, label: c.name }))}
                value={collegeId}
                onChange={(e) => setCollegeId(e.target.value)}
              />
            </Field>
            <Field label={ar.org.importKind} id="imp-kind" required>
              <Select
                id="imp-kind"
                placeholder={false}
                options={[
                  { value: 'students', label: ar.org.importStudents },
                  { value: 'supervisors', label: ar.org.importSupervisors },
                ]}
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              />
            </Field>
          </div>

          <Field label={ar.org.uploadExcelFile} id="imp-file" required>
            <input
              id="imp-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full rounded-xl border border-input-line bg-white p-2.5 text-sm text-ink"
            />
          </Field>

          <Button type="submit" variant="gold" disabled={!collegeId || !file} loading={submitting}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            <span>{ar.org.runImport}</span>
          </Button>
        </form>
      </Card>

      {result && (
        <Card title={t('org.importCreatedCount', { count: result.created })}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-muted">
                {t('org.importRejectedCount', { count: result.rejected?.length || 0 })}
              </p>
              {result.credentialsFile && result.created > 0 && (
                <Button
                  variant="navy"
                  onClick={() =>
                    downloadBlob(
                      base64ToBlob(
                        result.credentialsFile,
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                      ),
                      'كلمات-المرور-المؤقتة.xlsx'
                    )
                  }
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>{ar.org.downloadCredentials}</span>
                </Button>
              )}
            </div>
            {result.rejected?.length > 0 && (
              <ResponsiveTable
                columns={rejectedColumns}
                rows={result.rejected}
                rowKey={(r) => `${r.row}-${r.field}`}
              />
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
