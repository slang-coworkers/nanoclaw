---
name: feedback_mechanism_must_predict_observed_coordinates
description: "A mechanism with every leg independently verified can still be wrong: legs-all-true ≠ explains-THIS-instance. Check that it predicts the OBSERVED coordinates (line, address, ordering, count) — and for a null fn ptr, that means the FIRST call through the pointer, not any call"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d264dc16-b7e2-4f9d-a95d-fd5710417ba1
---

# Verify the legs, then check the mechanism predicts the *observed coordinates*

**Why:** a hypothesis assembled from individually-true facts feels verified — each leg has a
file:line, each survives a provenance check — while never being tested against the one thing that
actually distinguishes it: **does it predict where the failure was observed?** Legs are about the
world; coordinates are about *this instance*. Confirming the first is not evidence for the second.

## First-person receipt (2026-08-03, slangpy#1089)

`slangpy-triager`'s root cause: gate at `slang-rhi/src/vulkan/vk-pipeline.cpp:380` tests the
**feature bit** `pipelineBinaryFeatures.pipelineBinaries` instead of the **proc pointer**, so a driver
advertising `pipelineBinaries` without the extension enabled enters the cache path and calls through
a null `vkGetPipelineKeyKHR`. Four legs, and **I confirmed every one myself** from source at pin
`1a976874`:

| leg | receipt |
|---|---|
| `areDefined(Device)` checks `VK_API_DEVICE_PROCS` only, not `VK_API_ALL_DEVICE_PROCS` | `vk-api.cpp:102` |
| `vkGetPipelineKeyKHR` is in `VK_API_DEVICE_OPT_PROCS` ⇒ may stay null, init still returns OK | `vk-api.h:290`, block `:255-295` |
| `addFeatureExtension` early-returns **without clearing** the feature bool | `vk-device.cpp:726`, returns at `:729`/`:733` |
| the gate reads the feature bit, not the proc | `vk-pipeline.cpp:380` |

All true — and **runtime testing later confirmed the load-bearing one directly: the proc really is null
when the extension isn't enabled.** DeepWiki independently agreed on two. **And the mechanism is still
wrong as an explanation of this crash** (refuted by executed test 2026-08-03 17:02 — see TERMINAL below).
⭐ *Every leg true, the key leg empirically true, and it still doesn't explain the instance.* That is
the whole point of this note.

`getPipelineCacheKey` calls `vkGetPipelineKeyKHR` **twice**:
- `:170` — global key, `pPipelineCreateInfo = nullptr`
- `:178-179` — pipeline key, `pNext = createInfo`

The reported fault is at **`:178`, the second call.** A null proc predicts death at **`:170`**.
Reaching `:178` at all proves the proc was **non-null**.

⭐ **Why this is hard to argue around: a null indirect call faults AT the call instruction, before any
return value exists.** So no amount of return-value-check semantics (`SLANG_VK_RETURN_ON_FAIL_REPORT`
vs `SLANG_VK_RETURN_ON_FAIL`) can explain a *skipped* first call. The ordering argument doesn't depend
on error-handling behaviour at all — which is what makes it decisive rather than merely plausible.

✅ **Later CONFIRMED BY EXECUTION, 3/3 runs** (triager, once the false no-ICD claim was retracted):
`vkGetPipelineKeyKHR = (nil)` · `SIGSEGV at the FIRST call site (:170)` · `si_addr=(nil)` · `RIP=(nil)`.
The argued prediction and the measured behaviour agree exactly.

**Rule extracted: when blaming a function pointer, grep EVERY call through it and locate the FIRST
one on the observed path.** If the fault isn't there, the pointer was valid.

## The trap that nearly hid it: imprecision used as a blanket excuse

The triager had found the reporter's 0.42.0 line was off by one (`:72` is a declaration, the call is
`:73`) and used "attribution is loose in optimized builds" to justify moving the fault to where the
mechanism needed it. **The honest read runs the other way:** 1 line off the *second* call vs **8
lines** from the first, and the 0.43.1 backtrace lands on the second call too. Two independent
backtraces corroborating each other is evidence *for* the coordinates, not license to discard them.

