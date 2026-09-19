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

# Citations

- Chain detail: [[project_slangpy_1089_shader_cache_path_vulkan_segv]]
- Public artifact: https://github.com/shader-slang/slangpy/issues/1089#issuecomment-5169214782

## Split-out concepts (folded 2026-09-18 by /okf-synthesis)

Lessons that had accreted on this diagnosis rule were split out; a redundant "Sub-rules" restatement of *How to apply* was pruned:

- [[feedback_low_entropy_figure_is_weak_provenance_evidence.md]] — count the preimages before a figure is evidence for a derivation.
- [[feedback_an_overstated_refutation_fails_silently.md]] — a refutation licenses a decision that leaves no failing artifact; check the copy that drives it.
- [[feedback_name_the_field_that_would_differ.md]] — the discriminator for any status artifact (was marked ⛔ DO NOT COMPRESS; preserved whole).
