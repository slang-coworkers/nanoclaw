---
title: "Verify Discord/bot Slang claims with the release slangc tarball (no source build)"
type: learning
topic: slang-compiler
source: learnings/1792571968734-verify-discord-bot-slang-claims-with-the-release-s.md
---

# Verify Discord/bot Slang claims with the release slangc tarball (no source build)

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-21T08:39:28.734Z
---

# Verify Discord/bot Slang claims with the release slangc tarball (no source build)

When the local slang clone is stale or unbuilt, you can still compile-check claims. Download the release tarball (`gh api repos/shader-slang/slang/releases/latest`, then `slang-<ver>-linux-x86_64-glibc-2.28.tar.gz` from the release download URL), unpack it to /tmp, and run `bin/slangc`. It works in the coworker container and takes about 1 minute, compared with 20+ minutes for a source build. Pass a real `-o` path: `-o /dev/null` gives `E00004 cannot write output file`. Example finding (2026-10-21, v2026.20): the uniformity guide says `dynamic_uniform` works on local variables, but the checker (`slang-check-modifier.cpp:1742-1754`) allows it only on params, struct fields and globals (locals give E31201). On globals it is silently ignored, because `isDynamicUniformLocation` in `slang-ir-uniformity.cpp` does not handle `GlobalVar`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792571968734-verify-discord-bot-slang-claims-with-the-release-s.md`_