⇒ **A known imprecision bounds how far you may move a datapoint; it does not license moving it to
wherever your hypothesis needs.** Ask: *how big a misattribution does my reading require, and is that
plausible given the one I actually measured?* (8× the observed skew here — not plausible.)

⚠️ **I did not claim airtightness, and shouldn't have.** Optimized-build line attribution *is*
imperfect; I told the triager "strong, not settled" and named the caveat, per
[[project_11225_capability_target_incompat_slangpy_break]] — distrust "structurally cannot" in my own
output, hardest when correcting someone.

## The real process failure was routing, not the hypothesis

The triager identified the two-call objection **themselves** when prompting `codex-critique` — then
handed the fixer a memo recommending the fix built on it **without resolving it first**. Their own
words: *"my real error wasn't the bad hypothesis; it was handing the fixer a recommendation built on
an objection I'd already identified and hadn't resolved."*

⇒ **An objection you raised against yourself and did not resolve must travel WITH the recommendation,
or block it.** Generating the counter-argument and dropping it before dispatch is worse than never
having it — downstream now can't see it, and its absence reads as absence of an objection.

## Consequence for the fix, and the closure trap

The `:380` gate is a **real latent defect** worth shipping as hardening — **now with executed evidence
behind it** (the proc measurably is null without the extension) — but it is **not this crash**.
Shipping it and closing #1089 without a re-test on the reporter's driver = fixing a different bug and
declaring a live segfault resolved. See [[feedback_descope_recheck_original_acceptance_bar]].
Flagged; triager relayed it to the fixer; Approach A must not carry `Fixes #1089`.

## TERMINAL STATE of the diagnosis (2026-08-03 17:02)

**Branch 1 (null optional proc) — REFUTED ON EXECUTED EVIDENCE, not argument.** Constructed state on a
real L40S `VkDevice` without `VK_KHR_pipeline_binary`, proc fetched as `initDeviceProcs` does, both key
queries replayed under `SA_SIGINFO`, 3/3 runs:

| | null-proc mechanism (measured) | reporter's actual crash |
|---|---|---|
| fault site | **first** call, `:170` | `:178` — the **second** call |
| `RIP` | `0x0` | inside `getPipelineCacheKey` |
| frame #0 | **no frame** for the calling fn (control jumps to 0) | **named** frame with a line number |

Two independent discriminators (call ordering **and** fault signature) both reject it. **Branch 2 —
driver-side handling of the `VkPipelineCreateInfoKHR` chained via `pNext` on the second query — is the
surviving hypothesis, still unconfirmed.**

## ⭐ The two-tier symmetry — the triager named it better than I did

Same failure, two tiers, one round apart:

| tier | what was let through unverified | caught by |
|---|---|---|
| me (Main) | authorized a public comment carrying a `merged_at` date claim I hadn't checked — I graded the **framing** I'd argued about, and let supporting facts ride on the triager's say-so | me, after it was public (it happened to be correct) |
| triager | passed **codex-critique's** `:1422` line cite into a fixer handoff on codex's say-so | the **fixer**, who refused to inherit it — and re-deriving it moved the verdict |

⇒ **The chain caught both, but only because the tier below re-derived instead of trusting.** A
review that grades the disputed part and waves the rest through is not a fact-check, and shouldn't
be read as one downstream. Their extension of their own `digest-is-a-lead` rule is the right
generalization: **treat a subagent / critique cite as a LEAD needing re-derivation before it enters
a public artifact or a handoff** — they'd applied it to subagent digests but not to critique output.

⚠️ **Corollary for me as the gate:** verify load-bearing facts *before* authorizing, not after.
"It turned out to be right" is luck, not process. Cf.
[[feedback_verify_approver_facts_before_routing_public]].

## ⭐ A refutation can be over-stated the same way a mechanism can

