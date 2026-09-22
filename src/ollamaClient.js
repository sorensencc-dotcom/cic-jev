import { buildSchema, buildPrompt } from './schema.js';
import { toSystemOneAnswers } from './answers.js';

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/** Throws unless `baseUrl` parses and points at a loopback host (spec §5). */
function assertLoopback(baseUrl) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`invalid ollamaBaseUrl: ${baseUrl}`);
  }
  if (!LOOPBACK_HOSTNAMES.has(parsed.hostname)) {
    throw new Error(`ollamaBaseUrl must be a loopback address, got hostname: ${parsed.hostname}`);
  }
}

/**
 * Calls Ollama's /api/chat with a JSON-schema-constrained format so the whole
 * batch of questions resolves in one request (batching, not raw-logit
 * extraction, is v1's latency lever — see docs/meta/spec-local-jev-engine.md §4).
 * Refuses non-loopback `ollamaBaseUrl` values and follows no redirects, since
 * either could otherwise route model inference off the local machine.
 */
export async function askOllama(state, questions, {
  model,
  ollamaBaseUrl = 'http://127.0.0.1:11434',
  fetchImpl = fetch,
  timeoutMs = 120_000,
  signal,
} = {}) {
  assertLoopback(ollamaBaseUrl);
  const schema = buildSchema(questions);
  const prompt = buildPrompt(state, questions);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`ollama request timed out after ${timeoutMs}ms`)), timeoutMs);
  const onExternalAbort = () => controller.abort(signal?.reason);
  if (signal) signal.addEventListener('abort', onExternalAbort);

  let res;
  try {
    res = await fetchImpl(`${ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        format: schema,
      }),
      redirect: 'error',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ollama HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const body = await res.json();
  return toSystemOneAnswers(questions, body.message.content);
}
