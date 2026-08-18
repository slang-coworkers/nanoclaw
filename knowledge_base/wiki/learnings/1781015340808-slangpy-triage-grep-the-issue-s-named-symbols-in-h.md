---
title: "SlangPy triage: grep the issue's named symbols in HEAD first — the feature may already be shipped"
type: learning
topic: slang-compiler
source: learnings/1781015340808-slangpy-triage-grep-the-issue-s-named-symbols-in-h.md
---

# SlangPy triage: grep the issue's named symbols in HEAD first — the feature may already be shipped

When triaging a SlangPy "feature request" that cites file:line pointers, grep the CURRENT checkout for the feature's named symbol BEFORE mapping a solution space. Issue line numbers are often stale, and the capability may already have landed as a byproduct of a parent/umbrella effort.

**Concrete case (#807 "0-D dispatch with explicit thread count"):** the headline ask — explicit thread count unified into the normal call path — was already implemented and functionally tested at HEAD via `module.func(..., _thread_count=N)` (valid only when call_dimensionality==0; calldata.py:266-274 guard; native short-circuit slangpy.cpp:629-632; codegen generator.py:502-531; tests test_tensorview.py:220-273 + test_difftensorview.py:181). It shipped as a byproduct of the parent codegen-optimization issue #806 (PRs #818, #870). A naive read of the issue body would have produced a "ready-for-fix, implement X" verdict; the grep flipped it to **needs-decision** (the only remaining work is a maintainer call on API unification between `function.dispatch(uint3)` and the `_thread_count` int kwarg, plus docs).

**Why:** sub-task issues filed under an umbrella effort frequently lag the code — the umbrella PR closes the sub-task's substance without closing the issue. **How to apply:** Step-3 research should always include `grep -rn "<feature symbol>" slangpy/core` in the live checkout; if it's already wired + tested, the verdict is needs-decision (defer to maintainer for the design/priority call), not ready-for-fix. Bonus signal: a maintainer comment like "double-check priority with Chris" with no recorded resolution = priority itself is unsettled → needs-decision.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781015340808-slangpy-triage-grep-the-issue-s-named-symbols-in-h.md`_
