---
name: project_11989_examples_fail_on_warnings
description: "slang#11989: CI example tests should fail if they print warnings (filed at jkwak's request off #11985). TERMINAL for the bot: PR #12001 CLOSED unmerged 07-08 on POLICY — coworker bots may not modify .github/workflows/** regardless of route, so it was never landable. Issue stays OPEN, maintainer-owned; jkwak writes the CI PR locally (just -warnings-as-errors via compilerOptionEntries, no allowlist). Durable output = spinoffs #12006 (E41017 extern-global false positive) and #12007 (E36108 llvm-at-loadModule). Lesson: a workflow-only fix is maintainer-only — flag it at triage. The earlier rejection of -warnings-as-errors as unreachable was WRONG."
metadata: 
  node_type: memory
  type: project
  originSessionId: b63b776f-b15c-43f2-90e2-00d74c7ee891
---

# slang#11989 — example tests fail on warnings (TERMINAL for us)

https://github.com/shader-slang/slang/issues/11989 — filed by slang-triager at **jkwak-work**'s request
(bot mention on #11985, comment 4910115848; motivating context
[[project_11985_macos_metal_capability_regression]]). **Ask:** CI example tests must print no warnings
and fail if they do, so beginners get clean examples.

**✅ Outcome (2026-07-08 21:26Z):** PR #12001 **closed unmerged by jkwak on policy** (comment
4919366303): *"the PR is supposed to make changes to the workflow and coworker is not allowed to modify
them for security reasons. I will run an agent locally."* #11989 stays **OPEN and maintainer-owned**; the
CI PR is jkwak's local work. **No re-engage unless jkwak explicitly asks.** #12006 / #12007 are
jkwak-assigned ⇒ no auto-fixer; any dispatch on them is a fresh chain.

## ⭐ Lesson

A fix whose surface is **entirely `.github/workflows/**`** is policy-rejected for coworker bots
regardless of quality or route — on top of the App token lacking `workflows` permission
([[project_bot_workflows_permission]]; #12001 had to be pushed cross-fork from
`slang-coworkers:fix/issue-11989`, so no `ci.yml` ever ran). ⇒ **Catch it at triage scoping: flag
"workflow-file change → maintainer-only" and don't spend a fix cycle.**

## The two offenders (reproduced at exit 0, HEAD 33f9ed0ce / bfe6a7f14)

| example | diagnostic | disposition |
|---|---|---|
| `cpu-com-example` | `warning[E41017]` uninitialized global `globalDoThings` — host-provided `__extern_cpp`/`export __global`, no in-module init by design; `= {}` only trades it for warning E30521 | compiler false positive → **#12006** ([[project_12006_e41017_extern_cpp_false_positive]]) |
| `reflection-api` | `error[E36108]` + `fatal[E40003]` — **already an error**, so `-warnings-as-errors` is irrelevant; green only because the example discards the reflection `Result` | bisected @ d8e8e1a9e: `[require(sm_6_0)]` + a GPU-only op (`Texture2D.Sample`) pulls the entry into capability validation against auto-available `llvm`; target-independent → **#12007** ([[project_12007_e36108_require_llvm_falsepos]]) |

⇒ A gate must match `warning[` **and** `error[`/`fatal error[` — a warning-only grep misses reflection-api.

## How the design converged (jkwak drove every step)

1. **Triage recommendation H-A** (capture + anchored grep + per-code allowlist mirroring the skip file)
   was implemented as DRAFT #12001 after jkwak asked *"how is the PR going?"* — the hold assumed he'd
   self-fix; he expected the bot to drive. `report_pr_created(12001)` fired.
2. **jkwak rejected H-A** (comment 4916647794): use `-warnings-as-errors`, no allowlist, fix the shaders.
   ⛔ Triage had wrongly ruled `-warnings-as-errors` unreachable because "examples drive the API, not
   slangc" — but `WarningsAsErrors` is public `CompilerOptionName=19` (`slang.h:1000`), settable via
   `compilerOptionEntries`, as `example-base.cpp:77-85` already does. The triager said so plainly.
3. Neither offender is shader-cleanable, so the fixer **held and surfaced the per-offender blocker**
   (comment 4916836536) instead of shipping a red example or re-adding exceptions.
4. jkwak asked for #12006, briefly chose "compiler-exempt E41017 + example honors `Result`" (4919196664),
   then **superseded it** (4919252226): track reflection-api separately (#12007); once both are fixed,
   the #11989 PR is **only** the CI setting change. That plan was never dispatched, so nothing needed
   retracting on the wire.

Process notes: maintainer-self-assigned holds as in [[project_11988_nightly_spvopt_workflow_parked]] and
[[project_11806_cmake_options_maintainer_selffix]] — but a maintainer asking about PR progress *is* the
go-signal. When the maintainer's steer contradicts your earlier triage, re-verify at HEAD, adopt it where
feasible, and bring back a concrete blocker where it isn't.
