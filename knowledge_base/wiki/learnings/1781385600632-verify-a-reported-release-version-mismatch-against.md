---
title: "Verify a reported release-version mismatch against the actual artifact before treating it as a release-CI bug"
type: learning
topic: ci-tooling
source: learnings/1781385600632-verify-a-reported-release-version-mismatch-against.md
---

# Verify a reported release-version mismatch against the actual artifact before treating it as a release-CI bug

Triaging shader-slang/slang#11603: a user reported that the official `slang-2026.10.2-windows-x86_64.zip` returns `2026.8` from `spGetBuildTagString()`. This looked like a release-CI/version-embedding bug (Approach B). It was NOT.

The decisive step was to **download and inspect the actual release asset** rather than reasoning only from the workflow YAML + run logs (the run logs had expired — HTTP 410 Gone, which is common for runs >~few weeks old). The zip ships `include/slang-tag-version.h` (the generated header) AND the binaries, so you can read the embedded version directly:
- `cat include/slang-tag-version.h` → `#define SLANG_TAG_VERSION "2026.10.2"` ✓
- `strings -n4 bin/slang-compiler.dll | grep -c 2026.10.2` (slang-compiler.dll is the module that implements `getBuildTagString`; `slang.dll` is just a ~156KB re-export shim) → present; `2026.8` → **zero**
- grep the whole `bin/`+`include/` for any `20[0-9]{2}\.[0-9]` token → only `2026.10.2` appeared; nothing contained `2026.8`.

So the artifact was correct; the user's runtime `2026.8` came from a **different (older) Slang binary being loaded** — a classic Windows DLL-resolution issue (an older `slang.dll`/`slang-compiler.dll` earlier in the load path / a stale install dir / bundled by their app). Verdict flipped from "release-CI bug → forward to fixer" to "not a bug → clarification reply to reporter."

Corroborating pipeline facts (useful for future build-tag triage): release.yml checks out with `fetch-depth:0`+`fetch-tags:true` and passes no `-DSLANG_VERSION_FULL`, so `git describe` drives the version; `git describe --tags --match 'v20[2-9][0-9].[0-9]*'` on a release tag commit returns the clean tag; `cmake/slang_git_version` is an `export-subst` `$Format:...$` placeholder (only substituted by `git archive`, irrelevant to a normal CI checkout). General lesson: when a premise asserts an official artifact is wrong, the artifact is downloadable ground truth — check it before routing a fix for a bug that may not exist.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781385600632-verify-a-reported-release-version-mismatch-against.md`_
