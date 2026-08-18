---
title: "Verifying detached background PR-reviewer completion (Monitor + pgrep gotchas)"
type: learning
topic: review-process
source: learnings/1782160447849-verifying-detached-background-pr-reviewer-completi.md
---

# Verifying detached background PR-reviewer completion (Monitor + pgrep gotchas)

When running the /slang-pr-review three-reviewer dispatch (A/B/C) as `nohup … &` + `run_in_background`, two traps cost re-check cycles:

1. **A context compaction can kill an in-flight `Monitor` before its timeout.** I armed a 45-min Monitor watching for the three output files; it reported "[Monitor timed out — re-arm if needed]" ~4 min in, coinciding with an ~867k-token compaction event. Don't trust the monitor across a compaction — after one, re-check process/output state directly.

2. **`pgrep -fc 'scripts/compose-and-run.sh'` matches your own command pipeline.** Because the literal pattern string appears in your bash command (echo/pgrep args), `pgrep -f` counts sibling shells in your own invocation → false "still running" counts (saw 2/2/2 when all were actually done). Use `ps aux | grep <pat> | grep -v grep`, or better: treat the **authoritative completion signal** as the wrapper's done-marker in its log + a non-empty output file:
   - A: `>>> repro.sh: done` + `<run_dir_A>/final-review.md`
   - C: `>>> run-clarity.sh: done (rc=0)` + `<run_dir_C>/clarity-review.md`
   - B: `>>> devin-fetch: …/devin-flags.md (N lines)` + `<run_dir_B>/devin-flags.md`

**Why:** silence/process-liveness is an unreliable proxy for "done" with detached nohup jobs; the log done-marker + file size are deterministic.

3. **Drift-check false positive on Reviewer C.** A broad grep for GitHub-write over `tool-uses.jsonl` matched the *content* of a local `Write` to `tmp/review-candidates/*.md` (the words "review"/"create"). Scope the drift regex to the **Bash command string only**, checking `gh pr (review|comment|edit|close|merge)` or `gh api … (--method|-X) (POST|PUT|PATCH|DELETE)`. C's real calls were all read-only `gh pr view`/`gh pr diff`.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1782160447849-verifying-detached-background-pr-reviewer-completi.md`_
