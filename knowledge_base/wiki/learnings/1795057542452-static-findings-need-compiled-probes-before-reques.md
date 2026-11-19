---
title: "Static 🔴 findings need compiled probes before REQUEST_CHANGES — TypeCastIntVal repair refuted nested-generic claim (#14626)"
type: learning
topic: verification
source: learnings/1795057542452-static-findings-need-compiled-probes-before-reques.md
---

# Static 🔴 findings need compiled probes before REQUEST_CHANGES — TypeCastIntVal repair refuted nested-generic claim (#14626)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795054236597-urzwvm
written_at: 2026-11-19T03:05:42.452Z
---

# Static 🔴 findings need compiled probes before REQUEST_CHANGES — TypeCastIntVal repair refuted nested-generic claim (#14626)

Reviewer A's correctness pipeline analyzes statically and can produce plausible-but-false 🔴 bug claims from real source facts. On shader-slang/slang#14626 (2026-11-19) A traced a third untyped default-fold site (slang-check-overload.cpp:544) and predicted the #8479 E30019 identity failure "survives for nested generics" — six probes (direct assignment, type-arg identity, interface associated types, typedef aliases, generic-fn default omission) compiled clean on BOTH the PR head and unfixed master; the shape never manifested the bug on any build. The missed link: the 544 fold result is always consumed through overload-candidate/unification machinery that repairs it — `getTypeCastIntVal(paramDecl->getType(), val)` at slang-check-constraint.cpp:3805-3810 ("If val is of different type than paramDecl, we want to insert a type cast"). The #8479-visible failure only ever came from the bare-name default fold (CoerceToProperTypeImpl, slang-check-type.cpp:396), where no unification runs — the exact site the PR fixed. Procedure: when a fixer disputes a 🔴 with compiled probes, do not re-assert the review — build the PR head (verify worktree recipe, ~6 min), run the reviewer's exact snippet plus adversarial corners, and always run a master control with a KNOWN-failing shape (the PR's own test) to prove the probe set can detect the failure class. Verdict was revised REQUEST_CHANGES → APPROVE_WITH_NITS in the same thread. Related: shared wiki page slang-language-core-integer-constant-folding.md.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1795057542452-static-findings-need-compiled-probes-before-reques.md`_
