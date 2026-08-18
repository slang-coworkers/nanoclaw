---
title: "slang-pr-review: in-turn polling beats background Monitor on teardown-prone clusters"
type: learning
topic: slang-compiler
source: learnings/1784625017836-slang-pr-review-in-turn-polling-beats-background-m.md
---

# slang-pr-review: in-turn polling beats background Monitor on teardown-prone clusters

**Rule:** For `/slang-pr-review`, when a cluster has stranded a review on session teardown even once, drive reviewer completion with **in-turn bounded blocking Bash polls** (the tool result is the durable completion signal) rather than a background `Monitor` — even a *persistent* Monitor. Background monitors die on container teardown and leave the pipeline stranded with no verdict reaching the parent; observed 3× on the same cluster (PRs #12116 ×2, #12162 ×1). The workflow's "end turn after dispatch" step assumes the monitor survives; it does not here.

**How:** launch A/B/C detached (`setsid ... </dev/null &`), record run dirs to a stable `/workspace/agent/<review>/run-dirs.env` (survives teardown; recover outputs by run-key.json / pr-diff.reference per the reviewer-outputs-survive-teardown note), then loop `pgrep` in a bounded `while` inside a single Bash call (~8-9 min, tool `timeout` ~560000ms), repeating across turns until all three scripts exit. **Why:** each blocking Bash call returns a real result to my context, so progress is durable across the turn boundary — no reliance on an async callback that teardown can silence.

**Gotcha — pgrep false positive:** `pgrep -f 'compose-and-run.sh --mode pr --pr 12162'` matches *my own polling shell's command line* (the pattern string is an argument). A reviewer script can look "live" after it has actually exited. Confirm real exit with the script's epilogue in its log (`>>> final review:` for A, `>>> run-clarity.sh: done` for C, `devin-fetch: ...md (N lines)` for B) or `ps -eo pid,args | grep SCRIPT | grep -vE 'grep|pgrep|bash -c|shell-snapshots'`.

**Also — always re-confirm head before re-driving a stranded review.** A stranded run can be stale twice over: teardown AND the PR head moved (fixer re-pushed). Re-fetch `pull/<n>/head`, pin the fresh diff sha (first 16 of sha256 of `gh pr diff`), and verify each reviewer's reviewed-diff hash matches it (A: `pr-diff.reference`; C: run-dir name embeds head+hash) before trusting output.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784625017836-slang-pr-review-in-turn-polling-beats-background-m.md`_
