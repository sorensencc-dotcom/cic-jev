import { createServer as createHttpServer } from 'node:http';
import { askOllama } from './ollamaClient.js';
import { RESERVED_QUESTION_IDS } from './schema.js';

const MAX_BODY_BYTES = 65_536;
const MAX_QUESTIONS = 20;
const ALLOWED_TYPES = new Set(['noul', 'choice', 'score']);

/** Validates the parsed request body. Returns an error string, or null if valid. */
function validationError(parsed) {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return 'body must be a JSON object';
  }
  const { state, questions } = parsed;
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return 'missing or invalid state';
  }
  if (!questions || typeof questions !== 'object' || Array.isArray(questions)) {
    return 'missing or invalid questions';
  }
  const ids = Object.keys(questions);
  if (ids.length === 0) return 'questions must have at least one entry';
  if (ids.length > MAX_QUESTIONS) return `questions exceeds the limit of ${MAX_QUESTIONS}`;
  for (const id of ids) {
    if (RESERVED_QUESTION_IDS.has(id)) return `reserved question id: ${id}`;
    const q = questions[id];
    if (!q || typeof q !== 'object') return `question "${id}" must be an object`;
    if (!ALLOWED_TYPES.has(q.type)) return `question "${id}" has an unknown type`;
    if (typeof q.instructions !== 'string') return `question "${id}" is missing instructions`;
    if (q.type === 'choice' && (!q.criteria || typeof q.criteria !== 'object' || Array.isArray(q.criteria) || Object.keys(q.criteria).length === 0)) {
      return `question "${id}" requires non-empty criteria`;
    }
  }
  return null;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Creates (but does not start) the cic-jev HTTP server. Call `.listen(port, '127.0.0.1')` on the result. */
export function createServer({ model, ollamaBaseUrl, fetchImpl } = {}) {
  return createHttpServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/systemone') {
      sendJson(res, 404, { error: 'not found' });
      return;
    }

    const controller = new AbortController();
    res.on('close', () => controller.abort());

    const chunks = [];
    let bodyBytes = 0;
    let tooLarge = false;
    req.on('data', (chunk) => {
      if (tooLarge) return;
      bodyBytes += chunk.length;
      if (bodyBytes > MAX_BODY_BYTES) {
        tooLarge = true;
        sendJson(res, 413, { error: 'request body too large' });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', async () => {
      if (tooLarge) return;
      let parsed;
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        sendJson(res, 400, { error: 'malformed JSON' });
        return;
      }
      const error = validationError(parsed);
      if (error) {
        sendJson(res, 400, { error });
        return;
      }
      // The client's `model` field is the Jev model id (e.g. "jev-latest"),
      // never the Ollama model to run — the server's own `model` option is
      // the only thing ever sent to Ollama (Global Constraints).
      try {
        const answers = await askOllama(parsed.state, parsed.questions, {
          model,
          ollamaBaseUrl,
          fetchImpl,
          signal: controller.signal,
        });
        // A client disconnect between the askOllama call and here aborts the
        // signal above via the `res.on('close', ...)` listener, but `res` is
        // already gone by the time askOllama resolves or rejects — writing
        // to it would throw an uncaught error in this async handler.
        // `writableEnded` covers our own res.end() already having run;
        // `destroyed` covers the socket dying out from under us (the client
        // disconnect case this guard exists for).
        if (res.writableEnded || res.destroyed) return;
        sendJson(res, 200, { answers, meta: { confidenceMethod: 'self-reported-heuristic', model } });
      } catch (err) {
        if (res.writableEnded || res.destroyed) return;
        sendJson(res, 502, { error: String(err.message ?? err) });
      }
    });
  });
}
