# A guard can only see its own output file — check whether the work survives before accepting "re-run"

A runner guard that says `treat as failed / re-run` is reporting **its own visibility**, not the world's state. On shader-slang/slang#12353 this happened twice in one day, and both times the substantive work was sitting intact in the run transcript.

## The two cases

**Round 1** — Reviewer C stalled: `API Error: Response stalled mid-stream`, 78-byte output, guard fired `CLARITY-INCOMPLETE … re-run` (rc=1). Genuine mid-run death (no large earlier text block). **But its high-level pass had completed** and written 12 candidates. Recovered in ~2 minutes from the `Write` tool call in `stream.jsonl`, versus a 20–30 minute re-run that would have re-lost the stalled pass anyway.

**Round 2** — same reviewer died at the *consolidation* stage: `API Error: Connection closed mid-response`, 81-byte output, same guard. **More survived than round 1:** both generation passes had completed — 16 high-level candidates (34,298 B) and 24 fine-grained (43,565 B). Only consolidation, scope filtering and judgment-call resolution were lost.

In both cases the guard was correct about its own file and wrong about the run.

## Procedure before accepting a "re-run"

1. **Enumerate top-level assistant text blocks** (`type=="assistant"`, **no** `parent_tool_use_id`). A large earlier block means the last-block truncation defect — the review exists, recover it. No large block means genuine death; continue to step 2.
2. **Enumerate `Write`/`Edit`/`MultiEdit` tool calls** and pull `input.content` / `input.new_string`. The runner's worktree is **auto-removed on exit**, so the file path is gone — but the payload persists in the transcript. **Completed work outlives both the process and its filesystem.**
3. **Count the Write calls to determine which stage finished**, and label the recovery honestly. One Write = generation only. Two = both passes, consolidation lost. Ship as `_partial: died at <stage>; recovered, not re-run_` **plus** an explicit *raw / unconsolidated / unfiltered* warning — never `_skipped_` (understates recovered work) and never as complete (overstates a pipeline that never filtered it).
4. **Still run the drift/safety check on a partial run.** A crash is not a licence to skip the assertion.

## Why this matters beyond one skill

The general rule: **distinguish three states, never two** — *found nothing*, *never looked*, and *died trying*. A guard collapses the last two into "failed"; a tally collapses all three into a number. An accurate `_failed_` / `_partial_` with its reason is more informative to a downstream reader than a re-run would have been, and costs 2 minutes instead of 30.

Related failure mode from the same review: a scraper returning `(none reported)` at exit 0 because its harvest silently failed. Same lesson from the other side — *the instrument's report about itself is not evidence about the subject.*
