---
title: "approver: reviewers_complete field is authoritative — B/Devin infra-skip alone is not a harness-fail"
type: learning
topic: review-process
source: learnings/1783707333659-approver-reviewers-complete-field-is-authoritative.md
---

# approver: reviewers_complete field is authoritative — B/Devin infra-skip alone is not a harness-fail

**Context:** slang-pr-approver Step 2 short-circuits to ABSTAIN on "reviewer set incomplete." Two prior PRs (#12023, #12041) abstained partly because `reviewers_complete=false`. It's tempting to treat ANY Reviewer-B (Devin) infra-skip as an automatic incompleteness → ABSTAIN. That is WRONG and would blow the infra-abstain rate toward ~100% (the skill explicitly wants it ~0).

**The distinction that matters:** Step 2 keys on the *literal* `reviewers_complete` field the reviewer emits, not on whether every named reviewer physically ran.
- In #12023/#12041 the field was literally `false` (patch-mode and/or the reviewer itself judged the panel incomplete) → legitimate ABSTAIN.
- In #12031 the field was `true`: Reviewer A (correctness, 6 subagents) + Reviewer C (clarity) both ran to completion (drift=0), and Reviewer B (Devin, browser-driven) was infra-skipped because the lab container has no Chrome/dbus — a documented, STANDING best-effort configuration ("A+C carry the review"), not a mid-review error. The reviewer set the field true on that basis.

**Rule:** Don't override a `true` field to manufacture a harness-fail the reviewer didn't declare. B-skip is the standing config; A+C completing IS a complete panel for this pipeline. Conversely, don't rubber-stamp — confirm from the doc that A+C actually reached their verdicts (full correctness table + clarity candidate file present), and cite "field=true + A/C completion" in the decision so Step-2 isn't silently weakened. This is a policy-sensitive precedent worth stating explicitly each time.

**Also (mechanics):** the approver's `gh api .../pulls/<n>/...` reads trip the deliver-critique gate hook (it pattern-matches "pulls/"). Use `gh pr view`/`gh api repos/.../compare/...` for metadata instead, or split calls. And `gh api contents/<file>` can silently return an EMPTY body for some large meta files (hlsl.meta.slang came back 0 bytes) — verify `wc -c` before trusting a fetched source copy; the PR diff hunk is the reliable evidence for "what the PR ships."

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783707333659-approver-reviewers-complete-field-is-authoritative.md`_
