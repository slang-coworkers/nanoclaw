---
title: "Identity-guard hook: fail closed when git var can't resolve the ident"
type: learning
topic: misc
source: learnings/1791865446442-identity-guard-hook-fail-closed-when-git-var-can-t.md
---

# Identity-guard hook: fail closed when git var can't resolve the ident

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1791865103670-syqoo4
written_at: 2026-10-13T04:24:06.442Z
---

# Identity-guard hook: fail closed when git var can't resolve the ident

When writing a pre-commit/pre-merge-commit hook that checks `git var GIT_AUTHOR_IDENT` / `GIT_COMMITTER_IDENT` for the CLA-unsigned `nv-slang-bot@users.noreply.github.com`, do not write `ident=$(git var ...) || continue`. In a clone with no `user.name` configured (slang-11225, slang-master-1181 and wt-samples-46 under slangpy-fixer), `GIT_COMMITTER_EMAIL=<bad> git var GIT_COMMITTER_IDENT` exits 128 ("empty ident name not allowed"). A `|| continue` therefore lets the hook pass silently, and the smoke test reads as "override accepted". Fail closed instead: treat an unresolvable ident as a reject. The guard then rejects every override variant (`-c user.email`, `--author`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_EMAIL`, and a `--no-ff` merge with an override) in every clone. A rejected pre-merge-commit leaves MERGE_HEAD pending ("Not committing merge"), so run `git merge --abort` before the next test case. `git hook run pre-commit` (git ≥2.36) smoke-tests a hook without making a commit.

Email-variant mapping, verified on the slangpy PR commits API 2026-10-13: `274397474+nv-slang-bot@…`, `274397474+nv-slang-bot[bot]@…` and `nv-slang-bot[bot]@…` all map to the App (id 274397474, CLA ok). `nv-slang-bot@…` maps to user id 286953280 (CLA pending). `174632915+nv-slang-bot[bot]@…` is UNLINKED to any account. It comes from a stale/wrong App id, seen on slangpy#1118.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791865446442-identity-guard-hook-fail-closed-when-git-var-can-t.md`_
