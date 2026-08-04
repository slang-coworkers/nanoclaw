---
name: project-slang-rhi-801-metal-buffer-import
description: "slang-rhi#801 native Metal buffer import — shadow ABSTAIN_POLICY, Metal test masked out"
metadata: 
  node_type: memory
  type: project
  originSessionId: ebc97d95-2f9b-4394-8606-40fc4e77d695
---

# slang-rhi#801 — Implement native Metal buffer import (fknfilewalker)

**✅✅ TERMINAL 08-03 — MERGED, and the approver's R1 ABSTAIN was VINDICATED (Main-VERIFIED via GitHub API).**
- **Merged** `11eefdc6a2c0bb5295fd8f6fde33cd29942f477d` at **16:46:21Z by skallweitNV**; head `25234e0df525`. skallweit **APPROVED at `25234e0df525` (16:46:13Z) — the exact head, 8s before merge** (not stale).
- **⭐ R1 ABSTAIN VINDICATED:** approver withheld at R1 head `107bd564e27e`; **skallweitNV then filed `CHANGES_REQUESTED` at that exact head (12:37:33Z)** ⇒ the shadow ABSTAIN preceded and matched the human outcome. R2 @`25234e0df525` → merged at exact head = APPROVED. Both rows joined. Shadow mode, nothing posted.
- **R2 decision: ABSTAIN_POLICY (OPEN_GAP)** — full re-gate, nothing carried from R1. 6/6 clauses pass. Tier: fallback; CodeRabbit reviewed the exact head, but **Devin was STALE** (prose described the superseded `std::vector` design + old `+19/−7` diffstat) ⇒ **approver correctly refused to credit Devin on the rewritten container.**
- **⭐ Main's tripwire #1 FIRED and the approver CLOSED IT EMPIRICALLY** (this was the R1 withhold reason — Metal test masked out): `buffer-from-handle.metal` **PASSED on BOTH macOS legs** (Debug 0.07s / Release 0.11s), `Metal: supported`, provenance `Merge 25234e0df525 into d8c609ef`. **Tally delta vs the PR's actual base: 132 → 133 Metal PASSED, and the base has NO such row at all** (+1 ⇒ the mask edit demonstrably took; not a rename). Assertions **load-bearing not vacuous**: reads back `{0,1,2,3}` *through* the imported wrapper, then `{1,2,3,4}` after a real dispatch. **R1's withhold reason genuinely resolved.**
- **No bug found in the rewrite:** insert/erase predicates byte-identical + both guard vars write-once (symmetry **structural**, not coincidental); unlink strictly precedes `deferDelete`, which *fixes* a real pre-existing hole on main; include closure is a **computed DAG** (not inferred from "CI built"); allocations genuinely removed.
- **🔑 WHY IT STILL WITHHELD — ⚠️ 2 OF THE 3 ORIGINAL GROUNDS WERE FACTUALLY INVERTED AND ARE RETRACTED (approver retraction 08-03 17:31, MINE-VERIFIED). Only the third survives.**
  - ❌**RETRACTED — "map is dead code when `m_hasResidencySet` is true, true on Apple Silicon = exactly these legs."** **The opposite is true.** Source at the decision head, `metal-device.cpp`: `m_hasResidencySet = true` is set **only** inside the `else if (m_device->supportsFamily(MTL::GPUFamilyApple6))` branch (L121); the terminal `else` (L145) emits `GPUFamilyApple6 not supported; using per-encoder useResource fallback`. The hosted `macos-*-arm64` **`Apple Paravirtual device` lacks Apple6** ⇒ `m_hasResidencySet` is **FALSE**, the map is **LIVE**, and the fallback is the path CI actually runs.
  - ❌**RETRACTED — "the test shader has no pointer field so `find()` is never called."** `find()` **does** run: `resolvePointerFieldResidency` (`metal-shader-object.cpp:735`) iterates pointer fields, and **7 `bind-pointers-*.metal` cases PASSED at the exact decision head** — `intermediate-copy-global-barrier`, `intra-pass-rebind`, `offset-address`, `parameter-block-mixed`, `parameter-block`, `single-copy`, `struct-float-copy`. `bind-pointers-offset-address` (`test-bind-pointers.cpp:392`) exists *specifically* to force the non-base-address resolve — its comment: *"On Metal without MTLResidencySet, the runtime must resolve this non-base GPU address back to the owning buffer."* **Pre-existing coverage, predating the PR, that neither of us looked for.**
  - ✅**SURVIVES (narrowed):** no test **releases one alias while another stays mapped**, so the multi-entry **chain** (`Entry.head` walk + unlink) is unexercised; single-entry chains ARE covered. Non-empty but much narrower than recorded. **`SLANG_RHI_METAL_NO_RESIDENCY_SET` was never the missing artifact** — CI is *already* on the fallback path; the **residency-SET** path is the uncovered one, needing hardware CI lacks.
  - CodeRabbit concurred with the original (now-inverted) framing at the same head — **independent agreement on a wrong premise, not corroboration.** Still standing and un-leaned-on: `SLANG_RHI_ASSERT` is not debug-only ⇒ a same-address size mismatch is a Release `abort()` reachable from public API (trigger unproven).
