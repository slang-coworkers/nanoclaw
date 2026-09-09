---
title: "[approver/challenger-calibration] Devin false-positive 'broken tests bypass nightly failures' on expected-failures.txt additions"
type: learning
topic: review-approval
source: learnings/1788872770328-approver-challenger-calibration-devin-false-positi.md
---

# [approver/challenger-calibration] Devin false-positive "broken tests bypass nightly failures" on expected-failures.txt additions

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788343834857-1r8xf2
written_at: 2026-09-08T13:06:10.328Z
---

# [approver/challenger-calibration] Devin false-positive "broken tests bypass nightly failures" on expected-failures.txt additions

**Context:** shader-slang/slang PR #12881 (jvepsalainen-nv), a purely-additive edit to `docs/generated/tests/_meta/expected-failures.txt` adding 6 known-failing reporter keys from a nightly run.

**Symptom:** On revision 2 (a `Merge branch 'master'` head, `cf170148`), the head-current fallback-tier **Devin** review flagged a 🔴 Bug "Broken tests bypass nightly failures" @ `expected-failures.txt:183` tagged "Repo rule", plus a 🟡 "Duplicate defect lacks durable tracking". Yet on the **byte-identical net diff** at revision 1 (`94deba00`) a week earlier, Devin flagged **nothing**. Same change, different verdict → Devin's per-run output is non-deterministic for this PR class.

**Root cause:** The 🔴 is a generic "don't skip/disable tests" repo-rule misfire. Adding a key to `expected-failures.txt` is the **documented, intended** behavior of the expected-failures mechanism for a test that is known-failing pending a compiler fix — NOT a silent test-disable that hides a regression. `slang-test` still runs each listed test and its FileCheck directives (`test-reporter.cpp:175-176`), and a listed test that starts passing surfaces as an XPASS removal cue (`test-reporter.cpp:875`). So the change cannot hide a wrong verdict in shipped behavior.

**How to catch it:** On a fallback-tier Devin verdict for a `docs/generated/tests/_meta/expected-failures.txt` change, treat a "broken tests bypass / don't skip tests / Repo rule" 🔴 as a **false positive** unless the diff actually (a) DELETES a test, or (b) removes/weakens its `CHECK`/FileCheck directives. Direction matters: **ADDING** keys is the safe direction; **DELETING** a suppression is the direction to scrutinize (cf. #12451: a deletion premised on a false exit-path claim). A stale production bot review still transfers its source citations when the net diff is unchanged — here the stale `github-actions[bot]` review had already verified the mechanism is report-only.

**Fix / rule:** A fork-head PR abstains at Step 1 (`head_provenance`) regardless, so this Devin 🔴 never forced a BLOCK. But had the PR been eligible (non-fork), the challenger must NOT round a fallback-tier Devin 🔴 of this shape up to BLOCK — a BLOCK requires a VERIFIED bug (a deleted test / removed CHECK / a real regression), never a repo-rule paraphrase of the PR's documented intent. Also: an ABSTAIN never auto-approves, so even when a real bug is present, a fork-head abstain safely routes it to a human (here `jkiviluoto-nv` independently APPROVED).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788872770328-approver-challenger-calibration-devin-false-positi.md`_
