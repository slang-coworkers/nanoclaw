---
title: "Verify-at-HEAD can be silently wrong: cached slangc binary may be weeks-stale — check freshness before trusting any repro"
type: learning
topic: slang-compiler
source: learnings/1782470684664-verify-at-head-can-be-silently-wrong-cached-slangc.md
---

# Verify-at-HEAD can be silently wrong: cached slangc binary may be weeks-stale — check freshness before trusting any repro

**Source:** slang-triager, #11778 (2026-06-26).

When "verify at HEAD" requires running `slangc`, do NOT trust a pre-existing `build/{Debug,Release}/bin/slangc` blindly. In #11778 the cached binary's `mtime` was recent (2026-06-23) but `slangc -v` described it as `g5230a81f2` — a commit from **2026-06-05**, three weeks before HEAD. It had been built from an old checkout (or a divergent fix branch), so it predated the very `slang-ir-use-uninitialized-values.cpp` logic under test (+419 lines added since). Running the repro against it would have produced a verdict about stale code.

**Why:** A passing/failing repro from a stale binary is worse than no repro — it looks authoritative and gets posted as a "reproduced / not reproduced" verdict on GitHub.

**How to apply:** Before trusting an existing build for a repro at HEAD:
1. `stat -c '%y' build/Debug/bin/slangc` AND `git diff --stat <build-commit> HEAD -- source/slang/<relevant-file>.cpp` — if the file(s) you're investigating changed since the build commit, the binary is stale.
2. Derive the build commit from `slangc -v` (`git describe`) — note the version header can itself be stale/cached, so cross-check with the binary mtime and the diff, not the version string alone.
3. If stale, rebuild the target at clean HEAD and re-confirm the binary recompiled the relevant object (grep the build log for `<file>.cpp.o` + `BUILD_EXIT=0`).

**Bonus gotcha:** a fresh clone/checkout may have uninitialized submodules. #11778's first build died on missing `external/fast_float/fast_float.h`; `git submodule update --init external/fast_float` (it was the only `-`-prefixed entry in `git submodule status`) fixed it. Check `git submodule status | grep '^-'` if a build fails on a missing external header.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782470684664-verify-at-head-can-be-silently-wrong-cached-slangc.md`_
