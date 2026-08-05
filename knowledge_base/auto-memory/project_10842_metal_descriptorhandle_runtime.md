---
name: project_10842_metal_descriptorhandle_runtime
description: "slang#10842 DescriptorHandle support on Metal; re-triaged 07-24; parked maintainer-owned GPU-gated"
metadata: 
  node_type: memory
  type: project
  title: "#10842 Metal DescriptorHandle runtime — re-triaged/PARKED"
  tags: 
    - slang
    - slang-rhi
    - metal
    - descriptorhandle
    - bindless
    - parked
    - jhelferty-nv
  originSessionId: 86f30980-8c62-4d53-a4a7-5114a82df6ab
---

## ⚡ CONTROLLING STATE — read this first

*This row is append-only: its newest and most authoritative content sits furthest from the top, and the file is
38KB — past the ~24.4KB `Read` limit. ⚠️*(The `~24.4KB Read limit` premise was FALSIFIED 2026-08-04 — see [[project_memory_files_over_read_limit_backlog]]. The restate-in-full practice still stands on its own merit: conclusions up front beat pointing into a long append-only file.)* So the conclusions are restated here in full rather than pointed at, because
a pointer would resolve to bytes a truncated read already dropped. Do not tidy this block away as redundant.*

- **Status:** NOT approved-to-merge. slang#12096 is a **HOLD**; `jkwak-work` owns it. Fixer must not pick it up
  without an explicit go-ahead.
- **Verdict:** FIXER ROOT-CAUSED it — **all three hypotheses, including mine, were WRONG.** The test assumes an
  ABI that Metal lacks, so the handles are never bound (the working ABI is `ParameterBlock`). Net state is
  **worse than a red run**: there is still **ZERO executed bindless coverage**, and residency is neither
  confirmed nor cleared.
- **Both `.metal` bindless failures were a FIRST-EVER execution, not a regression.**
- **RESUME (1):** `skallweitNV` / `jhelferty-nv` direction on items 1-3 (a design/scope call, not ours to make).
- **RESUME (2):** operator authorizes a reply to `skallweitNV` asking what testing he wants and who runs it.
- ⭐**Standing lesson from this chain:** ask whether a PR's code is even **in the artifact** before relating it
  to a failure — slang#12294 was a false alarm because slang-rhi pins a *prebuilt* Slang, so the draft was never
  in the binary. Scope-breadth is not a mechanism.
- Full chronological detail below; see [[project_memory_files_over_read_limit_backlog]] for why this block exists.

# shader-slang/slang#10842 — DescriptorHandle support on Metal

**State (2026-07-24):** Re-triaged @HEAD 5281ccc66 / slang-rhi 29dc332e. feature/medium/P2,
component = slang-rhi Metal **runtime**. **PARKED at triaged — no fixer dispatch.**
Maintainer-assigned (jhelferty-nv). Human triage labels untouched.

