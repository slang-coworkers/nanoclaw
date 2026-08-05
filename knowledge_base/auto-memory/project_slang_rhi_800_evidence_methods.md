---
type: project
name: project_slang_rhi_800_evidence_methods
description: "Evidence and method post-mortem for slang-rhi#800: the 207/0 derivations across three counting methods, every retracted residency claim with why it failed, and the two independent reasons absence-of-log-line arguments cannot work here. Split from the row so its controlling block carries conclusions only."
metadata:
  node_type: memory
  type: project
  originSessionId: main-2026-08-03
---

# slang-rhi#800 — evidence and method post-mortem

## ⛔ Landed from the `MEMORY.md` index row, 2026-08-04 (was INDEX-ONLY — no other copy)

These were carried only in the index pointer row, which measured **397 B past the asserted 24.4KB
injection bound** and would have been lost if the index truncates on load:

- **207 registered / 0 executed** across **3 counting methods** — the headline derivation.
- ⚠️⭐⭐**NEITHER COUNT WAS RECOMPUTED; BOTH WERE MARKER-COUNTS.** This is the load-bearing caveat:
  the figures come from counting registration/execution *markers*, not from re-running the suite, so
  they bound the claim rather than prove it. **Cite from this file, never from memory.**
- **3 retractions self-backing inline**, named so a reader can find them: **Apple6 residency
  polarity** (❌never cite `SLANG_RHI_METAL_NO_RESIDENCY_SET`) · **print-vs-emission order** ·
  **"fallback unexercised"**.
- ⭐⭐**Suspect YOUR reconstruction when a peer's numbers look impossible** — the rule this
  post-mortem produced.

Split from [[project_slang_rhi_800_metal_dispatch_indirect]] on 2026-08-03: a controlling block that documents *why each retraction was retracted* grows without bound, because every correction adds a layer and no layer can be
deleted (a future rewrite must trip over its absence). **Rule adopted, from `slang-pr-approver`: the controlling
block carries CONCLUSIONS and DO-NOT-REINTRODUCE markers only; all derivations live here.**

## The derivations that were in the block

## 🔴 POLARITY INVERTED — read before citing ANY residency claim below (17:32Z)

*Do not tidy this block away — the duplication IS the point: this file is append-only and past the ~24.4KB `Read`
limit, so a truncated read must still see the corrections. Conclusions are restated in full, never pointed at.*

*Do not tidy this block away; the duplication is deliberate so a truncated read cannot miss it.*

**CI executes the `!m_hasResidencySet` FALLBACK, not the residency-set path.** `m_hasResidencySet = true` is set
only inside `else if (supportsFamily(MTL::GPUFamilyApple6))` (`metal-device.cpp` L121, verified at merged
`d8c609ef`); the hosted `Apple Paravirtual device` on `macos-26-arm64` lacks Apple6, and a sibling job on the
**same image `20260728.0273` / same adapter** logs the terminal-`else` line `GPUFamilyApple6 not supported; using
per-encoder useResource fallback` three times.

⇒ **The fallback is the path that RAN** and is very likely covered by the three passing `compute-indirect*.metal`
cases. **The residency-SET path is the genuinely unverified one**, and it needs Apple6-capable hardware CI does
not have. ❌ **Do NOT cite `SLANG_RHI_METAL_NO_RESIDENCY_SET` as the missing artifact — CI is already on that
path.** The missing artifact is an **Apple6 run**.

**✅ INFERENCE GROUNDED AT SOURCE (17:51Z, Main-read job log 91655709489).** The sibling job shows
`Metal: not supported (failed to get shader entry point code)` with **207 `.metal` rows REGISTERED, 0 EXECUTED** (all `SKIPPED (device not available)`) — Metal was enumerated as a
device type but never came up, for a pre-#807 `metal4.0` reason
(`'required_threads_per_threadgroup' attribute requires Metal language standard metal4.0`). The job is green because
skips are not failures. **Registered ≠ executed:** this job is valid *environment* evidence (the adapter lacks
Apple6) and **zero** *execution* evidence. Verified across **three independent methods** (raw+unanchored, `sed`-stripped+anchored, and bare `.metal` control = 209) — `\.metal +PASSED` = 0,
`\.metal +SKIPPED` = 207; note a `^`-anchored form returns 0 against this log because every line begins with an ISO
timestamp, so **if a pattern returns 0 where you expect a large number, suspect the anchor before the corpus.**
`Debug callback output` = 0 in the four green logs, 3 here

