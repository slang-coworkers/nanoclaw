---
name: project_12321_bfloat16_vector_vulkan_wrong_lanes
description: "#12321 vector<BFloat16,4>→float4 wrong .z/.w on -vk — bot-filed; Main DISPROVED the CI-visibility claim (variant PASSES on 4 CI GPU tiers incl. the reported SHA) ⇒ driver-specific to L40S/565.57.01, NOT a master regression; ✅jkwak-work ACCEPTED ('not-a-slang-bug'), assigned+Q4 2026 ⇒ TERMINAL, no reply sent (all points already in the posted comment)"
metadata:
  type: project
  originSessionId: b285e0b9-76cd-4205-9319-07b838de7550
---

**shader-slang/slang#12321** — "[SPIR-V/Vulkan] `vector<BFloat16,4>` -> `float4` conversion returns wrong values for .z/.w lanes". Filed **2026-08-03 09:36Z by `nv-slang-bot[bot]`** (slang-fixer, session `sess-1785749783022-ax8udf`, thread `gh-issue-shader-slang/slang-12321`). Labels `bug`/`SPIR-V`/`Vulkan`. No assignee, no milestone. Canonical thread `gh-issue-shader-slang/slang-12321`.

Symptom as filed: `tests/hlsl-intrinsic/scalar-bf16.slang` `-vk -emit-spirv-directly` returns `1,2,2,2` instead of `1,2,3,4`; `-cuda` arm of the same file passes. Scalar bf16 fine (`sizeof`=2, `bit_cast<uint16_t>(BFloat16(3.0))`=16448 both correct) ⇒ vector unpack/convert only. Emitted SPIR-V is one `OpBitcast` ulong→`v4bfloat16` + one `OpFConvert`→`v4float` + 4 extracts at correct indices 0/1/2/3; **passes spirv-val**. Reported env **NVIDIA L40S, driver 565.57.01**, Debug build @ `53b76e6d3`.

**This was a bot echo of our own chain's artifact (same class as [[project_12320_coverage_macos_segfault_base_rate]]) — so NO triager/fixer dispatch. But unlike #12320 the body carried a falsifiable claim, and I falsified it.**

## Main-verified receipts (2026-08-03, primary source = CI job logs)

The body's "CI visibility" section hypothesized the `-vk` variant is GPU-gated and therefore **under-surfaced**. **FALSE — it runs and PASSES on every GPU tier that has it in scope:**

| tier | GPU | driver | result | job |
|---|---|---|---|---|
| `test-linux-release-gcc-x86_64` | Tesla T4 | 580.126.09 | **passed** | `91350058606` @`15296db6d0` |
| `test-linux-debug-gcc-x86_64` | Tesla T4 | 580.126.09 | **passed** | `91426932645` @`bcd851aa29` |
| `test-windows-release-cl-x86_64-gpu` | Tesla T4 | 581.80 | **passed** | `91426570265` @`bcd851aa29` |
| `test-linux-release-gcc-x86_64-sm80` | NVIDIA L4 | 580.126.09 | *out of scope* | `91426832560` |

- Verified `passed test:` not `ignored test:` (slang-test prints both; I grepped for the distinction explicitly).
- `bcd851aa29` = head of PR #12315, whose **merge commit IS `53b76e6d3`** = the exact SHA in the report. So the variant was green on that code.
- sm80plus exclusion is **by design**, not a gap: `ci.yml:349-351` comment says "runs only cooperative-matrix / neural coverage that T4 cannot safely execute"; its log = 389 tests, all `tests/cooperative-matrix/**`.
- bf16 is NOT in any of the 6 `tests/expected-failure-*.txt` lists ⇒ not a tolerated-failure entry.

**⇒ Emission held CONSTANT across pass and fail; only the driver/GPU varies. Driver hypothesis strongly favoured, Slang-emission hypothesis substantially weakened. NOT a master regression.** Note this is *ranking by held-constant variable*, not a root-cause — Ada-vs-Turing is confounded with 565-vs-580 and I did NOT separate them.

**Environment caveat worth remembering:** the filing env is almost certainly the **fleet's own GPU host** — this Main container reports the identical `NVIDIA L40S, 565.57.01` via `nvidia-smi`. 565.x is materially older than any CI tier. **A "wrong result on Vulkan" finding from our own fleet host is not trustworthy until re-tested on a current driver.** Generalize: fleet-host GPU findings need a driver-version sanity check before filing.

**Real gap (different from the hypothesized one, and genuine):** no CI tier runs this test on **Ada/L40S-class** hardware (L4 has the arch but excludes the test by scope) and no tier runs a **565.x** driver. A bf16 defect specific to Ada or to the 565.x band is invisible to CI by construction. Belongs on **#10750** (`jvepsalainen-nv`, open, bf16 coverage-gap tracker) — I did NOT add it there.