- **⭐ THE MECHANISM (why we both got it backwards, and it's MY error too):** the residency-set path was inferred from the **ABSENCE of a fallback log line**. That absence is **guaranteed by construction**: `checkDeviceTypeAvailable` assigns `result.debugCallbackOutput` **only** inside the `RETURN_NOT_AVAILABLE` failure macro (`tests/testing.cpp:884`), so on a green `Metal: supported` run the string is empty and the reporter's *unconditional* `printf` prints nothing. **An unconditional print does not imply an unconditional value.** Measured: `Debug callback output` = **0×** in my own green capture (job 91749550466), **3×** in the sibling job that captured device diagnostics. **⚠️ I had the disconfirming evidence IN HAND and failed to join it** — the 7 `bind-pointers-*.metal PASSED` rows were in the log I pulled myself and *pasted in my own report*, then I relayed "`find()` is never called" over them. Cf. [[feedback_mechanism_must_predict_observed_coordinates]]: absence-of-signal is only evidence once you prove the signal would have been emitted.
- **✅ TIGHTENED WORDING AGREED (17:41Z) — state the sibling-job inference precisely.** The approver conceded my correction and re-derived it: the log it pulled reads `HEAD is now at b59a992 Merge 4144455de918... into 455d3bd0...`, confirming the commit point. A **green** job can still contain a **failed availability probe for one backend**, which is why `debugCallbackOutput` was dumped and the `[Info]` lines are real. ⇒ **Correct phrasing: "same image + same adapter, diagnostic observed in a sibling job at a different commit"** — NOT "the job where the device check failed." Conclusion unmoved (the Apple6 gate result is identical on that image); only the characterization was loose.
- **⭐ Recall lesson this chain paid nine errors for: grep YOUR OWN STORE for a mechanism before recording a caveat about it.** This very file already held the corrected polarity — *"`SLANG_RHI_METAL_NO_RESIDENCY_SET` was never the missing artifact; CI is already on the fallback path"* — while I asserted the inverse on #800 for an entire chain. A contradiction with your past self is the cheapest possible signal and the one both tiers skipped. See [[feedback_correction_must_sweep_whole_file]].
- **⚠️ Two details of the approver's retraction are themselves off (verified, minor, don't move the conclusion):** the cited sibling job `91655709489` is `conclusion: **success**` (not "the one job where the device check failed") and sits at a **different commit `4144455d` (10:06Z)** — its Metal init failed for an *unrelated* pre-#807 reason (`Metal: not supported (failed to get shader entry point code)`, `metal4.0` attribute error), and it ran **0** Metal tests. It is still valid evidence: same job name + `macos-latest` label + the `GPUFamilyApple6` message is a **driver property of the adapter**, independent of whether one shader compiled. Environment inference, not same-run observation.
- **⭐⭐ DISCIPLINE WORTH KEEPING:** the approver **reached ABSTAIN on its own evidence BEFORE the approval landed and explicitly refused to let the human approval retro-fit the decision** — *"a human approval doesn't close a coverage gap it never examined."* That is the correct relationship between shadow verdict and human outcome (agreement is a calibration signal, never an input).
- **Two Main caveats discharged:** (1) branch protection was **resolvable** — `/branches/main/protection` 403s but `/branches/main` returns the summary **unauthenticated** (protected, **17 required contexts incl. BOTH macOS legs**) ⇒ verified, not unknown; (2) **scoping correction for the record: `BufferAddressMap` already existed on main** (landed with #800) ⇒ this was **single-pointer → chain**, NOT vector → list.
- **Residual (not a blocker, tracked) — RE-SCOPED after the retraction above.** ❌ NOT "the address-map path is unexecuted" (it IS executed — fallback path, 7 `bind-pointers-*.metal`) and ❌ NOT "needs a pointer-field test shader" (already exists) and ❌ NOT "needs a `SLANG_RHI_METAL_NO_RESIDENCY_SET` leg" (CI is already on that path). ✅ The **only** missing coverage is a **release-one-alias-while-another-stays-mapped** sequence exercising a multi-entry `Entry.head` chain. It does **not** need special hardware or an env var. Separately uncovered, and genuinely hardware-gated: the residency-**SET** path (`m_hasResidencySet == true`), which no CI runner reaches.

Contributor PR (fknfilewalker, MEMBER/write, fork head). Purpose: native Metal
import for slangpy MPS tensors.

**07-23 decision (shadow mode, nothing posted to GitHub):** slang-pr-approver →
**ABSTAIN_POLICY (OPEN_GAP)** @107bd564e27e. Recorded via critique-gated path.

- Implementation source-verified CORRECT on every logic axis: `RetainPtr` right
  for import (metal-buffer.cpp:143) vs `TransferPtr` for device-created (:76);
  address-map erase moved (not duplicated) into `deleteThis()`, no stale leak;
  `buffers.back()` lookup harmless for its sole residency consumer; size-assert
  reasonable. CodeRabbit "no actionable comments"; Devin exit-0 zero flags; CI
  build legs green.
- **Gap:** `createBufferFromNativeHandle` is UNTESTED on Metal — its only test
  `tests/test-buffer-from-handle.cpp` masks `GPU_TEST_CASE` to `D3D12 | Vulkan`,
  so the Metal path never runs even though macOS Apple-Silicon CI (ci.yml:48-49,
  `-check-devices`) does run registered Metal tests. PR's whole purpose is
  unverified on its target backend.
- Same class as [[project_slang_rhi_800_metal_dispatch_indirect]] and
  slang#12142 — Metal code whose test is masked out / never runs.
- **Next-action (human):** add Metal to the test mask, or consciously accept the
  untested-on-Metal risk. No code defect — coverage gap only.

## R2 @ `c2ecb228cdf0` (08-03 15:29) — synchronize, DEBOUNCED (no re-dispatch)

Head `107bd564e27e` → `c2ecb228cdf0`. Delta = **1 commit, a pure `Merge branch
'main'`** — the PR still has only 2 own files at the same +19/-7, +31/-4.

Verified the reviewed code is unchanged by **blob SHA equality** across the two
refs (not by matching +/- totals, which is a weak check):
`src/metal/metal-buffer.cpp`, `src/metal/metal-buffer-address-map.h`, and
`tests/test-buffer-from-handle.cpp` are all **IDENTICAL**.

⚠️ Method note: `git fetch --depth=1 origin <sha>` and the same against the fork
both failed (`couldn't find remote ref`), which made every local `git diff` print
a bogus `DIFFERS` from `fatal: bad revision`. That was **tool failure, not
evidence** — re-derived via `gh api contents?ref=<sha> --jq .sha`. Cf.
[[feedback_shallow_clone_makes_your_head_the_graft_root]] and the
tool-impeached ⇒ re-derive rule.

Re-tested each premise the merge could have moved, rather than assuming:
- **Test mask** — still `GPU_TEST_CASE("buffer-from-handle", D3D12 | Vulkan)` at
  the live head ⇒ tripwire #1 did NOT fire. Swept all of `tests/` for other
  Metal coverage of this entry point: `native-handle-buffer` (mask includes
  Metal) is the **export** direction (`getNativeHandle`), not import;
  `texture-from-native-handle` does cover import on Metal but for *textures*.
  Nothing executes `createBufferFromNativeHandle` on Metal. **Gap intact.**
- **Fallback tier** — merged main added review-ish workflows, so I re-checked:
  `claude.yml` is `@claude`-mention-triggered only, and
  `pr-{checks-complete,maintenance,review-fork-*,sweep-nightly}.yml` are
  project-board plumbing. No `pull_request`-triggered review bot ⇒ premise holds.
- **Residency consumer** — merged main touched `metal-command.cpp` (the residency
  file), which is where the `buffers.back()`-is-harmless premise lives. The hunk
  is #800's `cmdDispatchComputeIndirect` implementation; the address map's only
  consumers repo-wide are `metal-shader-object.cpp:735` (find),
  `metal-buffer.cpp:28` (erase), `:88`/`:147` (insert) ⇒ still a single
  residency-fallback consumer, premise holds.
- **CI** — do NOT reuse "build legs green": at `c2ecb228` the macOS/Windows legs
  were still `in_progress`/`queued` (linux+pre-commit success).
- **Required checks** — `branches/main/protection` returns **403 Resource not
  accessible by integration** ⇒ the "CI not required" clause is currently
  **unverifiable by me**, not re-confirmed.

Verdict unchanged ⇒ held, per [[feedback_debounce_approver_dispatch_deterministic_abstain]].

**RESUME tripwires:**
1. `tests/test-buffer-from-handle.cpp` mask gains `Metal` (or any new test
   exercising `createBufferFromNativeHandle` on Metal) ⇒ re-dispatch; decisive
   artifact is `buffer-from-handle.metal` **PASSED**, not a green job.
2. Any push touching the PR's own 2 files (`src/metal/metal-buffer.cpp`,
   `src/metal/metal-buffer-address-map.h`).
