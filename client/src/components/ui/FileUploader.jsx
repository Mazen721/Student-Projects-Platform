import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { PURPOSE_POLICIES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { uploadFileToCloudinary } from '@/lib/cloudinaryUpload';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';

export function FileUploader({
  purpose,
  projectId,
  accept,
  onUploaded,
  onError,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [errorText, setErrorText] = useState('');

  const policy = PURPOSE_POLICIES[purpose];
  const resolvedAccept = accept || policy?.allowedMimes?.join(',') || '';

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setErrorText('');
    if (policy && file.size > policy.maxBytes) {
      const msg = ar.errors.UPLOAD_INVALID;
      setErrorText(msg);
      onError?.(msg);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);

    try {
      const result = await uploadFileToCloudinary({
        file,
        purpose,
        projectId,
        signal: controller.signal,
        onProgress: setProgress,
      });
      setProgress(null);
      onUploaded?.(result);
    } catch (err) {
      setProgress(null);
      if (err?.name !== 'CanceledError' && err?.name !== 'AbortError') {
        const msg = err?.response?.data?.error?.message || ar.errors.UPLOAD_INVALID;
        setErrorText(msg);
        onError?.(msg);
      }
    } finally {
      abortRef.current = null;
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={resolvedAccept}
        onChange={handleFileChange}
        className="sr-only"
        disabled={disabled || progress !== null}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={disabled || progress !== null}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          <span>{ar.common.chooseFile}</span>
        </Button>
        {progress !== null && (
          <Button
            variant="ghost"
            onClick={() => abortRef.current?.abort()}
            aria-label={ar.common.cancelUpload}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span>{ar.common.cancelUpload}</span>
          </Button>
        )}
      </div>
      {progress !== null && (
        <ProgressBar
          value={progress}
          label={t('common.uploadingProgress', { percent: progress })}
        />
      )}
      {errorText && (
        <p role="alert" className="text-xs font-semibold text-[#b91c1c]">
          {errorText}
        </p>
      )}
    </div>
  );
}
