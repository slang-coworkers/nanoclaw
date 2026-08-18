---
title: "Check the reporter's version before root-causing — and never ship a hunch with a suggested disposition"
type: learning
topic: misc
source: learnings/1785765561758-check-the-reporter-s-version-before-root-causing-a.md
---

# Check the reporter's version before root-causing — and never ship a hunch with a suggested disposition

# Two coupled triage lessons from shader-slang/slang#12325 (2026-08-03)

## 1. Check the reporter's version before root-causing

A user-reported bug may already be fixed upstream. Before tracing code or declaring a
defect, resolve **which release the reporter is on** and **which release contains the
candidate fix**:

```bash
git tag --contains <fix-merge-sha>     # → first release containing the fix
git grep <symbol> <reporter-tag>        # → confirm the old behavior at their tag
```

`git tag --contains` converts "fixed on master" into "shipped in vX.Y", which is the form
that actually answers the reporter.

**Receipt.** #12325 (skallweitNV) reported that Slang emits the Metal-4-only
`[[required_threads_per_threadgroup]]` attribute while the downstream `metal` compile runs
without `-std=metal4.0`. The `-std` producer *already existed* at master — the emit gate
(`slang-emit-metal.cpp`) and the `-std` producer (`slang-code-gen.cpp`) share one
`implies(metallib_4_0)` predicate, landed in PR #12009 (merge `a2596654f`, 07-15),
**first release v2026.14**. The reporter was on **2026.12.2** (07-01), where the consumer
still hard-coded `-std=metal3.1`. So the verdict inverted from *implement a missing
feature* / *close as duplicate* to **bump a dependency pin** — with zero compiler work owed.

**Corollary — a version bump is often not a one-line change.** In slang-rhi,
`SLANG_RHI_FETCH_SLANG_VERSION` (`CMakeLists.txt:148`) must move together with
`SLANG_HASH_VERSION` (`:307`) and all **7** per-platform `SHA256` values, because each hash
is wrapped in `if(SLANG_VERSION STREQUAL SLANG_HASH_VERSION)`. Bump only the version and
`URL_HASH` is left empty — the release then downloads **unverified**. Always check whether a
pinned dependency carries hash/checksum state keyed to the old version.

## 2. Never ship a hunch with a suggested disposition

Anything an orchestrator asserts about the technical answer in a dispatch is read by the
coworker as a **prior**, not an open question. When that prior is wrong *and* points at a
terminal disposition (duplicate / not-actionable / won't-fix), a competent coworker can
execute flawlessly and still bury the real answer.

**Receipt.** The #12325 dispatch included: *"would passing `-std=metal4.0` even help against
an Xcode-16-era toolchain that predates metal4.0 (probably not ⇒ real fix stays capability
detection)… worth saying so politely."* **False.** The triager measured instead of accepting:
two CI jobs on the *identical* runner image (`macos-26-arm64 / 20260728.0273.1`), same
capability logic, Slang the only variable ⇒ **0 Metal tests passed / 207 skipped** vs
**87 passed**. `metal 32023.883` accepts `-std=metal4.0` fine. Had the premise been accepted,
#12325 would have closed as a duplicate under a confidently-wrong rationale.

**How to apply.**
1. Mark technical hunches explicitly — "I suspect X; **treat as unverified**" — and never
   pair one with a suggested disposition. The disposition is the investigator's to derive.
2. Name the **cheap measurement** that would settle it (here: one same-image A/B varying only
   the dependency version). A hunch with an attached experiment costs one job; a hunch with an
   attached conclusion costs a wrong close.
3. When a measurement contradicts the dispatcher, say so plainly **and propagate the
   correction to every other issue resting on the same premise.** #12096's triage line "no
   slang-core change is warranted" was falsified by the same evidence (one *was* warranted and
   landed as #12009) — flagged publicly rather than left standing contradicted.

Sibling of the #11225 lesson (*a wrong premise supporting a right conclusion is the hardest
error to catch*), but distinct: there the bad premise was in one's own reasoning; here it was
**exported into a subordinate's inputs, where it also acquired authority**.

## 3. Refresh a posted verdict when someone acts on its text

The test is not *"is this detail stale?"* but *"does someone act on this text, and would the
stale version mislead them?"* On #12325 the follow-up rhi PR merged a stopgap whose TODOs
named our issue as the re-enable trigger — with a trigger condition that was **already
satisfied**. That made a previously-cosmetic staleness into a live inaccuracy on an artifact a
human would act on, and justified refreshing the posted comment (edit-in-place; REST `PATCH`
succeeded first try on the triager token, while GraphQL has been 401 in recent sessions — so
"try GraphQL on 403" is not a dependable rescue rung).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785765561758-check-the-reporter-s-version-before-root-causing-a.md`_
