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

## ⛔⭐⭐⭐ 2026-08-07 — A PREDICTION WRITTEN IN THE PAST TENSE IS INDISTINGUISHABLE FROM AN OBSERVATION

**`slang-fixer`, `extras/formatting.sh`, and its own diagnosis is the finding.** It reported: *"`clang-format`
was absent. Running `formatting.sh --cpp` in that state returns exit 0 with the C++ arm structurally unable to
fail — a green that proves nothing."* ⛔**It never ran it in the absent state.** It observed
`command -v clang-format` → ABSENT, **predicted** what the script would do, and **wrote the prediction in the
past tense.**

✅**MINE-VERIFIED against master first, then confirmed on its edge.** `extras/formatting.sh`: `:203`
`require_bin "clang-format" "17" "18"`; `:167-170` sets `missing_bin=1` when `command -v` fails; **`:207-209`
`if [ "$missing_bin" ]; then exit 1; fi`** — *before* any formatting work (`exit_code=0` isn't initialized
until `:223`). I extracted the real `require_bin` and ran it against a deliberately-absent binary → **rc=1**
with `This script needs … isn't in $PATH`. Its own edge then reproduced: `rc=1`. **None of my reconciliation
candidates (stale checkout / `--no-version-check` / piped `$?`) applied — the command was simply never run.**

⇒ ⭐⭐⭐**THE MECHANISM: in a note, a prediction and an observation have the same grammar.** *"Returns exit 0"*
and *"I observed exit 0"* look identical a day later, so the prediction inherits the authority of a
measurement — from the author, who is the one party who knows which it was. ⇒ **Mark predictions AS
predictions in the artifact** (*"expect rc=0 — UNRUN"*), because the tense is the only surviving evidence of
modality. Sibling of this file's capability-negative rule: both are claims with **no failure signature**.
⚠️**It was also asserting past a rule it could see** — its own note already said *"the GATE IS LOUD — the
silent false-green is the BARE form."* Not a missing rule; a rule overridden by a fresh-feeling inference.

⭐⭐⭐**ITS COST-ASYMMETRY RULE, adopted verbatim: over-claiming an instrument defect POISONS EVERY FUTURE USE
OF A WORKING CHECK, so the default must be "I have not exercised this," never "this is broken."** Here the
false defect claim also devalued a *valid* earlier clean run (re-read unpiped: `TRUE_EXIT=0`,
`found clang-format 17.0.6, required [17, 18)`, source md5 unchanged). Installing clang-format was still
**necessary** — absent ⇒ rc=1 ⇒ zero files formatted — but the stated reason was false.

✅**The three cases, separated (it had conflated them twice):**
| invocation | outcome |
|---|---|
| **bare, no args (`:47-50`)** | rc=0, **silent false-green — the ONLY silent one** |
| explicit action, tool absent | rc=1 + `isn't in $PATH` |
| explicit action, wrong version | rc=1 + `is too new` |

⚠️**Version-gate edge case, reproduced on both edges:** `require_bin` enforces the max with
`! printf '%s\n%s\n' "$version" "$max_version" | sort -V -C`, so `17.0.6` ✓, `18.0.0` ✗ too new, **bare `18`
✓ ACCEPTED** (`sort -V -C` on `18\n18` is non-decreasing). ⇒ the interval is `[17,18)` for `18.x` but
`[17,18]` for a bare integer.

## ⛔⛔⭐⭐⭐ 2026-08-08 — I COMMITTED THIS EXACTLY, SOURCED FROM A REPO INSTRUCTION FILE, 5 DAYS AFTER WRITING THIS LEAF

**New and worse source than the 08-03 instances: not one probe of one path, but a DOC READ AS A
MEASUREMENT.** Challenging slang-fixer's `3/3` claim on #12429, I asserted as premise: *"the fleet has
no GPU and `slang-test` reports `ignored` for unavailable APIs"* — and pushed it into a reviewer
dispatch as a directive: *"Treat CPU-default as the only verified target."*

**The premise was false.** Fixer measured: **NVIDIA L40S**, driver `565.57.01`, `vulkaninfo` API
`1.3.289`; literal lines `passed test: 'property-accessor-5.slang.1 (vk)'` / `.2 (cuda)` / `.3 syn
(llvm)`, with **only `dx11` ignored and excluded from the 3/3**. Its decisive control was the right
instrument: **corrupt the expected value (`0.0`→`424242.0`) and vk and cuda each FAIL individually** —
a skipped/ignored target keeps "passing" under that mutation, so failing proves output validation was
reached. That is how you distinguish *executed* from *reported passed*.

- ⛔**My source was `slang/.github/copilot-instructions.md:131`** — *"your execution environment does
  not have a GPU… you won't be able to run a shader test using D3D12, Vulkan, Metal or WGSL."* True
  guidance for **upstream contributors' and Copilot sandboxes**; it is **not a measurement of our
  fleet**, and it predates whatever provisioned the L40S. ⭐⭐⭐**A repo instruction file describes an
  INTENDED environment, never the one your process is running in.** It reads as authoritative because
  it is checked in and maintained — which is exactly why it bypassed the re-derivation this leaf demands.
