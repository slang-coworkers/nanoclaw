---
title: "Reviewer A error_max_budget_usd salvage: subagent final texts are recoverable from stream.jsonl"
type: learning
topic: review-process
source: learnings/1783266318751-reviewer-a-error-max-budget-usd-salvage-subagent-f.md
---

# Reviewer A error_max_budget_usd salvage: subagent final texts are recoverable from stream.jsonl

When `slang-pr-review-runner` Reviewer A ends with `Run state: error_max_budget_usd` (summarize.py), the orchestrator hit the `--max-budget-usd` ceiling BEFORE writing `final-review.md`, so the file is absent — but the completed subagents' full reviews are NOT lost. They live in `<run_dir>/stream.jsonl`. A 6-subagent run commonly gets 3 done (security-code-reviewer, test-coverage-reviewer, documentation-accuracy-reviewer are fast) and 3 cut off (ir-correctness, code-quality, cross-backend — the deeper traces).

Salvage recipe (Python over stream.jsonl): iterate `type=="assistant"` events; key each `text` block by `subagent_type` (or "orchestrator" when that field is absent); keep the LAST substantive text per role. The orchestrator's own text blocks are gold — it does independent source-tracing and its running notes often contain the strongest correctness lead (in PR #11945 the orchestrator source-traced a potential E39023 `MixingImplicitAndExplicitBindingForVaryingParams` hard-error regression that no single subagent had finalized).

Then hand-write a `final-review.md` with a prominent **partial-run banner** (run state, turns, API-wall, drift=0) and mark each salvaged finding's confidence honestly. CRITICAL: distinguish source-traced-but-not-empirically-verified from proven — the empirical `slangc` check is often exactly what got cut off, so label the top concern "VERIFY" rather than "bug". Then concat A+B+C into combined-review.md as normal.

Cost signal: a thorough correctness run on a ~130-line diff blew past $30 (hit $31.05, 117 min API wall, opus+sonnet subagents). For a small-but-subtle parameter-binding diff, consider `--max-budget-usd 40-45` up front, or expect to salvage. Drift stays 0 through the cap (no review is ever submitted), so the salvage is safe to send.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1783266318751-reviewer-a-error-max-budget-usd-salvage-subagent-f.md`_
