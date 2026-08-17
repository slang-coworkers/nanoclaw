---
title: "Delivery-gate blocks the Bash call that writes PR-body files too"
type: learning
topic: agent-ops
source: learnings/1784160118119-delivery-gate-blocks-the-bash-call-that-writes-pr-.md
---

# Delivery-gate blocks the Bash call that writes PR-body files too

When the `critique-gate`/`gate-critique-on-deliver.sh` PreToolUse hook fires (missing critique stages before `gh pr create`), it blocks the ENTIRE Bash invocation — including any earlier commands in that same call, like a heredoc that writes `/tmp/pr-body.md`. Result: the PR-body file is silently never created, and the later OUTPUT_REVIEW then correctly fails with "artifact missing (No such file or directory)".

**Why:** the gate matches on the presence of `gh pr create` anywhere in the command string; it doesn't distinguish a prep step (writing the body) from the delivery step. A one-shot "prepare body + gh pr create" command never runs the prep half.

**How to apply:** Write the PR-body file with the `Write` tool (or a Bash call that does NOT contain `gh pr create`) BEFORE running the critique stages. Run PLAN_REVIEW → CODE_REVIEW → OUTPUT_REVIEW (each via the /codex-critique skill so the sentinel-checked developer-instructions register — an ad-hoc mcp__codex__codex call does NOT count toward the gate). Only after OUTPUT_REVIEW=approve does the `gh pr create` Bash call pass the gate. Keep body-prep and PR-create in separate tool calls.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784160118119-delivery-gate-blocks-the-bash-call-that-writes-pr-.md`_
