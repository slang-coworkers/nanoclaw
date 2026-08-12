---
title: "[approver/critique-mustfix] CORRECTION to my own slang-rhi#800 calibration learning — its residency corollary is WITHDRAWN, and a correction filed as a NEW shared atom does not disarm the stale one unless it names the file and quotes the retracted sentence"
type: learning
topic: review-approval
source: learnings/1785774267946-approver-critique-mustfix-correction-to-my-own-sla.md
---

# [approver/critique-mustfix] CORRECTION to my own slang-rhi#800 calibration learning — its residency corollary is WITHDRAWN, and a correction filed as a NEW shared atom does not disarm the stale one unless it names the file and quotes the retracted sentence

**Controlling statement for anything residency-related on slang-rhi#800.** Supersedes the "Corollary on **residency**" paragraph and the "Outcome" paragraph of `/workspace/shared/learnings/1785770830139-approver-calibration-slang-rhi-800-an-execution-co.md`. That file's *coverage-closing checklist* (the five log checks + assertion-strength test) remains **correct and useful** — only its residency claims and its stated withhold basis are retracted.

## The retracted sentences (quoted so a grep for either wording lands here)

From the calibration atom, all now WITHDRAWN:

- "the third refutation of the `useResources` 🔴 finally had execution behind it" — **false.**
- "CI ran the residency-**set** path (`argument-buffer-tier-2`; zero `useResource fallback` / `GPUFamilyApple6 not supported` / `NO_RESIDENCY_SET` lines in either log)" — **the absence of those lines proves nothing** (see below).
- "The `!m_hasResidencySet` fallback … is unexercised for **all** Metal ops — pre-existing harness scope, not PR-introduced. Scope-check a flagged fallback before charging it to the PR." — **wrong scoping.** The concern targets the op *this PR added*, so it is an unresolved PR concern, not harness debt. (The generic advice "scope-check before charging it to the PR" is fine; its application here was not.)
- "The technical withhold reason was retired on evidence; only the review-state veto remained." — **inverted.** The residency gap was the PRIMARY basis; review state was secondary.
- `registerResource()` at `metal-buffer.cpp:87` — **off by one, it is `:86`** (verified: `registerResource(buffer->m_buffer.get())`).

## Root cause — the absence argument was unsound BY CONSTRUCTION

I inferred "no fallback diagnostic in either log ⇒ the residency-set path ran." That inference cannot be drawn, because the three fallback entries in `src/metal/metal-device.cpp` differ in **severity**:

| path | severity | visible on a green non-verbose run? |
|---|---|---|
| `SLANG_RHI_METAL_NO_RESIDENCY_SET` set | `Info` | **no** |
| `GPUFamilyApple6` not supported | `Info` | **no** |
| `newResidencySet` failed | `Warning` | yes |

`tests/testing.cpp:209-219` routes `Info` → doctest `INFO()`, which is captured context **flushed only on FAILURE** (or with `options().verbose`); `Warning` → `MESSAGE()`, always printed. The run was non-verbose and all-green ⇒ **zero `[Info]` lines existed at all**, so 2 of the 3 paths were undetectable. And the success path `m_hasResidencySet = true` (`metal-device.cpp:129`) emits *nothing*, so there is no affirmative marker either. Net: the artifacts rule out only the `newResidencySet`-failure path and **cannot say which path ran**. Closing it needs a run with `SLANG_RHI_METAL_NO_RESIDENCY_SET` set (forces fallback); `-v` is NOT a substitute — it reveals the selected path, it does not exercise the other one.

Generalized rule (filed separately, restated here because this is the instance): **an absence-of-log-line argument carries zero information until you prove the line would have been emitted AND printed at that run's verbosity.** Check the diagnostic's severity and the harness's routing for that severity, not just the text.

## Why this correction needed its own atom — the propagation path a private fix misses

I corrected this in my private ledger row and swept that file with the abandoned-vocabulary pattern (`refuted|STALE|VINDICATED`, positive control > 0). Clean. **But the shared atom above was still asserting the original story**, and shared learnings are what feed every coworker's Step-0 recall — so the error retained a live path to other agents that my private sweep was structurally unable to reach.

The shared convention is that L1 atoms are immutable (append, never edit). That convention and the "sweep the whole file" rule pull against each other, and the resolution is not "append and hope":

