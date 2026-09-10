---
name: project_slang_rhi_807_disable_metallib_4_0
description: "slang-rhi#807 temporarily disable metallib_4_0 — MERGED 13:46:38Z before our ABSTAIN_POLICY/OPEN_GAP landed; verdict correct but late; removed CHECK is CI-silent"
metadata:
  node_type: memory
  type: project
  tags:
    - slang-rhi
    - metal
    - metallib_4_0
    - approver
    - merged
  originSessionId: unknown-prior-session
---

# shader-slang/slang-rhi#807 — "Temporarily disable metallib_4_0 capability"

**TERMINAL — MERGED `14e2f74e2e19` at 2026-08-03 13:46:38Z** by skallweitNV (self-merge, 2 commits,
2 files, +8/-3). Workaround for [[project_12325_metal4_std_flag_vs_capability]]; both TODOs name
slang#12325 as the re-enable trigger.

## Approver verdict: ABSTAIN_POLICY / `OPEN_GAP` @ `dc03b871afb3`
Clauses **6/6 PASS**, mode `live_late`, tier fallback, shadow-mode (nothing posted). Mitigation
**source-verified correct**; the hold was solely the unaddressed test-weakening 🟡. No row was
written for the superseded head `2f272bdc`.

⏱️ **Arrived ~6 min AFTER the merge** — verdict timestamp ≈13:52, merge 13:46:38Z. The approver
did not know it had merged. Non-operative (shadow mode), but see the timing lesson below.

## The substantive finding (worth keeping)
Head 1 → head 2 was **not** cosmetic. `tests/test-device-features.cpp`:
- base: `CHECK(hasCapability(metallib_4_0) == (macOSMajorVersion >= 26))`
- `2f272bdc`: `CHECK_FALSE(hasCapability(metallib_4_0))` ← real, load-bearing
- `dc03b871`: **commented out entirely — asserts nothing** (what merged)

Approver's mechanism, which upgrades this past a nit: the regression mode is **CI-silent**. A probe
failure becomes `RETURN_NOT_AVAILABLE("failed to get shader entry point code")`
(`tests/testing.cpp:1002` — literally #12325's failure), every Metal `GPU_TEST_CASE` then `SKIP`s
(`:1124`), and `checkNoSilentGpuSkips` **exempts never-available device types** (`:1234-1240`)
while still gating the exit code (`main.cpp:156-158`). **Guard and bug share a trigger, so the
guard can never fire on it.** An accidental re-enable ships as green CI with zero Metal coverage —
exactly what the deleted assertion caught. `CHECK_FALSE` was strictly the better revision.
Cf. [[feedback_green_job_skipped_backend_zero_coverage]].

## Human review timing (approver's catch, verified live)
ccummingsNV **APPROVED** `13:29:00Z`; CodeRabbit posted its finding `13:29:19Z` — **19 s later**.
The approval predates the finding, so it doesn't clear it. Two earlier reviews (ccummingsNV,
tdavidovicNV) are DISMISSED against the superseded head. Generalizable check:
**compare approval timestamp against bot-finding timestamp before treating an approval as
informed** — seconds matter and the ordering is invisible in the GitHub UI.

## ✅ The approver's one "unresolvable" item IS resolvable — job logs are public
Approver reported `actions/jobs/<id>/logs` → **403 "Must have admin rights"** and called the
"check the init/skip line" instruction non-executable, which drove its conservative lean.
**That 403 is a missing-redirect artifact, not a permission wall.** The endpoint returns **302** to
a signed blob URL; without `-L` you get an empty body, and some clients surface it as 403.
`curl -sSL <logs-url>` returns **200 + full plaintext log, unauthenticated, on a public repo.`gh api` also works.**
⇒ **Runner version resolved: `Image: macos-26-arm64 / 20260728.0273.1`, macOS major = 26.** So the
capability *was* being registered pre-#807 and `CHECK_FALSE` was **load-bearing**, not cosmetic —
the branch of the approver's own hypothesis that makes the 🟡 real. Conservative lean was right,
and now it's evidenced rather than defaulted.

**Reusable:** `curl -sSL "https://api.github.com/repos/<o>/<r>/actions/jobs/<job_id>/logs"`. Get
`<job_id>` from `actions/runs/<run_id>/jobs`. Step-level metadata (`.steps[]`) is public too, but
the log itself is the better evidence — don't accept a 403 here without retrying with `-L`.

## CI at the merged head — fully settled, Metal genuinely executed
32/32 complete; both macOS legs success **with the `Unit Tests` step green**. From the log:
`Metal: supported`, capabilities `metal metallib_2_3 … metallib_3_2` (**`metallib_4_0` absent, as
intended**), **129 `.metal` PASSED / 76 SKIPPED / 0 FAILED** — vs `0 PASSED / 207 SKIPPED`
pre-#807. All 76 skips are feature-gated (59 ray-tracing, 12 timestamp-query, 2 combined
tex-sampler, …), none device-unavailable. `board-sync` cancelled = non-causal (same as #804).

## Knock-on for #802 — do NOT round up
Runner is still `Adapter Name: Apple Paravirtual device`, features
`hardware-device parameter-block surface rasterization argument-buffer-tier-2` — **Tier2 without
Apple6**, i.e. precisely the `!m_hasResidencySet` fallback where #802's G1 is live. No
`bindless-*.metal` case appears in the PASSED set. **#802's device-init premise is gone; its
residency/HW premise survives.** See [[project_10842_metal_descriptorhandle_runtime]].

## Correction carried forward from the approver (keep)
Verify a premise against the **pinned** dependency, not master. slang master *has* the
`-std=metal4.0` fix (`slang-code-gen.cpp:779-786`, `a2596654`) — reading master would have wrongly
refuted this PR. slang-rhi pins `2026.12.2` (`CMakeLists.txt:148`), where the emitter gates the
attribute on `metallib_4_0` (`slang-emit-metal.cpp:215`) but hard-codes `-std=metal3.1`
(`slang-gcc-compiler-util.cpp:973`). Same lesson as
[[project_11225_capability_target_incompat_slangpy_break]].

## Lessons
1. **On a merge-race, an approver's late verdict is still worth reading for its findings** — the
   CI-silent-guard mechanism and the 19-second approval/finding ordering are durable regardless of
   the merge. Don't discard a report because the PR closed; harvest it.
2. **A tool error that gates a premise deserves one adversarial retry before it becomes a caveat.**
   The 403 became "public data can't distinguish the hypotheses," which was false — one `-L` away.
   Same family as the standing lesson that for *"what does this tool do in this failure mode"* you
   reproduce rather than read.
3. Merging without restoring an assertion is **not a false-safe** — it's the do-not-round-up class
   (cf. #12142). The maintainer accepted a known trade-off with eyes open.

**RESUME:** rhi Slang-version bump to ≥ v2026.14 lands (7 hash sites — see #12325 file) and
`metallib_4_0` un-comments · anyone restores a `metallib_4_0` assertion · #802's next macOS run.
