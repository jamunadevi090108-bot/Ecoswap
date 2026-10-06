const DEFAULT_MODEL = 'gemini-3.8-flash';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

class GeminiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'GeminiError';
    this.statusCode = statusCode;
  }
}

function getApiKey() {
  const apiKey = String(process.env.AI_API_KEY || '').trim();
  if (!apiKey || /your_ai_api_key|placeholder|replace_me/i.test(apiKey)) {
    throw new GeminiError('The AI assistant is not configured yet. Add a Google Gemini API key as AI_API_KEY in backend/.env, then restart the backend.', 503);
  }
  return apiKey;
}

function normalizeHistory(history) {
  return (Array.isArray(history) ? history : [])
    .filter((item) => (item?.role === 'user' || item?.role === 'assistant') && typeof item.content === 'string')
    .slice(-10)
    .map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content.trim().slice(0, 1000) }]
    }))
    .filter((item) => item.parts[0].text);
}

async function generateAnswer(message, history = []) {
  const apiKey = getApiKey();
  const model = String(process.env.AI_MODEL || DEFAULT_MODEL).trim();
  if (!/^[A-Za-z0-9._-]+$/.test(model)) {
    throw new GeminiError('AI_MODEL contains an invalid model name. Update it in backend/.env.', 503);
  }

  const contents = normalizeHistory(history);
  contents.push({ role: 'user', parts: [{ text: message.trim() }] });

  let response;
  try {
    response = await fetch(`${API_URL}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: 'You are EcoSwap Assistant, a friendly and practical guide for a second-hand clothing marketplace. Answer the user’s actual question directly, in clear concise language. Help with clothing care, sustainable fashion, using EcoSwap, buying, selling, donating, exchanges, and recycling. Do not claim you completed actions, processed payments, or checked live inventory unless that data is explicitly supplied. Never invent listings, prices, seller details, policies, or medical/safety guarantees. If information is missing, say so and ask one useful follow-up question. Use the conversation history to understand follow-up questions.'
          }]
        },
        contents,
        generationConfig: { temperature: 0.5, maxOutputTokens: 700 }
      }),
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    const networkCode = error?.cause?.code;
    console.error(`[Gemini] Request failed before receiving an API response${networkCode ? ` (${networkCode})` : ''}.`);
    throw new GeminiError('The EcoSwap backend could not reach Google Gemini. Check backend internet access and try again.', 502);
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const providerCode = result?.error?.status;
    console.error(`[Gemini] API request failed with HTTP ${response.status}${providerCode ? ` (${providerCode})` : ''}.`);
    if (response.status === 401 || response.status === 403) {
      throw new GeminiError('Google Gemini rejected the configured API key. Check AI_API_KEY and enable the Gemini API for that key.', 503);
    }
    if (response.status === 429) {
      throw new GeminiError('The AI assistant has reached the Gemini API quota. Check the Google AI Studio project quota and try again later.', 503);
    }
    if (response.status === 400 && providerCode === 'INVALID_ARGUMENT') {
      throw new GeminiError('Gemini could not process this request. Check the AI_MODEL setting and try a shorter message.', 502);
    }
    if (response.status === 404) {
      throw new GeminiError('The configured Gemini model was not found. Check the AI_MODEL setting in backend/.env.', 503);
    }
    throw new GeminiError('Google Gemini is temporarily unavailable. Please try again shortly.', 502);
  }

  const answer = result?.candidates?.[0]?.content?.parts
    ?.map((part) => typeof part.text === 'string' ? part.text.trim() : '')
    .filter(Boolean)
    .join('\n')
    .trim();
  if (!answer) {
    throw new GeminiError('The AI assistant could not produce a reply. Please rephrase your question and try again.', 502);
  }
  return answer.slice(0, 6000);
}

module.exports = { generateAnswer, GeminiError };
