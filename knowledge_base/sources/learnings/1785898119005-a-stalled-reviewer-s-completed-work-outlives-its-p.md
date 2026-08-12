# A stalled reviewer's completed work outlives its process AND its worktree — recover from Write tool calls in stream.jsonl

Reviewer C (`slang-clarity-review-runner`) died mid-stream on shader-slang/slang#12353 with `API Error: Response stalled mid-stream`. Its own guard fired correctly: `CLARITY-INCOMPLETE: clarity-review.md is 78B (floor 500B) … treat as failed/inconclusive and re-run` (rc=1).

**Re-running would have been wrong.** Its high-level pass had already completed and written 12 candidates. Recovery took ~2 minutes; a re-run would have cost 20–30 minutes *and* would have re-lost the fine-grained pass anyway.

## The triage sequence

**1. Distinguish the two causes of a short output file** (they look identical):

| | truncation bug | genuine stall/death |
|---|---|---|
| `stream.jsonl` size | large | large **or** small |
| crash signatures | none | `API Error`, `socket connection closed` |
| large earlier top-level block | **yes** — that's the review | **no** (largest was 110 B here) |
| action | recover the block | recover *artifacts*, see below |

Both extractors (`repro.sh:138,147`, `run-clarity.sh:307-320`) keep only the LAST assistant text block with no `parent_tool_use_id` filter, so a completed review can land near-empty. Check for a big earlier block before concluding death.

**2. When it really did die, the finished artifacts may still exist — but not on disk.** C writes candidates to `<worktree>/tmp/review-candidates/pr-<N>-*.md`, and **the worktree is GC'd on exit**, so that path was already gone. The content survived inside the transcript:

```python
# recover any file the agent wrote, from the preserved tool call
for line in open(f"{run_dir}/stream.jsonl"):
    rec = json.loads(line)
    for c in (rec.get("message", {}) or {}).get("content", []):
        if c.get("type") == "tool_use" and c.get("name") in ("Write","Edit","MultiEdit"):
            body = (c.get("input") or {}).get("content") or (c.get("input") or {}).get("new_string")
            # -> 25,262 bytes of candidates, intact
```

**3. Count the `Write` calls to establish which stage finished.** Exactly one Write meant: high-level pass complete, fine-grained pass never emitted ⇒ consolidation, scope-filter and judgment-call stages never ran. So the recovered candidates must be labelled **raw / unfiltered / unconsolidated** when handed downstream. Reporting them as a finished clarity review would overstate them.

**4. Still check drift on a partial run.** 0 GitHub-write calls across 113 tool calls; `slang-review-post-github` never invoked. A crash is not a licence to skip the safety assertion.

## Why this matters beyond one reviewer

A guard that says "re-run" is advice, not a verdict — it can only see its own output file. Before spending 20–30 minutes on a re-run, ask **what did this process finish before it died, and where would that evidence be?** Transcripts preserve tool *inputs*, so any file the agent wrote is recoverable even after the filesystem it wrote to is gone.

Partial-but-substantial is a real state, and it must be reported as such: not `_skipped_` (understates 12 recovered candidates), not complete (overstates a pipeline that never filtered them). Label it `_partial: stalled after <stage>; recovered, not re-run_` and say which stages didn't run.
