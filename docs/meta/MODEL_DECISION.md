<!-- docs/meta/MODEL_DECISION.md -->
# Model decision: v1 uses an installed instruct model, not a purpose-built Jev model

**Decided:** 2026-09-22

Community "System One" models referenced in the original design draft were
checked against Ollama in Task 1 (see `docs/meta/MODEL_RESEARCH.md` for the
exact `ollama pull` output this decision is based on):

- `Verdict` (ModernBERT 151M) — excluded without a pull attempt: encoder-only
  architecture, not a causal-LM chat model, cannot run against Ollama's
  `/api/chat` regardless of packaging (see spec §4, non-goals).
- `NanoJev` (Qwen3-0.6B) and `decider` (Qwen3.5-2B) — pull results: both
  `ollama pull` attempts failed with `pulling manifest / Error: pull model
  manifest: file does not exist`.

v1 uses `qwen2.5:7b`, already installed locally, addressed via
schema-constrained `/api/chat` calls (Task 4/5). This is a stock instruct
model, not one trained for calibrated decisions — confidence is a
self-reported 1-5 certainty heuristic (spec §2.3), not the RLCD-trained
calibration TypeSafe's actual System One models use.

**Confidence heuristic validation (Task 8):** eval-set accuracy observed:
7/10 = 0.70 on one run and 8/10 = 0.80 on a separate run. The result is
right at/above the 0.7 threshold, non-deterministic run to run, and OK both
times.

**Observed latency (Task 9):** not separately timed in seconds by name; the
plan places typical warm latency around ~1.8s and cold latency around ~15s on
this machine. A real Ollama call answered all three question types (noul/choice/score)
in one request, values in range, confirmed twice (once by an earlier run and
once independently re-verified).

**Follow-up, not part of this plan:**
- If `NanoJev`/`decider` do turn out to be Ollama-pullable, benchmark against
  `qwen2.5:7b` for latency and answer quality before switching.
- If Task 8's eval accuracy is below threshold, this engine's `confidence`
  field must not be used as a gating signal in any future shell-safety-gate
  or similar integration until a passing eval run exists (spec §4 non-goals).
