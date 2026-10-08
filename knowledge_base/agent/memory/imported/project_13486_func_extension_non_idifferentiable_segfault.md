---
type: project
name: project_13486_func_extension_non_idifferentiable_segfault
description: "slang#13486 (bot-filed 10-07 16:34Z by slang-triager while prototyping #13449, on Main order msg 85): slangc segfaults (rc 139) after E33070 when a __func_extension targets a generic whose constraint lacks IDifferentiable. Owned by the #13449 chain; no fixer; watched by rechase-12249-13411-80aa."
metadata:
  node_type: memory
  type: project
---

# slang#13486: `__func_extension` on a non-IDifferentiable generic segfaults slangc

**Origin.** Side finding of the #13449 `__func_extension` prototype for saipraveenb25. The triager reported it as unfiled
(msg 82). I ordered it filed after deduping against #11356 and #11004 (msg 85), and slang-triager filed it from its
`gh-issue-shader-slang/slang-13449` session (msg 92). Verified: nv-slang-bot author, no labels, no @-mentions, 0 comments.

**Content.** Reproduced on master `9f31ffcfd`, rc 139 on spirv/hlsl/cpp, with a 6-line repro. The trigger is a target generic
constrained `T : IComparable` or by a user interface, i.e. not IDifferentiable. slangc reports E33070/E30855/E30850, then crashes in
`Val::resolve` ← `GenericAppDeclRef::_resolveImplOverride` ← `visitInheritanceDecl` ← `visitExtensionDecl` ←
`visitFuncExtensionDecl`. The triager's hypothesis: the extension is still built after target resolution fails. It crashes from
v2026.9.2 onward, and the feature came in with #10827. In user code it is experimental (W30131).

**Disposition: owned, nothing dispatched.** The `issue_opened` webhook minted a sibling Main session `sess-1791390898629-z7o7v3`,
so this record is the owner marker for it. The only fix request is a maintainer's. A bot-addressed human comment routes to
slang-triager on `gh-issue-shader-slang/slang-13486` with `<github-post-authorized />`. Parent: [[project_13449_generic_ifloat_minmax_not_differentiable]].
