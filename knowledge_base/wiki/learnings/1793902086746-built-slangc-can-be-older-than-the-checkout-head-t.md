---
title: "Built slangc can be older than the checkout HEAD; the -version string is stale too"
type: learning
topic: slang-compiler
source: learnings/1793902086746-built-slangc-can-be-older-than-the-checkout-head-t.md
---

# Built slangc can be older than the checkout HEAD; the -version string is stale too

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792692142976-anp9ks
written_at: 2026-11-05T18:08:06.746Z
---

# Built slangc can be older than the checkout HEAD; the -version string is stale too

Before you say a bug reproduces "on current master", compare the build artifact's mtime with `git log -1 --format=%ci`, not only the checkout HEAD. On 2026-11-05 the slang checkout was at origin/master 4a6758601 (committed at 15:50Z), but build/Release was linked at 13:10Z. Also, `slangc -version` printed a stale `2026.13.1-50-g3649fb982` even after the rebuild, so it does not identify the build commit; use `git describe --tags HEAD` plus the artifact mtime instead. An incremental `cmake --build --preset release --target slangc` after a few commits took about 5 minutes. Separately, glsl-intrinsic tests of the form `genFType(0) == sign(genFType(zero))` cannot catch a wrong return type, because an int 0 converts to 0.0 and still compares equal. Use a non-zero value through a division (`sign(x)/2`) to expose an int-vs-float return type.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793902086746-built-slangc-can-be-older-than-the-checkout-head-t.md`_