## Related, verified
- **#10750** open, `jvepsalainen-nv` — bf16 coverage gaps + `-skip-spirv-validation` workaround tracking. Body confirms bf16 tests broadly use `-skip-spirv-validation` because bundled spirv-val rejects bf16 arithmetic. Does not cover this wrong-value case (report was right about that).
- **#7077** open, `fairywreath` — `VK_KHR_shader_bfloat16` SPIRV support; **PR #7078** open since 2025-05-13.
- **PR #10938** open, `jvepsalainen-nv`, `mergeable_state: dirty`, untouched since 2026-06-01 — touches this exact test file. Its history is the precedent that matters: an earlier revision un-stubbed the Vulkan `dot` arm assuming "emitter codegen + spirv-val pass ⇒ runtime works", and **that broke `test-slang (vk)` on multiple CI tiers** because NVIDIA's Vulkan stack doesn't advertise `BFloat16DotProductKHR`. Reverted to the stub. **Same lesson as here: valid SPIR-V + clean spirv-val ≠ correct runtime behaviour on a given driver.**
- Only commit ever to touch the test: `45774a4486` (#9780, 2026-01-31). Report correctly declined to assert causation.

## Disposition
**Correction POSTED** — `#issuecomment-5164985223` (2026-08-03 10:06Z), zero prior comments. Carries the tier table, the by-design sm80 exclusion, the reframe (environment-specific not regression), the real coverage gap, the fleet-host env caveat, and the discriminating next step.

**PARKED.** The single discriminating experiment = **re-run on the same L40S with driver ≈580.126.09**. Pass ⇒ close as 565.x driver bug (log coverage gap on #10750). Still fails ⇒ driver hypothesis dead, Ada-vs-Turing becomes live, Slang emission back on the table. Driver upgrade is **infrastructure, outside bot reach** — operator/maintainer call.

**RESUME on:** substantive human (non-bot) comment on #12321, a driver-upgrade re-test result, or a maintainer picking it up. Do NOT re-triage on further bot echoes. Do NOT let the "silent wrong result on real hardware" framing drive P1 urgency — it is green on all CI hardware.

## ✅ 2026-08-06 — MAINTAINER ACCEPTED THE CORRECTION; chain TERMINAL

`jkwak-work` cmt **`5199011622`** (08-06 00:31Z): *"It sounds like this is not-a-slang-bug. Lowering the priority and pushing it by two sprints."* — i.e. **the correction landed and was acted on.** Timeline-verified state changes:
- `jhelferty-nv` 08-05 18:02Z: labeled `Office-Yong`, **assigned `jkwak-work`**
- `jkwak-work` 08-05 18:19Z: milestoned **Q4 2026 (Fall)** (from none; Q3 due 09-30 → Q4 due 12-31 = the "two sprints")
- `jkwak-work` 08-06 00:30Z: **unlabeled `Office-Yong`** (triage label consumed)
- Still `open`, labels `bug`/`SPIR-V`/`Vulkan` unchanged, 2 comments.

**NO REPLY SENT — deliberate, and this is the reusable judgment.** Every point a reply would carry was **already in cmt `5164985223`**, verified by grepping my own posted body: the 580.126.09 re-run as the discriminating experiment (§"Suggested next step"), the Ada/565.x coverage gap and its #10750 home (§"The real coverage gap", lines 22-29), and the explicit not-a-root-cause hedge. The maintainer read it, agreed, and disposed. ⇒ **A maintainer agreeing with you is not an inbound requiring output.** Restating the posted comment back at the person who just acted on it is the echo the silent-ack rule exists to kill. `next-action:` = none from us.

⚠️**Left undone on purpose, NOT a deferral-without-trigger:** the coverage gap is *named in the public comment* the maintainer has now read, so it is discharged as a communication. I did **not** add it to **#10750** (open, `jvepsalainen-nv`, Q2 2026 Spring milestone, 0 comments) — a bot comment on a maintainer's own coverage tracker, saying something the assigned maintainer just read elsewhere, is noise. **If a human asks where the gap is tracked, the answer is: only in cmt `5164985223`, not on #10750.**

**Disposition: TERMINAL** — maintainer-owned, assigned, milestoned. Do NOT re-engage on further label/milestone churn or bot echoes. RESUME only on a substantive *new* human comment or a driver-upgrade re-test result.

Related learnings: [[feedback_never_relay_a_verdict_not_in_hand]], [[feedback_verify_pushed_state_by_branch_not_sha]].
