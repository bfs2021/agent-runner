const test = require('node:test');
const assert = require('node:assert');
const { tools } = require('../src/tools');

const run = (command) => tools.run_command.run({ command });

test('refuses shell chaining and substitution', () => {
  assert.throws(() => run('ls; cat /etc/passwd'), /shell syntax is not supported: ;/);
  assert.throws(() => run('ls && cat /etc/passwd'), /shell syntax is not supported/);
  assert.throws(() => run('cat package.json | wc -l'), /shell syntax is not supported/);
  assert.throws(() => run('ls $(id)'), /shell syntax is not supported/);
  assert.throws(() => run('ls \`id\`'), /shell syntax is not supported/);
  assert.throws(() => run('cat package.json > out.txt'), /shell syntax is not supported/);
});

test('refuses interpreters that execute arbitrary code', () => {
  assert.throws(() => run('node -e "require(\'fs\')"'), /command not allowed: node/);
  assert.throws(() => run('python3 -c "print(1)"'), /command not allowed: python3/);
});

test('refuses flags that turn an allowlisted binary into a launcher', () => {
  assert.throws(() => run('git -c core.pager=cat log'), /git: subcommand not allowed/);
  assert.throws(() => run('git log --exec-path=/tmp'), /argument not allowed/);
  assert.throws(() => run('cat -n package.json'), /cat: argument not allowed: -n/);
  assert.throws(() => run('ls --color=always'), /ls: argument not allowed/);
});

test('refuses paths outside the working directory', () => {
  assert.throws(() => run('cat /etc/passwd'), /path escapes the working directory/);
  assert.throws(() => run('cat ../../etc/passwd'), /path escapes the working directory/);
});

test('still runs allowlisted commands', () => {
  assert.match(run('ls -1'), /package\.json/);
  assert.match(run('wc -l package.json'), /^\s*\d+/);
  assert.match(run('git status --short'), /^/);
  assert.match(run('cat "package.json"'), /agent-runner/);
});

test('refuses git operands that point outside the working directory', () => {
  assert.throws(() => run('git status /etc/passwd'), /path escapes the working directory/);
  assert.throws(() => run('git diff ../../outside'), /path escapes the working directory/);
  assert.match(run('git show HEAD:README.md'), /agent-runner/);
});

test('refuses control characters in place of argument separators', () => {
  assert.throws(() => run('ls\ncat package.json'), /invalid character in command/);
  assert.throws(() => run('cat "line\nfeed"'), /invalid character in command/);
});

test('refuses a symlink that points outside the working directory', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-runner-'));
  const work = path.join(dir, 'work');
  fs.mkdirSync(work);
  fs.writeFileSync(path.join(dir, 'secret.txt'), 'outside');
  fs.writeFileSync(path.join(work, 'inside.txt'), 'inside');
  fs.symlinkSync(path.join(dir, 'secret.txt'), path.join(work, 'link.txt'));
  const cwd = process.cwd();
  process.chdir(work);
  try {
    assert.throws(() => run('cat link.txt'), /path escapes the working directory/);
    assert.equal(run('cat inside.txt'), 'inside');
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

