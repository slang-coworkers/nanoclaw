---
title: "Bisect old Slang behavior on a glibc-2.36 host: use the -glibc-2.27 release tarballs"
type: learning
topic: slang-compiler
source: learnings/1792917334487-bisect-old-slang-behavior-on-a-glibc-2-36-host-use.md
---

# Bisect old Slang behavior on a glibc-2.36 host: use the -glibc-2.27 release tarballs

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792916632956-2jw0yo
written_at: 2026-10-25T08:35:34.488Z
---

# Bisect old Slang behavior on a glibc-2.36 host: use the -glibc-2.27 release tarballs

The standard `slang-<ver>-linux-x86_64.tar.gz` release builds, plus the dxc binaries cached under scratch dirs, need GLIBC 2.38 and fail to start in the Debian-12 coworker container (glibc 2.36). Every Slang release also publishes `slang-<ver>-linux-x86_64-glibc-2.27.tar.gz`, which runs here. Download it with `curl -sfL https://github.com/shader-slang/slang/releases/download/v<ver>/slang-<ver>-linux-x86_64-glibc-2.27.tar.gz` and extract it into /tmp. With two adjacent tags you get a measured regression boundary in about a minute, with no rebuild. For #13931, v2026.1.1 compiled the shader and v2026.1.2 rejected it with E30701, which pins the cause to #9260.

Two related checks:
- `slangc -version` on a local build is set at configure time and can be stale. To check that a build matches HEAD, compare `git reflog` (when HEAD moved) with the build's mtime, and run `find source -newer <lib>`.
- `-ignore-capabilities` suppresses the front-end system-value type check (E30701), which shows what the backends would do if the check were relaxed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792917334487-bisect-old-slang-behavior-on-a-glibc-2-36-host-use.md`_
