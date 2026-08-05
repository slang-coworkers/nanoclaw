---
name: feedback_published_negative_env_claims_need_rederivation
description: "A capability-negative about someone's environment ('no GPU/ICD/tool here') closes off investigation and is usually derived from ONE probe of ONE path — re-derive before publishing or relaying it; a single-directory check is not an absence"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d264dc16-b7e2-4f9d-a95d-fd5710417ba1
---

# "We can't test that here" is a claim that closes doors — re-derive it before publishing

**Why:** a capability-negative doesn't just report a limit, it **licenses giving up on a line of
investigation** — and it reads as humility, so nobody challenges it. Positive claims get audited
because someone acts on them and they can fail. A negative gets accepted, the door closes, and
nothing ever fails to report it. Same silent-failure shape as an over-stated refutation
([[feedback_mechanism_must_predict_observed_coordinates]]), one layer down: that one kills a
hypothesis, this one kills the *ability to test* hypotheses.

## First-person receipt (2026-08-03, slangpy#1089)

`slangpy-triager` published **"this container has no NVIDIA Vulkan ICD"** — in their fix memo, in the
**public GitHub comment**, and to me. **I relayed it to the operator in a rollup as a thing "a human
may need to act on."** It was false.

| | |
|---|---|
| what was checked | `/usr/share/vulkan/icd.d` — Mesa only (intel / lvp / radeon) |
| what was there | `/etc/vulkan/icd.d/nvidia_icd.json` → `libGLX_nvidia.so.565.57.01` |
| how it was found | the **fixer** challenged it; triager re-derived with `vkEnumeratePhysicalDevices` → **2 devices: NVIDIA L40S (565.228.64), llvmpipe** |

⇒ `/etc/vulkan/icd.d` is the *standard vendor-installed* ICD location. A one-directory probe answered
a narrower question ("is there a Mesa ICD?") than the one asked ("can we run NVIDIA Vulkan?"), and the
negative propagated three tiers up and into a public artifact.

**The cost was not cosmetic.** Once re-derived, the machine could run the decisive experiment, and it
**refuted branch 1 on runtime evidence within the hour** — null proc, `SIGSEGV at the FIRST call site`,
`RIP=0x0`, no frame for the calling function, vs the reporter's *named* frame with a line number. A
whole round of probability argument ("is an advertises-but-omits driver self-contradictory?") had been
substituting for a test that was available the entire time.

⭐ **A signature/mechanism test beats both a probability argument and its hedge.** I had (correctly)
argued *don't retire a branch on a spec-conformance assumption* — right in method, obsolete in fact
the moment someone ran the thing. When a debate turns on how plausible a state is, ask first: **can we
just construct that state?** The false environmental negative is exactly what had made that question
look unaskable.

## Delegation is where this originates

The bad probe came from a **recon subagent**, whose one-directory result became the triager's published
environmental fact. Subagents return *findings*, not *audits* — a subagent that greps one path reports
what it found there, and the absence of anything else is an artifact of its search, not of the world.
Cf. their own `digest-is-a-lead` rule and [[feedback_unattributed_fact_reads_as_your_own]].

## How to apply

1. **Before publishing or relaying "we can't X here," re-derive with the capability itself** — not with
   a proxy. For a runtime capability that means *running it*: `vkEnumeratePhysicalDevices`, not `ls` of
   one directory. A working probe is the only sound basis for a capability claim, positive or negative.
2. **Enumerate every standard location** before asserting absence. Vulkan ICDs: `/etc/vulkan/icd.d`
   **and** `/usr/share/vulkan/icd.d` (+ `VK_ICD_FILENAMES` / `VK_DRIVER_FILES`). Same discipline as
   [[feedback_shallow_clone_makes_your_head_the_graft_root]] rule 4b — **name the ref / name the path
   you searched**, so a reader can see how wide the search was.
3. **As the tier above: treat a relayed capability-negative as a lead, not a fact.** I had no way to
   check their container — so the honest relay is *"triager reports no NVIDIA ICD"*, attributed, or a
   question back. I wrote it as flat fact in an operator rollup instead.
   Cf. [[feedback_never_relay_a_verdict_not_in_hand]].
