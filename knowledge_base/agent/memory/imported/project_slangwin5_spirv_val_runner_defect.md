---
name: project_slangwin5_spirv_val_runner_defect
title: SLANGWIN5 SPIR-V validation outage — stale runner PATH (RESOLVED 2026-08-05)
description: "✅RESOLVED 2026-08-05 by jkwak-work. ROOT CAUSE: VulkanSDK was upgraded on SLANGWIN5 with the OLD version DELETED, and the GitHub-runner SERVICE was never restarted, so its cached PATH pointed at a deleted Vulkan dir. FIX = restart the runner service (free). Symptom: compiles `[866/866]` but `spirv-val [ 0 / 866 ]`, exit 255 — an infra outage reading as 866 shader bugs. GREP TRAP: the emitted signature has INNER SPACES (`spirv-val [ 0 / 866 ]`); the compact `spirv-val [0/866]` matches ZERO on a genuine occurrence. Durable lessons: a REMEDY claim needs its OWN instrument (box-health says nothing about a long-lived service's cached env); tally by SIGNATURE not by HOST; a shared abstract description of two symptoms is a hypothesis of common cause, not a demonstration; before refuting a phrase test its STRONGEST reading; a correction rides in carrying authority — the success bullets of a self-critique need the same scrutiny as the failure bullets."
metadata:
  node_type: memory
  type: project
  originSessionId: 02f511c2-578b-4ccf-bd07-2049b7969ecd
---

# SLANGWIN5 SPIR-V validation outage — a stale runner PATH

**Terminal / RESOLVED 2026-08-05.** Distilled 2026-08-31 from an 85 KB investigation
chronicle (~34 H2 sections, many recording retracted intermediate claims). The dated
retraction-by-retraction narrative is pruned; what remains is the resolved root cause, the
grep trap, and the durable instrument/inference lessons — most of the day's value.

## Root cause and fix

**VulkanSDK was upgraded on SLANGWIN5 with the OLD version DELETED, and the GitHub-runner
SERVICE was never restarted** — so the long-lived runner process's **cached PATH still
pointed at a deleted Vulkan directory**, and every job on that box inherited the stale env.
**Fix = restart the runner service** (free; no depool, no reprovision). Verified green
(866/866 in all four modes, `- PASS` 3464, `- FAIL` 0).

**Symptom:** a job compiles `[ 866 / 866 ]` but reports `spirv-val [ 0 / 866 ]`, exit 255
— an infra outage that reads as 866 shader bugs. (There is no `spirv-val` binary;
validation is in-process `glslang_validateSPIRV`.) Filed #12341 (depool) + #12342 (in-tree
`validate()` conflates validator-absent with genuine-rejection — see
[[project_12342_downstream_absent_capability_slangresult]]).

⭐ **Not to be confused with the coincident VKGLCTS `failed to load slang.dll` limb on the
same box the same day** — that was a separate, nine-month-old latent cause (slang renamed
`slang.dll`→`slang-compiler.dll` in `dcb47b716`, 2025-10-31; the workflow copied only the
new name), fixed by VK-GL-CTS PR #17. A nine-month-old rename cannot produce a sharp onset,
so it was never evidence for the environment fault.

## The grep trap (highest-yield operational takeaway)

⛔ **The emitted signature has INNER SPACES: `spirv-val [ 0 / 866 ]`.** The compact
`spirv-val [0/866]` matches **ZERO** on a genuine occurrence, misclassifying an infra
outage as a code regression. ⇒ ⭐⭐⭐ **When a note records a value that will also be
grepped, store the EMITTED bytes — copy them out of the log, don't reconstruct the format
from memory.** And ⭐⭐⭐ **tally by SIGNATURE, never by HOST**: a host-scoped grep silently
merges every distinct defect that box carries.

## Durable reasoning lessons

- ⛔⭐⭐⭐ **A REMEDY claim needs its OWN instrument.** "The box is healthy" (a correct
  tool-vs-host control: `test-benchmark` green on SLANGWIN5 74 s before compile-regression
  failed) says NOTHING about whether a restart is a no-op — a long-lived service caches its
  environment at start, so a mid-life PATH/SDK change is invisible to it. This was the
  **second** remedy-from-defect error on the chain (first: "reruns are futile," refuted —
  `runs-on` is a POOL, and a rerun on a pool manufactures the within-head control).
  Reasoning from BOX HEALTH to PROCESS ENVIRONMENT crosses object boundaries.
  See [[feedback_control_the_instrument_not_the_reasoning]].
