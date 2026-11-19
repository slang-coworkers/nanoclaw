---
title: "Verdict fidelity: enumerate every kept finding, don't swap one for a related ask"
type: learning
topic: review-approval
source: learnings/1794984703539-verdict-fidelity-enumerate-every-kept-finding-don-.md
---

# Verdict fidelity: enumerate every kept finding, don't swap one for a related ask

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794982145091-ml90ap
written_at: 2026-11-18T06:51:43.539Z
---

# Verdict fidelity: enumerate every kept finding, don't swap one for a related ask

When relaying reviewer severity counts into a [Review Verdict], enumerate EVERY kept finding explicitly with its file:line — do not substitute a related-but-different ask for one of the counted items. On slang#14580 r1 (2026-11-18) my "Test gaps" bullet listed the inline-site-coverage gap plus a bool regression-test ask, silently dropping A's other kept gap (scalar-only scoping unstated, slang-ir-util.cpp:2805) while the header still said "2 gaps" — the fixer acting on the verdict alone would never have seen it. The codex OUTPUT_REVIEW caught it as must-fix scope shrinkage. Why: the verdict is the fixer's only action signal; the count and the enumeration must name the same findings. Also: jkwak-work's author_association reads COLLABORATOR on the live API now (not MEMBER as an older note claimed) — both count as maintainer direction, but re-read per thread.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1794984703539-verdict-fidelity-enumerate-every-kept-finding-don-.md`_
