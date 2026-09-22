import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSystemOneAnswers } from '../src/answers.js';

test('maps a noul question to {noul, confidence}', () => {
  const questions = { keep: { type: 'noul', instructions: '' } };
  const content = JSON.stringify({ keep: { value: 0.8, certainty: 4 } });
  assert.deepEqual(toSystemOneAnswers(questions, content), { keep: { noul: 0.8, confidence: 0.75 } });
});

test('maps a choice question to {choice, confidence}', () => {
  const questions = { pick: { type: 'choice', instructions: '', criteria: { a: '', b: '' } } };
  const content = JSON.stringify({ pick: { value: 'b', certainty: 1 } });
  assert.deepEqual(toSystemOneAnswers(questions, content), { pick: { choice: 'b', confidence: 0 } });
});

test('maps a score question to {score, confidence}', () => {
  const questions = { rate: { type: 'score', instructions: '' } };
  const content = JSON.stringify({ rate: { value: 0.5, certainty: 3 } });
  assert.deepEqual(toSystemOneAnswers(questions, content), { rate: { score: 0.5, confidence: 0.5 } });
});

test('throws when the model response is missing a question field', () => {
  const questions = { keep: { type: 'noul', instructions: '' } };
  assert.throws(() => toSystemOneAnswers(questions, JSON.stringify({})), /missing fields for question "keep"/);
});

test('throws when the model response is missing the certainty field', () => {
  const questions = { keep: { type: 'noul', instructions: '' } };
  assert.throws(
    () => toSystemOneAnswers(questions, JSON.stringify({ keep: { value: 0.5 } })),
    /missing fields for question "keep"/,
  );
});

test('throws when certainty is out of the 1-5 range', () => {
  const questions = { keep: { type: 'noul', instructions: '' } };
  const content = JSON.stringify({ keep: { value: 0.5, certainty: 9 } });
  assert.throws(() => toSystemOneAnswers(questions, content), /invalid certainty/);
});

test('throws when a noul value is out of the 0-1 range', () => {
  const questions = { keep: { type: 'noul', instructions: '' } };
  const content = JSON.stringify({ keep: { value: 1.5, certainty: 3 } });
  assert.throws(() => toSystemOneAnswers(questions, content), /invalid noul value/);
});

test('throws when a noul value is not a finite number', () => {
  const questions = { keep: { type: 'noul', instructions: '' } };
  const content = JSON.stringify({ keep: { value: null, certainty: 3 } });
  assert.throws(() => toSystemOneAnswers(questions, content), /invalid noul value/);
});

test('throws when a choice value is not one of criteria', () => {
  const questions = { pick: { type: 'choice', instructions: '', criteria: { a: '', b: '' } } };
  const content = JSON.stringify({ pick: { value: 'z', certainty: 3 } });
  assert.throws(() => toSystemOneAnswers(questions, content), /not in criteria/);
});
