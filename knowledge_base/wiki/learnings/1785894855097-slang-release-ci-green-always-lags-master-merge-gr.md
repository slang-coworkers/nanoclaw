---
title: "Slang release CI green always lags master — merge_group CI is the real per-commit gate"
type: learning
topic: slang-compiler
source: learnings/1785894855097-slang-release-ci-green-always-lags-master-merge-gr.md
---

# Slang release CI green always lags master — merge_group CI is the real per-commit gate

When reading a Slang daily release-CI green, do **not** treat "master has N commits on top of the tested SHA" as a coverage hole. That lag is the designed steady state.

**Evidence (2026-08-05).** The 00:00 UTC bot dispatch builds whatever master HEAD is at that instant; commits keep landing during and after the ~50-min run. Gaps between 10 consecutive bot dispatches (2026-07-26 → 08-05), via `compare` on consecutive `head_sha`s: **2, 4, 4, 7, 8, 8, 3, 1, 6, 5**. Median ~5. So a 1-commit gap is the *smallest* observed — flagging it as actionable means spot-dispatching nightly.

It's deliberate and self-documented. `.github/workflows/release.yml` `on:` has only `workflow_dispatch` + `v20*` tags, with the comment: *"We are not caching the builds so we don't want to run the release workflow for every push to master."*

**Slang runs a merge queue, so a master commit is never actually unverified.** Every master commit has a `merge_group`-event `CI` run at its exact post-merge SHA. Verified on `ff45b15e`: run `30962756447`, 36/36 green — linux/macos/windows, x86_64+aarch64, wasm, sanitizer-linux-clang, full `test-slang`/`test-slang-rhi`, falcor, materialx.

```bash
gh api "repos/shader-slang/slang/actions/runs?head_sha=<SHA>&per_page=100" \
  --jq '.workflow_runs[] | "\(.conclusion) | \(.name) | \(.event)"'
```

**What release.yml uniquely adds** (grep-verified absent from `ci.yml`): `-DSLANG_ENABLE_RELEASE_LTO=ON`, `-DSLANG_STANDARD_MODULE_DEVELOP_BUILD=OFF`, `SLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM`, `--fresh` uncached builds, **macos x86_64** (CI only does macos aarch64), **windows aarch64** cross-compile. That delta is a toolchain / link / LTO-codegen surface.

**Rule:** escalate an uncovered commit only when its risk intersects that delta — build system, submodule/dep bumps, emsdk/wasm, LLVM-version-sensitive code, macOS/Windows-arch code, or plausible UB-under-LTO. A pure IR-pass / legalization / frontend change is fully exercised by the 36-job merge-queue run; no spot dispatch. Also check for a pending `v20*` tag (a tag push runs release.yml on that SHA anyway) — nothing ships off bare master.

**Two incidental corrections.** (1) Role instructions say release CI "typically takes 1-3 hours"; run `30961897889` was 00:00:42Z → 00:50:59Z = **~50 min**. (2) A PR commit's `committer.date` is when the merge queue *built* the commit object and can precede real `merged_at` by hours — #12281: commit date 00:15:57Z vs `merged_at` **01:43:01Z**. Cite `merged_at` when ordering a merge against a CI run.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785894855097-slang-release-ci-green-always-lags-master-merge-gr.md`_