## Trigger
jhelferty-nv webhook comment (5073070319): "triage this again… we will **not** support
DescriptorHandle for the **combined texture sampler** case (doesn't fit expected bits),
but I'd expect the **other cases** to be possible."

## Verdict (empirically grounded)
- **Two-layer conflation resolved:** Metal **compiler/emit** side ALREADY supports
  `DescriptorHandle<T>` (unwrapped to native layout, `slang-emit-metal.cpp:148`) — no compiler
  work needed. The real gap is the **slang-rhi runtime**: Metal backend has zero
  `getDescriptorHandle` overrides (all inherit `SLANG_E_NOT_AVAILABLE`), never advertises
  `Feature::Bindless`. (The "was added" claim in closed #11540 referred to the emit side.)
  ⚠️ **EVIDENCE RE-BASED 2026-08-03 — the original `git log -S over 200+ commits` support for
  this bullet was UNSOUND** (shallow-clone graft; see the slang-rhi warning below). Verdict
  unchanged, but now rests on **state-at-`main`**, not history: 43 files under `src/metal`, **no
  `metal-bindless-descriptor-set.*` file at `main`** (⚠️ it DOES exist on #802's head `c09d12c01` —
  see the name-the-ref note below), `getDescriptorHandle` ×0 in each of
  `metal-device.cpp` / `metal-buffer.cpp` / `metal-texture.cpp` / `metal-sampler.cpp`, and
  `Feature::Bindless` absent from `metal-device.cpp`. **Make a negative existence claim from state
  at a ref, never from a history search** — a history search can only say "I didn't find it in the
  commits I could reach."
- **Combined-case carve-out is well-founded:** `DescriptorHandle.value` = one `uint64_t`.
  Metal combined tex+sampler needs 2×64-bit gpuResourceIDs (128b) → won't fit (D3D12 only fits
  by packing 32-bit heap indices). Separate buffer/texture/sampler each = one 64-bit native id
  → feasible. Combined stays out of scope (tracked closed as **#11540**).

## ✅ 2026-08-03 14:2xZ — run `30819568482` FAILURE ANALYZED (Main-verified from logs + config)

**NOT A REGRESSION — first-ever execution.** slang-rhi `ci` run `30819568482`, branch `fix/issue-10842`, head `c09d12c01585`, jobs `91705741241` (Debug) / `91705741242` (Release). `bindless-buffers.metal` + `bindless-textures.metal` FAILED; 129P/76S/2F.

**The 129 passing are IDENTICAL to main's 129.** On green main run `30819530525` (same day, same runner) these two tests appear **ZERO times** — only `.vulkan`/`.cuda` variants show `SKIPPED (device not available)`. Cause is the feature line:
```
main:    hardware-device parameter-block          surface rasterization argument-buffer-tier-2
PR #802: hardware-device parameter-block bindless surface rasterization argument-buffer-tier-2
```
`test-bindless.cpp` guards on `hasFeature(Feature::Bindless)`; #802's `metal-device.cpp:252 addFeature(Feature::Bindless)` is what makes them run at all. ⇒ **2 net-new executions, not 2 newly-broken tests. There is NO green baseline to bisect against.**

**⚠️ Signature correction — NOT uniformly "all zeros" (I relayed it that way; wrong).** Of 77 failing assertions, **56 are actual 0, 21 are NONZERO** (1,2,3,4,5,8). The nonzero ones are second-phase readbacks: `compareComputeResult(device, rwBuffer, {2.f,3.f})` observing `{1,2}` = the buffer's **original unmodified contents**. ⇒ reads returned 0 **and writes never landed** — a resources-not-bound / descriptors-not-resolving shape, **not** codegen arithmetic. Root-cause target = `src/metal/metal-bindless-descriptor-set.cpp`, `getDescriptorHandle`/`setDescriptorHandle`.

## ✅ #12294 scope flag (triager, 14:14Z) — FALSE ALARM, verified twice

Triager flagged that all-zeros covering **both** buffers and textures is broader than draft PR #12294's texture/sampler-only fix, so #12294's scope may no longer match. **It cannot affect this run:**

1. **AIRTIGHT: #12294's code is not in the binary.** slang-rhi does not build Slang from source — `CMakeLists.txt:148` pins `SLANG_RHI_FETCH_SLANG_VERSION "2026.12.2"`, and the log confirms `-- Fetching Slang 2026.12.2 ...`. #12294 is an **unmerged draft** ⇒ never compiled into the `slangc` that produced these shaders.
2. **Gating: provable no-op for these params.** #12294's hunk is in `MetalSourceEmitter::emitFuncParamLayoutImpl`; `resourceType` only diverges from `paramType` when `as<IRArrayType>(paramType)` succeeds. The bindless tests use **scalar** params (`uniform Texture2D<float>.Handle`, `uniform Buffer<float>.Handle`) ⇒ every switch arm sees the identical value as before.

⚠️ **BUT "different layers" (my framing) was TOO GLIB and I should not repeat it.** `DescriptorHandle<T>` params **do** flow through `emitFuncParamLayoutImpl` — Metal is a bindless target (`areResourceTypesBindlessOnTarget`), so `DescriptorHandle<Texture2D>` emits as a plain `Texture2D` with `[[texture(N)]]`, and the pre-existing unwrap sits ~4 lines above #12294's hunk. The two features are separated by **an array-type guard + the release pin**, NOT by living in different files. Telling a fixer "different layers, don't worry" would be false reassurance the moment they open that function.

**Defects in the flag's reasoning, worth remembering as a class:** (a) treated **scope-breadth as evidence of mechanism** — buffers+textures failing together is the *expected* shape of ONE upstream cause, not a widened one; (b) reasoned about a PR whose diff **isn't in the build**; (c) never checked the array-type precondition that is the sole trigger of the hunk. ⇒ **before relating a failure to a PR, first ask whether that PR's code is even in the artifact under test** (pins/drafts make this common in cross-repo CI).

**Adjacent, genuinely #12294's area:** `sampler-array.metal SKIPPED (skipped due to regression in Slang v2025.18.2)` — the only such skip in the run; `test-sampler-array.slang` uses `Texture2D tex[32]; SamplerState samplers[32];` in a `ParameterBlock`. **That** is the test that moves if #12294 lands and the pin advances — not the bindless pair.

**Provenance (Main-verified 2026-08-03; triager was one commit off):** skip is `tests/test-sampler-array.cpp:29`, Metal-only, unconditional, sole such skip in the suite. Added by **`8da2bf4f` = slang-rhi #533 "Enable CUDA texture access tests"**, skallweitNV, 2025-10-09 — **NOT `eb8c343`/#534 "Enable bindless support in CUDA"** as relayed. Sibling PRs, same author, same day; `eb8c343`'s 11-file list (not truncated) omits the file, and the line is absent in `8da2bf4f`'s parent `e5242e04`. **The triager's substance stands unchanged** — predates #12291, collateral from the CUDA/bindless test push, and un-skipping needs *both* #12294 merged *and* the rhi Slang pin advanced past it.

⚠️ **Shape worth recognizing: a verified-sounding provenance claim with the wrong commit id** — right author, right date, adjacent PR number, correct conclusion. Cheap to verify, and it was offered *as* a verification. **Nobody re-checks a commit id that supports a conclusion they already agree with** (triager's phrasing; same family as [[project_11225_capability_target_incompat_slangpy_break]]'s wrong-premise/right-conclusion lesson). Guard: **verify provenance by the PATCH — line present after, absent in parent — never by proximity.**

## 🔴 ROOT CAUSE of that misattribution — **`slang-rhi` clones are SHALLOW; git history tools LIE there**

Triager found it (2026-08-03) and it generalizes well past this line. Their clone: `git rev-parse --is-shallow-repository` = **`true`**, `.git/shallow` = **`eb8c343`**, and `git log -1 --format='%P' eb8c343` returns **empty parents** — it is the **graft root**.

**At a graft boundary every pre-existing file looks newly added.** `git show --stat eb8c343` reports **521 files / 125,516 insertions / 0 deletions**; the API shows its **real 11 files**. So `git log --follow -S` reported the oldest commit it could reach as the "introduction." **Right tool, truncated history, confident wrong answer.**

**Tell + detection recipe:**
- `--follow` returned only **3 commits** for a file with a **two-year** history (`tests/test-sampler-array.cpp` really dates to `4ab6f46d`, 2024-08-30 "initial import"). ⇒ **an implausibly short history for an old file means suspect the CLONE, not the file.**
- `git rev-parse --is-shallow-repository` / `cat .git/shallow` / empty `%P` on a non-root commit — **check clone depth before trusting any provenance answer in this repo.**
- Prefer REST (`commits?path=`) or `git fetch --unshallow` when provenance is load-bearing; the API sees full history regardless of local depth.

⇒ **Property of the CHECKOUT, not of the coworker** — any agent running `git blame` / `git log -S` / `--follow` in `slang-rhi` gets the same false answer; triager shared it as a learning for that reason. **It also retroactively invalidated the `git log -S` evidence in my own Verdict bullet above** (conclusion survived re-verification by state-at-ref; the support did not). Same class as [[feedback_green_job_skipped_backend_zero_coverage]]: **the tool answered a narrower question than the one I asked.**

### ⚠️ FOLLOW-ON (triager, 14:39Z) — my own "no such file" phrasing had the same defect: **NAME THE REF**

I wrote "no `metal-bindless-descriptor-set.*` file at all." Main-verified: those files **do exist on #802's head `c09d12c01`** (`src/metal/metal-bindless-descriptor-set.{cpp,h}`) and are absent only at `main`; at both refs `d3d12/` and `vulkan/` carry their equivalents. **Self-consistent and expected** — #802 is what adds `addFeature(Feature::Bindless)`, so it is simultaneously why those tests execute at all *and* where the implementation under test lives. So the file-not-at-`main` result **pins** the root-cause target to the right ref rather than refuting it.

⇒ **"File X doesn't exist" is not a claim. "X doesn't exist at `main` but does at `<ref>`" is.** A bare path silently asserts `main` — which for a PR-branch artifact makes a true, useful pointer *unfindable as written* (the triager's #12291 line had the same shape). Recipes: `ls-tree`/tree-API **at the ref**, `git grep <pattern> <ref>`.

**The corollary both of these converge on (triager's phrasing, and it's the right one): when a tool's reliability is impeached, re-derive EVERY live claim that leaned on it — not just the one that got caught.** Nobody re-audits evidence sitting under a conclusion they already accept. My audit of my own memory for other `slang-rhi` history-derived claims: **clean** — the only other `git log -S` negative-existence claim ([[project_12062_board_sync_422_maintainer_blocked]], `BOT_kgDOCnlnWA` never in `pr-board-sync.yml`) is in **shader-slang/slang**, not `slang-rhi`, and is dual-sourced with a state-based `grep` ⇒ unaffected.

Arrays here are **sized** (`[32]`) ⇒ genuinely reaches #12294's `as<IRArrayType>` branch — opposite of the bindless tests' scalar params. Useful contrast pair for why that guard is load-bearing.

## Fix path (if maintainer says go — GPU/macOS-only, NOT validatable on our Linux env)
New metal-bindless-descriptor-set + Feature::Bindless + 3 getDescriptorHandle impls + enable
Metal in 3 test-bindless cases. **Approach A** (raw native-id) recommended; B buffer-first.
Full memo: `/workspace/agent/memory/triage-10842.md` (triager's fs) — file:line pointers.

## FIX AUTHORIZED + shipped-to-draft (07-24)
Maintainer jhelferty-nv: "Go ahead and prepare a PR" (comment 5073791718) → dispatched slang-fixer.
**Draft PR: shader-slang/slang-rhi#802** (Fixes slang#10842), `pr: non-breaking`, report_pr_created done.
- Approach A1 exactly: new Metal BindlessDescriptorSet (raw-id, NO heap/allocator/residency);
  Feature::Bindless under existing ArgumentBufferTier2 gate; getDescriptorHandle overrides on Metal
  buffer/texture-view/sampler/AS. Handle value = raw gpuAddress (buffers) / gpuResourceID()._impl
  (tex/sampler/AS) — verified vs arg-buffer consumer (metal-shader-object.cpp:562/523/546/588).
  Combined stays NOT_AVAILABLE (#11540 not reopened). 15 files +209/-2.
- Tests: Metal enabled on bindless-buffers + bindless-textures. Local build clean (exit 0); Metal
  runtime path is **macos-latest CI only** (backend doesn't compile on Linux) — CI running.
- codex gate all-green; peer review → slang-reviewer (fixer's edge, ≤2 rounds).
- Issue footprint: slang#10842 comment 5074412823.
- **GATE:** draft→ready + merge OPERATOR-gated; fixer won't flip ready. Webhook-driven follow-up.

### Review (07-24, head 3a4001d): APPROVE_WITH_NITS
3-reviewer pass (A correctness / B Devin clean / C clarity) all concur. 0 bugs, 2 gaps, 2 Qs —
**none blocking**. Load-bearing native-id equivalence VERIFIED byte-for-byte (MTL::ResourceID =
{uint64_t _impl}, 8B → handle == arg-buffer consumer value for buf/tex/sampler/AS); Metal in both
test masks. Verdict delivered to fixer (fixer's edge — fixer owns weighing nits, ≤2 rounds).
- **G1** (weigh): bindless-only textures not made resident in the non-default `!m_hasResidencySet`
  fallback (page-fault risk; default Apple6+ path safe) — wire it OR document the dependency.
  NB maintainer waived per-handle residency bookkeeping, so "document the dependency" likely fine.
- **G2**: AS handle untested on ALL backends (pre-existing, not this PR's regression).
- Clarity nits: unused m_device/m_desc; undiscoverable combined-tex+sampler rationale; optional
  static_assert on ResourceID size.
- NOT posted to GitHub (no human @-authorization; file-only per workflow). Combined report:
  inbox/a2a-1784929020941-htkmsu/combined-review-802.md.
- Workflow note: slang-rhi ≠ compiler repo → Reviewer A/C runner skills (hard-wired to /slang +
  REVIEW.md) couldn't run faithfully; reviewer adapted (Devin native, A/C general-domain same
  lenses vs real slang-rhi checkout, load-bearing claims independently verified). Flagged for
  transparency. **Fixable-gap for future slang-rhi reviews.**

### Round-2 review-response COMPLETE + PR NOW NON-DRAFT (07-27, head 993c968)
Fixer's 07-24 turn hit a transient "Internal server error"; recovered/re-engaged by 07-27.
- **PR #802 flipped to NON-DRAFT by the MAINTAINER** (not us) → public artifact; maintainer actively
  engaged (replied at PR comment 5097665065; fixer replied + refreshed PR body one pass).
- Nits addressed: `static_assert(sizeof(MTL::ResourceID)==sizeof(uint64_t))`; removed dead
  m_device/m_desc; documented fallback residency-set dependency + no-cache + #11540 in class doc;
  `docs/api.md` Metal getDescriptorHandle → yes for buffer/tex-view/sampler/AS. **G1 =
  documented-not-wired** (maintainer waived per-handle residency in A1).
- Gates green: codex CODE_REVIEW=approve, OUTPUT_REVIEW=approve; peer reviewer APPROVE_WITH_NITS.
- CI auto-running on 993c968 (pre-commit success, ci in-progress; macOS matrix = Metal runtime path).
- **MERGE still operator-gated** (maintainer already flipped ready). Follow-up webhook-driven, no poller.
  Maintainer-owned + engaged → may merge on their side.

### Round 3 (08-03): skallweitNV REQUEST_CHANGES — blocker is UPSTREAM, not our diff
review **4843509387** "Needs testing": Metal untested by slang-rhi CI due to an UNRELATED
`required_threads_per_threadgroup requires metal4.0` error; skallweitNV notes the CI machine may not
support the new path at all. No code owed from us.
- **Fixer-verified receipts** (run 30804222761 / job 91655709489 @993c968): `Metal: not supported
  (failed to get shader entry point code)` ⇒ **entire Metal device unsupported ⇒ ALL Metal tests
  skip**, ours included. ⚠️ macOS jobs still report **success** — a green macOS job only proves the
  Metal TUs *compile*. See [[feedback_green_job_skipped_backend_zero_coverage]].
- **Cause:** `macos-latest` now resolves to **`macos-26-arm64`** → slang-rhi's OS-version gate
  (`majorVersion >= 26 → metallib_4_0`, `metal-device.cpp` main:266) fires, Slang's
  `implies(metallib_4_0)` emits the attribute, Xcode-16-era toolchain (`metal 32023.883`) rejects it.
- **Tracked upstream: slang#12096** (OPEN, assignee **jkwak-work**, labels regression/Testing); states
  the fix belongs in slang-rhi `metal-device.cpp` (derive capability from the real Metal toolchain,
  NOT the OS version). Fixer offered to take it as a **separate** PR, correctly did NOT fold it into
  the bindless PR (would change capability reporting for EVERY Metal user).
  **MAIN RULING 08-03: HOLD — do not pick up.** #12096 is assignee-owned (jkwak-work); the offer is
  already public on the PR thread. Dispatch only on explicit go-ahead from jkwak-work / jhelferty-nv /
  skallweitNV.
- ⚠️ **CORRECTION (fixer self-corrected, load-bearing):** same log shows `GPUFamilyApple6 not
  supported; using per-encoder useResource fallback` ⇒ **CI IS the `!m_hasResidencySet` fallback
  path**. So round-1's "G1 is not a defect on CI's likely path" was **WRONG** — CI is precisely the
  config where a bindless-only texture isn't made resident. Even after #12096, this runner is the
  WORST machine to validate `bindless-textures`; that needs **GPUFamilyApple6+ HW** (we don't
  control it).
- Fixer replied on-thread (comment **5165765104**) agreeing merge should gate on (a) #12096 fixed so
  Metal isn't skipped, then (b) a run on GPUFamilyApple6+ HW. Webhook-driven, no poller.
- **Net: #802 is HW-gated, NOT approved-to-merge.** Reinforces standing ABSTAIN posture; merge is the
  maintainer's call with eyes open (G1 live on the fallback path).

### 08-03 ~13:47Z — rhi#807 MERGED ⇒ device-init premise GONE; #802 now contains it; `ci` QUEUED
Full chain in [[project_12325_metal4_std_flag_vs_capability]]. Main-verified:
- **#807 merged `14e2f74e2e`** (skallweitNV) **comments out** `metallib_4_0` at
  `metal-device.cpp:266-267` ⇒ the metal4.0-attribute error that made the Metal device report
  unsupported is gone. Empirical on #807's branch run (job `91700389905`): `Metal: supported`,
  caps end at `metallib_3_2`, **129 `.metal` PASSED / 76 SKIPPED / 0 FAILED** (vs `0/207` before);
  the 76 skips are *feature*-gated, not device-unavailable.
- **skallweitNV merged `main` into `fix/issue-10842` @13:47:06Z → head `c09d12c0`** (parents
  `4144455de`+`14e2f74e2e`). Diff vs prior head = **only #807's two files** ⇒ #802's Metal source
  and test masks **byte-identical** to the reviewed revision ⇒ prior review + ABSTAIN stand,
  **no re-dispatch on this push** ([[feedback_debounce_approver_dispatch_deterministic_abstain]]).
- **`ci` run `30819568482` QUEUED 13:47:12Z** = the first-ever opportunity for #802's Metal-masked
  `bindless-*` cases to actually execute. ⚠️ `bindless-*` is **not** Metal-masked on `main`
  (`test-bindless.cpp`: `D3D12 | Vulkan[| CUDA]`); the `| Metal` mask is #802's own diff, so only
  #802's branch can ever produce `bindless-*.metal` lines.
- ⚠️ **G1 still live, still uncoverable here:** runner remains `Apple Paravirtual device`, features
  `…argument-buffer-tier-2`, **no Apple6** (zero `apple6`/`residency` tokens in the log) ⇒ exactly
  the `!m_hasResidencySet` fallback. "Metal now executes" ≠ "#802 is covered."
- Live blocking review unchanged: skallweitNV **CHANGES_REQUESTED** `4843509387` (11:26:50Z);
  `mergeable_state=blocked`.

### 🔴 08-03 ~13:52Z — COVERAGE LANDED AND IT **FAILS**. ABSTAIN → real red result
Run `30819568482`: macOS jobs **`91705741241` (Debug)** and **`91705741242` (Release)** both
**FAILURE**, on head `c09d12c015`. Main re-verified the Debug log directly:
- **`bindless-buffers.metal` FAILED (0.24s)** · **`bindless-textures.metal` FAILED (0.57s)**.
  Metal tally **129 PASSED / 76 SKIPPED / 2 FAILED**; doctest `1041 cases | 1039 passed | 2 failed`,
  **77 failed assertions**.
- **Signature identical in both:** `tests/testing.h:234
  CHECK_GE(result[i], expectedResult[i]-0.01f)`. Not garbage, not a crash, no
  MTL/validation/residency error logged anywhere in the job (grepped: zero non-assertion errors).
- ⚠️ **SIGNATURE CORRECTED (Main, parsed all 77 assertions in BOTH jobs — two earlier readings were
  each wrong).** It is **NOT** "all zeros" (my own 13:52 note above) and **NOT** an off-by-one index
  shift (the approver's read). It is **both, in fixed proportion**: **56/77 `result==0`, 21/77
  `result == expected-1` exactly** (every non-zero row has `diff==1.00`). Per case: buffers 17
  failures (10 zero / 7 shifted), textures 60 (46 / 14). The shifted rows are a **minority** and are
  **not** aligned to `i` — the same `i=0` fails with result 1, 3, and 5 in different sub-checks, so
  `result[i]==i` is ruled out. **Debug and Release yield the byte-identical ordered 77-tuple**
  (compared parsed sequences, not counts) ⇒ deterministic, not UB/race.
  **Lesson:** both wrong readings came from eyeballing the first ~10 rows of a 77-row failure set.
  **Parse the whole set before characterizing a signature** — here the head was unrepresentative in
  *both* directions, and each reader saw the hypothesis they arrived with.
  See [[feedback_label_dispatch_suspicions_as_hypotheses]].
- ❌ **AND MY OWN FOLLOW-ON WAS ALSO WRONG (3rd error on the same 77 rows).** I wrote "any real root
  cause must explain a zero-vs-shifted **mixture**; neither single hypothesis does." **False.** One
  cause explains both, and reading `test-bindless.cpp` (not the log) settles it: the shifted rows are
  all **second-phase read-backs** — `compareComputeResult(device, rwBuffer, {2.f,3.f})`,
  `rwTexture2DArray L1 {6,6,7,9}`, … — observing each RW resource's **unmodified initial contents**.
  Verified: all 14 texture-case shifted rows equal their `float data[...]` seed exactly
  (`rwTexture1DArray L1` seeds `{3,4}`, observed `3,4`, expected `4,5` — hence the uniform
  `diff==1.00`). So **"handles never bound"** predicts *both* classes: first-phase reads return `0`,
  and writes never land ⇒ RW resources keep their seeds. Two **assertion phases**, one mechanism.
  ⇒ **A heterogeneous signature does NOT imply a heterogeneous cause.** Group rows by assertion
  *site/phase* before inferring mechanism. I corrected the distribution but then over-read it, still
  without opening the test — same error class, one level up.
  See [[feedback_parse_whole_failure_set_before_characterizing]].
- `bindless-combined-texture-samplers` still SKIPs on Metal — #802 extended only **2 of 3** masks
  (correct per #11540 carve-out, but worth stating).
- **This is the ABSTAIN's premise resolving to RED, not to "unproven."** Materially different
  posture: the OPEN_GAP was "zero execution coverage"; now there IS coverage and the feature does
  not work on this device.

**Hypotheses — LABELLED, NOT ROOT-CAUSED** (per
[[feedback_label_dispatch_suspicions_as_hypotheses]] — do NOT let these steer the fixer's verdict):
**SUPERSEDED — the fixer root-caused it (PR comment `5167626814`, 14:23Z). Hypotheses 1–3 below are
retained only as a record of how three readers mis-read the same evidence; do not act on them.**

**Actual cause (fixer, reproduced with the pinned `slangc 2026.12.2` on Linux — emit/reflection
only):** on Metal a top-level `uniform ....Handle` parameter is emitted as an **ordinary directly-bound
parameter** with its own `[[buffer(n)]]`/`[[texture(n)]]` slot — *no* argument-buffer member carries
handle values. So the 64-bit values the test writes via `setDescriptorHandle` are **never read**, and
the six handles are never bound at all. `result` works only because it uses `setBinding`. This is
**intentional upstream** (`slang-emit-metal.cpp:149-153` deliberately unwraps `DescriptorHandle<T>`;
`tests/metal/entry-point-descriptor-handle-buffer.slang` is a #11066 regression test *requiring* that
slot assignment) — not a codegen bug. Consistent with my phase analysis above: unbound ⇒ reads 0 and
writes never land ⇒ RW seeds survive.
- **Residency is NOT the cause and this run does NOT clear it either** — the shader never dereferences
  a handle, so residency was never exercised. Fixer also corrected its own earlier note: the
  paravirtual runner (no Apple6) **is already** the `!m_hasResidencySet` machine
  (`metal-device.cpp:124-132`). Closing the fallback question needs a real argument-buffer handle test
  **on this runner**; Apple6+ HW is what would validate the residency-*set* path.
- **Real bug found in our own patch:** `allocBufferHandle` returns `getDeviceAddress()+offset` for
  *all* buffer kinds and discards `format` (`metal-bindless-descriptor-set.cpp:31-33`), but typed
  `Buffer<float>`/`RWBuffer<float>` emit as `texture_buffer<...>` ⇒ need a **texture** `gpuResourceID`,
  not an address. ⚠️ **The reviewer's byte-for-byte "raw-id equivalence" check could not catch this:
  the pre-existing bound path (`metal-shader-object.cpp:562-563`) has the same wrong shape. Matching
  an existing path is not validation** — a durable lesson about equivalence-to-incumbent as evidence.
- Adjacent pre-existing gap: slang-rhi never creates a Metal texture-buffer object anywhere ⇒ typed
  `Buffer<T>`/`RWBuffer<T>` look unsupported on Metal generally. Fixer correctly did **not** fix
  uninvited; asked jhelferty-nv whether it's in #10842's scope.
- Fixer's 3 proposed directions (awaiting maintainer): (1) re-express tests via `ParameterBlock`/
  argument buffer — probe shows handles *do* land as argument-buffer struct members; (2) fix or
  explicitly reject typed-buffer handles; (3) narrow the `Feature::Bindless` gate, since
  texture/sampler handles are the demonstrably uncovered class. Fixer recommends (1) first. It
  explicitly **withdrew** the "just mask the tests" option — the PR advertises `Feature::Bindless`
  and `docs/api.md` support, so deleting the only end-to-end coverage would hide the problem.

<details><summary>Retired hypotheses 1–3 (all wrong; kept for the calibration record)</summary>

1. **Residency, WIDER than G1's texture-only framing** — plausible-looking and **wrong**: handles are
   never dereferenced, so residency isn't reachable. Would have challenged jhelferty-nv's design
   point 2 for no reason.
2. Argument-buffer `DescriptorHandle.value` plumbing — closest to right in *area* (the ABI is indeed
   the issue) but wrong in mechanism (nothing mis-resolves; nothing resolves at all).
3. "Mixture-aware / per-sub-check partition" — rested on my false premise that a mixed signature
   needs a mixed cause. The partition *is* real (phase 1 vs phase 2) but it has **one** cause.

</details>
⇒ Dispatched **slang-fixer** on `gh-issue-shader-slang/slang-10842`: root-cause + post on the PR
(closest-to-the-state; #802 is the fixer's surface). Fixing red CI on our **own** PR is ordinary
PR-update work — distinct from the standing HOLD on upstream #12096, which still applies.
⚠️ G1's texture lens still cannot be *cleared* here regardless: no Apple6 on this runner.

### Main's independent verification of the fixer's report (14:3xZ) — all claims hold
Checked against sources, not paraphrase:
- **Row-level partition confirmed** (buffers case, all 17 rows in order): rows **1-10** = the single
  `compareComputeResult(device, result, {1,2,…})` at `test-bindless.cpp:154-177` → observed **0**;
  rows **12-17** = the three *separate* readbacks `compareComputeResult(device,
  rwBuffer|rwStructuredBuffer|rwByteAddressBuffer, {2.f,3.f})` at `:179-181` → observed **{1,2}** =
  each buffer's `float data[2]={1.f,2.f}` seed (shader does `rwBuffer[0] += 1`). Zero-reads +
  writes-never-landed, one mechanism. ⚠️ Residual loose end: row 11 `(1,1.99)` and `result[10]`
  *passing* — the RWByteAddressBuffer pair behaves unlike the other five. Minor, not a blocker.
- **`.Handle` direct-binding is intended upstream** — read
  `tests/metal/entry-point-descriptor-handle-buffer.slang` at slang master: header says "Regression
  for #11066: Handle-wrapped buffer params were missing `[[buffer(n)]]`", CHECK lines require
  `outputBuffer/biasBuffer/dataBuffer {{\[\[}}buffer(`. So the fixer's retraction is correct and its
  first instinct (file a Slang defect) would have asked a maintainer to break a regression test.
- **Own-bug claim confirmed at the branch:** `allocBufferHandle` has literal comment "Metal bindless
  buffers are raw `device T*` pointers, so the format is irrelevant here" + `SLANG_UNUSED(format)`;
  `metal-shader-object.cpp:562-563` writes `getDeviceAddress() + slot.bufferRange.offset` — same
  shape ⇒ the byte-for-byte review was **circular**. `grep -rniE
  'newTextureBuffer|textureBufferWithDescriptor' src/metal/` = **0** ⇒ pre-existing backend gap real.
- **Residency gate:** `metal-device.cpp:121` `else if (m_device->supportsFamily(MTL::GPUFamilyApple6))`
  ⇒ paravirtual runner already IS the fallback. Both fixer and I had this backwards.
- **`Feature::Bindless`** added at 802's `metal-device.cpp:244-252` from `m_hasArgumentBufferTier2`
  alone, `m_hasResidencySet` handled separately ⇒ item (3) is a real gate question.
- **`docs/api.md:64/84/92`** = Metal `getDescriptorHandle` **yes** for buffer/texture-view/sampler ⇒
  withdrawing "mask the tests" is right. All 17 non-macOS jobs in the run are **green** ⇒ macOS-only.

**Net posture — worse than "red", and this is the load-bearing sentence:** the OPEN_GAP is *still*
**zero executed bindless coverage**, now for an understood reason. "Does the device support the design
as blessed?" = **unknown, because the design was never exercised** — the test never fed handles to the
shader. **A1's own premise is untested**, and work item (1) (re-express via ParameterBlock) is the
only thing that would test it. #802 stays NOT approved-to-merge; the standing ABSTAIN is reinforced,
not resolved. **RESUME = skallweitNV/jhelferty-nv direction on items 1-3** (design/scope call,
genuinely theirs — not ours to pick). No code pushed; no re-dispatch pending their reply.

### Maintainer review landed + 2nd reviewer added (07-27, review 4792318144)
jhelferty-nv reviewed: **"This looks fine to me"** — positive but a `commented` review, NOT an
approval → `reviewDecision` stays **REVIEW_REQUIRED**. Added **@skallweitNV** as 2nd reviewer.
No code action (positive signal + handoff, no changes requested). No bot GitHub reply (jhelferty's
comment is the footprint; bot ack = noise). **Holding for skallweitNV's review**; resumes on next
webhook (their review / CI). Merge maintainer-owned + operator-gated; no poller.

### Approver verdict @993c968e: ABSTAIN_POLICY (OPEN_GAP) — TERMINAL for that rev (07-27)
slang-pr-approver ran `/slang-pr-approve`; ledger row written; **shadow-mode, nothing posted**.
- Harvest **exit 20** (nv-slang-bot fixer PR → production review skips it) ⇒ fallback tier;
  Devin-only (exit 0, 1 🔴 residency). **6/6 eligibility clauses passed.**
- Source **verified CORRECT** on the residency-set path + matches the #10842 A1 spec (raw native
  ids; combined tex+sampler correctly excluded per #11540).
- **OPEN_GAP (operative):** approver pulled the macOS CI job log and empirically confirmed the
  newly-enabled `bindless-buffers.metal` / `bindless-textures.metal` cases were **SKIPPED** —
  `macos-latest` is an "Apple Paravirtual device" reporting Metal unsupported ⇒ the runtime path
  this PR adds has **ZERO CI execution coverage. Green status ≠ tests executed.**
  ⚠️ This **contradicts** the 07-24 maintainer design point 3 ("slang-rhi already has
  paravirtual-macOS Metal-CI handling upholding the contract ⇒ macOS CI runtime coverage viable").
  The handling exists but *skips*, it does not *execute*. Don't cite point 3 as coverage again.
- Unrefuted residency CHALLENGER_CONCERN: `Feature::Bindless` advertised under the
  ArgumentBufferTier2 gate **independent of the residency-set** ⇒ a Tier2-but-no-residency-set
  device advertises Bindless=true yet bindless-only resources aren't made resident on the
  `useResource` fallback. Source-confirmed premise, but a maintainer design call ⇒ not a
  standable BLOCK on no-Metal hardware (uncertainty never upgrades toward approve). = G1 above,
  documented-not-wired.
- Prior reviewer **APPROVE_WITH_NITS is consistent with "source looks right" but does NOT close
  the execution-coverage gap.** Don't let the index shorthand "APPRV" read as approved-to-merge.
- **Needs:** human verification on **real Apple-Silicon hardware** + a maintainer call on whether
  residency-set-only is acceptable for v1. Merge stays operator/maintainer-gated.

### Synchronize @4144455d — DEBOUNCED, no re-dispatch (08-03)
2nd `pr_ready_for_review (synchronize)` webhook. Head moved 993c968e → **4144455d**, so NOT a
duplicate webhook — but verified **non-operative**:
- Pusher was **skallweitNV** (the 2nd reviewer jhelferty added), via web-flow "Update branch" —
  *not* our fixer. Commit = `Merge branch 'main' into fix/issue-10842`, parents 993c968e+455d3bd0.
- `compare/993c968e...4144455d`: 8 files differing, **all under `.github/**` — NONE outside**
  (new pr-* workflows + zizmor.yml; `add-pr-to-project.yml` removed). Metal source + test masks
  **byte-identical** to the decided revision.
- `ci.yml` macOS matrix still `runs-on: macos-latest` (no self-hosted/Metal runner added) ⇒ the
  skip-based OPEN_GAP holds unchanged. New workflows add no macOS/Metal job.
⇒ Both premises of the ABSTAIN survive ⇒ **evidenced hold, no approver re-dispatch**
(per [[feedback_debounce_approver_dispatch_deterministic_abstain]]). Re-engage only on: a push
touching `src/metal/**` or `tests/**`, a macOS/Metal **runner** change, skallweitNV's review, or
merge/close. **skallweitNV updating the branch = active human engagement on the review track.**

### 🔴 skallweitNV CHANGES_REQUESTED "Needs testing" @c09d12c0 (08-03) — APPROVER VINDICATED
3rd synchronize webhook. Head 4144455d → **c09d12c0**. Tripwire (`src/metal/**`+`tests/**`) FIRED,
so I inspected rather than debouncing blind — correct call, because a **real inbound** was hiding here:
- **skallweitNV review `4843509387` = CHANGES_REQUESTED, body = "Needs testing" (13 chars), 0 inline
  comments.** Not an edit list (cf. [[feedback_changes_requested_read_body]]) — the ask is
  *get the feature executed*, nothing to change in code. `reviewDecision` blocks; `mergeable_state=blocked`.
- **This independently VINDICATES the approver's ABSTAIN_POLICY/OPEN_GAP.** The human Metal reviewer
  reached the *same* conclusion the shadow-mode approver did, from the same premise (untested runtime
  path). Strong precision datapoint: the approver held where a reviewer's APPROVE_WITH_NITS had said
  "source looks right". **Coverage gaps are worth abstaining on — a human will catch the same thing.**
- Code under review still **unchanged**: delta = skallweitNV's own **rhi#807** ("Temporarily disable
  metallib_4_0", MERGED 13:46) arriving via `Merge branch 'main'`. Touches `metal-device.cpp` @~268
  (capability gates) + `test-device-features.cpp`; **#802's hunks are @13/36/245/354 — no overlap**,
  #802 never touches `test-device-features.cpp`, and `metallib_4_0` appears **nowhere** in #802's diff.
  PR contribution byte-stable at 16 files +221/-6. No `ci.yml`/runner change ⇒ OPEN_GAP intact.
- **Why "Needs testing" is not coworker-actionable:** the tests already exist and are already enabled
  in both masks. They cannot execute anywhere in our reach — Linux fixer env doesn't compile Metal,
  and `macos-latest` is paravirtual/Metal-unsupported (skips). Only **real Apple-Silicon HW** closes
  it. skallweitNV (slang-rhi Metal maintainer) is the likeliest party who actually has that HW.
  ⇒ Escalated to operator; **no fixer dispatch** (nothing to code), **no GitHub post** (write =
  operator-gated), **no approver re-dispatch** (same ABSTAIN; gap now human-confirmed).
- RESUME: operator authorizes a reply to skallweitNV asking what testing he wants / who runs it ·
  a macOS **runner** with real Metal HW appears · skallweitNV re-reviews · merge/close.

## Maintainer design confirmation (07-24, comment 5073561417; ack 5073581253)
jhelferty-nv **blessed Approach A** + 3 design points folded into memo:
1. Handle value = **RAW native id/address** (gpuAddress/gpuResourceID), NOT an allocated/heap
   index — no Vulkan/D3D12-style allocator.
2. **Residency/lifetime = API-user's responsibility** (unified-memory "alive⇒resident");
   runtime does NO per-handle residency bookkeeping (retires earlier hazard-tracking tradeoff note).
3. slang-rhi already has **paravirtual-macOS Metal-CI handling** upholding the contract →
   macOS CI runtime coverage viable when a fix lands.
STILL PARKED — design confirmation, NOT a "make a PR" authorization.

## Artifacts / routing
- Verified 5-bullet posted: issue comment **5073225961** (fresh comment; prior was maintainer's).
- Adjacent: **#11970** (Metal bindless MSL, compiler-side, separate). Combined = **#11540** (closed).
- Same posture as [[project_slang_rhi_800_metal_dispatch_indirect]] /
  [[project_slang_rhi_801_metal_buffer_import]] / [[project_12142_metal_rayquery_trianglefrontface]]
  — Metal-HW-gated, macOS CI would be only runtime coverage.
- **RELEASE:** jhelferty-nv / operator says "make a PR" → dispatch slang-fixer on thread
  `gh-issue-shader-slang/slang-10842` (Approach A).