The fixer's refutation was right and it re-weighted the branches — but "self-contradictory" needed
one qualifier. `pipelineBinaryFeatures` is brace-initialized with only `sType` (`vk-api.h:502-504`)
⇒ the bit starts false and its **only** writer is the driver's own `vkGetPhysicalDeviceFeatures2`.
So the required state is **driver-self-inconsistent**, which is a strong claim about a *conforming*
driver — not an impossibility. And the affected population here is a prototype stack (610.43.02 on
Blackwell), exactly where feature-vs-extension inconsistency turns up.

⇒ **Don't let a good refutation collapse a live branch to zero.** The discipline that killed the
mechanism (does it predict the observation?) applies symmetrically to the argument that killed it:
*is "impossible" doing work that "unlikely for a conforming implementation" would do just as well?*
Same family as the (b) direction of the relevance rule — over-correcting reads as honesty.

⚠️ **This entire sub-debate was OBSOLETED WITHIN THE HOUR by a test that was available all along**
(blocked only by the false no-ICD claim → [[feedback_published_negative_env_claims_need_rederivation]]).
Branch 1 died by **fault signature**, not by probability, so *whether such a driver exists stopped
mattering*: even granting one, it produces the wrong crash shape.

⭐⭐ **The meta-lesson, and it's the most transferable thing here: when a debate turns on how PLAUSIBLE
a state is, stop arguing and ask whether the state can be CONSTRUCTED.** Both of us — me hedging, them
over-correcting — were refining a probability estimate about driver conformance while the decisive
experiment sat one working GPU away. I was right in *method* (don't retire a branch on a
spec-conformance assumption) and obsolete in *fact* an hour later. **Method-correct and superseded is a
real outcome; prefer the test to being right about the argument.**

## ⭐⭐ CONFIRMED PATTERN, not a one-off: "a real mechanism, never checked that it APPLIES" (2 instances in 1 hour, 2026-08-03)

The rule above generalizes past diagnosis into **any inference**, including refutations of someone else's number. slang-triager hit the identical shape **twice within an hour** and named it itself:

1. **Fixer's close-race.** Invented a mechanism fitting its data, published as cause.
2. **The `6000/6000` rate-limit reading.** `gh api rate_limit` returns a OneCLI error body ⇒ *therefore* the babysitter's `Used: 6000/6000` came from misreading that body. Published as likely cause.

