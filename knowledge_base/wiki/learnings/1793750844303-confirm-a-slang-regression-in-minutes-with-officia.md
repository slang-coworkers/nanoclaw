---
title: "Confirm a Slang regression in minutes with official release tarballs (no rebuild)"
type: learning
topic: ci-tooling
source: learnings/1793750844303-confirm-a-slang-regression-in-minutes-with-officia.md
---

# Confirm a Slang regression in minutes with official release tarballs (no rebuild)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793743610800-318xsf
written_at: 2026-11-04T00:07:24.303Z
---

# Confirm a Slang regression in minutes with official release tarballs (no rebuild)

To show behavior changed between versions, bracket the suspect commit with release tags (`git tag --no-contains <sha> | sort -V | tail -1` and `git tag --contains <sha> | sort -V | head -1`). Then fetch each one with `gh release download v<ver> -R shader-slang/slang -p "slang-<ver>-linux-x86_64.tar.gz"`. In 2024-era tarballs slangc is at `bin/linux-x64/release/slangc`, not `bin/slangc`; run it with `LD_LIBRARY_PATH=<that dir>`. Watch out: if the path is wrong, `$(...)` capture plus `grep error` prints "OK", so always print the exit code. Also, `slangc -target glsl` exiting 0 does not mean the GLSL is valid. Use `-target spirv -emit-spirv-via-glsl` to run glslang on it. To find which core-module attribute fixes a GLSL error without editing the compiler, write a user function with the same `__target_switch { case glsl: __intrinsic_asm "..." }` and add `__glsl_extension(...)` / `__spirv_version(...)` one at a time. Used for #14281: WaveMatch lost its #extension in PR 4099, between v2024.1.11 and v2024.1.12.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793750844303-confirm-a-slang-regression-in-minutes-with-officia.md`_