4. **When a negative would close an investigation, that's the trigger to challenge it**, not to record
   it. The fixer's instinct — refuse to inherit, re-derive — is the only control that worked here, and
   it worked twice on this chain.
5. Cheap tell: a negative sourced from **one path, one command, one subagent** is not an absence.

# Citations

- Chain: [[project_slangpy_1089_shader_cache_path_vulkan_segv]]
- Public artifact (corrected 2026-08-03 17:02:02): https://github.com/shader-slang/slangpy/issues/1089#issuecomment-5169214782

## ⛔ DO NOT COMPRESS — why this class is uniquely dangerous (index line points here)
Appended 2026-08-03; the `MEMORY.md` hook referenced this claim before this file held
it (a **forward reference** — see the trap note at the end).

**A false capability-negative is the only error class with NO observable failure
signature.** Other errors produce a wrong artifact someone may later contradict. A
published negative produces **nothing**: readers act on it by **not attempting** the
thing, and a not-attempted action leaves no log line, no transcript entry, no failed
run. Nobody ever reports *"I didn't try the thing your note said was impossible."*
⇒ the blast radius is invisible **in principle**, not merely in practice.

✅ **Write `"I could not verify X by method M"` — with M NAMED** — never `"X is
unavailable"`. The method is what a future reader re-tests; an unattributed negative
**cannot be refuted**, so it forecloses the retry instead of inviting one.

**Instances, 2026-08-03:** "no NVIDIA Vulkan ICD" (false; disproved by probing one
directory, and it was the sole blocker on a decisive test) · "`rate_limit` core
`limit` is the working auth probe" (false; reported `60` = anonymous while the
credential *was* injected — see
[[project_critique_gate_pulls_pattern_builtin_floor]]).

## ⛔⭐⭐⭐ THE CONVERGENT FORM — two tiers reach the SAME false negative independently, by different routes

**#11616, 2026-08-04.** Two coworkers held one wrong belief — *"`filecheck=` tests don't run locally"* —
reached independently and from opposite directions:

- **slang-fixer:** its store carried the claim outright; it nearly shipped a blind third-party emulator
  harness on the strength of it.
- **slang-triager:** re-derived it fresh as *"`slang-llvm` is absent"* from **`ls build/Debug/bin/`** —
  one directory, published as a tree-wide negative. The library was in `build/Debug/lib/`.

Truth, settled by a **failable control** (inject a broken CHECK → `FAILED`; restore → pass): LLVM
FileCheck runs locally, in-process from `slang-llvm`. A **correct 2026-07-02 note already said so** and
neither tier grepped for it.

⇒ ⭐⭐⭐ **Agreement between two tiers is NOT corroboration when both claims are capability-negatives.**
Every other error class gets caught by a peer disagreeing; this one **converges** — the belief's entire
content is *"don't try,"* so neither party ever generates the evidence that would refute it. Two
independent derivations of a false negative *feel* like confirmation and are structurally its opposite.

⇒ **Guard:** when a capability-negative is **shared across tiers**, that is the moment to demand a
failable control rather than to relax — and to **grep the store first**, because a stale claim
propagating between coworkers is indistinguishable from two people measuring the same real limit.
Cf. [[feedback_control_the_instrument_not_the_reasoning]] (instances 1, 15),
[[feedback_green_job_skipped_backend_zero_coverage]] §4,
[[feedback_retrieval_gap_grep_shared_learnings_before_deriving]].

⚠️ **THE FORWARD-REFERENCE TRAP** (found by slang-ci-babysitter, reproduced twice in
my own store): an index line can point at a child that **predates the claim it
summarizes**. Nothing was ever deleted, so cut-then-verify never fires and a
link-integrity check reports all-green — the pointer resolves, the content was never
there. ⇒ **"I only shortened, I didn't delete" is false reassurance.** Content-grep
the child for the specific datum whenever you write OR shorten a pointer.
