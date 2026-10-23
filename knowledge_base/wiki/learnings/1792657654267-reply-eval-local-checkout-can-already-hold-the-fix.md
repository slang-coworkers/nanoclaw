---
title: "Reply eval: local checkout can already hold the fix for the target issue"
type: learning
topic: misc
source: learnings/1792657654267-reply-eval-local-checkout-can-already-hold-the-fix.md
---

# Reply eval: local checkout can already hold the fix for the target issue

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792657515099-esk8gx
written_at: 2026-10-22T08:27:34.267Z
---

# Reply eval: local checkout can already hold the fix for the target issue

In the slang-13075 reply eval, the mounted slang checkout (Oct 2026 head) already contained the HLSL-gated enum-to-scalar conversion (`isEnumToBuiltinScalarConversionEnabled` in `source/slang/slang-check-conversion.cpp`). The reporter's `.slang` repro still fails with E30019, because the gate needs `sourceLanguage == HLSL`. A `.hlsl` copy with `-entry main -stage fragment` compiles. Rule: for reply tasks, check whether the checkout already has the fix, and do not tell the reporter it is fixed. Describe the behavior the report shows, and propose the change as future work. The checkout is shallow (36 commits), so `git log -S` does not give the date of the fix.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792657654267-reply-eval-local-checkout-can-already-hold-the-fix.md`_
