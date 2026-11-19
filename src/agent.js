// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Marcus Beauregard

const { tools } = require('./tools');

function parseAction(text) {
  const line = String(text || '').trim();
  if (!line) return null;
  // A bare tool name (no space, no args) is a valid call: default args to {}.
  const idx = line.search(/\s/);
  const name = idx < 0 ? line : line.slice(0, idx).trim();
  const rest = idx < 0 ? '' : line.slice(idx + 1).trim();
  if (!tools[name]) return null;
  if (!rest) return { name, args: {} };
  try { return { name, args: JSON.parse(rest) }; }
  catch (e) { return null; }
}

// plan -> act -> observe -> reflect, with a hard step cap and a transcript.
async function runAgent(task, llm, opts) {
  opts = opts || {};
  const requested = opts.maxSteps;
  const maxSteps = Number.isInteger(requested) && requested > 0 ? requested : 10;
  const transcript = [];
  let prompt = [
    'You are an autonomous agent completing a task.',
    'Available tools: ' + Object.keys(tools).join(', '),
    'Each turn reply with exactly ONE line:',
    '  tool_name {"arg": "value"}',
    'or reply DONE when finished.',
    'Task: ' + task,
  ].join('\n');

  for (let step = 0; step < maxSteps; step++) {
    const reply = await llm.complete(prompt);
    transcript.push({ role: 'assistant', text: reply });
    if (/^DONE/i.test(reply.trim())) {
      return { done: true, steps: step + 1, transcript };
    }
    const action = parseAction(reply);
    if (!action) {
      prompt += '\n(Invalid action. Use tool_name {"arg":"value"} or DONE.)';
      continue;
    }
    let observation;
    try {
      observation = String(tools[action.name].run(action.args));
    } catch (e) {
      observation = 'ERROR: ' + e.message;
    }
    transcript.push({ role: 'tool', tool: action.name, observation });
    prompt += '\nObservation: ' + observation;
  }
  return { done: false, steps: maxSteps, transcript };
}

module.exports = { runAgent, parseAction };
