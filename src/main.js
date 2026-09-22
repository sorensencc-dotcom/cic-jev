import { pathToFileURL } from 'node:url';
import { createServer } from './server.js';

const DEFAULT_MODEL = 'qwen2.5:7b';
const DEFAULT_PORT = 4173;
const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

/** Reads and validates config from an env-like object. Exported for testing. */
export function resolveConfig(env) {
  const model = env.JEV_MODEL ?? DEFAULT_MODEL;
  const ollamaBaseUrl = env.JEV_OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL;
  let port = DEFAULT_PORT;
  if (env.JEV_PORT !== undefined) {
    port = Number(env.JEV_PORT);
    if (!Number.isInteger(port)) throw new Error(`JEV_PORT must be a number, got: ${env.JEV_PORT}`);
  }
  return { model, port, ollamaBaseUrl };
}

/* c8 ignore start -- process wiring, exercised manually via `npm start`, not by node:test */
// `pathToFileURL(...).href` (not a raw `file://${...}` template) is required
// on Windows: process.argv[1] uses backslashes and no percent-encoding
// (e.g. "C:\dev\cic-jev\src\main.js"), while import.meta.url is a proper
// file:// URL with forward slashes (e.g. "file:///C:/dev/cic-jev/src/main.js").
// The naive template comparison never matches on Windows, so this entrypoint
// guard would silently never fire and `npm start` would do nothing.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = resolveConfig(process.env);
  const server = createServer(config);
  server.on('error', (err) => {
    console.error(`cic-jev failed to start: ${err.message}`);
    process.exitCode = 1;
  });
  server.listen(config.port, '127.0.0.1', () => {
    console.log(`cic-jev listening on http://127.0.0.1:${config.port} (model: ${config.model}, ollama: ${config.ollamaBaseUrl})`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      console.log(`cic-jev received ${signal}, shutting down`);
      server.close(() => process.exit(0));
    });
  }
}
/* c8 ignore stop */
