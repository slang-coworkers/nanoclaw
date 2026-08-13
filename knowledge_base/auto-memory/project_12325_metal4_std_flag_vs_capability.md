---
name: project_12325_metal4_std_flag_vs_capability
description: "#12325 metal4 -std: ALREADY FIXED by #12009 (1st release v2026.14), reporter on 2026.12.2 ⇒ fix = slang-rhi pin bump, not slang-core. 08-06 jkwak-work ENDORSED verbatim + took assignee; ack-only, no dispatch. NOT a dup of #12096"
metadata: 
  node_type: memory
  type: project
  originSessionId: edc48ae7-5fee-4ff7-be3f-be0d2948d5d2
---

# shader-slang/slang#12325 — Metal 4.0 attribute vs downstream `-std=metal4.0`

**TERMINAL coworker-side (2026-08-03).** Filed by **skallweitNV**; triaged; verdict POSTED
(comment **5167081493**, fresh, 0 prior). Labels `Dev Opened`/`RTR` + Type=Bug were his — left
alone. **No fixer dispatch; HOLD respected.** Bug / low-med / **P3**, **no slang-core work owed**.

## Verdict: the headline ask is ALREADY IMPLEMENTED at master
`-std` producer `slang-code-gen.cpp:786-804` (`PassThroughMode::MetalC`) sets
`metalLanguageVersion=4.0` from `implies(metallib_4_0)` — **the same predicate as the emit gate**
`slang-emit-metal.cpp:227` — and consumer `slang-gcc-compiler-util.cpp:971-988` renders
`-std=metal4.0` for the `MetalAIR` payload (else historical `-std=metal3.1`). Landed in **PR
#12009** (merge `a2596654f`, 07-15). Reporter is on **2026.12.2** (released 07-01), where
`slang-gcc-compiler-util.cpp:973` is an unconditional `-std=metal3.1` while the emitter already
emitted the 4.0 attribute ⇒ deterministically his error.

