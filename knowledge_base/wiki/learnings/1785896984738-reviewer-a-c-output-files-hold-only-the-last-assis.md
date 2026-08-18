---
title: "Reviewer A/C output files hold only the LAST assistant text block — reconstruct the review from stream.jsonl"
type: learning
topic: review-process
source: learnings/1785896984738-reviewer-a-c-output-files-hold-only-the-last-assis.md
---

# Reviewer A/C output files hold only the LAST assistant text block — reconstruct the review from stream.jsonl

**The artifact on disk is not the review.** Both local PR-review runners write their output file from the *last* assistant text block in `stream.jsonl` and nothing else:

- `slang-pr-review-runner/scripts/repro.sh:138,147` → `final-review.md`
- `slang-clarity-review-runner/scripts/run-clarity.sh:307-320` → `clarity-review.md`

Both are the same loop — `if rec.get("type")=="assistant": … last = b.get("text") or last` — so only the final text block survives. **Neither filters `parent_tool_use_id`**, so a *subagent's* closing text can also win `last` and become the "review".

## Observed failure (shader-slang/slang#12353, 2026-08-05)

Reviewer A's code-quality subagent landed after A had already emitted its review, prompting a short closing amendment message. Result: `final-review.md` was **1.5KB containing only that amendment** ("Two corrections to the review above…"). The actual review was a **17.6KB earlier top-level block** — verdict, changes overview, 6-finding table, per-finding detail, provenance footer.

Anyone opening `final-review.md` by name would have concluded Reviewer A found almost nothing. That is the found-nothing/never-looked failure moved into the **artifact layer**: an empty-looking file is indistinguishable from a reviewer that had little to say.

Note this is *likely* whenever the run ends with a short wrap-up: a late subagent, a correction, an "all reviewers are now in" note. It is not a rare edge case.

## How to recover

```python
# top-level assistant text blocks only (excludes subagent turns)
for line in open(f"{run_dir}/stream.jsonl"):
    rec = json.loads(line)
    if rec.get("type") != "assistant" or rec.get("parent_tool_use_id"): continue
    for b in (rec.get("message", {}) or {}).get("content", []):
        if b.get("type") == "text" and b.get("text","").strip():
            blocks.append(b["text"])
# print index + length + first 90 chars of each; the review body is usually the
# LARGEST block, not the last. Concatenate body + any later amendment sections.
```

Then **confirm identity by the provenance footer** — `reviewed: <head sha> · diff sha256 <hash>` — matched against a head and diff hash you verified yourself. Not by filename, and not by `context.json` (which has its own known clobber problem).

## Don't confuse this with the socket-death mode

A short output file has two very different causes:
1. **This truncation bug** — `stream.jsonl` is large and contains a big earlier block. Recover; do **not** re-run.
2. **Transient socket death** — leaves a `<500`-byte file with a small stream, often with `API Error` / `socket connection closed` text. Recover candidates from `<worktree>/tmp/review-candidates/pr-<N>-*.md`, or re-run.

Check `stream.jsonl` size and look for a large earlier top-level block before deciding. Re-running a review that actually completed costs 20–30 minutes for nothing.

## Suggested fix if it recurs

Keep the largest top-level text block, or concatenate all top-level blocks emitted after the final tool result, and skip any record carrying `parent_tool_use_id`.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785896984738-reviewer-a-c-output-files-hold-only-the-last-assis.md`_
