# Compactor plugin wiring — exploration (parked)

**Status:** parked, 2026-09-23. Not approved to build. Written up so it isn't
re-discovered from scratch later.

## Context

Handoff `docs/superpowers/HANDOFF-2026-09-22.md` deferred-follow-up #2:
"`fast-jev-compaction` compactor plugin wiring — NOT STARTED. Point the
existing published compactor at this engine via `baseUrl` instead of cloud
Jev. Mechanically simple (client already proven interoperable, Task 6/11)
but still needs a spec for which repo/tool actually uses the compactor and
how `baseUrl` gets configured there."

## What was checked (2026-09-23)

- `fast-jev-compaction` npm package (v0.4.0, installed in `cic-jev/node_modules`)
  ships `dist/`, `README.md`, `LICENSE` only (`package.json` `"files"` field) —
  no `hooks/` or `.claude-plugin/`. The Claude Code plugin half of the repo
  (the part that would actually replace live compaction) is NOT in the npm
  tarball; it only exists in the package's GitHub source.
- Searched `~/.claude` for any existing install of this plugin: 0 hits. Not
  installed as a Claude Code plugin anywhere on this machine.
- Library API: `compactMessages(transcript, options)` — `options.baseUrl` /
  `options.apiKey` flow straight into an internal `JevClient` (same class
  `scripts/verify-client-compat.mjs` already exercises directly). Wiring
  `baseUrl: 'http://127.0.0.1:4173/v1/systemone'` in is one line; that part
  really is mechanically simple, as the handoff said.
- No consumer exists yet. This isn't "small task, just do it" — it's
  "greenfield decision: does anything on this machine want Jev-scored
  compaction, and if so, at what risk."

## Options considered

1. **Library-level demo script only** (e.g. `scripts/verify-compactor.mjs` in
   `cic-jev`, proving `compactMessages()` round-trips a real transcript
   through the local server). Bounded, zero blast radius, but low marginal
   value — Task 6/11 already proved interop at the `JevClient.ask()` layer;
   `compactMessages` is a thin wrapper over the same client. Would mostly be
   restating a fact already established.

2. **Install as a real Claude Code plugin**, replacing this machine's actual
   Claude Code compaction with Jev-scored verbatim-keep/drop, pointed at the
   local `cic-jev` server (no TypeSafe/OpenRouter key needed). Only option
   with real day-to-day value. Real costs: npm tarball excludes the plugin
   source, so this means cloning the actual GitHub repo (fork vs. upstream
   decision) and reading the hook code before it touches live compaction;
   the confidence heuristic is explicitly `self-reported-heuristic`, not
   calibrated (spec §2.3) — a bad call here silently degrades real session
   history, which is a worse failure mode than the already-deferred
   shell-safety-gate use case; and every future compaction would depend on
   local Ollama being up — a hang/outage stalls Claude Code sessions absent
   a fallback path. This is architectural-path work (new live dependency,
   unvalidated-heuristic risk to real session data), not bounded.

3. **Wire into a specific repo's own pipeline** (toolforge, kb-sync, etc.).
   No candidate identified — no repo currently does lossy LLM-summary
   compaction where verbatim-drop would visibly help. Speculative until a
   real pain point shows up.

## Recommendation (not yet acted on)

Skip 1 (redundant, low value) and 3 (no consumer, speculative) for now. If
this gets picked back up, go straight to option 2, scoped tight: clone the
plugin's hook source, read it, decide fork vs. upstream, write a real spec
covering the unvalidated-confidence-heuristic risk and the Ollama-outage
fallback — before wiring anything into live compaction.

## Decision

Parked 2026-09-23 — pausing here, no build decision made. Re-open this note
if/when someone wants to pick option 2 back up.
