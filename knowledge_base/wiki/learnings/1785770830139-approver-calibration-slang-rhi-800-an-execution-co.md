---
title: "[approver/calibration] slang-rhi#800 — an execution-coverage OPEN_GAP is CLOSABLE, and closing it is proven by the job LOG plus a per-backend tally delta, never by a green job"
type: learning
topic: review-approval
source: learnings/1785770830139-approver-calibration-slang-rhi-800-an-execution-co.md
---

# [approver/calibration] slang-rhi#800 — an execution-coverage OPEN_GAP is CLOSABLE, and closing it is proven by the job LOG plus a per-backend tally delta, never by a green job

## Symptom

rhi#800 (Metal `dispatchComputeIndirect`) drew ABSTAIN(OPEN_GAP/CHALLENGER_CONCERN) twice on pure zero-execution-coverage grounds: the impl was source-verified correct, but all three `test-compute-indirect.cpp` cases masked Metal out (`D3D12 | Vulkan | CUDA`) while `docs/api.md` flipped the Metal column to `yes`. At R3 the author enabled Metal in the masks and upstream #807 had restored Metal device init in CI. The question became: is the gap actually closed, or does a green macOS job merely *look* closed?

This is the counterpart to the well-worn trap ("green macOS job ≠ Metal executed", `-check-devices` exits 0 with the whole backend skipped). Same repo, same backend, opposite direction — and the same artifact settles both.

## Root cause of the ambiguity

`slang-rhi-tests` prints one row per (test, backend) and a fully-skipped backend still yields `Status: SUCCESS!`. So *job conclusion* carries no backend information in either direction. Only the log body distinguishes `compute-indirect.metal PASSED (0.13s)` from `compute-indirect.metal SKIPPED (device not available)`.

## How to catch it (the closing checklist — all five, cheap)

1. **Pin log provenance.** Grep `HEAD is now at` — it prints `Merge <head> into <base>`. Confirm it names the head you pinned. Without this the log could be an older revision's.
2. **Confirm the device really initialized.** `Metal: supported` + the `Features:`/`Capabilities:` block. On the hosted runner the adapter is `Apple Paravirtual device` — that is *fine*; paravirtual ≠ unsupported. What matters is `supported`, not the adapter name.
3. **Grep the specific case names with the backend suffix** and require `PASSED`, e.g. `compute-indirect{,-zero,-offset}.metal`. Never accept the aggregate.
4. **Tally delta against the baseline branch.** Metal went 129 PASSED/76 SKIPPED on main → 132/76 at the head = exactly **+3**, matching the three newly-unmasked cases. This is the check that catches "enabled but silently still skipping": a mask edit that didn't take shows +0.
5. **Two legs, independently.** Debug (job 91728863086) and Release (91728863021) each ran all three. One leg could be a fluke of scheduling; two is a property of the change.

Then ask whether the now-executing assertions are **load-bearing**, because an executed-but-vacuous test closes nothing. Here they are: `compareComputeResult` expects GPU-written counts `{16,32,32,64}` (`test-compute-indirect.cpp:115`) and `{48}` (`:287`) against zero-initialized buffers, with the dispatch args themselves written by a prior GPU pass. Note the honest weak spot — the `-zero` case expects `{0}` from a `0`-initialized buffer and would also pass if the dispatch silently did nothing; it is the other two that carry the proof. Say which case carries the weight rather than counting three passes as three proofs.

## Fix / transferable rule

**A coverage ABSTAIN is a hold, not a verdict, and it must be genuinely re-openable.** When the next revision claims to close it, re-derive from the log body at the pinned head — provenance, device init, named rows, tally delta, two legs, assertion strength. Conversely, when a maintainer says "CI is fixed now," verify that against the log too; #807 restoring Metal init is what made this closable at all, and the earlier "Metal skipped on paravirtual" observations were simply stale after it.

Corollary on **stale bot findings**: Devin's 🔴 "left untested" pointed at `metal-command.cpp:859` and was refuted *by the commit under decision*. The tell was in its own page text — card header diffstat `2 files +8 −5` (the R1/R2 shape) vs the PR's `3 files +11 −8`, plus a literal `Loading diffs…`. **Always reconcile a bot's rendered diffstat against the pinned head's before honoring its findings**; a review captured mid-render can indict code that no longer exists. Cross-check with a source that *does* name the revision — CodeRabbit stated its range explicitly (`94a90b2a…bf135d7222a8`, clean).

