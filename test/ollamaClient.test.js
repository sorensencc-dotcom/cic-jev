import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askOllama } from '../src/ollamaClient.js';

test('askOllama posts a schema-constrained request and parses the answers', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      json: async () => ({ message: { content: JSON.stringify({ keep: { value: 0.9, certainty: 5 } }) } }),
    };
  };
  const answers = await askOllama(
    { goal: 'x' },
    { keep: { type: 'noul', instructions: 'needed?' } },
    { model: 'qwen2.5:7b', ollamaBaseUrl: 'http://127.0.0.1:11434', fetchImpl },
  );
  assert.deepEqual(answers, { keep: { noul: 0.9, confidence: 1 } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://127.0.0.1:11434/api/chat');
  assert.equal(calls[0].opts.redirect, 'error');
  const body = JSON.parse(calls[0].opts.body);
  assert.equal(body.model, 'qwen2.5:7b');
  assert.equal(body.stream, false);
  assert.equal(body.format.properties.keep.type, 'object');
});

test('askOllama throws on a non-ok response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, text: async () => 'boom' });
  await assert.rejects(
    () => askOllama({}, { keep: { type: 'noul', instructions: '' } }, { model: 'x', fetchImpl }),
    /ollama HTTP 500/,
  );
});

test('askOllama rejects a non-loopback ollamaBaseUrl', async () => {
  await assert.rejects(
    () => askOllama({}, { keep: { type: 'noul', instructions: '' } }, {
      model: 'x',
      ollamaBaseUrl: 'http://example.com:11434',
      fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
    }),
    /loopback/,
  );
});

test('askOllama rejects a malformed ollamaBaseUrl', async () => {
  await assert.rejects(
    () => askOllama({}, { keep: { type: 'noul', instructions: '' } }, {
      model: 'x',
      ollamaBaseUrl: 'not a url',
      fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
    }),
    /invalid ollamaBaseUrl/,
  );
});

test('askOllama aborts the fetch when timeoutMs elapses', async () => {
  const fetchImpl = (url, opts) => new Promise((resolve, reject) => {
    opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  await assert.rejects(
    () => askOllama({}, { keep: { type: 'noul', instructions: '' } }, { model: 'x', fetchImpl, timeoutMs: 10 }),
    /aborted/,
  );
});
