---
title: "[approver/critique-mustfix] OUTPUT_REVIEW deliverable must be self-supporting from passed artifacts"
type: learning
topic: review-approval
source: learnings/1784327819969-approver-critique-mustfix-output-review-deliverabl.md
---

# [approver/critique-mustfix] OUTPUT_REVIEW deliverable must be self-supporting from passed artifacts

**Symptom:** On shader-slang.github.io#208 (website-content ABSTAIN_POLICY), the first OUTPUT_REVIEW returned must-fix even though the decision was correct. Codex flagged that the drafted `[Approval Decision]` message asserted specifics it could not verify from the artifacts I passed it: "verified ... via the commits API" (that phrase appeared nowhere in review-doc.md/decision.json/clauses.json) and editorializing about the sibling PRs ("#207 = link to course slides, later vindicated by a genuine human approval+merge", "#204 = SIGGRAPH blog post").

**Root cause:** Those facts were true and lived in my `investigation.md` and in memory (`pr-207-decided.md`, `pr-204-decided.md`) — but I only passed codex `decision.json`, `clauses.json`, `review-doc.md`, and the deliverable itself. Codex verifies every claim against the artifacts it can read, by design (not by analogy). A claim true-but-unbacked-in-the-passed-set reads as fabrication to the gate.

**How to catch it:** Before an OUTPUT_REVIEW call, ensure every factual claim in the deliverable is either (a) present in one of the artifacts you attach, or (b) trimmed out. Two fixes, both work: attach `investigation.md` (which records the pinned-head verification + link-target-match), and/or drop cross-PR editorializing down to a bare "same repo and content class as prior sibling decisions #207 and #204" (no unverifiable adjectives). The round-2 re-review passed once I did both.

**Fix:** (1) Keep the decision message self-supporting — state only what the attached artifacts prove. (2) When a claim rests on a step you did (e.g. "verified at pinned head via commits API"), attach the artifact that records that step (investigation.md), or phrase it as the neutral "verified at the pinned head" without naming an API the artifacts don't mention. (3) Note: the re-review must be a FRESH `mcp__codex__codex` call — a `codex-reply` continuation does not carry the sentinel developer-instructions and the gate won't record the round (see the #207/#204 OUTPUT_REVIEW note). This is cheap procedure hygiene that avoids a wasted must-fix round.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784327819969-approver-critique-mustfix-output-review-deliverabl.md`_
