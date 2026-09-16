---
title: "slang-clarity-review-runner can capture a trailing meta-message as clarity-review.md instead of the review — recover the real body from stream.jsonl"
type: learning
topic: slang-compiler
source: learnings/1789517911038-slang-clarity-review-runner-can-capture-a-trailing.md
---

# slang-clarity-review-runner can capture a trailing meta-message as clarity-review.md instead of the review — recover the real body from stream.jsonl

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787784675810-nces5k
written_at: 2026-09-16T00:18:31.038Z
---

# slang-clarity-review-runner can capture a trailing meta-message as clarity-review.md instead of the review — recover the real body from stream.jsonl

On an R5 clarity review of slang#12782, `clarity-review.md` was only 10 lines — NOT the review, but the model's trailing meta-message ("The complete pr-12782-clarity-workflow.md is in my prior message... Nothing further to do."). The clarity pipeline had actually completed a full 44.5KB review (29 kept / 10 dropped candidates, Review Body, PR Summary), but the runner's output-extraction grabbed the LAST assistant turn — which was a meta-conclusion emitted AFTER the review body — instead of the review itself.

**Detection:** clarity-review.md is tiny (<2KB) and/or has no `## Kept` / `## Review Body` / `### ` candidate headers, but the run exited rc=0 and the log says "clarity review: <path>". A `grep -c '### ' clarity-review.md` of 0 with rc=0 is the tell.

**Recovery:** extract the real body from the run's `stream.jsonl` — find the largest assistant text turn containing `## Review Body` / `## Kept` / `PR Summary`:
```python
best=""
for line in open(f"{RUN_C}/stream.jsonl"):
    o=json.loads(line)
    for c in o.get("message",{}).get("content",[]):
        t=c.get("text","")
        if ('## Review Body' in t or '## Kept' in t) and len(t)>len(best): best=t
open(f"{RUN_C}/clarity-review-recovered.md","w").write(best)
```
Then use the recovered file in the combined report.

**Also:** the naive drift grep `grep -cE '(POST|PUT|PATCH|DELETE)'` over tool-uses.jsonl false-positives on Agent-dispatch prompt text containing "PATCH"/etc. Use a tighter pattern scoped to command/name fields (`gh api|--method (POST|PUT|...)|post-github|pulls/[0-9]+/reviews`) to confirm real GitHub-write drift. Same family as the pr-review-runner stream.jsonl recovery + REVIEW-GUARD/INTEGRITY-FAIL false-positive learnings — the runners' post-processing (extraction, guards, drift grep) all have false-positive/mis-capture modes; always cross-check against the stream and read the actual artifact before trusting a summary count.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789517911038-slang-clarity-review-runner-can-capture-a-trailing.md`_
