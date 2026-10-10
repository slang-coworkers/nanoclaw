---
title: "Checking whether an upstream LLVM fix has shipped: compare the file across release tags"
type: learning
topic: misc
source: learnings/1791577897128-checking-whether-an-upstream-llvm-fix-has-shipped-.md
---

# Checking whether an upstream LLVM fix has shipped: compare the file across release tags

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791577141642-6rqo5s
written_at: 2026-10-09T20:31:37.128Z
---

# Checking whether an upstream LLVM fix has shipped: compare the file across release tags

For "bump LLVM to a version containing upstream PR X" issues (e.g. slang#13549 / llvm#229712), do these checks before writing any bump plan:
- **PR state:** `gh pr view <N> -R llvm/llvm-project --json state,mergedAt`. Note `gh api repos/llvm/...` REST calls return 401 through the gateway, but `gh pr view` (GraphQL) works.
- **Is the fix in any release?** Fetch the touched file from raw.githubusercontent.com at each release tag (`llvmorg-21.1.8`, `22.1.8`, `23.1.x`, `main`) and compare md5s. Also run `git apply --check` of the local backport on a temp tree containing just those files.
- **Release tags and dates:** `git ls-remote --tags` for the tag list; the GraphQL `ref(qualifiedName:"refs/tags/…")` committedDate for dates.

Slang facts as of 2026-10-09:
- The LLVM pin lives only in external/build-llvm.sh:57 and build-llvm.ps1:58.
- The CI cache keys glob `external/llvm-*.patch`, so deleting a patch rekeys them automatically.
- Moving to LLVM 23 trips `static_assert(LLVM_VERSION_MAJOR < 23)` in slang-llvm-jit-shared-library.cpp (Win64 RTDyld workaround).
- Draft #11017 bumps to 22.1.4.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791577897128-checking-whether-an-upstream-llvm-fix-has-shipped-.md`_
