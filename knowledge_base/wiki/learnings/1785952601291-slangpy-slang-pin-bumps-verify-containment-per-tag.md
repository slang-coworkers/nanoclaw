---
title: "SlangPy Slang-pin bumps: verify containment per tag, and the patch line may not carry the fix"
type: learning
topic: slang-compiler
source: learnings/1785952601291-slangpy-slang-pin-bumps-verify-containment-per-tag.md
---

# SlangPy Slang-pin bumps: verify containment per tag, and the patch line may not carry the fix

When a Slang fix is "released", a SlangPy user still can't get it until `SGL_SLANG_VERSION`
(`external/CMakeLists.txt:85`) moves — it's a prebuilt **release tarball**, bumped manually.

**Verify containment per tag, never by version arithmetic:**
`gh api repos/shader-slang/slang/compare/<tag>...<fix_sha> --jq .status` → `ahead` = fix ABSENT,
`behind`/`identical` = PRESENT.

Non-obvious finding (2026-08-05, fix `33f9ed0c` / slang#11935): v2026.12 was `ahead` **and so were
v2026.12.1 and v2026.12.2**. A fix landing after X.0 is *not* backported into the X.y patch line, so
"bump to the newest 12.x" can silently fail to fix it. First containing release was v2026.13.

Also check the **reporter's** release, not just `main`: slangpy v0.41.0/v0.42.0 pinned 2026.5.2 while
`main`/v0.43.1 pinned 2026.12. A maintainer saying "slangpy uses 2026.12" can be right about `main`
and still not describe the user's build.

**Why a pin bump is not a routine one-liner:**
1. *Perf is structurally unmeasured.* slangpy#1016 **downgraded** Slang ("severe perf regressions"),
   reverting #1012 one day later. `.github/workflows/ci-benchmark.yml:75` and `:104` have the
   build-latest-Slang path **commented out** → benchmarks measure the *pinned* Slang, so they cannot
   detect a regression in the candidate version. A green benchmark lane is not evidence here.
2. *slang-rhi couples.* `SLANG_RHI_FETCH_SLANG OFF` (`external/CMakeLists.txt:231,237-239`) — rhi
   builds against our Slang. `src/sgl/device/types.h:124` asserts
   `Feature::count == rhi::Feature::_Count`, keyed to the **submodule** — so a Slang-only bump does
   NOT trip it; only moving the submodule does. slangpy#1037 moved pin + submodule + `types.h` together.

All recent pin moves (#1037, #1016, #1012) were authored by `skallweitNV` ⇒ version selection is
maintainer-owned. File the issue; don't land the bump.

**Two gotchas that cost me time:**
- `gh run list --workflow=ci-latest-slang.yml --limit 60` is swamped by `repository_dispatch` runs
  from slang PRs — I wrongly concluded "no cron runs exist". Filter explicitly:
  `gh api ".../workflows/ci-latest-slang.yml/runs?event=schedule&per_page=14"`.
- **Slang release bodies are empty (1 line).** Grepping them for "breaking change" returns nothing
  and that is a *null signal*, not an all-clear.

Cheap way to pre-validate a newer Slang without waiting for the pin: `ci-latest-slang.yml` builds
`main` against Slang **master** with `SGL_LOCAL_SLANG=ON`. Limits: builds Slang from source (not the
released tarball, so packaging is unexercised) and is correctness-only.

Worked example: slangpy#1092 (filed) ← residual of shader-slang/slang#12285.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785952601291-slangpy-slang-pin-bumps-verify-containment-per-tag.md`_
