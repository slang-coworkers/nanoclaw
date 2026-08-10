---
name: feedback_a_local_green_is_an_environment_claim_too
description: "ANCHOR C's inverse: my PASS is as environment-bound as my FAIL. nanoclaw#1150 R2 — new tests 9/9 on my Node 22, 1 failed on CI's Node 20; err.code differed. When my result and CI's disagree, CI is authoritative for CI and the runtime version is the first variable to probe."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a5b972af-7843-4f33-bba2-5d5f162f197f
---

# A local GREEN is an environment claim too — probe the runtime version before disputing CI

**Measured 2026-08-09, nanoclaw#1150 R2 (head `b451aa7e`).** A new test file ran **9/9 green on my
edge**. CI reported **1 failed / 161 passed** on the same commit. ⭐⭐⭐**The instinct is to treat my
own passing run as the reliable one and CI's red as flake or infrastructure. That is backwards here:
my green was the environment-specific claim.**

ANCHOR C is normally about a *negative* — "this doesn't work here" arriving as a general fact.
⇒ ⭐⭐⭐**The inverse is equally live and feels much safer, which is why it slips through: "it passes
for me" is a statement about MY interpreter, not about the code.**

## The mechanism (root-caused by execution, not inferred)

I run Node **v22.23.1**; the repo pins Node **20** (`compose-check.yml:53`, `ci.yml`). For an
unparseable `package.json`, the resolver's thrown error differs by version:

| Node | `err.code` | message |
|---|---|---|
| 22.23.1 | `ERR_INVALID_PACKAGE_CONFIG` | `Invalid package config …` |
| **20.20.2** | **`undefined`** | `Error parsing …: Expected propert…` |

Code keyed on `err?.code === 'ERR_INVALID_PACKAGE_CONFIG'` therefore takes a *different branch* on
the shipped runtime. Running the real script against a corrupt manifest: node22 → `DAMAGED INSTALL`
(correct), node20 → `UNDECLARED TRANSITIVE` (wrong advice, wrong branch to fix).

⇒ ⭐⭐**The failing test was reporting a REAL defect on the shipped runtime, not being too strict.**
Had I dismissed CI's red as flake — the cheap move, backed by my own 9/9 — I would have told the
author their test was wrong and left a live mis-diagnosis in the gate.

## The procedure

✅**Get a real interpreter of the pinned version; do not reason about it.** `npx -y node@20 script.mjs`
took seconds and settled it. **Inferring cross-version behavior from release notes or memory is the
same error as inferring another container's file contents.**

✅**Cheapest discriminator when local and CI disagree — diff the versions FIRST:** `node --version`
vs the `node-version:` pin in the workflow. Runtime/toolchain version is the highest-prior variable
for a test that passes locally and fails in CI; check it before reading any test logic.

⇒ ⭐⭐**Asymmetry worth internalizing: CI is authoritative for CI.** My machine can only prove
"passes on v22." Only a run on the pinned version speaks to what ships. When the two disagree,
the burden is on my green, not on their red.

⚠️**Sibling trap on the same review, opposite direction:** a smoke-failure `detail:` line surfaced a
UNDICI warning instead of the real error — caused by `NODE_USE_ENV_PROXY=1` **in my own container**
(OneCLI proxy), absent on CI. I published that as *"my edge, not charging it"* plus a cosmetic note.
⇒ ⭐⭐**Same session, both directions: my FAIL was environment-bound (don't charge it) and my PASS was
environment-bound (don't trust it). Ask which edge produced a result BEFORE deciding what it proves** —
about my own results as rigorously as about a peer's.

Related: [[feedback_published_negative_env_claims_need_rederivation]],
[[feedback_a_guard_must_run_where_the_failure_is_silent]],
[[project_nanoclaw_1150_ccusage_own_nvmain]].
