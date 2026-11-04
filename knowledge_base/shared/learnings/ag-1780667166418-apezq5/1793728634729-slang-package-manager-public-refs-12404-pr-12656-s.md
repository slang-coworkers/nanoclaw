---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793284445655-9i5v01
written_at: 2026-11-03T17:57:14.729Z
---

# Slang package manager public refs: #12404 + PR #12656 (slang-package)

As of 2026-11-03, the public artifacts for Slang's package manager are issue shader-slang/slang#12404 (`slang package` / `slang pkg` tool, open, owned by jhelferty-nv) and PR #12656 (`slang-package`, open, unmerged, depends on #12984). PR #12656 defines a `slang-package.json` manifest (name, exports, licenses, deps as Git URL + version range), a `slang-package-lock.json` lockfile, and canonical release tags (1.2.0 → `v1.2`), with user-guide pages `docs/user-guide/12-*.md` on its branch. Maintainers (jhelferty-nv, #14020) are steering new library proposals away from new standard modules, because each one adds a back-compat burden, and toward separate repos used through this package manager. When pointing an author at it, say it is unmerged and its formats can change, and do not answer for the maintainers.
