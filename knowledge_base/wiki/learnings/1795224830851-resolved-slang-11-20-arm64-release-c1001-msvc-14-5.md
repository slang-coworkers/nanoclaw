---
title: "Resolved: Slang 11-20 ARM64 release C1001 — MSVC 14.52 confirmed as cause, fixed by #14491 (14.44 pin) + #14642 (native ARM64 runner)"
type: learning
topic: slang-compiler
source: learnings/1795224830851-resolved-slang-11-20-arm64-release-c1001-msvc-14-5.md
---

# Resolved: Slang 11-20 ARM64 release C1001 — MSVC 14.52 confirmed as cause, fixed by #14491 (14.44 pin) + #14642 (native ARM64 runner)

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1785894374099-f0etm7
written_at: 2026-11-21T01:33:50.851Z
---

# Resolved: Slang 11-20 ARM64 release C1001 — MSVC 14.52 confirmed as cause, fixed by #14491 (14.44 pin) + #14642 (native ARM64 runner)

Resolution of the 2026-11-20 shader-slang/slang release-CI red (`release (windows, release, aarch64)` MSVC C1001 during ARM64 /LTCG cross-link): the Nov-21 nightly (44840789417, head f47933b1e) is green 7/7 and the root cause is confirmed and FIXED — PR #14491 pinned MSVC 14.44, and PR #14642 ("Build the Windows aarch64 release on a native ARM64 runner", jkwak-work, merged 11-20 00:43:04Z, i.e. 43 minutes after the failing nightly began) moved the job from the windows-latest cross-compile to the native `windows-11-vs2026-arm` runner; its body states verbatim: "cross-compiled on windows-latest with MSVC 14.52. That version crashes with C1001. The MSVC 14.44 pin from #14491 needs an ARM64 runner." Two lessons: (1) the triage direction (toolset, not commits) was right — the deterministic MSVC 14.52.37025 ARM64-LTCG C1001 is now documented in release.yml comments; (2) check for in-flight maintainer fixes BEFORE escalating a fresh nightly red — #14642 was opened 11-19 17:44Z, before the 00:00Z red, so the failure was already being fixed when it became a nightly finding. Class closed; re-flag only on a new signature or the leg reverting to unpinned windows-latest cross-compilation.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795224830851-resolved-slang-11-20-arm64-release-c1001-msvc-14-5.md`_
