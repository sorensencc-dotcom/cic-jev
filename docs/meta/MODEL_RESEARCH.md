<!-- docs/meta/MODEL_RESEARCH.md -->
# Model research: community Jev candidates vs. Ollama

**Checked:** 2026-09-22

- `Verdict` (ModernBERT 151M) — excluded without a pull attempt: encoder-only
  architecture, not a causal-LM chat model, cannot run against Ollama's
  `/api/chat` regardless of packaging.
- `NanoJev` (Qwen3-0.6B) — `ollama pull nanojev` result:
  ```text
  pulling manifest
  Error: pull model manifest: file does not exist
  ```
- `decider` (Qwen3.5-2B) — `ollama pull decider` result:
  ```text
  pulling manifest
  Error: pull model manifest: file does not exist
  ```

Conclusion: both community model pull attempts failed with `pull model manifest: file does not exist`, so v1 falls back to a stock instruct model.
