// scripts/smoke-test.mjs
import { createServer } from '../src/server.js';

const server = createServer({ model: process.env.JEV_MODEL ?? 'qwen2.5:7b' });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

try {
  const res = await fetch(`${base}/v1/systemone`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'jev-latest',
      state: {
        goal: 'trim an over-long tool result before it re-enters context',
        tool_output: 'ran `git diff`, 400 lines, unrelated to the current task',
      },
      questions: {
        keep: {
          type: 'noul',
          instructions: 'Is this tool output strictly necessary to resolve the current goal?',
        },
        severity: {
          type: 'choice',
          instructions: 'How severe would dropping this output be?',
          criteria: { low: 'minor', high: 'major' },
        },
        relevance: {
          type: 'score',
          instructions: 'Rate relevance to the goal, 0.0 lowest to 1.0 highest',
        },
      },
    }),
  });

  if (res.status !== 200) {
    console.error(`FAIL: expected 200, got ${res.status}: ${await res.text()}`);
    process.exitCode = 1;
  } else {
    const body = await res.json();
    console.log(JSON.stringify(body, null, 2));
    const { answers } = body;
    const checks = [
      typeof answers.keep?.noul === 'number' && answers.keep.noul >= 0 && answers.keep.noul <= 1,
      ['low', 'high'].includes(answers.severity?.choice),
      typeof answers.relevance?.score === 'number' && answers.relevance.score >= 0 && answers.relevance.score <= 1,
    ];
    if (!checks.every(Boolean)) {
      console.error(`FAIL: answers did not match expected shapes/ranges: ${JSON.stringify(answers)}`);
      process.exitCode = 1;
    } else {
      console.log('OK: real Ollama call answered all three question types in one request, values in range');
    }
  }
} finally {
  server.close();
}
