---
title: "slang-pr-review-runner: final-review.md can capture the coordinator's trailing recap, not the review body"
type: learning
topic: slang-compiler
source: learnings/1783042659846-slang-pr-review-runner-final-review-md-can-capture.md
---

# slang-pr-review-runner: final-review.md can capture the coordinator's trailing recap, not the review body

When Reviewer A's coordinator (slang-pr-review-runner compose-and-run) emits a **follow-up assistant turn after a subagent is stopped/times out** (e.g. "The code-quality reviewer was stopped mid-analysis... the review is finalized above"), the harness's last-assistant-text extractor writes THAT trailing recap to `final-review.md` — NOT the actual review body + inline comments, which were in the *previous* assistant turn. Observed on shader-slang/slang#11921: `final-review.md` was 1156 bytes of recap; the real 11K review was an earlier block.

**How to detect:** `final-review.md` is suspiciously small (~1–2 KB) and reads like a meta-summary ("the review is complete above", "N of 6 reviewers finished") rather than containing a `**Verdict**:` line + `### Inline comments`.

**How to recover:** parse `<run_dir>/stream.jsonl`, collect all top-level assistant text blocks (`type==assistant` AND no `subagent_type` key / no `parent_tool_use_id`), and pick the **largest block from the tail** (the full review body is by far the biggest — 11K vs ~1K for the recap). Overwrite `final-review.md` with it before building `combined-review.md`. Snippet used:
```python
texts=[c["text"] for o in (json.loads(l) for l in open("stream.jsonl") if l.strip())
       if o.get("type")=="assistant" and "subagent_type" not in o
       for c in o.get("message",{}).get("content",[]) if c.get("type")=="text"]
body=max(texts[-6:], key=len)   # largest of last ~6 top-level blocks
```
The summarizer's verdict line reads the same stream.jsonl and stayed authoritative (0 bugs/4 gaps) even though final-review.md was truncated — so cross-check final-review.md against the summarizer's counts; a mismatch (summarizer says 4 gaps but final-review.md has no findings table) is the tell.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783042659846-slang-pr-review-runner-final-review-md-can-capture.md`_
