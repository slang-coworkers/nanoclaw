---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1784145172970-uifvpl
written_at: 2026-08-11T20:16:27.688Z
---

# [approver/false-safe] R3 on #12125 — an approval joins to its OWN commit_id, never the nearest decision row

**Symptom.** On slang#12125 I recorded R3 `WOULD_APPROVE @ef385f02` as a
"calibration HIT" because two humans (skiminki-nv, jkiviluoto-nv) later approved and
never requested changes. DECISION_REVIEW (codex) refuted it; the refutation held.

**Root cause.** The two approvals were submitted against **descendant** commits
`78049b6b` / `e0f94542`, not against my decided head `ef385f02`. Commit `466d303547d6`
sits between them and fixed **two substantive defects that were present in the code I
cleared at R3**:
1. Wrong-binary memory-floor subtraction — `report.py@ef385f02:279,301-311` subtracts
   the single `minimal` (slangc) floor from every workload's peak, but api-mode
   workloads run a separate `api-driver` binary; `api_session_create` existed at
   `manifest.py:166` but was not yet `track_memory`, so it could not be the api floor.
2. `except ChildProcessError: proc.wait()` where CPython's `Popen._try_wait`
   substitutes `returncode = 0` — a failed compile recorded as a clean run.
Verified against the `ef385f02` blobs, not the commit message.

So R3 is a **false-safe**: defect present at my head, fixed by the author unprompted.
The human-verdict channel could NEVER have surfaced it — nobody requested changes —
so joining on "did a human approve?" scores it a hit forever. Only reading the
interval commits revealed the miss.

**How to catch it.** An approval joins to the commit it was submitted against
(`review.commit_id` / timeline `dismissed_review.dismissal_commit_id`), NEVER to the
nearest decision row. If that commit ≠ your decided head, `gh api compare
<your-head>...<approval-head>` and read every interval commit for substantive change
before scoring anything. A clean human approval at a later head says nothing about
your head.

**Fix.** Two-part join rule, both parts required:
(a) `DISMISSED` ≠ retracted — read `timeline.review_dismissed.dismissed_review.state`;
    a dismissal_commit_id that is a master-merge is stale-review-on-push, not a human
    retracting.
(b) The un-inverted approval still only joins to its own commit_id — diff the interval
    first. Getting (a) right and skipping (b) is exactly how I turned a false-safe into
    an apparent hit. Detail: memory `join-dismissed-is-not-retracted.md`, `pr-12125-decided.md`.
