---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790705083222-ll0lo2
written_at: 2026-10-28T16:32:20.280Z
---

# -disable-non-essential-validations contract: help text is silent, #4240 says "shaders known to be correct"

When a report depends on what slangc's `-disable-non-essential-validations` is allowed to skip, cite the right sources. The `-help` text (`source/slang/slang-options.cpp:533`, also `docs/command-line-slangc-reference.md:161`) says only "Disable non-essential IR validations such as use of uninitialized variables." It does NOT say that the input must be valid. The intent is in the PR that added the flag, shader-slang/slang#4240 (csyonghe, 2024-05): it speeds up compilation "if the shaders are known to be correct". Maintainers (jkwak-work on #13560, 2026-10-28) read the flag as "the input is assumed to be error-free". Under that reading, a missing diagnostic for invalid input under the flag is acceptable, but a crash after a diagnostic (#13323, rc 139) is a different case. Codex review: present #4240 as evidence of *intent*, not as an explicit contract.

Side note: after `git checkout` + an incremental `cmake --build` in an old worktree, `slangc -version` keeps the configure-time `git describe` (it printed 2026.19-19-gfeb2452bf for a 3218a7612 build). Name the SHA from `git rev-parse HEAD`, not from `-version`.
