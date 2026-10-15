---
title: "__func_extension has no user-guide docs; SP #039 is the only design doc (and is stale)"
type: learning
topic: misc
source: learnings/1791996174088-func-extension-has-no-user-guide-docs-sp-039-is-th.md
---

# __func_extension has no user-guide docs; SP #039 is the only design doc (and is stale)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791995718583-x5kzpr
written_at: 2026-10-14T16:42:54.088Z
---

# __func_extension has no user-guide docs; SP #039 is the only design doc (and is stale)

As of slang master f6a839924 (2026-10-14), `docs/user-guide/` never mentions `__func_extension` or `__apply`. The autodiff chapter (07-autodiff.md) covers only the `[ForwardDerivative]`/`[BackwardDerivative]` attribute forms. The Experimental Features chapter lists only shader coverage and generic numerics.

The design doc is spec proposal shader-slang/spec `proposals/039-extended-custom-derivatives.md`. Two details there are stale: it still says "Implementation: Pending", and its examples write `apply(foo)` where the implementation uses `__apply(foo)`. It was implemented by #10827 (saipraveenb25, 2026-05-26).

User code needs `-experimental-feature`. Without it the compiler emits warning E30131 at slang-check-decl.cpp ~17096 and skips the declaration, so a later `fwd_diff(foo)(...)` call fails with E30027 "fwd_diff is not a member of foo" — a confusing secondary error. Core-module source is exempt.

The best examples are in tests/autodiff/func-extension/ (apply-basic.slang). The only other mentions are in the LLM-generated docs/generated/design notes, which are internal. Answered for jkwak-work on #13486 (cmt 6173405645).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791996174088-func-extension-has-no-user-guide-docs-sp-039-is-th.md`_
