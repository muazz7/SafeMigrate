import { randomUUID } from 'node:crypto';
import { errorWithCors, jsonWithCors, preflight } from '@/lib/cors';
import { DOCUMENTS_BUCKET, getServerSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { emptyContract, type ExtractedContract } from '@/lib/schema';
import { ExtractionError, getProvider } from '@/lib/extract';
import { DOC_TYPES, type DocType, type ExtractResponse } from '@/types';

/**
 * POST /api/extract — BUILD-SPEC §7.4.
 *
 * DAY 2: persistence is real (Storage + documents row); the extraction itself is a
 * hardcoded fixture. Day 3 replaces `stubExtraction()` with the provider call.
 *
 * This route lives only on Vercel. The APK calls it cross-origin from
 * capacitor://localhost, which is why every response carries CORS headers (§4.1).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;

const ACCEPTED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export async function OPTIONS(request: Request): Promise<Response> {
  return preflight(request);
}

export async function POST(request: Request): Promise<Response> {
  // --- session ---------------------------------------------------------------
  const sessionId = request.headers.get('x-session-id');
  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
    return errorWithCors(request, 'MISSING_SESSION', 'errors.generic', 400);
  }

  // --- input -----------------------------------------------------------------
  let form: FormData;
  try {
    form = await request.formData();
  } catch (error) {
    return errorWithCors(request, 'BAD_REQUEST', 'errors.generic', 400, error);
  }

  const file = form.get('file');
  const docTypeRaw = String(form.get('docType') ?? 'contract');

  if (!(file instanceof File)) {
    return errorWithCors(request, 'NO_FILE', 'errors.generic', 400);
  }
  if (!ACCEPTED_MIME.has(file.type)) {
    return errorWithCors(request, 'UNSUPPORTED_TYPE', 'errors.unsupported_type', 415);
  }
  if (file.size > MAX_BYTES) {
    return errorWithCors(request, 'FILE_TOO_LARGE', 'errors.file_too_large', 413);
  }

  const docType: DocType = DOC_TYPES.includes(docTypeRaw as DocType)
    ? (docTypeRaw as DocType)
    : 'contract';

  // Never log document content — field names and counts only (§16.2).
  console.info(
    `[extract] session=${sessionId.slice(0, 8)}… type=${docType} mime=${file.type} bytes=${file.size}`,
  );

  // --- persist ---------------------------------------------------------------
  // Supabase being unreachable must not block the scan: the user still gets their
  // report, they just do not get a saved copy (§15).
  let documentId = randomUUID();
  let persisted = false;

  const supabase = isSupabaseConfigured() ? getServerSupabase() : null;

  if (supabase) {
    try {
      // The session row is created on first use; ignore a duplicate on repeat scans.
      await supabase.from('sessions').upsert({ id: sessionId }, { onConflict: 'id' });

      const extension = EXTENSION[file.type] ?? 'bin';
      const storagePath = `${sessionId}/${documentId}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(storagePath, await file.arrayBuffer(), {
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: inserted, error: insertError } = await supabase
        .from('documents')
        .insert({
          id: documentId,
          session_id: sessionId,
          storage_path: storagePath,
          mime_type: file.type,
          doc_type: docType,
          original_filename: file.name || null,
        })
        .select('id')
        .single();
      if (insertError) throw insertError;

      documentId = inserted.id;
      persisted = true;
    } catch (error) {
      // Degrade to local-only rather than failing the user's scan.
      console.error('[extract] persistence failed, continuing local-only:', error);
    }
  }

  // --- extract ---------------------------------------------------------------
  // Falls back to the fixture when no provider is configured, so the whole
  // pipeline stays exercisable before the API key and samples/ arrive.
  let parsed: ExtractedContract;
  let confidence: number;
  let providerName = 'stub';
  let raw: unknown = null;

  if (process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY) {
    try {
      const provider = await getProvider();
      providerName = provider.name;

      const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
      const result = await provider.extract({
        fileBase64: base64,
        mimeType: file.type,
        docType,
      });

      parsed = result.parsed;
      confidence = result.confidence;
      raw = result.raw;
    } catch (error) {
      const code = error instanceof ExtractionError ? error.code : 'EXTRACTION_FAILED';
      console.error(`[extract] provider failed (${code})`);

      // Two attempts have already been made inside the provider (§7.1). Return a
      // partial extraction with confidence 0; the UI shows the retake-photo state.
      if (code === 'TIMEOUT' || code === 'NETWORK') {
        return errorWithCors(request, code, 'errors.network', 504);
      }
      parsed = emptyContract();
      confidence = 0;
    }
  } else {
    parsed = stubExtraction(docType);
    confidence = 0.82;
  }

  // --- persist the extraction ------------------------------------------------
  const extractionId = randomUUID();

  if (supabase && persisted) {
    try {
      await supabase.from('extractions').insert({
        id: extractionId,
        document_id: documentId,
        provider: providerName,
        raw_response: raw ?? {},
        parsed,
        confidence,
        language_detected: parsed.document_language,
      });
    } catch (error) {
      console.error('[extract] could not persist extraction:', error);
    }
  }

  const response: ExtractResponse & { persisted: boolean } = {
    documentId,
    extractionId,
    parsed,
    confidence,
    persisted,
  };

  // Field names and counts only, never values (§16.2).
  console.info(
    `[extract] provider=${providerName} confidence=${confidence} fields=${
      Object.values(parsed).filter((v) => v !== null).length
    }`,
  );

  return jsonWithCors(request, response);
}

/**
 * A deterministic fixture standing in for the model until Day 3.
 *
 * Deliberately shaped like a genuinely bad contract so the Day 4 rules engine has
 * something to fire on: passport held with NO written return guarantee (R01
 * critical, not the I02 safekeeping note), a fee far above the Malaysia ceiling,
 * no return ticket, and vague employer details.
 */
function stubExtraction(docType: DocType): ExtractedContract {
  return {
    ...emptyContract(),
    document_language: 'en',
    document_type_detected: docType === 'contract' ? 'contract' : 'other',

    employer_name: 'STUB Employer Sdn Bhd',
    employer_specific: false,
    workplace_country: 'Malaysia',
    workplace_country_code: 'MY',
    job_title: 'General Worker',
    job_title_specific: false,

    salary_amount: 1200,
    salary_currency: 'MYR',
    salary_period: 'month',

    contract_duration_months: 24,
    probation_months: 6,
    probation_salary_reduced: true,

    working_hours_per_day: 10,
    working_days_per_week: 6,
    weekly_rest_days: 0,
    overtime_rate_defined: false,

    accommodation_provided_by_employer: true,
    food_provided_by_employer: false,
    ticket_outbound_paid_by_employer: true,
    ticket_return_paid_by_employer: null,

    // R01 branch 1: custody transferred, no written guarantee of return.
    passport_held_by_employer: true,
    passport_return_on_request_guaranteed: null,
    passport_holding_at_worker_request: null,

    worker_may_resign: false,
    exit_permit_required: true,

    recruitment_cost_deducted_from_salary: true,

    agency_name: 'STUB Active Recruiting Agency Ltd.',
    agency_rl_number: '0000001',
    total_fee_demanded_bdt: 380000,

    quoted_clauses: {
      R01: 'The Employer shall retain the passport of the Employee for the duration of the contract.',
      R05: 'Recruitment expenses shall be recovered from the monthly salary of the Employee.',
      R08: 'The Employee may not terminate this contract before completion of the term.',
      R09: 'Outbound air ticket shall be borne by the Employer.',
      R10: 'Working hours shall be ten (10) hours per day, six (6) days per week.',
    },
    extraction_notes: 'STUB — fixture data, replaced by the real provider on Day 3.',
  };
}
