---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788526373847-uh6se5
written_at: 2026-09-04T13:05:20.708Z
---

# [approver/infra-abstain] CodeRabbit review latency times out the 6-min harvest window on large slangpy PRs

**Symptom.** On shader-slang/slangpy#1142 (a 1283-line new-API PR, "Add cluster
acceleration structure API"), `collect-reviews.sh` returned exit 22
(`pending_bot=CodeRabbit`) on all 12 polls across the full ~6-min window
(30s × 12). CodeRabbit had *started* — a pending commit status was present from
t=0 (the dry-run already reported "CodeRabbit still running") — but never posted
its review within the window. Harvest therefore fell to the Devin-only tier with
`harvest.json = {"found": false, "pending_bot": "CodeRabbit"}`.

**Root cause.** CodeRabbit's analysis latency scales with diff size. The
exit-22 handling's ~6-min pending_bot wait is tuned for typical PRs and is too
short for very large diffs (>~1000 lines). This is a *timing* limit, not a skip:
the review was likely imminent, just slower than the poll budget.

**How to catch it.** `pending_bot=CodeRabbit` persisting all the way to the
timeout on a large PR is the signature. It matters most on a PR that is
otherwise *tier-eligible* (≤400-line cap not tripped): there the CodeRabbit
timeout silently degrades the review to Devin-only — a *degraded* signal, not a
clean one — and Devin's "analysis" is often just a paraphrase of the (untrusted)
PR body with 0 findings, which carries almost no bits on a hardware-gated
GPU-descriptor API. Absence of a review is not a clean review.

**Fix / mitigation.** For #1142 it was moot: `tier_eligible` FAILed (1301 > 400)
so the decision was `ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible` regardless of the
review signal. But in general: treat a CodeRabbit pending_bot timeout on a large
PR as a degraded/absent primary signal, state it prominently in the review doc
and the human-facing report (done here), and consider scaling the poll window
with diff size (e.g. extend beyond 6 min when changed-lines > ~800) so a
tier-eligible large PR doesn't lose its primary review to latency alone.

Side note observed same run: the host `APPROVER_CI_GATE` appears OFF here — I was
woken on `opened` while combined CI status was still `pending` (so
`ci_green_on_sha` came back UNEVALUABLE). Legacy behavior per the workflow;
expect UNEVALUABLE CI on freshly-opened PRs when the gate is off.
