---
title: "slang#12004 OUTCOME — Approach A rejected as 'downgrading'; sampler-as-descriptor is the desired form, not the bug"
type: learning
topic: slang-compiler
source: learnings/1783635981424-slang-12004-outcome-approach-a-rejected-as-downgra.md
---

# slang#12004 OUTCOME — Approach A rejected as "downgrading"; sampler-as-descriptor is the desired form, not the bug

**Terminal outcome (2026-07-09) for shader-slang/slang#12004** — the sampler-vs-texture `[noinline]` SPIR-V param asymmetry (see companion learning "slang#12004 sampler-vs-texture noinline SPIR-V param asymmetry" for the root cause: `isIllegalSPIRVParameterType`@slang-ir-specialize-resources.cpp:1371-1379, texture always-specialized, scalar sampler not).

**Maintainer decision (jkwak-work relaying Yong/csyonghe):** PR #12027 (Approach A — specialize scalar `SamplerState` params like textures so BOTH pass by bindless index) was **CLOSED UNMERGED** and Approach A **EXPLICITLY REJECTED**. Quote: *"we don't want to make changes to the SamplerState side. Passing the sampler-state as descriptors should be considered **downgrading**."* Issue parked (`Dev Reviewed` label + internal board "Unplanned").

**The key insight — which direction is "correct" was NOT obvious from the code, and my triage guessed the wrong one as the recommendation:** the sampler being passed by-value as a loaded `OpTypeSampler` is the DESIRED form, not the anomaly. The texture being passed by-index-and-reloaded is the WORKAROUND (from #3252, for old driver bugs). So the principled fix direction is **Approach B** (revert the texture index workaround → both by VALUE), not A (drag the sampler down to by-index). A was rejected precisely because it makes the good case worse to match the bad case.

**Triage lesson:** when an asymmetry has a "good" leg and a "bad" leg, the fix should lift the bad leg to the good, not lower the good to the bad — even when lowering is the smaller/lower-risk diff. My memo DID enumerate B and flag it as the reporter's preference + a maintainer design call, but RECOMMENDED A as "fastest correct fix that doesn't regress adjacent surfaces." That framing under-weighted that A is a *quality regression* (downgrade) even if behavior-symmetric. Next time: for a codegen-consistency asymmetry, lead by asking which leg is the better codegen and default the recommendation toward converging on THAT, flagging the risk of touching the older invariant rather than defaulting to the low-risk-but-downgrading direction.

**Status of B:** NOT authorized — "we currently don't have a plan to remove the workaround"; removal scheduled only if proven safe for drivers, else wait for driver stability. Re-engage ONLY on a future maintainer directive to prototype B (via webhook). Do NOT re-open with B unilaterally — relaxing the #3252 texture-always-specialize invariant is maintainer-owned and explicitly deferred.

Chain outcome: clean triage→fix→maintainer-decision cycle; A didn't land but the PR surfaced the exact A-vs-B tradeoff on the real invariant so maintainers could decide with full framing.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783635981424-slang-12004-outcome-approach-a-rejected-as-downgra.md`_
