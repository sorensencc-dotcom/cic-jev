import { readFile } from 'node:fs/promises';
import { createServer } from '../src/server.js';

const ACCURACY_THRESHOLD = 0.7; // fraction of items within tolerance / matching expected choice
const CALIBRATION_THRESHOLD = 0.5; // correlation floor between certainty and correctness

const cases = JSON.parse(await readFile(new URL('../docs/meta/confidence-eval-set.json', import.meta.url)));

const server = createServer({ model: process.env.JEV_MODEL ?? 'qwen2.5:7b' });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

let correct = 0;
const rows = [];
try {
  for (const c of cases) {
    const res = await fetch(`${base}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'jev-latest', state: c.state, questions: { q: c.question } }),
    });
    if (res.status !== 200) {
      rows.push({ ...c, error: `HTTP ${res.status}` });
      continue;
    }
    const { answers } = await res.json();
    const answer = answers.q;
    let isCorrect;
    if ('expectedNoul' in c) isCorrect = Math.abs(answer.noul - c.expectedNoul) <= c.tolerance;
    else if ('expectedScore' in c) isCorrect = Math.abs(answer.score - c.expectedScore) <= c.tolerance;
    else isCorrect = answer.choice === c.expectedChoice;
    if (isCorrect) correct++;
    rows.push({ ...c, answer, isCorrect });
  }
} finally {
  server.close();
}

const accuracy = correct / cases.length;
console.log(JSON.stringify(rows, null, 2));
console.log(`\nAccuracy: ${correct}/${cases.length} = ${accuracy.toFixed(2)} (threshold: ${ACCURACY_THRESHOLD})`);

if (accuracy < ACCURACY_THRESHOLD) {
  console.error(`FAIL: accuracy ${accuracy.toFixed(2)} below threshold ${ACCURACY_THRESHOLD} — the confidence heuristic is not validated. Do not treat this engine's confidence field as safety-grade until this passes.`);
  process.exitCode = 1;
} else {
  console.log(`OK: accuracy meets the ${ACCURACY_THRESHOLD} threshold on this ${cases.length}-item set. This is a floor for "not obviously broken," not a calibration guarantee — see docs/meta/spec-local-jev-engine.md §2.3 before any safety-grade use.`);
}
