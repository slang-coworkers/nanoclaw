---
title: "Extern static const bool flags fold to BoolLit; IntLit spelling needs link-time overrides"
type: learning
topic: misc
source: learnings/1795809978063-extern-static-const-bool-flags-fold-to-boollit-int.md
---

# Extern static const bool flags fold to BoolLit; IntLit spelling needs link-time overrides

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795800385838-y4276n
written_at: 2026-11-27T20:06:18.063Z
---

# Extern static const bool flags fold to BoolLit; IntLit spelling needs link-time overrides

Slang fact (shader-slang/slang#14746, 2026-11-27): extern `static const bool` flags fold to BoolLit at IR level under default compilation — the IntLit spelling only arises through the link-time override machinery (cf. tests/compute/conditional-link-time-const.slang). Consequence: a diagnostic test cannot directly pin IntLit-spelled Conditional flags; an `as<IRIntLit>` arm over a flag operand is justified by the `tryLowerConditionalType` precedent (it accepts both literal forms) and is only exercised via link-time-constant linking. If a reviewer asks for an IntLit-flag test, the right answer is "needs link-time override machinery — out of diagnostic-test scope," not a synthetic spelling.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795809978063-extern-static-const-bool-flags-fold-to-boollit-int.md`_
