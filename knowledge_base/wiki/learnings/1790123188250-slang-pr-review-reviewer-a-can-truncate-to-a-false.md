---
title: "slang-pr-review Reviewer A can truncate to a false 0/0/0 clean — verify the result event finalized"
type: learning
topic: review-process
source: learnings/1790123188250-slang-pr-review-reviewer-a-can-truncate-to-a-false.md
---

# slang-pr-review Reviewer A can truncate to a false 0/0/0 clean — verify the result event finalized

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790112507838-6gop3g
written_at: 2026-09-23T00:26:28.250Z
---

# slang-pr-review Reviewer A can truncate to a false 0/0/0 clean — verify the result event finalized

When running the `/slang-pr-review` pipeline (Reviewer A = `slang-pr-review-runner compose-and-run`), the inner `claude --print` orchestrator sometimes dispatches its 6 `.claude/agents/*` subagents **asynchronously (background)** and the print session ends mid-synthesis — its final assistant text is an intermediate message like *"…holding for cross-backend before I finalize the table."* No findings table is emitted, so `summarize.py` reports a **false `0 bugs / 0 gaps / 0 questions`** and `Run state: success`. Do NOT trust that as a clean review.

**Detection:** before trusting the counts, parse `stream.jsonl` for the terminal `result` event and check its `result` text — if it contains a "holding / before I finalize the table" pattern (or `final-review.md` is suspiciously short, ~1–2 KB, and reads like reasoning rather than a `**Verdict**:` + Findings table), the run truncated. The async subagent transcripts under `/tmp/claude-.../-workspace-agent-slang/.../tasks/*.output` are symlinks that get **cleared** on session/container churn, so you usually cannot recover the subagent findings — just **re-run** compose-and-run. A finalized run's `result` text is the full review (10–15 KB) ending in a `<sub>reviewed: <sha>…` footer.

**Second, milder degradation:** 3 of the 6 subagents (code-quality, cross-backend, doc-accuracy) can *refuse* because their agent definitions hard-require the harness-staged `tmp/pr-diff.patch`, which the CLI sandbox blocks from being created. In that case the orchestrator still finalizes but covers those dimensions with its own source-verified analysis — usable, but note the reduced independence in the verdict, and consider an independent verification subagent for the highest-stakes dimension (e.g. a build-break question).

Both are nondeterministic; a re-run typically produces a proper table. Cost ≈ $17–21 per Reviewer-A run, so check for truncation before spending a re-run, and always before reporting a verdict.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790123188250-slang-pr-review-reviewer-a-can-truncate-to-a-false.md`_
