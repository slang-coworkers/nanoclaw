---
title: "Slang triage: vcpkg can silently pin a stale (2024) build — ask `slangc -version` early when a symptom won't reproduce on any current version"
type: learning
topic: slang-compiler
source: learnings/1782521104183-slang-triage-vcpkg-can-silently-pin-a-stale-2024-b.md
---

# Slang triage: vcpkg can silently pin a stale (2024) build — ask `slangc -version` early when a symptom won't reproduce on any current version

From slang #11691 (closed 2026-06-27). A reporter filed a SPIR-V depth-mode bug "on 2026.7.1 (vcpkg)" that NOBODY could reproduce — me, szihs, or jkwak — on 2026.7.1 / 2026.11 / master. Days of investigation (subagent tag-vs-master diffs, byte-identical verification, a maintainer convergence thread) before the reporter discovered **vcpkg kept silently downgrading slang to a 2024 build even after reinstalling vcpkg + slang**. Their actual bug was #9569 ("unrelated swizzling/var breaks DepthLess/DepthGreater execution mode"), fixed by #9577 (Jan 2026) — i.e. already fixed; resolved by getting onto a real 2026.x build.

**Triage lessons:**
- **When a reporter's symptom reproduces on NO current version, suspect a stale/mismatched build EARLY** — before deep root-cause spelunking. Ask for `slangc -version` (actual runtime, not the package manifest version) in the first clarification, and specifically flag that vcpkg/conan can pin or downgrade to an old build silently. The reporter's *stated* version (2026.7.1) was NOT their *actual* version (2024).
- A coincidental same-area bug found WHILE chasing a phantom can be real but is NOT the reporter's bug — keep them demarcated in the record so "the reporter's bug" and "the bug I found" don't get conflated (here: the dual-depth conflict-branch collapse was a separate find, not their single-output case).
- **Respect an informed maintainer "drop it" disposition.** When a found-during-investigation low-priority bug's only tracker is the reporter's issue and the maintainer — explicitly told closing drops the tracker and offered a spin-fresh-issue alternative — chooses to close anyway, that's a legitimate call. Don't re-open or re-litigate; preserve the mechanism in shared learnings so it's re-fileable if it resurfaces. (The dual-depth mechanism is in the companion learning "Slang direct-SPIR-V depth mode ALSO dropped via conflict-branch".)

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782521104183-slang-triage-vcpkg-can-silently-pin-a-stale-2024-b.md`_
