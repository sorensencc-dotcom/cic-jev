import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function withServer(fetchImpl, fn) {
  const server = createServer({ model: 'qwen2.5:7b', ollamaBaseUrl: 'http://127.0.0.1:11434', fetchImpl });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('POST /v1/systemone returns answers matching the System One shape and a heuristic-labeled meta', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ message: { content: JSON.stringify({ keep: { value: 0.7, certainty: 3 } }) } }),
  });
  await withServer(fetchImpl, async (base) => {
    const res = await fetch(`${base}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'jev-latest',
        state: { goal: 'x' },
        questions: { keep: { type: 'noul', instructions: 'needed?' } },
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.answers, { keep: { noul: 0.7, confidence: 0.5 } });
    assert.equal(body.meta.confidenceMethod, 'self-reported-heuristic');
  });
});

test('the client-supplied model field is never sent to Ollama', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push(JSON.parse(opts.body));
    return { ok: true, json: async () => ({ message: { content: JSON.stringify({ keep: { value: 0.1, certainty: 1 } }) } }) };
  };
  await withServer(fetchImpl, async (base) => {
    await fetch(`${base}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'jev-latest',
        state: {},
        questions: { keep: { type: 'noul', instructions: '' } },
      }),
    });
  });
  assert.equal(calls[0].model, 'qwen2.5:7b');
});

test('POST /v1/systemone returns 400 when questions is missing', async () => {
  await withServer(async () => ({}), async (base) => {
    const res = await fetch(`${base}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: {} }),
    });
    assert.equal(res.status, 400);
  });
});

test('POST /v1/systemone returns 400 on malformed JSON body', async () => {
  await withServer(async () => ({}), async (base) => {
    const res = await fetch(`${base}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    assert.equal(res.status, 400);
  });
});

test('POST /v1/systemone returns 400 when the body is valid JSON but not an object', async () => {
  await withServer(async () => ({}), async (base) => {
    const res = await fetch(`${base}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'null',
    });
    assert.equal(res.status, 400);
  });
});

test('POST /v1/systemone returns 400 when questions is an array', async () => {
  await withServer(async () => ({}), async (base) => {
    const res = await fetch(`${base}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: {}, questions: [] }),
    });
    assert.equal(res.status, 400);
  });
});

test('POST /v1/systemone returns 400 for a reserved question id, without calling Ollama', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  await withServer(fetchImpl, async (base) => {
    // Bracket notation is required here: a literal `{ __proto__: ... }` key
    // sets the object's prototype instead of creating an own property, so
    // JSON.stringify would silently drop it and this test would pass for the
    // wrong reason (empty questions, not the reserved-id path).
    const res = await fetch(`${base}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: {}, questions: { ['__proto__']: { type: 'noul', instructions: '' } } }),
    });
    assert.equal(res.status, 400);
  });
  assert.equal(called, false);
});

test('POST /v1/systemone returns 400 when question count exceeds the limit, without calling Ollama', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  const questions = {};
  for (let i = 0; i < 21; i++) questions[`q${i}`] = { type: 'noul', instructions: '' };
  await withServer(fetchImpl, async (base) => {
    const res = await fetch(`${base}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: {}, questions }),
    });
    assert.equal(res.status, 400);
  });
  assert.equal(called, false);
});

test('POST /v1/systemone returns 413 when the body exceeds the size limit', async () => {
  await withServer(async () => ({}), async (base) => {
    const res = await fetch(`${base}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: {}, questions: { keep: { type: 'noul', instructions: 'x'.repeat(100_000) } } }),
    });
    assert.equal(res.status, 413);
  });
});

test('POST /v1/systemone returns 502 when Ollama fails', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, text: async () => 'boom' });
  await withServer(fetchImpl, async (base) => {
    const res = await fetch(`${base}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: {}, questions: { keep: { type: 'noul', instructions: '' } } }),
    });
    assert.equal(res.status, 502);
  });
});

test('unknown route returns 404', async () => {
  await withServer(async () => ({}), async (base) => {
    const res = await fetch(`${base}/nope`);
    assert.equal(res.status, 404);
  });
});

test('a client disconnect before Ollama responds does not crash the server', async () => {
  let releaseOllama;
  const fetchImpl = () => new Promise((resolve) => { releaseOllama = resolve; });
  const server = createServer({ model: 'qwen2.5:7b', ollamaBaseUrl: 'http://127.0.0.1:11434', fetchImpl });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const controller = new AbortController();
    const pending = fetch(`http://127.0.0.1:${port}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: {}, questions: { keep: { type: 'noul', instructions: '' } } }),
      signal: controller.signal,
    }).catch(() => {}); // client-side abort rejects this fetch; the assertion is that the server survives
    controller.abort();
    await pending;
    releaseOllama({ ok: true, json: async () => ({ message: { content: JSON.stringify({ keep: { value: 0.5, certainty: 3 } }) } }) });
    await new Promise((resolve) => setImmediate(resolve));
    // If the server's post-abort write path threw inside the 'end' handler's
    // async function, that becomes an unhandled rejection that fails this
    // test file under node:test; reaching this line means it didn't.
    const health = await fetch(`http://127.0.0.1:${port}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: {}, questions: {} }),
    });
    assert.equal(health.status, 400); // server still routes and validates normally after the disconnect
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