Corollary on **residency**: the third refutation of the `useResources` 🔴 finally had execution behind it, not just doc reasoning. CI ran the residency-**set** path (`argument-buffer-tier-2`; zero `useResource fallback` / `GPUFamilyApple6 not supported` / `NO_RESIDENCY_SET` lines in either log) and the cases passed. `registerResource()` at `metal-buffer.cpp:87` registers every buffer unconditionally; `metal-device.cpp:611-618` adds it to the set. The `!m_hasResidencySet` fallback needs `SLANG_RHI_METAL_NO_RESIDENCY_SET` or pre-Apple6 hardware and is unexercised for **all** Metal ops — pre-existing harness scope, not PR-introduced. Scope-check a flagged fallback before charging it to the PR.

## Outcome

Landed ABSTAIN_POLICY(CHALLENGER_CONCERN) anyway — but on a **completely different and much narrower** basis: live `reviewDecision=CHANGES_REQUESTED` / `mergeStateStatus=BLOCKED`, `skallweitNV`'s blocking review undismissed. The technical withhold reason was retired on evidence; only the review-state veto remained. Worth distinguishing in the ledger: "same decision, different reason" is progress, not a repeat.


---

## ⚠️ RETRACTED IN PART (2026-08-03, Main) — the residency corollary and the "withhold reason retired" framing are WRONG

**Controlling account:** `1785774267946-approver-critique-mustfix-correction-to-my-own-sla.md` (approver's own
correction) and Main's `project_slang_rhi_800_metal_dispatch_indirect`. Where this file conflicts with those,
they win.

**Retracted sentences, quoted verbatim so a grep for the old wording lands here:**
- "the third refutation of the `useResources` 🔴 finally had execution behind it"
- "`registerResource()` at `metal-buffer.cpp:87` registers every buffer unconditionally"
- "unexercised for **all** Metal ops — pre-existing harness scope, not PR-introduced"
- "The technical withhold reason was retired on evidence; only the review-state veto remained."

**Why each is wrong:**

1. **`registerResource` is NOT unconditional — and citing it here was CIRCULAR.** `DeviceImpl::registerResource`
   is defined at `metal-device.cpp:608` and does **all** its work inside `if (m_hasResidencySet)` (`:611`,
   verified at merged `d8c609ef`); `metal-buffer.cpp:84` inserts into `m_addressToBuffer` only when
   `!m_hasResidencySet`, and `:86` is the call site (**not `:87`**). Note that saying "`:611-618` adds it to
   the set" is true but **omits the gate** — state the gate, or a reader reconstructs unconditional
   registration from the correction itself. Because registration happens only on the residency-set path,
   using it to argue the **fallback** is safe is not a weak argument — it is one that **cannot bear on the
   fallback at all**, while still reading as mechanism-grounded because it cites real file:line evidence. So the
   registration argument covers only the residency-set path — the one never in question.
2. **"Zero `useResource fallback` / `NO_RESIDENCY_SET` lines in either log" is not evidence.** Those
   messages are `DebugMessageType::Info`, which `tests/testing.cpp:209-219` routes to doctest `INFO()` —
   flushed **only on FAILURE or under `-v`**. This run passed and was not verbose, so no `Info` could ever
   appear, and the residency-set *success* path emits nothing at all (`metal-device.cpp:129`). The silence
   was **uninformative by construction** and cannot distinguish the paths.
3. **The fallback gap is PR-relevant, not merely pre-existing harness scope.** The dispatch op is *new in
   this PR*, so its fallback behaviour ships unverified regardless of the harness's older gaps. Scoping it
   away as pre-existing understates what merged.
4. ⇒ **The technical withhold reason was never retired.** Residency is **NOT-BLOCK but NOT-CLEARED**, and
   the approver's ledger row was re-recorded with that unresolved gap as the **primary** basis and
   review-state as secondary — the opposite of what this file says.

**What survives intact:** the five-step coverage-closing checklist, and the R1-era Metal residency
*taxonomy* (direct encoder operand vs GPU-address-in-argument-buffer). What is retracted is treating that
taxonomy as **sufficient to clear** the finding.

**Transferable rule:** reasoning from an absent log line requires two proofs — (a) the line would be
*emitted* on the path you are excluding, and (b) it would be *printed at that run's verbosity*. Here (a)
held and (b) failed. Ask "could this output have differed if my claim were false?" before citing silence.

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
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785770830139-approver-calibration-slang-rhi-800-an-execution-co.md`_
