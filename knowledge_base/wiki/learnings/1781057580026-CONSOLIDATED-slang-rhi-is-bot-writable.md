---
title: "CONSOLIDATED: shader-slang/slang-rhi (and all shader-slang repos) are bot-writable — push:false probes are false-positives"
type: learning
topic: slang-compiler
source: learnings/1781057580026-CONSOLIDATED-slang-rhi-is-bot-writable.md
---

# CONSOLIDATED: shader-slang/slang-rhi (and all shader-slang repos) are bot-writable — push:false probes are false-positives

**`nv-slang-bot[bot]` CAN push branches, open PRs, and comment on `shader-slang/slang-rhi`.** Proven by merged same-repo bot PR #765 (`fix/issue-762`, MERGED 2026-06-03) and draft PR #773 (`fix/issue-772`, 2026-06-10, real `git push` returned `* [new branch]`, no 403). The earlier learning "slang-rhi cross-repo fix is a forced patch-handoff" was **WRONG** and is superseded by this one — it never attempted the actual push and gated on misleading probes.

**Signals that are NOT "no write access" (do not gate a handoff on any of these):**
- `gh api repos/<owner>/<repo> --jq .permissions` → `{push:false, pull:false, triage:false}` is the NORMAL shape of a GitHub App *installation* token. It is **identical** on `shader-slang/slang` (pushed to daily) and every other shader-slang repo — so it cannot distinguish writable from non-writable. Reading `push:false` as "can't write" is a category error.
- `gh api user` → 401/403 is EXPECTED: the OneCLI proxy injects the real token only on org-scoped `shader-slang/*` and `slang-coworkers/*` paths, not `/user`.
- `git push --dry-run` is ALSO a false-positive — it can succeed where a real push fails, so it's no substitute either.
- A clone with no local `git user.name/email` and a `x-access-token:placeholder@…` remote URL are not blockers.

**The ONLY authoritative test of push capability is an actual `git push` / `gh pr create`.** A 403 from those is a real blocker; the permission probe is not evidence. When in doubt, just attempt the push — a reject is harmless. To check history instead of attempting: `gh api "repos/<owner>/<repo>/pulls?state=all&per_page=100" --jq '[.[]|select(.user.login|test("nv-slang-bot";"i"))|{num:.number,head:.head.ref,merged:.merged}]'` — prior merged bot PRs = writes work. Verify any cited "forced handoff" precedent before relaying it (the #762 claim was false — its fix #765 was a merged bot PR).

**Push flow:** in the clone, `git remote set-url origin https://github.com/<owner>/<repo>.git` (drop baked auth), commit as author `nv-slang-bot[bot] <274397474+nv-slang-bot[bot]@users.noreply.github.com>`, `git push -u origin fix/issue-<n>`, `gh pr create`, then `report_pr_created`. Follow the normal `/slang-fix-issue` Step 7; do NOT pre-emptively declare a patch-handoff. (Patch fallback applies only on a genuine push *rejection*.)

## slang-rhi build feasibility (still valid)
slang-rhi compiles **headless, no GPU / no Vulkan SDK**, via CMake FetchContent (Vulkan-Headers pinned ≥ v1.3.280, so newer NV/EXT feature structs are defined). Configure with `-DSLANG_RHI_ENABLE_CUDA=OFF -DSLANG_RHI_ENABLE_WGPU=OFF -DSLANG_RHI_BUILD_TESTS=OFF -DSLANG_RHI_BUILD_EXAMPLES=OFF`, target `slang-rhi`.

## slang-rhi `rhi::Feature` is public API (ABI rule, still valid)
The `SLANG_RHI_FEATURES` X-macro in `include/slang-rhi.h` is public API (`DeviceDesc::requiredFeatures`, `IDevice::getFeatures`/`hasFeature`, `getFeatureName`). **APPEND new entries at the END of the macro, never insert mid-list** — mid-list renumbers every later enumerator = ABI break. Each `x(EnumName, "kebab-name")` line is the single name table generating both the enum entry AND the valid `-render-feature` string for slang-test.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781057580026-CONSOLIDATED-slang-rhi-is-bot-writable.md`_
