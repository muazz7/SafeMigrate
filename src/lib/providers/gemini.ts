import {
  ExtractionError,
  extractJsonObject,
  parseExtraction,
  scoreConfidence,
  type ExtractionInput,
  type ExtractionOutput,
  type ExtractionProvider,
} from '@/lib/extract';
import { buildExtractionPrompt, buildRepairPrompt } from '@/lib/prompt';

/**
 * Gemini extraction provider — BUILD-SPEC §7.1.
 *
 * Plain REST, no SDK: the stack in §3 is fixed and one more dependency in the
 * bundle is not worth saving twenty lines here.
 *
 * Retry policy (§7.1): exactly one repair attempt on malformed JSON, never more
 * than two calls total. The caller turns a second failure into a partial
 * extraction with confidence 0, which the UI shows as a retake-photo state.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Overridable so a cheaper or newer model can be swapped in without a code change. */
const DEFAULT_MODEL = 'gemini-2.0-flash';

const TIMEOUT_MS = 18_000; // Under the 20s end-to-end ceiling in §2.

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

async function callGemini(
  apiKey: string,
  model: string,
  parts: GeminiPart[],
): Promise<{ text: string; raw: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          // Deterministic: the same page must extract the same way every time, or
          // the deterministic rules engine downstream is built on sand.
          temperature: 0,
          responseMimeType: 'application/json',
          maxOutputTokens: 2048,
        },
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ExtractionError('TIMEOUT', `Gemini did not respond within ${TIMEOUT_MS}ms`);
    }
    throw new ExtractionError('NETWORK', error instanceof Error ? error.message : 'fetch failed');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // Body may carry the document; log the status only, never the response text (§16.2).
    throw new ExtractionError('HTTP', `Gemini returned ${response.status}`);
  }

  const raw = (await response.json()) as GeminiResponse;

  if (raw.promptFeedback?.blockReason) {
    throw new ExtractionError('BLOCKED', `Gemini blocked the request: ${raw.promptFeedback.blockReason}`);
  }

  const text = raw.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text.trim()) {
    throw new ExtractionError('EMPTY', 'Gemini returned no text');
  }

  return { text, raw };
}

export function geminiProvider(): ExtractionProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;

  if (!apiKey) {
    throw new ExtractionError('NO_API_KEY', 'GEMINI_API_KEY is not set');
  }

  return {
    name: `gemini:${model}`,

    async extract(input: ExtractionInput): Promise<ExtractionOutput> {
      const documentPart: GeminiPart = {
        inline_data: { mime_type: input.mimeType, data: input.fileBase64 },
      };

      const first = await callGemini(apiKey, model, [
        { text: buildExtractionPrompt(input.docType) },
        documentPart,
      ]);

      try {
        const parsed = parseExtraction(extractJsonObject(first.text));
        return { raw: first.raw, parsed, confidence: scoreConfidence(parsed) };
      } catch (error) {
        if (!(error instanceof ExtractionError)) throw error;

        // One repair attempt, then give up (§7.1).
        console.warn(`[gemini] first response unusable (${error.code}), retrying once`);

        const second = await callGemini(apiKey, model, [
          { text: buildExtractionPrompt(input.docType) },
          documentPart,
          { text: buildRepairPrompt(first.text, error.message) },
        ]);

        const parsed = parseExtraction(extractJsonObject(second.text));
        return { raw: second.raw, parsed, confidence: scoreConfidence(parsed) };
      }
    },
  };
}
