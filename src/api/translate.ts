export const RENDER_BACKEND_API_URL = 'https://femmeflo-inventory.onrender.com/api/v1';

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || RENDER_BACKEND_API_URL
).trim().replace(/\/+$/, '');

export interface TranslateFeedbackResponse {
  translatedText: string;
  originalText: string;
  provider?: string;
}

export interface TranslateOptions {
  sourceLang?: 'hi-IN' | 'en-IN' | 'auto';
  targetLang?: string;
  timeoutMs?: number;
  retries?: number;
}

/**
 * Resolves the translation endpoint URL.
 * Checks for explicit environment override, website URL, or resolves relative to the Render backend.
 */
export function getTranslationEndpointUrl(): string {
  // 1. Explicit environment variable override
  if (process.env.EXPO_PUBLIC_TRANSLATE_URL) {
    return process.env.EXPO_PUBLIC_TRANSLATE_URL;
  }

  // 2. Explicit website URL
  if (process.env.EXPO_PUBLIC_WEBSITE_URL) {
    const base = process.env.EXPO_PUBLIC_WEBSITE_URL.replace(/\/+$/, '');
    return `${base}/api/translate`;
  }

  // 3. Fallback to production Render backend translate route
  try {
    const url = new URL(API_BASE_URL);
    return `${url.origin}/api/translate`;
  } catch {
    // If API_BASE_URL is relative or not a full URL
  }

  return 'https://femmeflo-inventory.onrender.com/api/translate';
}

/**
 * Client-side fallback translation using Google Translate public endpoint.
 * Ensures field sellers are never blocked even when the translation server is offline.
 */
async function clientFallbackTranslate(
  text: string,
  sourceLang = 'auto',
  targetLang = 'en'
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      sourceLang
    )}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(trimmed)}`;

    const res = await fetch(url, { signal: controller.signal });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const parts = data[0].map((part: any) => part?.[0] || '').filter(Boolean);
        if (parts.length > 0) {
          return parts.join('').trim();
        }
      }
    }
  } catch (err) {
    console.warn('[translateApi] Client fallback translate error', err);
  } finally {
    clearTimeout(timeoutId);
  }

  return trimmed;
}

/**
 * Translates spoken Hindi, Hinglish, or regional field feedback into professional English.
 * Submits to the server-side Next.js /api/translate endpoint with retries and resilient fallback.
 */
export async function translateHindiOrHinglishToEnglish(
  text: string,
  options?: TranslateOptions
): Promise<TranslateFeedbackResponse> {
  const rawText = (text || '').trim();

  // 1. Validation: Return empty immediately for empty or whitespace text
  if (!rawText) {
    return {
      translatedText: '',
      originalText: '',
      provider: 'none',
    };
  }

  const timeoutMs = options?.timeoutMs ?? 6000;
  const maxRetries = options?.retries ?? 1;
  const endpoint = getTranslationEndpointUrl();

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ text: rawText }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        return {
          translatedText: data.translatedText || rawText,
          originalText: rawText,
          provider: data.provider || 'server-mistral',
        };
      }

      throw new Error(`Server returned HTTP ${res.status}`);
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;
      attempt++;
      if (attempt <= maxRetries) {
        // Backoff delay before retry
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
  }

  console.warn('[translateApi] Server translation unavailable, engaging client fallback:', lastError?.message);

  // 2. Resilient Fallback: Use client fallback translation or preserve verbatim input
  try {
    const fallbackTranslation = await clientFallbackTranslate(rawText, 'auto', 'en');
    return {
      translatedText: fallbackTranslation || rawText,
      originalText: rawText,
      provider: 'client-fallback',
    };
  } catch {
    return {
      translatedText: rawText,
      originalText: rawText,
      provider: 'verbatim-fallback',
    };
  }
}
