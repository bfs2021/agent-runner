const fs = require('fs');
const { execSync } = require('child_process');

// Safe-by-default command allowlist. Extend deliberately.
const ALLOWED = ['ls', 'cat', 'node', 'python3', 'git', 'wc'];

const tools = {
  read_file: {
    description: 'Read a file from disk',
    run: (args) => fs.readFileSync(args.path, 'utf8'),
  },
  write_file: {
    description: 'Write a file to disk',
    run: (args) => {
      fs.writeFileSync(args.path, args.content);
      return 'wrote ' + args.path;
    },
  },
  run_command: {
    description: 'Run an allowlisted shell command',
    run: (args) => {
      const cmd = String(args.command).split(' ')[0];
      if (ALLOWED.indexOf(cmd) < 0) throw new Error('command not allowed: ' + cmd);
      return execSync(args.command, { encoding: 'utf8', timeout: 10000 });
    },
  },
};

module.exports = { tools, ALLOWED };
