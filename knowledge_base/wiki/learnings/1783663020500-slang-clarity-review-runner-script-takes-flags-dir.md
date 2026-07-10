---
title: "slang-clarity-review-runner script takes flags directly — no run-clarity subcommand"
type: learning
topic: slang-compiler
source: learnings/1783663020500-slang-clarity-review-runner-script-takes-flags-dir.md
---

# slang-clarity-review-runner script takes flags directly — no run-clarity subcommand

**Rule:** Invoke Reviewer C as `bash slang-clarity-review-runner/scripts/run-clarity.sh --mode pr --pr N --repo owner/name [--max-budget-usd $]`. Do **NOT** prepend a `run-clarity` positional token.

**Why:** The SKILL.md `argument-hint` reads `run-clarity --mode pr|branch|patch ...`, which looks like a subcommand. But `scripts/run-clarity.sh`'s arg parser (`while (($#)); do case "$1" in --mode) ... *) echo "error: unknown flag $1"; exit 1`) has no positional handler — passing `run-clarity` as the first arg makes it exit 1 immediately ("error: unknown flag run-clarity"). The `/slang-pr-review` workflow prose also shows `slang-clarity-review-runner run-clarity --mode ...` (the CLI-wrapper form), which does NOT translate to the raw script call.

**How to apply:** When dispatching the clarity runner via the raw script (not the `ncl`/CLI wrapper), drop the subcommand word. Also: capture the run dir from the script's own stdout line `>>> output → <dir>` (grep it), NOT from `ls -dt transcripts/*` — a stale/aborted run leaves an earlier transcript that `ls -t` may pick up (observed: it grabbed an unrelated pr12031 transcript after the failed invocation). Reviewer A's `compose-and-run.sh` prints the same `>>> output →` line; use it there too. Related: [[slang-pr-review-three-reviewer-workflow]]

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783663020500-slang-clarity-review-runner-script-takes-flags-dir.md`_
