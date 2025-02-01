const { runAgent } = require('./agent');

// A deterministic mock LLM so the loop runs offline. Swap for a real client.
const mockLlm = {
  complete: async (prompt) => {
    if (prompt.indexOf('run_command') >= 0 && prompt.indexOf('Observation') < 0) {
      return 'run_command {"command": "ls -1"}';
    }
    if (prompt.indexOf('Observation:') >= 0) {
      return 'DONE';
    }
    return 'read_file {"path": "README.md"}';
  },
};

const task = process.argv[2] || 'List the files in this project';
runAgent(task, mockLlm).then((result) => {
  console.log(JSON.stringify({ done: result.done, steps: result.steps,
    transcript: result.transcript.map((t) => t.tool || t.role) }, null, 2));
});
