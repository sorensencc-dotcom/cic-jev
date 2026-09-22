/**
 * Maps Ollama's structured-output JSON (one `{ value, certainty }` object
 * per question) into the TypeSafe System One answer shape, validating every
 * field — the JSON Schema sent to Ollama is a hint, not a runtime guarantee,
 * so a model that ignores it (out-of-range numbers, an invalid choice, a
 * non-integer certainty) must not silently produce a fabricated answer.
 * `confidence` is `(certainty - 1) / 4`, a self-reported heuristic — not a
 * calibrated probability. See docs/meta/spec-local-jev-engine.md §2.3.
 */
export function toSystemOneAnswers(questions, content) {
  const parsed = JSON.parse(content);
  const answers = {};
  for (const [id, q] of Object.entries(questions)) {
    const entry = parsed[id];
    if (!entry || typeof entry !== 'object' || entry.value === undefined || entry.certainty === undefined) {
      throw new Error(`model response missing fields for question "${id}"`);
    }
    const certainty = Number(entry.certainty);
    if (!Number.isInteger(certainty) || certainty < 1 || certainty > 5) {
      throw new Error(`model response has invalid certainty for question "${id}": ${entry.certainty}`);
    }
    const confidence = (certainty - 1) / 4;

    if (q.type === 'noul' || q.type === 'score') {
      const value = entry.value;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`model response has invalid ${q.type} value for question "${id}": ${entry.value}`);
      }
      answers[id] = q.type === 'noul' ? { noul: value, confidence } : { score: value, confidence };
    } else if (q.type === 'choice') {
      const choice = String(entry.value);
      if (!Object.prototype.hasOwnProperty.call(q.criteria, choice)) {
        throw new Error(`model response chose a value not in criteria for question "${id}": ${entry.value}`);
      }
      answers[id] = { choice, confidence };
    } else {
      throw new Error(`unknown question type for "${id}": ${q.type}`);
    }
  }
  return answers;
}
