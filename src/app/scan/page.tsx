'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadDropzone } from '@/components/UploadDropzone';
import { ProgressSteps, type UploadStep } from '@/components/ProgressSteps';
import { apiFetch, ApiRequestError } from '@/lib/api';
import { toBlob, base64Bytes, MAX_UPLOAD_BYTES } from '@/lib/image';
import { getSessionId } from '@/lib/storage';
import type { PickedFile } from '@/lib/platform';
import { t } from '@/lib/strings';
import { DOC_TYPES, type DocType, type ExtractResponse } from '@/types';

/** Scan — BUILD-SPEC §10.2. */

type Phase =
  | { kind: 'idle' }
  | { kind: 'preview'; file: PickedFile }
  | { kind: 'working'; file: PickedFile; step: UploadStep }
  | { kind: 'error'; file: PickedFile; messageKey: string };

export default function ScanPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [docType, setDocType] = useState<DocType>('contract');
  const [feeBdt, setFeeBdt] = useState('');
  const [priorSalary, setPriorSalary] = useState('');

  const handlePicked = useCallback((file: PickedFile) => {
    if (base64Bytes(file.base64) > MAX_UPLOAD_BYTES) {
      setPhase({ kind: 'error', file, messageKey: 'errors.file_too_large' });
      return;
    }
    setPhase({ kind: 'preview', file });
  }, []);

  const handleSubmit = useCallback(
    async (file: PickedFile) => {
      setPhase({ kind: 'working', file, step: 'uploading' });

      try {
        const sessionId = await getSessionId();

        const form = new FormData();
        form.append('file', toBlob(file), file.fileName);
        form.append('docType', docType);

        const result = await apiFetch<ExtractResponse>('/api/extract', {
          method: 'POST',
          headers: { 'x-session-id': sessionId },
          body: form,
        });

        // Day 4 wires /api/analyze here; for now the read step completes and we
        // hand the extraction id to the results screen.
        setPhase({ kind: 'working', file, step: 'checking' });

        const params = new URLSearchParams({ id: result.extractionId });
        if (feeBdt.trim()) params.set('fee', feeBdt.trim());
        if (priorSalary.trim()) params.set('prior', priorSalary.trim());

        setPhase({ kind: 'working', file, step: 'done' });
        router.push(`/scan/result?${params.toString()}`);
      } catch (error) {
        const messageKey =
          error instanceof ApiRequestError ? error.userMessageKey : 'errors.generic';
        setPhase({ kind: 'error', file, messageKey });
      }
    },
    [docType, feeBdt, priorSalary, router],
  );

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[24px] font-semibold">{t('nav.scan')}</h1>

      {phase.kind === 'idle' ? (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="font-semibold mb-1">{t('scan.doc_type_label')}</legend>
            <div className="flex flex-wrap gap-2">
              {DOC_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={docType === type}
                  onClick={() => setDocType(type)}
                  className={`tap focus-ring rounded-[12px] border px-4 text-[15px] ${
                    docType === type
                      ? 'bg-brand-soft border-brand text-brand font-semibold'
                      : 'bg-surface border-border text-muted'
                  }`}
                >
                  {t(`scan.doc_type.${type}`)}
                </button>
              ))}
            </div>
          </fieldset>

          <UploadDropzone onPicked={handlePicked} />

          <div className="flex flex-col gap-4">
            <NumberField
              labelKey="scan.fee_question"
              value={feeBdt}
              onChange={setFeeBdt}
              hintKey="scan.optional"
            />
            <NumberField
              labelKey="scan.prior_salary_question"
              value={priorSalary}
              onChange={setPriorSalary}
              hintKey="scan.optional"
            />
          </div>
        </>
      ) : null}

      {phase.kind === 'preview' ? (
        <>
          <Preview file={phase.file} />
          <p className="text-muted text-[15px] bg-brand-soft rounded-[12px] px-4 py-3">
            {t('scan.photo_tips')}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-secondary focus-ring flex-1"
              onClick={() => setPhase({ kind: 'idle' })}
            >
              {t('scan.retake')}
            </button>
            <button
              type="button"
              className="btn-primary focus-ring flex-1"
              onClick={() => void handleSubmit(phase.file)}
            >
              {t('scan.confirm')}
            </button>
          </div>
        </>
      ) : null}

      {phase.kind === 'working' ? (
        <>
          <Preview file={phase.file} />
          <ProgressSteps current={phase.step} />
        </>
      ) : null}

      {phase.kind === 'error' ? (
        <>
          <p role="alert" className="text-critical bg-critical-soft rounded-[12px] px-4 py-3">
            {t(phase.messageKey)}
          </p>
          <p className="text-muted text-[15px]">{t('scan.photo_tips')}</p>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-secondary focus-ring flex-1"
              onClick={() => setPhase({ kind: 'idle' })}
            >
              {t('scan.retake')}
            </button>
            <button
              type="button"
              className="btn-primary focus-ring flex-1"
              onClick={() => void handleSubmit(phase.file)}
            >
              {t('common.retry')}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Preview({ file }: { file: PickedFile }) {
  if (file.mimeType === 'application/pdf') {
    return (
      <div className="card p-4 text-muted">
        <p className="font-semibold text-ink">{t('scan.pdf_selected')}</p>
        <p className="text-[15px] break-all">{file.fileName}</p>
      </div>
    );
  }

  return (
    // Not next/image: this is a runtime data URL, and the native build runs with
    // images.unoptimized anyway.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={file.previewUrl}
      alt={t('scan.preview_alt')}
      className="w-full rounded-[12px] border border-border"
    />
  );
}

function NumberField({
  labelKey,
  hintKey,
  value,
  onChange,
}: {
  labelKey: string;
  hintKey: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-semibold">{t(labelKey)}</span>
      <span className="text-muted text-[14px]">{t(hintKey)}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="tap focus-ring card px-3 text-[17px]"
      />
    </label>
  );
}