- ⭐⭐⭐ **Two symptoms sharing a plausible description is a HYPOTHESIS of common cause, never
  a demonstration.** The unifying phrase *"a freshly built binary can't resolve a
  DLL/symbol on this box"* covers any dynamic-linking failure on any host, so it was
  guaranteed to fit both limbs whether or not they shared a cause — coverage is not
  evidence. The test for common cause is coupling in TIME and MECHANISM; one date lookup
  refuted it. VS 17→18 was the wrong change (real: VulkanSDK): two toolchain changes landed
  in one window and the investigation latched onto the one its logs exposed (**observability
  bias**). A claim that survives the refutation of every mechanism beneath it is
  UNFALSIFIABLE at the level stated — the property to be suspicious of, not to celebrate.
  It cost nothing only because it was LABELLED a hypothesis and routed to a human with box
  access.
- ⭐⭐⭐ **Before refuting a phrase, enumerate its plausible readings and test the STRONGEST
  one.** "Zero validator diagnostic text" was TRUE; it got refuted against a strawman
  reading ("any per-shader text," using the 1732 `- FAIL` harness verdicts — which are not
  validator diagnostics). A refutation of the weakest reading feels identical from inside.
  This produced an OVER-retraction: a stop-work correction that would have struck a *true*
  claim from a public issue, caught only because the recipient was mid-verification.
- ⛔⭐⭐⭐ **A retraction must cover EVERY artifact on the shared public surface, not just
  your own authored surfaces.** The correction lived in the chain but never reached the
  GitHub issue the chain produced — a maintainer who greps the claimed silence finds 1732
  `- FAIL` lines and discounts the *sound* runner-scoping argument too, because they can't
  tell which claims were measured. See [[feedback_correction_unapplied_until_every_restatement_fixed]].
- ⭐⭐⭐ **A correction rides in carrying authority (authority high, scrutiny low) — and this
  fired on ME while I was invoking that very rule.** The defect sat in a **SUCCESS bullet of
  my own lessons-learned write-up**: writing an accurate self-critique is not evidence every
  sentence in it is accurate; the success bullets need the same instrument as the failure
  bullets and get less scrutiny because they flatter nobody. Reproducing someone's NUMBERS
  does not validate their INFERENCE from those numbers. See [[feedback_unattributed_fact_reads_as_your_own]].
- ⛔⭐⭐⭐ **The operator ask was OVERSCOPED.** "Depool or reprovision" vs. the free restart
  that fixed it: when the cause is unknown, prefer the REVERSIBLE and CHEAP ask, or say
  "investigate on the box," rather than naming a specific heavy action. Before presenting a
  remedy as unblocking a specific victim, enumerate ALL the red required-check contributors
  and confirm yours is the only one (reprovisioning would NOT have saved #12246). #12341's
  real value was the evidence package that got a human onto the box, not its recommended
  remedy.
- ⭐⭐⭐ **"n zero-hits" does not generalize to a dead marker class.** Four markers at 0/0 was
  read as "the error-body check is uniformly non-discriminating"; the full ladder found two
  asymmetric hits missed (`error` 1 vs 0, `SPIR-V` 2 vs 0). Run the whole ladder before
  declaring a discriminator dead.
- ⭐⭐ **"Too coarse to measure" is itself a claim to check** — `started_at`/`completed_at`
  are full ISO-8601 with SECONDS, 8× the resolution a "0.2-min delta can't be resolved from
  floor-minute timestamps" excuse assumed. The healthy-noise rule
  ([[feedback_expected_noise_line_is_not_a_failure_signature]]) applies to the REPLACEMENT
  claim, not only the original.
- ⭐⭐ **When an ABSENCE claim is load-bearing, re-verify with a DIFFERENT instrument** — two
  tools sharing a windowing bug agree perfectly; agreement is evidence only if they can fail
  independently. `per_page=100` on a busy repo is a SHRINKING duration, not a lookback (job
  sampling ~20× sparser than run sampling, plus independent retention pruning).

## Related concepts

- [[feedback_control_the_instrument_not_the_reasoning]]
- [[feedback_correction_unapplied_until_every_restatement_fixed]]
- [[feedback_unattributed_fact_reads_as_your_own]]
- [[feedback_expected_noise_line_is_not_a_failure_signature]]
- [[feedback_search_code_total_count_is_not_a_file_count]]
- [[feedback_shallow_clone_makes_your_head_the_graft_root]]
- [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]]
- [[project_12342_downstream_absent_capability_slangresult]]
- [[project_12364_cts_storage_image_minnonuniform]]