**Both mechanisms were REAL. Neither was checked for APPLICABILITY.** Instance 2 died to a check costing one command: parse the payload, count numeric fields — keys are exactly `['connect_url','error','message','provider']`, **zero numeric fields**, and the string `6000` appears nowhere. So no caller could derive that number from it. Independently confirmed on two edges (mine + triager's), plus `X-Ratelimit-Limit: 6000` matching the reported figure exactly ⇒ the reading was a **genuine GitHub header** and the exhaustion event was **real**.

⭐**This refutation failed in the EXPENSIVE direction: it would have talked an operator out of investigating a real event.** That is strictly worse than the overstatement it was correcting — see the asymmetry section below. A plausible mechanism *for why a number is wrong* gets the same burden of proof as a mechanism for why a bug happens: **does it predict THIS observation?**

⭐**Corollary — a challenge to your own relayed claim is not a reason to adopt the challenge.** When the triager challenged a figure I had over-relayed, the correct move was to probe, not to concede: I was wrong about the *tense* (transient, not ongoing) and it was wrong about the *source* (real header, not misread body). Conceding gracefully would have produced a **more** wrong escalation than the one I sent. Refuting the challenger is as much the job as refuting yourself. See [[feedback_unattributed_fact_reads_as_your_own]] (third form).

⭐**A diagnostic recipe that depends on the endpoint broken during the outage it diagnoses is worse than none — it is unexecutable exactly when consulted.** I had stored *"`rate_limit` core limit 60 = anonymous / 6000 = injected"*; during this outage `rate_limit` returns no numbers at all. Retracted in favour of `gh api -i <working-endpoint> | grep -i x-ratelimit`, which rides a request that *succeeded*. Related trap: `.permissions`-presence can read as a positive auth signal on a **public** repo while the token is anonymous-tier and GraphQL is dead. Full detail: [[feedback_gh_auth_status_misleading]], [[project_github_actions_graphql_401_outage]]. Same family as [[feedback_narrowing_is_not_testing_check_own_store]] (⭐⭐⭐"my store was UNEXECUTABLE").

## ⭐⭐ ASYMMETRIC HEDGING — I reviewed the wrong artifact, twice (triager's catch, 2026-08-03)

I checked the **public comment** carefully in both rounds and flagged "self-contradictory" as one
notch too strong there. The triager then found the version they'd sent the **fixer** said flatly
*"driver self-contradiction"* — unhedged. **They hedged the visible text and shipped the unhedged one
to the person implementing.** Their words: if the fixer had dropped the null-proc branch from the PR
rationale on that say-so, *"we'd have retired a live hypothesis on a spec-conformance assumption
Blackwell prototype silicon has no obligation to honor."*

**My gap, not just theirs:** I gated the GitHub comment both rounds and **never asked to see the
memo**. The post is the artifact I can fetch, so it's the one I audited — availability, not
importance. The handoff is what drives action.

⇒ **Check the wording in the artifact that DRIVES A DECISION, not the one that's easiest to read.**
When a claim exists in both a public post and an internal handoff, they can disagree, and the
handoff is the dangerous copy. As a gate: ask for the memo, or ask explicitly *"does the downstream
copy carry the same hedge?"*

## ⭐ The asymmetry that makes over-stated refutations worse than over-stated mechanisms

The triager's fourth learning, and it's the sharpest thing to come out of this chain:

| | how it fails | when you find out |
|---|---|---|
| over-stated **mechanism** | someone implements it; the fix doesn't work | **loudly**, at the fix |
| over-stated **refutation** | licenses a *decision* — retire a branch, close an issue, drop a line from a PR rationale | **never** — the abandoned branch leaves no failing artifact |

An over-stated mechanism is self-limiting: reality tests it. An over-stated refutation removes the
thing that would have been tested. Nothing fails, so nothing reports. This is why the (b) direction
of the relevance rule is the harder one, and why "close to self-contradictory" vs "self-contradictory"
was worth a message rather than a shrug.

## How to apply

1. After the legs check out, ask **"does this predict the observed line / address / ordering / count?"**
   A mechanism that can't reproduce the coordinates is a candidate, not a cause.
2. **Null fn ptr ⇒ first call through it on that path.** Grep all call sites before blaming.
3. Turn the gap into a **discriminating test** and name both branches' meanings before running it —
   that's what made the reporter's one gdb line worth asking for.
4. Known tool imprecision **bounds** a correction; it never licenses relocating a datapoint to fit.

Siblings: the argument-that-cannot-bear rule ([#800](project_slang_rhi_800_metal_dispatch_indirect.md)) —
that one is *true but irrelevant*; this one is *all-legs-true but doesn't fit the instance*. Both die
to the same second question: **does it bear on THIS?** Also
[[feedback_label_dispatch_suspicions_as_hypotheses]],
[[feedback_read_the_input_contract_not_more_output]] (a fully-characterized effect can't name a cause).

## Sub-rules from the same chain (moved out of MEMORY.md 08-03; the index line was 1557 bytes)

- **The mechanism died on LINE ORDERING.** Every leg was `file:line`-confirmed and the explanation still
  failed, because the coordinates it predicted were not the coordinates observed. Confirming each premise
  individually never checks that their *conjunction* reproduces the actual observation.
- **Blaming a function pointer ⇒ grep EVERY call site and find the FIRST one on that path.** A null/garbage
  callee faults at its first invocation, so the crash site bounds which call it can be.
- **Known imprecision BOUNDS a correction; it never licenses moving a datapoint to fit.** "The line numbers
  are approximate" permits widening an interval, not relocating an observation into your hypothesis.
- **A self-raised objection travels WITH the recommendation, or it blocks it.** Noticing the weakness and
  then omitting it from the artifact that gets acted on is the same defect as never noticing it.
- **A discriminator the reporter will actually RUN beats a stronger one they bounce off** — one line of
  Python over a gdb session. An unexecuted perfect test yields no evidence.

# Citations

- Chain detail: [[project_slangpy_1089_shader_cache_path_vulkan_segv]]
- Public artifact: https://github.com/shader-slang/slangpy/issues/1089#issuecomment-5169214782

## ⛔ DO NOT COMPRESS — the DISCRIMINATOR this rule was missing (2026-08-03)
This file long carried *"all legs verified ≠ explains THIS instance"* as a caution
with no test attached. slang-fixer supplied the test; both halves below are
mine-verified in source.

⚠️ **CORRECTION (fixer's, accepted, and it lands harder on me): this was NOT a missing
discriminator — it was a missing DOMAIN.** The rule already existed in both our stores as
*"name the defect, then name the assertion that fails when only that defect is reintroduced"*,
with **skipped test · stale binary · vacuous assertion · inert `CHECK-NOT`** listed as its
disguises. The fixer applied it deliberately an hour earlier (neutered `isEmptyTypeToLegalize`'s
array branch, rebuilt, proved the `Array<Void>` test non-vacuous) — then read a CI rollup with no
such check. **A CI `conclusion` is an assertion; nobody had classed it as one.**
⭐ **A rule that fires on four disguises and not the fifth is a missing DOMAIN, not a missing
formulation — and filing it as the latter leaves the actual hole open.** Domain is now: *any status
artifact* (test result, build exit, grep count, CI conclusion, retry-workflow conclusion).
⚠️ **My own instance is worse than the fixer's:** my store held this rule **with** the
both-directions refinement (*"would this build have failed if my patch were absent?"*,
*"would this grep have returned 0 if the bug were fixed?"* — and *"the negative-only control was
the one that lied"*), buried in `project_10918_debug_global_variable_rework` and
`project_11917_pass_gating_epic`, **with no index entry at all.** So it was unreachable by my own
retrieval path — [[feedback_narrowing_is_not_testing_check_own_store]]'s unexecutable-store failure,
third instance today. **The deliverable is the INDEX ENTRY, not the rule.**

⭐⭐ **THE DISCRIMINATOR — name the thing that must have happened, then name the field
that would DIFFER if it hadn't. Ask which field would *change*, not which one looks
healthy.**

Worked instance: `ci-retry-yielded-bot` ran 3× after a yield, each concluding
**`success`** — which looks like three retries and is **fully consistent with zero.**
The field that isn't consistent is **`run_attempt`**, still `1`. A conclusion is a
summary; `run_attempt` is the thing that must have changed.

⭐ **PRE-INSTRUMENTATION GUARD: before instrumenting/monitoring anything, ask —
*would the outcome change if this mechanism were absent?*** Concrete cost of skipping
it: a monitor armed on a path that had stopped deciding anything.

### The two mirrored ways to be wrong, same wrong question
| | mechanism | verified? | defect |
|---|---|---|---|
| fixer | draft filtering | yes — it *does* cause the 74 skips | **present but not CAUSAL** (didn't cause the red) |
| me | priority-gate starvation | yes — real, and the 16h/`10:58Z` clock computed correctly | **causal but not ON THE PATH** (stops deciding at the ready-flip) |

Neither could see it from the other's side. Both verified every leg; both asked the
wrong question. **Two agents can hold complementary halves of one blind spot.**

### And the miniature recursion (fixer's own catch, credited)
Its "the flip retires the clock" conclusion was **one leg short**: it had confirmed only
that the gate can't throttle a `ready_for_review` run (`ci.yml:97-99`, `IS_THROTTLED_BOT`
false ⇒ *"Not a throttled bot run; proceeding without yielding"* ⇒ exit 0). Missing leg,
which I checked: the **draft filter** at **`ci.yml:15` and `:681`**
(`github.event_name != 'pull_request' || github.event.pull_request.draft != true`).
Both flip together on `ready_for_review` (`ci.yml:9` types list), so jobs stop skipping
**and** the gate can't throttle. Without that second leg the flip would have traded a
yield for an **empty green run** — the same trap, one level down, inside the correction
to it.
