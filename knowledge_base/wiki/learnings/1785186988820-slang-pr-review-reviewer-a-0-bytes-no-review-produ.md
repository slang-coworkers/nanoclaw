---
title: "slang-pr-review Reviewer A: '0 bytes / no review produced' guard can be a lie when the run hit the budget cap — recover from stream"
type: learning
topic: review-process
source: learnings/1785186988820-slang-pr-review-reviewer-a-0-bytes-no-review-produ.md
---

# slang-pr-review Reviewer A: "0 bytes / no review produced" guard can be a lie when the run hit the budget cap — recover from stream

When `slang-pr-review-runner compose-and-run` exits and its REVIEW-GUARD reports "final review is 0 bytes (<500) — no substantive review produced" (and the summarizer shows 0 bugs / 0 gaps / 0 questions), do NOT assume the review failed. Check the run's `stream.jsonl` first — the review may be complete and only the *file write* was skipped.

Observed (shader-slang/slang#12206 R8): Reviewer A produced its full final review, then hit `error_max_budget_usd` (the `--max-budget-usd 30` cap) on the very last turn. The runner's final step that writes `<run_dir>/final-review.md` never ran, so the file was absent → the guard fired "0 bytes" and the summarizer parsed nothing → 0/0/0. But the complete review (verdict, findings table, inline comments, `reviewed:`/`diff sha256` footer) was intact in the last top-level assistant message in the stream.

Recovery (same shape as the teardown-recovery pattern, but triggered by budget cap, and the tell is different — job exits 0, guard says "0 bytes"):
```python
import json
final=None
with open('<run_dir>/stream.jsonl') as f:
    for line in f:
        try:
            o=json.loads(line)
            if o.get('type')=='assistant' and o.get('parent_tool_use_id') is None:  # top-level, not subagent
                for c in o.get('message',{}).get('content',[]):
                    if c.get('type')=='text' and 'Verdict' in c.get('text','') and 'reviewed:' in c.get('text',''):
                        final=c['text']
        except: pass
open('<run_dir>/final-review.md','w').write(final)   # reconstruct the file the runner skipped
```

Two more gotchas seen in the same run:
- **Drift false-positive.** The runner's drift detector / a raw grep for `/pulls/*/reviews|APPROVE|CHANGES_REQUESTED` over the stream matches the REVIEW.md *protocol text* the model quotes ("using event COMMENT ... NEVER use APPROVE"). That is not a real POST. Confirm drift==0 by counting actual `Bash`/`gh api` tool_use calls that POST a review (`grep tool_use for name==Bash and command contains 'reviews' and 'POST'`), not by grepping prose.
- **Budget headroom.** `--max-budget-usd 30` is cutting it close for the correctness pass when the diff is large (~600+ line diff, 6 subagents). The review still completed here, but the cap landed exactly on the file-write turn. Consider bumping to 35-40 for large PRs, or always be ready to stream-recover.

General rule: a passing guard is trustworthy; a FAILING guard ("no review / 0 bytes / no dispatches") on a job that exited 0 warrants a stream check before you report the reviewer as failed or re-run (which wastes ~$30 and 20 min).

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785186988820-slang-pr-review-reviewer-a-0-bytes-no-review-produ.md`_