**Fix = bump slang-rhi's fetched Slang** `SLANG_RHI_FETCH_SLANG_VERSION` (`CMakeLists.txt:148`,
pins `"2026.12.2"`) to **≥ v2026.14** (latest v2026.14.1, 07-30). ⚠️ **not a 1-line bump:**
`SLANG_HASH_VERSION` (`:307`) plus **5 per-platform SHA256s** (`:313/318/327/332/341/346/354`)
are gated on `SLANG_VERSION STREQUAL SLANG_HASH_VERSION` — leave them stale and `URL_HASH` goes
empty (unverified download). Recommended owner **skallweitNV** (owns #807 and #802).

## Independently re-verified by me (not relayed on trust)
- `git compare`: `a2596654f` is **ahead** of `v2026.13.1`, **behind** `v2026.14` ⇒ first release
  containing the fix = **v2026.14** (07-24). ✓
- slang-rhi job `91655709447` (= PR **#802**'s head `4144455de`): `-- Fetching Slang 2026.12.2`,
  image `macos-26-arm64 / 20260728.0273.1` ⇒ `Metal: not supported` +
  `required_threads_per_threadgroup … requires metal4.0`, **0 `.metal` PASSED / 207 SKIPPED**. ✓
- slang job `91692432521` (today): **identical image** `macos-26-arm64 / 20260728.0273.1`, device
  advertises `metallib_3_2 metallib_4_0` (log line 933), in-tree Slang sends `-std=metal4.0` ⇒
  **87 `.metal` PASSED / 75 SKIPPED**, incl. `compute-smoke.metal`, `compute-trivial.metal`; zero
  `required_threads` errors. ✓
- rhi **#807** "Temporarily disable metallib_4_0": OPEN, non-draft, skallweitNV,
  `mergeable_state=blocked`, `metal-device.cpp +5/-2` + `test-device-features.cpp +3/-1`. ✓
- #12129 (revert of the macos-15 pin #12075) merged 07-15 by jkwak-work. ✓

## ⚠️ Two premises DISPROVEN — mine and #12096's
1. **My dispatch suspicion "`-std=metal4.0` wouldn't help a toolchain predating metal4.0" is
   FALSE.** `metal 32023.883` on that image *accepts* `-std=metal4.0` and compiles the attribute.
   The two-job comparison above is the arbiter (same image, same rhi capability logic, only the
   Slang version differs). Good instance of [[feedback_never_relay_a_verdict_not_in_hand]] in the
   other direction: I flagged it as *worth doubting*, the triager measured it, measurement won.
2. **#12096's triage line "no slang-core change is warranted" was too strong** — one *was*, and it
   landed (#12009). Politely noted on #12325. Corollary: **#12096's remaining justification is now
   weaker/hypothetical** (a real macOS-26 user whose toolchain genuinely lacks 4.0 — not the CI
   images). Still OPEN, jkwak-work-owned; **not ours to close**
   ([[feedback_dont_close_open_proposals]]).

## Dedup: DISTINCT from #12096, not a duplicate
- #12325 = "downstream compile must pass `-std=metal4.0`" ⇒ slang-core, **already fixed**, residual
  = consumer version bump.
- #12096 = "stop *over-reporting* `metallib_4_0` from OS version alone" ⇒ slang-rhi
  `metal-device.cpp:266` (`osVersion.majorVersion >= 26`). Separate defect. #11999 folded in there.
- Not a dup of #10560/#10592 (original feature requests).

## skallweitNV's alternative — declined with reasons
"Don't emit unless the standard is guaranteed" → the `metallib_4_0` atom (`capdef:208`) IS the
host's promise; Slang can't introspect the offline `metal` binary at emit time (emission precedes
the downstream invocation; the toolchain need not be local). Weakening the gate would silently drop
a requested attribute. One residual kept as hygiene: emitter never calls
`requireMetalLanguageVersion(4,0)` beside `slang-emit-metal.cpp:227` (contrast `printf` at `:909`)
— **latent, not this bug**, since code-gen derives 4.0 from the same capability.

## Bump scope: 7 hash sites, not one line (Main-verified)
`SLANG_RHI_FETCH_SLANG_VERSION` `CMakeLists.txt:148` **and** `SLANG_HASH_VERSION` `:307` **and**
regenerate **7** `SLANG_RHI_SLANG_URL_HASH` SHA256s at `:313 :318 :327 :332 :341 :346 :354`, each
wrapped in `if(SLANG_VERSION STREQUAL SLANG_HASH_VERSION)`. Bump only `:148` ⇒ variable unset ⇒
`FetchPackage(slang URL … URL_HASH "")` at `:359` downloads **unverified**. (I first wrote "five"
while listing seven line numbers; triager caught the count — 7 is right.)

## rhi #807 MERGED 13:46:38Z — stopgap landed, not the bump (Main-verified at rhi main)
skallweitNV self-merged `14e2f74e2e`, 5 min after our verdict posted. `metal-device.cpp:266-267`
now **commented out** (confirmed live at rhi `main`), plus the matching `CHECK` in
`tests/test-device-features.cpp`. Both TODOs name **#12325** as the re-enable trigger.
⚠️ **Their TODO text — "Re-enable once Slang passes `-std=metal4.0` to the downstream Metal
compiler" — is ALREADY SATISFIED at ≥ v2026.14.** So a human acting on that TODO will wait for a
Slang change that already shipped; the real gate is the version bump, whose true scope is the
7-hash change above. **#12325 is now the tracked blocker for restoring Metal 4 in slang-rhi** ⇒ we
own keeping that trigger accurate on the public surface. Authorized triager to **refresh comment
`5167081493` in place** (bot still last commenter) — ✅ **DONE, REST `PATCH` first try**, count
still 1, `updated 13:53:39Z`, 4701→5955 chars; Main-verified live. Refresh rewrote only the
**Next action** bullet + appended one **Update** paragraph before the disclaimer; carries #807's
merge as a plain event, the already-satisfied TODO condition, and the 7-hash scope. See
[[feedback_github_comment_hygiene]].

**Judgment note worth keeping:** I first told the triager "#807's merge is churn, don't re-post,"
then reversed. Both calls were right for their inputs — what changed is that #807's merged TODOs
made *our comment* the referenced re-enable trigger, so a stale trigger condition became a live
public inaccuracy on an artifact a human will act on. Test to reuse: **not "is this detail stale?"
but "does someone act on this text, and would the stale version mislead them?"**

## Knock-on
Metal 4 emission is now **surrendered** in rhi (not merely unfixed), so **#802's Metal tests will
now run** rather than skip — the `metallib_4_0` path that broke device init is gone. That changes
#802's posture: re-check its next macOS run for *executed* Metal tests (and watch for G1,
bindless-only texture residency on the `!m_hasResidencySet` fallback, which needs Apple6+ HW and is
**independent** of this). See [[project_10842_metal_descriptorhandle_runtime]] and
[[feedback_green_job_skipped_backend_zero_coverage]].

**CONFIRMED EMPIRICALLY at #807's merged head** (job `91700389905`, run `30817983674`,
`build (macos, aarch64, clang, Debug)`): `Metal: supported`, capabilities
`metal metallib_2_3 … metallib_3_2` — **`metallib_4_0` absent, as intended** — and
**129 `.metal` PASSED / 76 SKIPPED / 0 FAILED**, vs the pre-#807 `0 PASSED / 207 SKIPPED`. The
76 skips are all *feature*-gated (59 ray-tracing, 12 timestamp-query, 2 combined tex-sampler, …),
NOT device-unavailable. So the surrender genuinely restored Metal execution coverage.
Main re-verified all of the above from the job log directly. ⚠️ Note this run is `event=pull_request`
on #807's **branch** `dev/skallweit/disable-metallib-4-0-capability` @`dc03b871` — pre-merge, not a
post-merge main run; the capability state it exercises is nonetheless #807's.
⚠️ **But #802's own gap is NOT closed by this:** the runner is still `Adapter Name: Apple
Paravirtual device` with features `hardware-device parameter-block surface rasterization
argument-buffer-tier-2` — Tier2 **without** Apple6 (zero `apple6`/`residency` tokens in the whole
log), i.e. exactly the `!m_hasResidencySet` fallback where G1 is live. #802's OPEN_GAP therefore
survives #807 on the *residency/HW* premise even though the *device-init* premise is gone. Do not
read "Metal now executes" as "#802 is now covered."
⚠️ **And the deeper reason it can't be covered on this run: `bindless-*` is not Metal-masked on
`main`.** At `main`, `tests/test-bindless.cpp` still reads `GPU_TEST_CASE("bindless-buffers",
D3D12 | Vulkan)` / `("bindless-textures", D3D12 | Vulkan | CUDA)` — **no `| Metal`**. Enabling Metal
in those masks is *#802's own diff*, so `bindless-*.metal` cannot appear in any run that lacks
#802's changes (zero `bindless.*\.metal` lines in job `91700389905`, confirmed). The mask change
travels with #802, not with #807.

## #802 live state (Main-verified 2026-08-03 ~14:00Z)
skallweitNV merged `main` into `fix/issue-10842` at **13:47:06Z** → new head **`c09d12c0`**
(parents `4144455de` + `14e2f74e2e`), i.e. **#802 now contains #807**. `ahead_by 4, behind_by 0`
vs #807's merge commit. Diff `4144455de…c09d12c0` = only `src/metal/metal-device.cpp` +
`tests/test-device-features.cpp` (#807's own files) ⇒ **no change to #802's Metal source or test
masks** ⇒ the prior review/approver decisions still stand on identical reviewed content.
**`ci` run `30819568482` was QUEUED at 13:47:12Z** — that is the run that will finally exercise
#802's Metal-masked `bindless-*` cases with a working Metal device, the first time that has ever
been possible. `mergeable_state=blocked`; skallweitNV's `CHANGES_REQUESTED` (review `4843509387`,
11:26:50Z) is still the live blocking review.
⇒ **No re-dispatch now** (per [[feedback_debounce_approver_dispatch_deterministic_abstain]]:
non-operative merge-only push, reviewed content byte-identical). **RESUME on that ci run
completing** — then read the per-test lines for `bindless-buffers.metal` / `bindless-textures.metal`
specifically, not the job conclusion.

## ✅ 2026-08-06 16:26Z — MAINTAINER ENDORSED THE VERDICT (jkwak-work, cmt `5207425279`)
> "@skallweitNV, what the bot says is that this issue is already resolved by … PR #12009. And it is
> a part of v2026.14. Since you tested with v2026.12, it appears to be a matter of upgrading the
> Slang version on slang-rhi."

**Our triage verdict was adopted verbatim by the assignee.** Both load-bearing facts (#12009 →
v2026.14; reporter on 2026.12.2 ⇒ rhi version bump, not a slang-core change) restated as his own
conclusion. Notable given the chain's history: this is the one where I hedged my premise and let the
triager measure it — the opposite of [[feedback_label_dispatch_suspicions_as_hypotheses]]'s failure
mode. Had my "the `-std` ask is a false lead, close as dup of #12096" framing been accepted, this
comment could not exist.

**Routing call: NO dispatch, NO GitHub post.**
- **Not addressed to us and NOT a bot mention** — webhook said `github.pr_mention` but
  `grep -c nv-slang-bot` on the body = **0**. It is a maintainer→maintainer routing note.
  ⇒ [[feedback_webhook_dispatch_by_event]]: classify by the body, not the event label.
- Per spine: a human restatement/endorsement gets an **ack with no further routing**. It introduces
  no new design point, no counter-proposal, no question to us. Our resolution comment
  (`5167081493`) is already public and its substance is unchanged ⇒ re-posting would be churn, and
  jkwak is *citing* that very comment.
- **Not an authorization.** He tells **skallweitNV** to upgrade. A maintainer directing another
  maintainer is not a go-ahead for us ([[feedback_reopen_not_release_parked_feature]]).

**State deltas (Main-verified 08-06):** #12325 **still OPEN**, now **assigned jkwak-work** (was
unassigned), labels `Dev Opened`/`RTR` unchanged. Correctly open — it is #807's re-enable trigger.
⚠️ **rhi `main` pin is STILL `2026.12.2`** (`CMakeLists.txt:148`, `SLANG_HASH_VERSION:307`) and
`metallib_4_0` is **still commented out** (`metal-device.cpp:266`). So nothing has moved on the rhi
side in 3 days; the bump is unowned-in-practice — **assigned to jkwak-work** (skallweitNV authored #12325 and merged #807's stopgap, but is NOT the assignee; do not write "skallweitNV's" — author ≠ owner, corrected 08-12).

**Available-but-unauthorized work:** the bump is small, mechanical and bot-doable (bump `:148` +
`:307`, regenerate 7 SHA256s from the v2026.14.x release assets). ⚠️ It does **NOT** unblock our
#802 any more — #807 already removed the device-init blocker, and #802's live blocker is the
ABI/test finding. So the bump's only payoff is restoring rhi's Metal 4 advertisement = **squarely
rhi-maintainer territory**. Offer only if the operator asks; do not volunteer into another repo's
maintenance.

**RESUME:** rhi Slang-version bump lands (then `metallib_4_0` un-comments) · a human comment that
asks us something or disputes the verdict · #802 CI turning over with Metal actually executing.
Triage memo (triager's fs): `/workspace/inbox/a2a-1785764518666-963d79/triage-12325.md`.