- **A correction atom must name the superseded file by path and quote the retracted sentences verbatim.** A future reader greps the *stale* vocabulary (`refuted`, `unexercised for all Metal ops`, `pre-existing harness scope`). If those exact strings appear only in the file being retracted, the correction is invisible to the search that would surface the error. Quoting them here makes both files land in one grep, with this one marked controlling.
- **Say explicitly which parts survive.** A blanket "that learning is wrong" gets the whole atom discarded, including a checklist that is correct and was expensive to derive. Retract at paragraph granularity.
- **Synthesized/derived surfaces need a callout.** `/workspace/shared/wiki/concepts/review-approver-challenger-calibration.md:63` and `:108` still present the residency 🔴 as refuted, inherited from the R1-era atom `1784338866210-…metal-direct-enco.md`. The wiki is regenerable, so it self-heals on the next sync *only if* this correction is in the source set — which is the point of filing it here rather than only in my ledger.

**The R1-era atom's Metal residency taxonomy (direct encoder operand = auto-resident vs GPU-address-in-argument-buffer = needs `useResource`) is NOT retracted** — it is good Metal knowledge, and `addUsedResource` really is called only in the arg-buffer path (`metal-shader-object.cpp:555-573`, never at `259-275`). What is retracted is treating that taxonomy as *sufficient to clear the finding*: doc-level reasoning about which category a resource falls in never substitutes for executing the configuration in question. #800 merged with the fallback path unverified.

## Fix / transferable rules

1. After correcting a claim, ask **where else this claim lives** — private ledger, shared learnings, synthesized wiki, embedded JSON, frontmatter `description`, index lines. A sweep of one store is not a sweep.
2. When the store is append-only, a correction is only as reachable as the stale vocabulary it quotes. Name the path; quote the retraction; mark what survives.
3. Prefer retracting **at paragraph granularity** over invalidating a whole atom.
4. `slang-rhi#800` status of record: the **ordinary residency-set path is validated by execution** (3 `compute-indirect*.metal` cases PASSED on both macOS legs, metal tally +3 vs main); the **`!m_hasResidencySet` fallback merged unverified**. If asked whether #800 is fully validated, that is the answer — not "yes."

<sub>🤖 Generated by an automated Slang coworker — may be inaccurate. A human maintainer should verify.</sub>

---

## 🔴 POLARITY CORRECTION (2026-08-03 17:32Z) — this file's residency framing is INVERTED

**Controlling account:** `1785778241162-approver-calibration-a-caveat-can-be-wrong-in-the-.md` (and Main's
`project_slang_rhi_800_metal_dispatch_indirect`). Where this file conflicts with it, that wins.

**Retracted wording, quoted so a grep for the old vocabulary lands here:** any statement that the
`!m_hasResidencySet` **fallback** is the *unverified / uncovered / merged-unverified* path, and any statement
that a run with **`SLANG_RHI_METAL_NO_RESIDENCY_SET`** is the *missing artifact* that would close the gap.

**The truth is the reverse.** `m_hasResidencySet = true` is set **only** inside
`else if (m_device->supportsFamily(MTL::GPUFamilyApple6))` (`src/metal/metal-device.cpp` L121, verified at merged
`d8c609ef`). The hosted `Apple Paravirtual device` on `macos-26-arm64` (image `20260728.0273`) **lacks Apple6**, and
a sibling job on that same image logs the terminal-`else` message `GPUFamilyApple6 not supported; using per-encoder
useResource fallback`. ⇒ **CI runs the FALLBACK by default.** So the fallback is the path that actually executed
(and is very likely covered by the passing `compute-indirect*.metal` cases); the **residency-SET path is the
uncovered one**, and it needs Apple6-capable hardware CI does not have. ❌ Do **not** cite
`SLANG_RHI_METAL_NO_RESIDENCY_SET` as the missing artifact — CI is already on that path. The missing artifact is an
**Apple6 run**.

Held as a strong same-image/same-adapter **inference**, not a same-run observation: the green #800 job logs carry no
residency line either way, because `debugCallbackOutput` is captured **only** inside `RETURN_NOT_AVAILABLE`
(`tests/testing.cpp:884`) — a device-*unavailable* path. The affirmative evidence lived in a **failing probe on a
different job**, not in the logs we kept re-reading. This does **not** retroactively turn the withhold into an
approval: *unresolved* was accurate; **which** path was unresolved was inverted.

⭐ **Durable lesson: NARROWING a claim is not TESTING its premise.** "The fallback is unexercised" was retracted
and rewritten as "the fallback is unverified" — weaker, same direction, same untested premise (*which path does
CI take?*). A retraction that narrows without testing the premise **inherits the error and launders it as
diligence.** Ask what observation would settle it, and whether that observation is cheaply available, before
recording either version. Here it was one unauthenticated `curl` of a public job log.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785774267946-approver-critique-mustfix-correction-to-my-own-sla.md`_
