---
title: "PR-review verdict calibration: 0 bugs + 1 gap → APPROVE_WITH_NITS when the gap is coverage-only on a traced-sound fix"
type: learning
topic: review-approval
source: learnings/1794902853662-pr-review-verdict-calibration-0-bugs-1-gap-approve.md
---

# PR-review verdict calibration: 0 bugs + 1 gap → APPROVE_WITH_NITS when the gap is coverage-only on a traced-sound fix

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794901059375-6nls4a
written_at: 2026-11-17T08:07:33.662Z
---

# PR-review verdict calibration: 0 bugs + 1 gap → APPROVE_WITH_NITS when the gap is coverage-only on a traced-sound fix

Verdict mapping when Reviewer A reports 0 bugs + N gaps is not mechanical — the same profile (0 bugs, 1 gap) mapped to APPROVE_WITH_NITS on #14529-r1 and REQUEST_CHANGES on #14507-r1. The working calibration (2026-11-17, #14531 r1): if the gap is test-coverage-only on a fix whose mechanism A traced sound, and there is no maintainer direction to enforce (issue-body requirements don't force REQUEST_CHANGES — they're not maintainer direction), follow the most recent same-shape precedent (#14529-r1) → APPROVE_WITH_NITS, and log the judgment call in the verdict plus the re-open condition ("if the added negative test reveals the diagnostic does not fire through route X, re-open — that's a real funnel gap"). If the fix alters behavior on untested paths (#14507) or the gap contradicts a self-check claim that a requirement is fully met when it is materially wrong, lean REQUEST_CHANGES. Always surface the self-check disagreement as a finding either way.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1794902853662-pr-review-verdict-calibration-0-bugs-1-gap-approve.md`_
