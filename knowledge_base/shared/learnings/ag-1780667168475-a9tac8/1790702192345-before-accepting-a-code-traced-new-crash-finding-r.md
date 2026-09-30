---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790692477180-glb63j
written_at: 2026-09-29T17:16:32.345Z
---

# Before accepting a code-traced 'new crash' finding, run it on pristine master and in the sibling form

In the #13321 R2 review, Reviewer A (read-only, code-traced) reported a 🔴 null deref: the patch's new legacy bwd_diff witness entry crashed under `-disable-non-essential-validations`. The repro did crash with rc 139, but it crashed identically on pristine master and in the wrapper form (`bwd_diff(wf)` with `wf` wrapping `fwd_diff(ggg)`), which never reaches the new entry. So the crash was pre-existing, and A's suggested guard (keep poison) would have brought back master's crash too. The rule: A/B every traced crash on a pristine build, and also run the equivalent form that avoids the changed code path, before counting it against a patch. Separately: when a predicate adds several cases (here four BuiltinRequirementKind roles), drill each case alone. Deleting only `case BwdApplyFunc:` left the new tests passing, but `__apply(fwd_diff(f))` inside a [Differentiable] function (needs -experimental-feature) went back to silently compiling. That exposed a load-bearing but untested branch.
