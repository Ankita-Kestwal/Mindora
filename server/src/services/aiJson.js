// Ask Azure OpenAI for JSON and parse it robustly.
import { chat, AIError } from './azureAI.js';

export function parseJson(text) {
  const t = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(t); } catch { /* try to find the object */ }
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* give up */ } }
  return null;
}

export async function chatJson(messages, opts = {}) {
  const r = await chat(messages, { ...opts, json: true });
  const data = parseJson(r.text);
  if (!data) throw new AIError('The AI response could not be understood. Please try again.', 502, 'ai/bad-json');
  return { data, model: r.model, truncated: r.truncated };
}

/** Validates and cleans MCQ questions from the model. */
export function cleanQuestions(raw, max = 30) {
  const list = Array.isArray(raw?.questions) ? raw.questions : [];
  return list.map((q) => {
    const options = (Array.isArray(q?.options) ? q.options : []).map((o) => String(o).trim().slice(0, 300)).filter(Boolean).slice(0, 4);
    const answer = Number.isInteger(q?.answer) ? q.answer : options.findIndex((o) => o === String(q?.answer).trim());
    return {
      question: String(q?.question || '').trim().slice(0, 1000),
      options,
      answer,
      explanation: String(q?.explanation || '').trim().slice(0, 1200),
      topic: String(q?.topic || '').trim().slice(0, 120),
    };
  }).filter((q) => q.question && q.options.length === 4 && q.answer >= 0 && q.answer < 4).slice(0, max);
}

export const MCQ_FORMAT = 'Return ONLY JSON: {"questions":[{"question":string,"options":[4 strings],"answer":index 0-3,"explanation":string,"topic":string}]}. Exactly one correct option. Options must be plausible and distinct. Explanations: 1–3 sentences. Use plain text (no Markdown) in questions and options.';