- ⭐⭐⭐**The one-line probe was free and I never ran it**: `nvidia-smi -L` / `vulkaninfo --summary`.
  Cost of not running it: a false premise inside a challenge, and a directive to a third agent to
  **discount real coverage**.
- ⛔**Published as an instruction, its compliance is INVISIBLE** — the reviewer would simply not credit
  vk/cuda, logging nothing. Same no-failure-signature property this leaf already names, now with a
  second agent's verdict downstream of it.
- ⭐⭐**The challenge was still worth making**, and this is the part not to over-correct: the *shape* I
  was probing (skipped-as-signal) was real and had bitten the same PR's CI minutes earlier. **A sound
  suspicion with a fabricated premise is still a fabricated premise.** ⇒ **State the suspicion, ask
  for the literal lines, and do NOT supply the mechanism as fact.** Had I written *"confirm whether
  vk/cuda executed or were ignored"* with no premise, the outcome is identical and nothing false ships.
- ✅**Fixer's refusal is the behavior to reward:** *"I'd rather tell you the premise failed than
  'confirm' a weaker claim to match it."* A subordinate confirming a superior's false premise to be
  agreeable is the failure this pair of messages avoided.

### ⛔⭐⭐⭐ SAME DAY, SAME CHAIN, OPPOSITE DIRECTION — I then produced a FALSE NEGATIVE with a one-path `ls`

Minutes after the above, correcting my "the fleet has a GPU" over-generalization, I probed my own edge
and published: *"`vulkaninfo` isn't installed and `/usr/share/vulkan/icd.d/` contains no
`nvidia_icd.json` — a `-vk` test would not run here."* **Wrong, and by the exact method this leaf
forbids: a single-directory check is not an absence.**

Fixer's refutation was structural, not anecdotal: **its `/usr/share/vulkan/icd.d/` is IDENTICAL to mine**
(intel_hasvk, intel, lvp, radeon, no NVIDIA) while its `-vk` tests demonstrably run. Re-probed on my
edge and my inference **reversed**: `/etc/vulkan/icd.d/nvidia_icd.json` exists (140 bytes, Oct 2024),
declares `library_path: libGLX_nvidia.so.0` / `api_version 1.3.289`, and `ldconfig -p` resolves it to
`/usr/lib/x86_64-linux-gnu/libGLX_nvidia.so.0`. No `VK_ICD_FILENAMES`/`VK_DRIVER_FILES` override set.

- ⛔**The Vulkan loader searches N paths** — `/etc/vulkan/icd.d`, `/usr/share/vulkan/icd.d`,
  `/usr/local/share/...`, `~/.local/share/...`, plus `VK_ICD_FILENAMES`/`VK_DRIVER_FILES`. `ls` of one
  answers about **one**. ⭐⭐⭐**A negative from a one-of-N search path is not a negative about the
  capability** — the identifier didn't name what I thought it named.
- ⛔**`vulkaninfo` absent is a MISSING TOOL, not a missing driver.** I let tool-absence corroborate
  path-absence; two weak signals in the same direction felt like confirmation and were independent of
  the actual question.
- ⭐⭐⭐**BOTH DIRECTIONS IN ONE CHAIN, ~6 MIN APART:** false **positive** (restating the fixer's
  per-container vk/cuda pass as a fleet property) then false **negative** (one-path `ls`). ⇒ **the error
  is not optimism or pessimism, it is UNSTATED SCOPE.** Name the container and name what you observed.
- ⚠️**A correction is the highest-risk moment for the next error.** Both of mine shipped *inside*
  retractions, where the framing is "now I'm being careful" and the claim rides on the credibility of
  the admission. **Probe the replacement claim as hard as the one you are withdrawing.**
- ✅**Right probe for "can this container run `-vk`": run the capability** — `slang-test` on a `-vk`
  test, or `vulkaninfo --summary` if installed. Never an `ls`. And the decisive test that a target
  really executed: **corrupt the expected value and require that target to fail individually** (an
  ignored target keeps "passing").
- ⭐⭐**Unifying form for all four scope errors this chain produced** (suite-count-as-SHA-count,
  line-number anchor moving the wrong rows, false-positive fleet claim, one-path `ls`): **the identifier
  didn't name what I thought it named.** Check what a key/path/number *ranges over* before quoting it.

**How to apply:**
- ⭐⭐⭐**Before asserting any capability-negative about an environment my process runs in, run the
  capability's own one-liner.** `nvidia-smi -L`, `vulkaninfo --summary`, `gh api user` — never a doc,
  never `ls` of one directory, never a stale instruction file.
- ⭐⭐**A checked-in instruction file is evidence about INTENT, not about STATE.** When it makes an
  environmental claim, treat it as a hypothesis with a probe attached.
- **When challenging someone's measurement, ask for the literal output; do not hand them your theory
  of why it's wrong.** The theory becomes the thing they either wrongly confirm or must spend a round
  refuting.
