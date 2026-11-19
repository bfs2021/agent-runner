const test = require('node:test');
const assert = require('node:assert');
const { runAgent } = require('../src/agent');

// A mock LLM that never says DONE, so the loop always consumes its full step budget.
function countingLlm() {
  let calls = 0;
  return {
    complete: async () => { calls++; return 'not a valid action'; },
    get calls() { return calls; },
  };
}

test('valid positive integer maxSteps is honoured', async () => {
  const llm = countingLlm();
  const result = await runAgent('task', llm, { maxSteps: 3 });
  assert.equal(result.steps, 3);
  assert.equal(llm.calls, 3);
});

test('omitted maxSteps falls back to 10', async () => {
  const llm = countingLlm();
  const result = await runAgent('task', llm, {});
  assert.equal(result.steps, 10);
  assert.equal(llm.calls, 10);
});

test('zero maxSteps falls back to 10', async () => {
  const llm = countingLlm();
  const result = await runAgent('task', llm, { maxSteps: 0 });
  assert.equal(result.steps, 10);
  assert.equal(llm.calls, 10);
});

test('negative maxSteps falls back to 10', async () => {
  const llm = countingLlm();
  const result = await runAgent('task', llm, { maxSteps: -1 });
  assert.equal(result.steps, 10);
  assert.equal(llm.calls, 10);
});

test('non-numeric maxSteps falls back to 10', async () => {
  const llm = countingLlm();
  const result = await runAgent('task', llm, { maxSteps: 'abc' });
  assert.equal(result.steps, 10);
  assert.equal(llm.calls, 10);
});

test('fractional maxSteps falls back to 10', async () => {
  const llm = countingLlm();
  const result = await runAgent('task', llm, { maxSteps: 2.5 });
  assert.equal(result.steps, 10);
  assert.equal(llm.calls, 10);
});

test('numeric-string maxSteps falls back to 10', async () => {
  const llm = countingLlm();
  const result = await runAgent('task', llm, { maxSteps: '5' });
  assert.equal(result.steps, 10);
  assert.equal(llm.calls, 10);
});

test('NaN maxSteps falls back to 10', async () => {
  const llm = countingLlm();
  const result = await runAgent('task', llm, { maxSteps: NaN });
  assert.equal(result.steps, 10);
  assert.equal(llm.calls, 10);
});
