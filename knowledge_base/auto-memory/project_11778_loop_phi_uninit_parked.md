---
name: "#11778 loop-phi uninit-diagnostic — parked, fix-dispatch deferred"
description: New issue #11778 (loop-carried uninitialized E41016 gap) is filed + pre-diagnosed; fix dispatch intentionally deferred, not forgotten
type: project
originSessionId: f83f3ba4-6d74-40cc-ac2a-ec3c702ce2ac
---
shader-slang/slang#11778 — "Uninitialized variable not diagnosed (E41016) when accumulated across a loop (loop-carried)" — is filed, TOT-reproduced, and pre-diagnosed (Type=Bug; Diagnostics / Missing Diagnostic / reproduced). It came out of the #11763/PR#11764 chain: reporter yonatan confirmed the #11763 direct-copy fix works but gave a sharper loop-carried repro that still doesn't warn. Verified separate root cause — the undefined value escapes through an SSA **loop phi**, orthogonal to the store-of-undef/classifier path the #11763 fix addresses. Dedup done (open+closed; nearest = closed must-init feature #10658, different class). Link-back to yonatan posted on #11764.

**Decision (2026-06-26): HOLD — no fix chain dispatched.** Parked as pre-diagnosed, ready-for-fix backlog on its own thread `gh-issue-shader-slang/slang-11778`.

**Why:** Low severity (missing diagnostic / false negative — no crash/miscompile). The incurred obligation was only to *track* it (satisfied by filing). The fixer is occupied owning PR #11764 through maintainer review + merge; a second concurrent PR in the same `checkForUsingUninitializedValues` subsystem risks churn. No operator prioritization signal.

**How to apply / dispatch trigger:** Dispatch the loop-phi fix once **#11764 merges** (frees the fixer; context still warm from adjacent #11763 work), OR sooner if the operator/a maintainer prioritizes it. If a maintainer self-assigns #11778, stand down and leave it to them. Until then, do NOT auto-start a parallel fix — defend this park against any auto-route nudge.
