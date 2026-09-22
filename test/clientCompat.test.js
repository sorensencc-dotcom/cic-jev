import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JevClient } from 'fast-jev-compaction';
import { createServer } from '../src/server.js';

async function withClient(fetchImpl, fn) {
  const server = createServer({ model: 'qwen2.5:7b', ollamaBaseUrl: 'http://127.0.0.1:11434', fetchImpl });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const client = new JevClient({ apiKey: 'unused', baseUrl: `http://127.0.0.1:${port}/v1/systemone` });
  try {
    await fn(client);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('JevClient.ask() parses a noul answer', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ message: { content: JSON.stringify({ keep: { value: 0.9, certainty: 5 } }) } }) });
  await withClient(fetchImpl, async (client) => {
    const result = await client.ask({}, { keep: { type: 'noul', instructions: 'x' } });
    assert.deepEqual(result.answers.keep, { noul: 0.9, confidence: 1 });
  });
});

test('JevClient.ask() parses a choice answer', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ message: { content: JSON.stringify({ pick: { value: 'a', certainty: 3 } }) } }) });
  await withClient(fetchImpl, async (client) => {
    const result = await client.ask({}, { pick: { type: 'choice', instructions: 'x', criteria: { a: '', b: '' } } });
    assert.deepEqual(result.answers.pick, { choice: 'a', confidence: 0.5 });
  });
});

test('JevClient.ask() parses a score answer', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ message: { content: JSON.stringify({ rate: { value: 0.25, certainty: 2 } }) } }) });
  await withClient(fetchImpl, async (client) => {
    const result = await client.ask({}, { rate: { type: 'score', instructions: 'x' } });
    assert.deepEqual(result.answers.rate, { score: 0.25, confidence: 0.25 });
  });
});

test('JevClient.ask() throws when the server returns an error status', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, text: async () => 'boom' });
  await withClient(fetchImpl, async (client) => {
    await assert.rejects(() => client.ask({}, { keep: { type: 'noul', instructions: 'x' } }), /Jev request failed/);
  });
});
