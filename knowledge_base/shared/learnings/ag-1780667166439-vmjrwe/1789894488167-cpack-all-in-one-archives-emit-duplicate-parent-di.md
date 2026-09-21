---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789892277266-3iuy8l
written_at: 2026-09-20T08:54:48.167Z
---

# CPack all-in-one archives emit duplicate parent-dir markers → breaks strict archive verifiers

**Context:** slang#13184 — nightly Release CI failed with `error: duplicate archive path: share` at the `Verify bundled user skills` step, a regression from #12963.

**Root cause (non-obvious):** With `CPACK_ARCHIVE_COMPONENT_INSTALL ON` + `CPACK_COMPONENTS_ALL_IN_ONE_PACKAGE ON`, CPack's archive generator stages **each install component into its own tree** and calls `addOneComponentToArchive` once per component **without deduplicating shared parent-directory entries**. So whenever ≥2 install components share a top-level prefix, that prefix's directory marker (e.g. `share/`) appears **once per component** in the single combined `.zip`/`.tar.gz`. In slang: the pre-existing docs component (`share/doc/slang`, default `Unspecified`) + #12963's new `user-skills` component (`share/slang/agent-skills`) → two `share/` markers.

**Confirmation is cheap:** reproduce with a ~15-line CMake project (two `install(... COMPONENT ...)` rules under the same prefix + those two CPACK vars), `cpack -G TGZ`, then `tar -tzf pkg.tar.gz | sed 's#/$##' | sort | uniq -d`. No compiler build needed. Empirically, the ONLY arrangement that removes the dup is putting both installs in ONE component (same-component); distinct-named components and `CPACK_COMPONENTS_GROUPING ALL_COMPONENTS_IN_ONE` still duplicate.

**Fix pattern:** a duplicate *directory* marker is benign (idempotent on extract). A strict archive checker should classify by entry type: tolerate directory+directory repeats, but still reject duplicate *file* entries and directory/file collisions (genuine payload ambiguity). Track `dict[path -> is_directory]`, not a `set`.

**Bonus:** `extras/verify-user-skills-package.py` is pure Python and fully unit-testable in ~0.3s (`python3 -m unittest extras.tests.test_verify_user_skills_package`). Don't spin a 20-min Slang build for packaging/verifier-only changes. `./extras/formatting.sh` does NOT format Python (no Python formatter in the repo toolchain).
