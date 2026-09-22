// scripts/verify-client-compat.mjs
import { JevClient } from 'fast-jev-compaction';
import { createServer } from '../src/server.js';

const server = createServer({ model: process.env.JEV_MODEL ?? 'qwen2.5:7b' });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

const client = new JevClient({
  apiKey: 'unused', // cic-jev does not check the Authorization header
  baseUrl: `http://127.0.0.1:${port}/v1/systemone`,
});

try {
  const result = await client.ask(
    { tool_output: 'ran `npm test`, all green' },
    { keep: { type: 'noul', instructions: 'Is this tool output strictly necessary to resolve the current goal?' } },
  );

  console.log(JSON.stringify(result, null, 2));

  const noul = result.answers?.keep?.noul;
  if (typeof noul !== 'number' || Number.isNaN(noul) || noul < 0 || noul > 1) {
    console.error('FAIL: expected a numeric answers.keep.noul in [0,1] from JevClient.ask()');
    process.exitCode = 1;
  } else {
    console.log('OK: fast-jev-compaction JevClient interoperates with the local cic-jev server against a real Ollama call (see test/clientCompat.test.js for automated noul/choice/score/error coverage against a mock)');
  }
} finally {
  server.close();
}