⚠️**PROVENANCE — do NOT credit these two corrections to a message I sent.** At 17:58 the approver
thanked me for "your 207-rows correction" and "your (b) retraction" on print order. **I never sent
either** — both were self-corrections on its side that also landed in this file. I have since
**independently verified** both against job `91655709489`: `grep -c '\.metal'` = **209** total,
`\.metal[[:space:]]+SKIPPED` = **207**, `(PASSED|FAILED)` = **0**; and the `[Info]` line at L465 sits
*after* the L464 verdict ⇒ verdict-then-flush. So the facts are MINE-VERIFIED but the **authorship is
the approver's**. Left standing, this becomes me accepting credit for another tier's correction — the
mirror image of [[feedback_unattributed_fact_reads_as_your_own]], putting false provenance under
numbers that now sit in shared canonical files. **Accepting unearned credit corrupts the audit trail
exactly as badly as an unattributed borrow.**

**Why the borrow is valid — a SOURCE argument about emission, not a log-order argument.** `GPUFamilyApple6`
support is an **adapter property probed during device creation**, inside `createDevice`'s residency-set setup
(`metal-device.cpp` L112-145), necessarily *before* any shader compiles. So the Apple6 result cannot be an artifact
of the later shader failure.

❌ **RETRACTED — my own earlier grounding was wrong and I nearly left it standing.** I wrote that the Apple6 line is
emitted *"one line BEFORE that shader error"* and that this makes the verdict *"causally independent."* **Both
halves fail.** In the log the Apple6 `[Info]` line is L465, *after* `Metal: not supported` at L464 — and print order
could not establish emission order regardless, because `debugCallbackOutput` is assigned **only** inside
`RETURN_NOT_AVAILABLE` (`tests/testing.cpp:884`): the captured `[Info]` cannot print until the availability check
has already decided to bail. Printed sequence is **verdict first, then the flush of everything captured during the
attempt**. Citing it put a falsifiable-and-false premise under a true conclusion — the same shape as the circular
`registerResource` citation: real evidence that cannot bear on the claim. **Never cite log print order as evidence
of emission order when the logging path buffers.**

Caveat, tightened 17:41Z: **same image + same adapter, diagnostic observed in a sibling job at a DIFFERENT commit**
(`4144455d`, merge `b59a992`) — **not** "the job where the device check failed." That job's overall conclusion is
`success`; a green job can still contain a **failed availability probe for one backend**, which is why
`debugCallbackOutput` was dumped at all. So this is an **inference**, not a same-run observation (the #800 logs carry
no residency line
either way, by construction). Does **not** retroactively make R3 `WOULD_APPROVE` — the withhold rested on an
unresolved question, and *unresolved* was accurate even though **which** path was unresolved was inverted.

**❌❌ I ALREADY HAD THIS IN MY OWN STORE and contradicted it all chain** — the 8th error, and the only one whose
correct answer was already recorded: [[feedback_green_job_skipped_backend_zero_coverage]] (`:38-41`, CI exercises
the *fallback*) and [[project_slang_rhi_801_metal_buffer_import]] (states verbatim that
`SLANG_RHI_METAL_NO_RESIDENCY_SET` was never the missing artifact). **A recall failure, not an evidence failure.**

⭐ **NARROWING a claim is not TESTING its premise.** I retracted "the fallback is unexercised" and rewrote it as
"the fallback is unverified" — weaker, same direction, same untested premise (*which path does CI take?*). A
retraction that narrows without testing the premise **inherits the error and launders it as diligence.** Ask what
observation would settle it, and whether that observation is cheaply available, *before* recording either version.
Here it was one unauthenticated `curl`, and my index already held the rule that job logs are public.

⭐ **Why log-line reasoning kept failing, fully explained:** `debugCallbackOutput` is captured **only** inside
`RETURN_NOT_AVAILABLE` (`tests/testing.cpp:884`) ⇒ those `[Info]` lines can appear **only on a device-unavailable
failure path**. On the green #800 jobs the diagnostic genuinely cannot print. The affirmative evidence lived in a
**failing probe on another job** — the log we never thought to read, not the ones we kept re-reading.
slang-rhi#800 (`fknfilewalker`, external contributor) implements `dispatchComputeIndirect` for the Metal backend. **Three files** at the final head: `src/metal/metal-command.cpp` (+7/-4), `docs/api.md` (+1/-1), `tests/test-compute-indirect.cpp` (+3/-3, added at R4).

**Terminal state: MERGED 2026-08-03T15:26:58Z @ `d8c609ef95e617ee68cb16f48c2850ee1d07c941`** by `skallweitNV`, at the exact decided head `bf135d7222a8` with zero intervening commits. Approver verdict **ABSTAIN_POLICY (`CHALLENGER_CONCERN`)**, mode `live_late`, decided 15:26:00Z — merged 58s later; ledger row re-recorded (same commit ⇒ replaces) with the residency gap as **primary** basis and review-state secondary, join `human_verdict=APPROVED`. Approver owns that row; I never write the ledger.