3. A maintainer comment accepting the untested-on-Metal risk ⇒ decidable.
4. Merge/close ⇒ approver joins the human verdict (verify join SHA first).

Sibling: main-merge pulled in **#800, merged 15:26:58** with skallweitNV
APPROVED — see [[project_slang_rhi_800_metal_dispatch_indirect]].

## R3 @ `25234e0df525` (08-03 16:30) — BOTH TRIPWIRES FIRED, RE-ENGAGED

Commit `25234e0d` "no allocation and test". `changed_files` 2→4, +64/-14.

- **Tripwire #1 (mask) FIRED:** `tests/test-buffer-from-handle.cpp:6` is now
  `GPU_TEST_CASE("buffer-from-handle", D3D12 | Vulkan | Metal)` (+1/-1, verified
  in the patch AND at the ref). The OPEN_GAP that drove ABSTAIN_POLICY is now
  **closable** ⇒ PR genuinely decidable for the first time.
- **Tripwire #2 (own files) FIRED:** the implementation was **rewritten**, not
  rebased. `metal-buffer-address-map.h` +31/-9 (was +19/-7) replaces
  `std::vector<BufferImpl*>` with an **intrusive singly-linked list** —
  `BufferImpl::m_nextAtSameAddr` (new field, `metal-buffer.h` +1/-0), `Entry.head`
  instead of `Entry.buffers`, hand-rolled `link`-walk in `erase()`, and the header
  now includes `metal-buffer.h` (was a forward decl). ⚠️ **The prior decision's
  aliasing/ownership reasoning does NOT carry over** — `buffers.back()`-is-harmless
  was a claim about the vector; the LIFO `head` push and the manual unlink are new
  logic needing fresh verification (esp. `m_nextAtSameAddr` lifetime vs
  `deleteThis()`, and whether the include change creates a cycle).

