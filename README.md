# agent-runner

A minimal autonomous agent runtime. A pluggable LLM drives a
plan → act → observe → reflect loop against a small, safe-by-default tool
registry (read_file, write_file, and an allowlisted command runner: argv only,
no shell, flags declared per command, paths confined to the working directory).

This is the furthest point of the arc: taking everything learned across the
other repos — small surfaces, explicit state, verification — and using it to
orchestrate an agent that writes and runs its own code inside a sandbox.

Swap the mock LLM for a real client to go live. Defaults matter: step caps,
a command allowlist, and a full transcript on every run.
