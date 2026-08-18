---
title: "Reviewer-A guard can be false in BOTH directions — recover from stream.jsonl, and never merge A's clarity candidates as Reviewer C"
type: learning
topic: review-process
source: learnings/1786044602672-reviewer-a-guard-can-be-false-in-both-directions-r.md
---

# Reviewer-A guard can be false in BOTH directions — recover from stream.jsonl, and never merge A's clarity candidates as Reviewer C

On shader-slang/slang#12408 the `slang-pr-review-runner` guard printed **two** failures, both false:

```
!!! REVIEW-GUARD FAIL: zero Task/Agent subagent dispatches — no reviewers ran
!!! REVIEW-GUARD FAIL: final review is 0 bytes (<500) — no substantive review produced
```

From `stream.jsonl`: **7 subagent dispatches** (code-quality, test-coverage, security,
cross-backend, ir-correctness, documentation-accuracy, general-purpose) and a **119-turn** run
producing a complete **16.8 KB** review. The run then hit its `--max-budget-usd` cap on three
trailing passes (`subtype: error_max_budget_usd`), which zeroed `final-review.md`. Had I trusted the
guard, a real review with 7 findings would have been reported upstream as "no reviewers ran" —
absence reading as clean.

**Recovery recipe.** Parse `stream.jsonl` for `type == "result"` records with a non-empty string
`result`. Multiple will exist: the largest complete one is the review; **later, smaller ones are
amendments that supersede a section** — concatenate with an explicit "Amendment (supersedes …)"
heading rather than dropping them or splicing in place. Verify dispatch count yourself by scanning
for `tool_use` entries with `name in ("Task","Agent")`.

**Two traps found while recovering:**

1. **Do NOT merge `tmp/review-candidates/pr-<N>-*.md` as Reviewer C's output.** Reviewer A runs a
   *clarity pass* as one of its own subagents and writes those files into the shared repo root. On
   #12408 the `Write` payloads carried A's `session_id` (`00788819…`); Reviewer C ran isolated in its
   own worktree (`wt-clarity-…`) and wrote **nothing**. Reporting them as C would have fabricated an
   independent third signal from A's own output. **Discriminate by the payload's `session_id`, never
   by file path** — the two runners share `/workspace/agent/slang/tmp/`.
2. **Per-subagent transcripts may not exist.** `/tmp/claude-*/…/tasks/*.output` are symlinks into
   `…/subagents/agent-*.jsonl`; on this run only `agent-*.meta.json` stubs existed and the `.jsonl`
   files were never written. So a claim like "3 of 7 lenses unrepresented" (which A states about its
   own synthesis) is **corroborable from the summarizer's per-subagent token/wall figures but not
   auditable**. Report it as A's claim, not as your verified finding.

**Reviewer C fails the same way at a different step.** Its `clarity-review.md` came back **81 bytes**
— the literal narration *"Now I have enough verified context. Let me write the high-level candidates
file."* — after exiting `success` at 71 turns with **70 tool calls and zero writes**. The runner's own
500 B floor caught it (`CLARITY-INCOMPLETE`). Re-dispatch; it gets a distinct run dir keyed by PID.

**Also: gate the drift check on the command's *method*, not on substrings.** My first C drift pass
flagged 4 "GitHub writes" that were all read-only `gh api … compare/commits/pulls` **GETs**. Gate on
`--method POST|PUT|PATCH|DELETE` / `-X …` or a write verb (`gh pr review|comment|edit|close`,
`gh api graphql`), and carry a positive control on a synthetic POST so a 0 means "clean" rather than
"detector broken."

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1786044602672-reviewer-a-guard-can-be-false-in-both-directions-r.md`_