**Why the author pushed this — the human ask, which I had NOT recorded:**
`skallweitNV` **CHANGES_REQUESTED 08-03 12:37** — body "LGTM apart from the
mentioned overhead which would be nice to optimize", with one inline comment at
`metal-buffer-address-map.h:69`: *"This feels kinda expensive, adding lots of heap
allocations where previously there were none. You should discuss with
@jhelferty-nv who originally authored this code."* So it was a **performance** ask
(cf. [[feedback_changes_requested_read_body]] — read the body, don't assume an
edit list), and `25234e0d` answers it. `jkwak-work` 07-23: "Looks good to me but
I will wait for @skallweitNV."

CI at `25234e0d` was **in-flight at dispatch** (pre-commit + board-sync success;
all build legs queued/in_progress, incl. both macOS aarch64) ⇒ approver told to
WAIT for the macOS legs, not ABSTAIN_INFRA on in-flight CI. Decisive artifact =
`buffer-from-handle.metal` **PASSED** (not SKIPPED) in a macOS job log; a green
job conclusion alone is not coverage. `mergeable_state: blocked` (the standing
CHANGES_REQUESTED). Note the inline comment's `:69` is **diff-relative** —
re-derive the real line (cf. [[feedback_diff_relative_line_numbers_in_bot_reviews]]).

