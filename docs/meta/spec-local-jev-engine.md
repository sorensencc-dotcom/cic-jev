# Spec: Local Jev-Engine Core (`cic-jev`)

**Status:** Approved for v1 planning
**Repo:** `C:\dev\cic-jev` (standalone, own remote `sorensencc-dotcom/cic-jev`)

## 1. Origin and scope correction

This reimplements the public interface concept from TypeSafe's Jev
(https://typesafe.ai/blog/introducing-system-one-models-and-jev) and observed
behavior of the open-source `jev-guard` / `fast-jev-compaction` clients
(https://jevai.dev/projects/), not their code or weights. No source, prompts,
or weights are copied. If this ever ships outside internal use, rename
`evaluateSystemOne` / `Noul` naming before external release (trademark risk).

Original internal draft assumed integration points (`modules/cache/vector-store.mjs`,
`triageGapAgainstCache()`) that do not exist in `toolforge` as checked
2026-09-21 — kb-sync's real structure is `toolforge/kb-sync/`, shape unconfirmed.
**v1 builds the standalone engine only.** Downstream integrations (RAG chunk
filter, tool-call compactor, shell safety gate) are separate follow-up specs,
each written after grepping the real integration site in its own repo.

## 2. What v1 delivers

A local HTTP service (`cic-jev`) that:

1. Accepts the same request/response contract as TypeSafe's System One API
   (confirmed from `fast-jev-compaction`'s client source,
   https://github.com/tamaratran/fast-jev-compaction/blob/main/src/request.ts):

   Request: `POST /v1/systemone`
   ```json
   { "model": "jev-latest", "state": {}, "questions": { "<id>": { "type": "noul|choice|score", "instructions": "..." } } }
   ```

   Response:
   ```json
   { "answers": { "<id>": { "noul": 0.0, "choice": "id", "score": 0.0, "confidence": 0.0 } } }
   ```

   The response may include additional top-level fields alongside `answers`
   (e.g. `meta`) — confirmed safe against the real client: `fast-jev-compaction`'s
   `parseJevResponse` (`src/request.ts`) only checks that an `answers` object is
   present; it does not reject unknown top-level keys.

2. Answers `noul` (binary probability), `choice` (pick from `criteria` keys),
   and `score` (ordinal float 0-1) questions by calling a local model over
   Ollama's HTTP API (`127.0.0.1:11434`).

3. Runs a **confidence heuristic**, not a calibrated probability — the base
   model is not trained for calibration (real TypeSafe System One models use
   proprietary RLCD training + parallel sampling per the blog post; this
   engine does not reproduce that training). Confidence is computed, labeled
   `self-reported-heuristic` in the response's `meta` field (§2.1), and
   validated in v1 itself against a small hand-labeled eval set with defined
   acceptance criteria (plan Task 8) — not deferred to a future integration.
   `jev-calibrate` (https://github.com/smkrv/jev-calibrate) is a reference for
   eval methodology, not a required dependency; v1's own eval script does not
   need to run against it.

4. Depends on an existing, unmodified client library rather than a new one:
   `fast-jev-compaction@0.4.0` (MIT, zero deps, published to npm, confirmed
   2026-09-21) exports `JevClient` from its package root with `baseUrl` as a
   first-class constructor option (`src/client.ts:10` in source, compiled to
   `dist/client.js`). v1 adds it as a normal `dependencies` entry and imports
   `JevClient` directly — no vendoring, no reimplementation of the HTTP
   client. Only the server side (Task 2-7 below) is new work.

## 3. Model selection (research spike, Task 1)

Candidates from the Jev community list (https://jevai.dev/projects/), not
yet confirmed runnable via Ollama:

- `Verdict` (ModernBERT 151M) — https://github.com/Heman10x-NGU/Verdict-open-jev
- `NanoJev` (Qwen3-0.6B) — https://github.com/TianyuCodings/NanoJev
- `decider` (Qwen3.5-2B) — https://github.com/Mapika/decider

Task 1 determines which (if any) ship as an Ollama-pullable GGUF vs. requiring
a separate HuggingFace `transformers` runtime (ModernBERT encoder models are
not causal-LM chat models and will not run in Ollama's `/api/generate` at
all — this must be checked, not assumed). If none run locally without a new
runtime, v1 falls back to prompting a stock instruct model already resident
in Ollama (e.g. whatever `ollama list` shows installed) via structured
`format` output, with confidence explicitly labeled heuristic-only in code
comments and API response.

## 4. Non-goals for v1

- No llama.cpp/vLLM raw-logit extraction path (original spec's "Path A").
  Adds a second inference backend before the single Ollama path is proven.
  Revisit only if measured Ollama latency is a proven bottleneck.
- No shell safety gate / `jev-guard` fork. Deferred until Task 5's
  calibration harness has real numbers — gating agent shell commands on an
  unvalidated heuristic is a safety regression, not a feature.
- No compactor plugin wiring. `fast-jev-compaction` already exists and works
  against cloud Jev; pointing it at this engine via `baseUrl` is a follow-up
  task once the engine is running, not part of core build.

## 5. Global constraints

- Node.js (matches vendored client's TypeScript/ESM target).
- No network calls outside `127.0.0.1` in the server's model-inference path —
  data sovereignty is the whole point of this project.
- Vendored third-party code keeps its original license file and is not
  modified beyond what's needed to compile against this repo's tooling.
