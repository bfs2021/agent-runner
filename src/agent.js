const { tools } = require('./tools');

function parseAction(text) {
  const idx = text.indexOf(' ');
  if (idx < 0) return null;
  const name = text.slice(0, idx).trim();
  const rest = text.slice(idx + 1).trim();
  if (!tools[name]) return null;
  try { return { name, args: JSON.parse(rest) }; }
  catch (e) { return null; }
}

// plan -> act -> observe -> reflect, with a hard step cap and a transcript.
async function runAgent(task, llm, opts) {
  opts = opts || {};
  const maxSteps = opts.maxSteps || 10;
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
