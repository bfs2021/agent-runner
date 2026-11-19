// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Marcus Beauregard

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Safe-by-default command allowlist. Extend deliberately.
//
// Every command runs as an argv array with no shell, so metacharacters, globs,
// pipes, redirections and substitutions are refused instead of interpreted.
// Each entry also declares the exact flags it accepts, which keeps an
// allowlisted binary from becoming a launcher: `node -e`, `python3 -c` and
// `git -c core.pager=...` all execute arbitrary code without ever needing a
// shell, so they are simply not allowed.
const POLICY = {
  ls: { flags: ['-1', '-a', '-A', '-l', '-h', '-la', '-al', '-lah'] },
  cat: { flags: [] },
  wc: { flags: ['-l', '-w', '-c', '-m'] },
  git: {
    subcommands: {
      status: ['--short', '--porcelain', '-s'],
      log: ['--oneline', '--stat', '--decorate', '-n', '--max-count'],
      diff: ['--stat', '--name-only', '--cached'],
      show: ['--stat', '--oneline'],
    },
  },
};

const ALLOWED = Object.keys(POLICY);

const SHELL_CHARS = ';&|<>$`*?()[]{}~!\\';

// Split a command line into argv without invoking a shell. Quoting groups
// arguments; anything a shell would interpret is rejected with a clear error
// rather than silently becoming part of a filename.
function tokenize(command) {
  const tokens = [];
  let current = '';
  let quote = null;
  let started = false;
  for (const ch of String(command)) {
    if (ch === '\0' || ch === '\n' || ch === '\r') {
      throw new Error('invalid character in command');
    }
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (/\s/.test(ch)) {
      if (started) { tokens.push(current); current = ''; started = false; }
    } else if (SHELL_CHARS.indexOf(ch) >= 0) {
      throw new Error('shell syntax is not supported: ' + ch);
    } else {
      current += ch;
      started = true;
    }
  }
  if (quote) throw new Error('unterminated quote in command');
  if (started) tokens.push(current);
  return tokens;
}

function checkFlag(bin, flags, arg) {
  const eq = arg.indexOf('=');
  const name = eq < 0 ? arg : arg.slice(0, eq);
  if (flags.indexOf(name) < 0) throw new Error(bin + ': argument not allowed: ' + arg);
  if (eq >= 0 && !/^[A-Za-z0-9._-]+$/.test(arg.slice(eq + 1))) {
    throw new Error(bin + ': argument not allowed: ' + arg);
  }
}

function escapes(arg, resolved, root) {
  if (resolved !== root && resolved.indexOf(root + path.sep) !== 0) {
    throw new Error('path escapes the working directory: ' + arg);
  }
}

// Lexical checks catch the obvious escapes; resolving the deepest existing
// ancestor catches the ones a symlink would otherwise smuggle in. This guards
// against a model naming the wrong path — it is not a sandbox against a
// concurrent local writer, since Node cannot hand execFileSync an already-open
// descriptor and a symlink swapped after this check still wins the race.
function checkPath(arg) {
  if (arg.startsWith('/') || arg.split(/[\\/]/).indexOf('..') >= 0) {
    throw new Error('path escapes the working directory: ' + arg);
  }
  const root = fs.realpathSync(process.cwd());
  let probe = path.resolve(root, arg);
  const missing = [];
  for (;;) {
    let real;
    try {
      real = fs.realpathSync(probe);
    } catch (e) {
      if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw e;
      const parent = path.dirname(probe);
      if (parent === probe) throw new Error('path cannot be resolved: ' + arg);
      missing.unshift(path.basename(probe));
      probe = parent;
      continue;
    }
    escapes(arg, path.join(real, ...missing), root);
    return;
  }
}

// Validate a command line and return the argv to execute.
function parseCommand(command) {
  const argv = tokenize(command);
  if (!argv.length) throw new Error('empty command');
  const bin = argv[0];
  const policy = POLICY[bin];
  if (!policy) throw new Error('command not allowed: ' + bin);
  const args = argv.slice(1);
  let flags = policy.flags || [];
  if (policy.subcommands) {
    if (!policy.subcommands[args[0]]) {
      throw new Error('git: subcommand not allowed: ' + (args[0] || '(none)'));
    }
    flags = policy.subcommands[args[0]];
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('-')) {
      checkFlag(bin, flags, arg);
    } else if (policy.subcommands) {
      // args[0] is the subcommand; later non-flag operands are paths, except
      // rev:path forms, which name objects inside the repository.
      if (i > 0 && arg.indexOf(':') < 0) checkPath(arg);
    } else {
      checkPath(arg);
    }
  }
  return argv;
}

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
    description: 'Run an allowlisted command (no shell, paths inside the working directory)',
    run: (args) => {
      const argv = parseCommand(args.command);
      return execFileSync(argv[0], argv.slice(1), {
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });
    },
  },
};

module.exports = { tools, ALLOWED, parseCommand };
