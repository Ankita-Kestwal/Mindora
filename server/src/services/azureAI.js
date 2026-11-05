// Microsoft Azure OpenAI (Azure AI Foundry) chat completions.
// Supports both endpoint styles Foundry shows:
//   https://<res>.openai.azure.com/                  → /openai/deployments/<name>/chat/completions?api-version=…
//   https://<res>.openai.azure.com/openai/v1/        → /chat/completions  (model in body)
//   https://<res>.cognitiveservices.azure.com/ and https://<res>.services.ai.azure.com/ (same as the first)
import { env } from '../config/env.js';

const MIN_API_VERSION = '2025-04-01-preview'; // needed for reasoning models such as gpt-5-mini

export function azureConfigured() {
  const a = env.azure;
  return Boolean(a.openaiEndpoint && a.openaiKey && a.openaiDeployment);
}

function buildRequest(messages, { maxTokens, json }) {
  const a = env.azure;
  let base = a.openaiEndpoint.trim().replace(/\/+$/, '');
  // Accept a full "Target URI" pasted from the portal.
  base = base.replace(/\/openai\/deployments\/.*$/i, '').replace(/\/chat\/completions.*$/i, '').replace(/\/models$/i, '');
  const v1 = /\/openai\/v1$/i.test(base);
  const apiVersion = !a.openaiApiVersion || a.openaiApiVersion < '2024-12-01' ? MIN_API_VERSION : a.openaiApiVersion;
  const url = v1
    ? `${base}/chat/completions`
    : `${base}/openai/deployments/${encodeURIComponent(a.openaiDeployment)}/chat/completions?api-version=${apiVersion}`;
  const body = { messages, max_completion_tokens: maxTokens };
  if (v1) body.model = a.openaiDeployment;
  if (json) body.response_format = { type: 'json_object' };
  if (/gpt-5|o\d/i.test(a.openaiDeployment)) body.reasoning_effort = 'low'; // faster + cheaper for study content
  return { url, body };
}

export class AIError extends Error {
  constructor(message, status = 502, code = 'ai/error') { super(message); this.status = status; this.code = code; }
}

/** Removes "thinking" blocks some models (e.g. DeepSeek) include in the answer. */
export function cleanOutput(text) {
  return String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^\s*<think>[\s\S]*$/i, '').trim();
}

export async function chat(messages, { maxTokens = 4000, timeoutMs = 90000, json = false } = {}) {
  if (!azureConfigured()) throw new AIError('Azure OpenAI is not configured. Add AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY and AZURE_OPENAI_DEPLOYMENT to server/.env.', 503, 'ai/not-configured');
  const { url, body } = buildRequest(messages, { maxTokens, json });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': env.azure.openaiKey },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new AIError(e.name === 'AbortError' ? 'Azure OpenAI took too long to respond. Try again.' : `Can’t reach Azure OpenAI (${e.cause?.code || e.message}). Check AZURE_OPENAI_ENDPOINT.`, 504, 'ai/unreachable');
  } finally { clearTimeout(timer); }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || '';
    const code = data?.error?.code || '';
    console.warn('[azure]', res.status, code, msg.slice(0, 300));
    if (res.status === 401 || res.status === 403) throw new AIError('Azure rejected the API key. Check AZURE_OPENAI_API_KEY in server/.env.', 502, 'ai/auth');
    if (res.status === 404) throw new AIError('Azure deployment not found. Check AZURE_OPENAI_DEPLOYMENT and AZURE_OPENAI_ENDPOINT.', 502, 'ai/not-found');
    if (res.status === 429) throw new AIError('Azure OpenAI rate limit reached. Wait a minute and try again.', 429, 'ai/rate-limit');
    if (code === 'content_filter' || /content (management|filter)/i.test(msg)) throw new AIError('This request was blocked by Azure’s content safety filter. Try rephrasing the topic.', 422, 'ai/content-filter');
    throw new AIError(`Azure OpenAI error: ${msg || res.status}`, 502, 'ai/error');
  }
  const choice = data.choices?.[0];
  if (choice?.finish_reason === 'content_filter') throw new AIError('The answer was blocked by Azure’s content safety filter. Try rephrasing.', 422, 'ai/content-filter');
  const text = cleanOutput(choice?.message?.content);
  if (!text) throw new AIError(choice?.finish_reason === 'length' ? 'The answer was cut off before it started. Try a narrower topic.' : 'Azure OpenAI returned an empty answer. Try again.', 502, 'ai/empty');
  return { text, truncated: choice?.finish_reason === 'length', model: data.model || env.azure.openaiDeployment, usage: data.usage || null };
}
