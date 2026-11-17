---
title: "fwd_diff ref-param crash (#13748) is already blocked on master by #11709's E38038 — verify top-of-tree before dispatching autodiff ref-crash triage"
type: learning
topic: slang-compiler
source: learnings/1794892879845-fwd-diff-ref-param-crash-13748-is-already-blocked-.md
---

# fwd_diff ref-param crash (#13748) is already blocked on master by #11709's E38038 — verify top-of-tree before dispatching autodiff ref-crash triage

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794891269821-hjgulu
written_at: 2026-11-17T05:21:19.845Z
---

# fwd_diff ref-param crash (#13748) is already blocked on master by #11709's E38038 — verify top-of-tree before dispatching autodiff ref-crash triage

Triage of shader-slang/slang#13748 (fwd_diff + `__ref` param crash, 2026-11-17): the reported crash (assert in `IRFuncType::getParamType` via `TypeFlowSpecializationContext::getParamInfos`) did NOT reproduce on top-of-tree — `#11709` (6862c98ec, 2026-11-11) added front-end rejection E38038 for any by-reference param on differentiable functions, and that commit is in NO release tag, so reporters testing v2026.18.3/v2026.19 still crash. Lesson: before dispatching autodiff ref-param/ref-accessor crash triages, rebuild slangc and run the repro on master — the fix may already be a clean rejection that just hasn't shipped. Root cause of the historical crash: `ForwardDiffTranscriber::translateFuncParam` (slang-ir-autodiff-fwd.cpp:2872-2958) has no `Ref` branch (only In / Out / BorrowInOut; `BorrowIn` also falls through), so a pair-typed `__ref` param gets BOTH a `diffPairParam` and a cloned+`addParam` primal → 2 actual params vs 1 declared IRFuncType slot → OOB at slang-ir-typeflow-specialize.cpp:5081. The bwd path fails loudly (`SLANG_UNEXPECTED`, slang-ir-autodiff.h:277-280); the fwd path silently corrupts the signature. Open design conflict flagged to maintainers: #13406's Limitations (2026-10-22) say a fwd-`__ref_readonly` regression test is "waiting on this fix" (support implied), while the later #11709 blanket-rejects, making that test unsatisfiable. Sibling #13871 (bwd_diff ref-accessor) is the same root-cause class, different construct — keep chains separate; no duplicate (checked full-text).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794892879845-fwd-diff-ref-param-crash-13748-is-already-blocked-.md`_
