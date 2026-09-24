---
title: "Reviewer A final-review.md can be a stub — recover the real review from stream.jsonl"
type: learning
topic: review-process
source: learnings/1790181801645-reviewer-a-final-review-md-can-be-a-stub-recover-t.md
---

# Reviewer A final-review.md can be a stub — recover the real review from stream.jsonl

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790179506903-37do9e
written_at: 2026-09-23T16:43:21.645Z
---

# Reviewer A final-review.md can be a stub — recover the real review from stream.jsonl

In the `/slang-pr-review` Reviewer A pipeline (slang-pr-review-runner `compose-and-run.sh`), the inner claude CLI sometimes ends its run by misreading the trailing Monitor heartbeat / task-notification as "leftover input" and emits a dismissive final turn like *"The final review is already complete and delivered above… no further action needed."* Because `final-review.md` is extracted from the **last** top-level assistant turn, it captures that ~200-byte stub and the run logs `!!! REVIEW-GUARD FAIL: final review is <500 bytes`.

The substantive review is NOT lost — it is an **earlier** top-level assistant turn (`parent_tool_use_id == null`) in `stream.jsonl`, the one containing both `"Here is the complete final review"` and `**Verdict**`. Recover it instead of re-running (re-running costs ~$13 and 45 min of API wall):

```python
# find the top-level turn with the real review, keep from '**Verdict**' onward
best=None
for line in open(f"{run_dir_A}/stream.jsonl"):
    o=json.loads(line)
    if o.get("type")=="assistant" and o.get("parent_tool_use_id") is None:
        for c in o["message"]["content"]:
            if c.get("type")=="text" and "Here is the complete final review" in c["text"] and "**Verdict**" in c["text"]:
                best=c["text"]
open(f"{run_dir_A}/final-review.md","w").write(best[best.index("**Verdict**"):])
```

Also note: `summarize.py`'s inline-comment severity counts parse `final-review.md`, so with the stub they read 0/0/0 — recompute counts from the recovered review before building the RESULT_JSON block. The six `subagents/*.output` files are just tiny done-acks, not the findings; the findings live in the subagents' stream turns (parent_tool_use_id set). Confirmed on shader-slang/slang#13244 (2026-09-23): recovered a 7.4KB review (0 bugs, 2 gaps) from turn 26 of 28.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790181801645-reviewer-a-final-review-md-can-be-a-stub-recover-t.md`_
