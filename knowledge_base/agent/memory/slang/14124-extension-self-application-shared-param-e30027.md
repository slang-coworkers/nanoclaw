---
type: chain
title: "slang#14124: E30027 when an extension method calls a same-extension member on another specialization"
description: "Bot-filed 10-31 08:10Z by slang-triager (follow-up 3 of #13741, chain 13737). jkwak-work self-assigned + milestoned Q1 2027 on 11-02. Operator asked for triage 11-05; answered directly (no dispatch): semantic checker / generic extension application, P3, maintainer-owned; root-cause hypothesis unverified."
tags: [semantic-check, generics, extension, maintainer-owned]
---

# slang#14124: extension self-application with a shared generic parameter

Repro is in the issue: inside `extension Box<T, N>`, `Box<T, 0> b; b.get()` fails E30027, but `Box<T, N>`, `Box<float, 0>`,
a second extension block, a free generic function, and a struct-body `get` all compile. Owner chain:
[13737](13737-hlsl-combined-sampler-texture-only-ops.md) (#13741 uses a free-function trampoline instead of the member call).

- **11-02 19:00Z** jkwak-work self-assigned it and set milestone Q1 2027 (Winter). No comments, no PR (11-05 11:3xZ read).
- **11-05 11:35Z** operator (dashboard msg 40) asked for triage. Rung 4 holds a maintainer-assigned bot filing, but an operator
  ask resumes it. I answered **directly, with no triager dispatch**, as in the #13442 precedent: the filing is already the public
  triage. Reproduced with the local Release slangc (built 11-02 22:24Z): rc 255 E30027; `Box<T, N>` rc 0.
- **Verdict:** front-end semantic checking (generic extension application during member lookup). Bug, low severity, **P3**
  (valid code is rejected at compile time, it is not silent, and the workaround is known). Maintainer-owned; no bot fixer unless the operator or jkwak-work asks.
- **Hypothesis (Main's, from reading code, unverified — not built or patched):** `applyExtensionToType`
  (`slang-check-decl.cpp:18589`) short-circuits only when the whole target type equals the receiver. Otherwise it calls
  `TryUnifyTypes(Box<T,N>, Box<T,0>)`, whose `if (fst->equals(snd)) return true;` (`slang-check-constraint.cpp:4384`)
  matches the extension's `T` against itself and records **no constraint for `T`**. So `trySolveGenericArguments` cannot
  solve `T`, the extension does not apply, and `get` is not found. This fits every row of the issue's variant table: a
  second extension or a free function has a *different* `T` decl, so a constraint is recorded.
- Next: nothing agent-side. Webhooks deliver jkwak-work's activity.
