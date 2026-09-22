# Resume: cic-jev core build, Codex-executed, Claude-reviewed

**State:** plan done, reviewed twice (caveman-review found 4 real bugs, all fixed in-plan), nothing committed yet. New session starts here.

**Plan:** `docs/superpowers/plans/2026-09-22-local-jev-engine-core.md` (11 tasks)
**Spec:** `docs/meta/spec-local-jev-engine.md`
**Codex consult session (resumable):** `01a0c739-212c-7f83-b050-2e8f881cdd7f` (14 findings, all closed in the plan)

## What's different this session

User wants **Codex** (not Claude subagents) to execute the plan task-by-task, with **Claude reviewing** each task's output before the next one starts. This is not `superpowers:subagent-driven-development` (that dispatches Claude subagents) — it's a manual loop:

1. Read the next unchecked task in the plan.
2. Dispatch it to Codex via the `codex` gstack skill — this needs its own mode, not Consult: Codex has to write files and run commands, not just answer a question. Check the skill for whether Review/Challenge/Consult cover "execute this task" or whether raw `codex exec -C C:\dev\cic-jev -s workspace-write ...` (or similar sandbox flag) piped the task's exact steps via stdin is the right call. Confirm Codex's actual write-access sandbox mode before the first dispatch — don't assume.
3. After Codex reports done, independently verify: run the task's own test command myself, read the diff, check it matches the plan's code exactly (no drift).
4. Caveman-review the diff for bugs before checking off the task and moving to the next one.
5. Commit per the plan's own commit step (or let Codex commit, then verify the commit message/content match).

## Known landmines from this plan (don't let Codex reintroduce them)

- `test/server.test.js`'s "client disconnect before Ollama responds" test must wait for `releaseOllama` to be assigned (i.e. wait for the server to actually reach `askOllama`) before calling `controller.abort()` — calling abort synchronously right after `fetch()` with no await in between races the request off the socket before the server's `'end'` handler ever fires, so `fetchImpl` (and thus `releaseOllama`) never runs and the test fails deterministically with "releaseOllama is not a function", every run, not flaky. Fixed 2026-09-22 (Task 5 follow-up commit `152d8b5`), plan text updated to match.
- `src/answers.js`'s noul/score validation must check `typeof value !== 'number'` **before** the range check — `Number(null) === 0` passes `0 <= 0 <= 1`, so coercing via `Number(entry.value)` first lets a `null` value silently become `0` instead of throwing. Fixed 2026-09-22 (Task 3 follow-up commit `34e5cd6`), plan text updated to match — this was a bug in the plan's own given implementation, not something Codex introduced.
- `package.json`'s `test` script **must** be `node --test test/*.test.js`, never bare `node --test test/` — confirmed live on this machine (Node v24.18.0, Windows), the bare-directory form fails with `MODULE_NOT_FOUND` (Node treats the dir as an entry script, not a test root), even with real test files present. Fixed 2026-09-22 in the Task 1 commit's follow-up fix, plan text updated to match — don't let Codex "clean up" the glob back to a bare directory path.
- `test/server.test.js`'s reserved-id test **must** use `{ ['__proto__']: {...} }`, never a literal `__proto__:` key — literal form sets the prototype instead of an own property and the test silently tests nothing.
- `src/main.js`'s entrypoint guard **must** use `pathToFileURL(process.argv[1]).href`, never `` `file://${process.argv[1]}` `` — the naive form never matches on Windows (this machine, `C:\dev\cic-jev`).
- `src/server.js`'s body-size cap counts **bytes** (`Buffer.concat(chunks)`/`chunk.length`), not JS string `.length`.
- `src/server.js`'s success/error response paths both guard with `if (res.writableEnded || res.destroyed) return;` before `sendJson` — a client disconnect mid-Ollama-call must not throw an uncaught error in the `'end'` handler.

## Next action

Start by reading `docs/superpowers/plans/2026-09-22-local-jev-engine-core.md` Task 1, then figure out the correct Codex dispatch mode for "execute this task's steps and report back" before touching any code.
