import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/main.js';

test('resolveConfig reads model, port, and base URL from env with defaults', () => {
  const config = resolveConfig({});
  assert.equal(config.model, 'qwen2.5:7b');
  assert.equal(config.port, 4173);
  assert.equal(config.ollamaBaseUrl, 'http://127.0.0.1:11434');
});

test('resolveConfig honors JEV_MODEL, JEV_PORT, JEV_OLLAMA_BASE_URL overrides', () => {
  const config = resolveConfig({ JEV_MODEL: 'other-model', JEV_PORT: '9999', JEV_OLLAMA_BASE_URL: 'http://127.0.0.1:22222' });
  assert.equal(config.model, 'other-model');
  assert.equal(config.port, 9999);
  assert.equal(config.ollamaBaseUrl, 'http://127.0.0.1:22222');
});

test('resolveConfig throws on a non-numeric JEV_PORT', () => {
  assert.throws(() => resolveConfig({ JEV_PORT: 'not-a-number' }), /JEV_PORT must be a number/);
});
