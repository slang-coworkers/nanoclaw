---
title: "[approver/infra-abstain] Merge confirms: bot-authored test-only device-enablement takeover is a repeatedly-safe shape"
type: learning
topic: review-approval
source: learnings/1784726873588-approver-infra-abstain-merge-confirms-bot-authored.md
---

# [approver/infra-abstain] Merge confirms: bot-authored test-only device-enablement takeover is a repeatedly-safe shape

**Calibration join (slangpy#1071):** My decision was ABSTAIN_INFRA (NO_REVIEW_SIGNAL — bot-authored PR that production review skips + Devin fetch timed out). The PR then merged at my EXACT decision commit `c47cd4404644` with zero follow-up commits, explicitly APPROVED by `jhelferty-nv` (the original author of the #958 it took over). So the code I investigated shipped verbatim and a human approved it. My investigation read ("safe, test-only Metal enablement") matched the outcome perfectly; only the infra failure forced the abstain. ABSTAIN_INFRA is excluded from agreement scoring, but the shape is worth recording.

**The transferable shape — a repeatedly-safe class:**
- Bot-authored *rebased-takeover* of a human PR (`nv-slang-bot[bot]` reopening someone's stalled PR so CI runs as a normal PR), AND
- diff is small and *test-only* (here +5/−5, 2 test files: removing device-skips + adding a DeviceType to a device-filter list), AND
- the cited blocker issue in the removed TODO/skip is verifiably CLOSED/COMPLETED (slang#7605), AND
- the target platform's CI job actually *runs* the newly-enabled tests and they pass (macOS unit-test 1704✅/367 skip/0❌, and the enabled test is confirmed absent from the skip list).

When all four hold, the change is very low-risk. This does NOT license rounding an infra-abstain up to WOULD_APPROVE — the procedure forbids self-review substituting for a missing review signal — but it sharpens Step-0 recall: on the next bot-authored test-only device-enablement PR, expect safety, and the *only* thing standing between abstain and a real signal is the fragile Devin-only tier. Fixing devin-fetch reliability (see sibling infra-abstain learning) would convert this whole class from ABSTAIN_INFRA to a scoreable decision.

**Secondary catch — flaky CI on the enabling job:** a bot comment on #1071 shows the very macOS Debug job that runs the enabled Metal tests first failed on a *pre-existing unrelated flake*, then went green on re-run. So "CI green on the settled head" was legitimate but had passed through a flaky red first. Reinforces the recall prior that green macOS CI for Metal enablement is meaningful ONLY after confirming the enabled tests genuinely executed (grep the log for the test running vs. skipped) — which here they did.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784726873588-approver-infra-abstain-merge-confirms-bot-authored.md`_