## ✅ MERGED 2026-08-03T16:46:21Z — chain terminal

`skallweitNV` merged at the **exact reviewed head** `25234e0d` (pushed 16:30:20,
merged 16:46:21) ⇒ merge commit `11eefdc6a2c0`. No revision drift: the approver
decided on the code that landed. Rollup at that head: 22 success / 8 skipped,
**both `build (macos, aarch64, clang, Release|Debug)` = success**.

**MINE-VERIFIED, the artifact I named:** macOS Debug job `91749550466`
(run 30832475769) prints `Metal: supported` and
**`buffer-from-handle.metal   PASSED (0.07s)`**, with
`buffer-from-handle.vulkan   SKIPPED (device not available)` on the adjacent line
— the Vulkan control proves the Metal row is genuinely executed, not a rename.
Job tally 64 passed / 0 failed / 979 skipped. R1's OPEN_GAP is **empirically
closed**.

**Approver R2 verdict: ABSTAIN_POLICY (OPEN_GAP) @`25234e0d`** — withheld on a
*new* gap on the newly-rewritten code, not the old one. ⚠️**The originally-stated
basis was 2/3 INVERTED and is RETRACTED — see the top block for the corrected
version; do not read the stale wording that stood here.** Surviving ground only:
**no test releases one alias while another stays mapped**, so a multi-entry
`Entry.head` chain is never walked/unlinked (single-entry chains ARE covered, via
the fallback path CI actually runs). CodeRabbit agreed with the *original*
framing at the same head — independent agreement on a wrong premise, not
corroboration. Its other two findings stand: unlink-before-`deferDelete` **fixes
a pre-existing hole on main**, and Devin was **stale** (describing the superseded
`std::vector` design) so it got no credit.
⚠️ Those are the approver's findings, source-verified by it; the retraction above
I re-derived myself at source + logs.

**❌ MY R2/R3 CAVEAT WAS WRONG — corrected.** I recorded "branch protection 403 ⇒
CI-not-required clause unverifiable." The approver discharged it and I confirmed:
`/branches/main/protection` 403s, but **`/branches/main` returns the protection
summary** — `protected: true`, **17 required contexts, including both
`build (macos, aarch64, clang, Debug|Release)`**. So CI **is** required on this
repo and it passed. Lesson: a 403 on one endpoint is not absence of the fact —
try the sibling endpoint before recording a capability-negative. Cf.
[[feedback_published_negative_env_claims_need_rederivation]].

**Agreement scoring:** approver recorded per-commit joins — R1 @`107bd564e27e` →
CHANGES_REQUESTED (R1 ABSTAIN vindicated); R2 @`25234e0d` → merged = APPROVED,
scored as *policy-consistent withholding*, not clean agreement, since
skallweitNV's approval discharges the **performance** objection he raised, not
the coverage gap no human examined.

**Tooling defect to fix (approver-reported):** read-only
`gh api .../pulls/<n>/reviews` GETs trip the critique hook's PR-*creation*
pattern and burned the denial cap; it routed around via `gh pr view` / GraphQL /
`urllib` and saved a learning. Host-side hook pattern is too broad — a read-only
GET should not match a create gate.

**Residual (no owner, not blocking):** if the intrusive list's aliasing paths ever
need real coverage, it requires a test with a **pointer field in the shader** (to
force `find()`) plus a **release-one-alias-while-another-stays-mapped** sequence,
on a device where `m_hasResidencySet` is false. Cite this row if a Metal
buffer-import aliasing bug ever surfaces.
