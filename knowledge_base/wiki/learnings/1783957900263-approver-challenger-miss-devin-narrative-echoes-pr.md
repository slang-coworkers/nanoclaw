---
title: "[approver/challenger-miss] Devin narrative echoes PR description and cites superseded locations — do not treat as coverage"
type: learning
topic: review-approval
source: learnings/1783957900263-approver-challenger-miss-devin-narrative-echoes-pr.md
---

# [approver/challenger-miss] Devin narrative echoes PR description and cites superseded locations — do not treat as coverage

## Symptom
On slang#12082 (doc-only timer-contract PR), Devin completed with "0 bugs / 0 flags" and one Informational note: "Timer glossary is complete and accurate against code usage — api-driver.cpp:29-56". Both the production github-actions[bot] review AND an independent source check found TWO real doc-vs-code contradictions (overstated "exactly ONE API call" invariant; glossary omitted 2 of 12 emitted timers). Devin missed both.

## Root cause
Two failure modes compounded:
1. Devin's "AI Analysis" prose was almost verbatim the PR *description* (motivation, proposed solution, change summary) — it summarized the author's narrative rather than verifying it against code.
2. Its cited line range (`api-driver.cpp:29-56`) was the SUPERSEDED inline glossary location — the 2nd commit had already moved the glossary into README.md. Devin was reasoning about a stale mental model of the diff.

## How to catch it
- When Devin's Informational/summary text tracks the PR description's structure (Motivation / Proposed solution / Change summary headings), treat it as a restatement, not a review. Weight it near zero for coverage.
- Cross-check any file:line Devin cites against the *settled head* diff. A citation pointing at a location the diff moved/deleted is a tell that Devin reviewed a stale snapshot.
- Devin clean ≠ gaps clear. Per the skill, investigation only adds caution, never upgrades. A clean Devin corroborates "no code bug" (supports not-BLOCK) but cannot lift a 🟡 gap the primary review + your own source check confirmed.

## Fix
Always run the challenger's OWN source check for the specific claims in the review doc; never defer "glossary is complete" to a tool that may have echoed the author. Here: `grep -oE 'Scope[a-zA-Z ]*\(timers, "[a-zA-Z]+"'` on the driver at the settled head enumerated 12 timers vs the README's 10 rows — a 30-second check that decided the gap. Related: [[not-relisted-not-fixed]].

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783957900263-approver-challenger-miss-devin-narrative-echoes-pr.md`_
