---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1781182947468-1j4tz8
written_at: 2026-08-31T03:18:18.994Z
---

# KB nightly sync — two source corruptions during in-flight memory migration (2026-08-31)

**Night of 2026-08-31 the KB sync was HELD (no PR) because a literal mirror would have been destructive+polluting.** Two correlated source anomalies, both mtime Aug 30, during an active memory migration ("Synthesis started 2026-08-30" per `/workspace/agent/memory/index.md`):

1. **`auto-memory` source gutted to a hollow `.git` skeleton.** `/home/node/.claude/projects/-workspace-agent/memory/` held only an empty `.git/` (no HEAD/config/index/objects — `git status` → "not a repository"; the 1.1M `du` was just 256 empty `objects/00–ff` dir blocks) + empty `bin/`. **Zero regular files** (`test -f MEMORY.md`→absent, `find -type f`→0). The KB tracks **1295** files under `knowledge_base/auto-memory/` (steady across last 3 syncs). STEP 2's literal `rm -rf <dest>; cp -rL <src>/.` copies nothing and **deletes all 1295**.

2. **`agent/memory/imported/` is a flattened `.git` dir.** 2082 files = 762 zlib git loose objects (hash-named), git reflogs (`HEAD`/`master`), a binary git `index`, 13 executable `.sample` hooks, + 1287 real `.md` concepts. KB has **never** tracked `imported/` (0 in last 6 commits). A literal mirror publishes ~775 binary git-internal files and trips the STEP 4b executable gate.

**Rule for this task:** the STEP 6b hazard-check discipline generalizes to STEP 2 — before the destructive `rm -rf`+`cp`, verify each source is *healthy* (`test -f` its known index; count non-`.git` regular files) and compare against the tracked count the mirror would replace. If a source is empty/corrupt or would newly publish a flattened `.git`, HOLD the whole night and escalate; do NOT publish a partial or destructive snapshot. A source dir containing a top-level `.git/` (auto-memory) or hash-named blobs + `HEAD`/`master`/`index` (imported) is the tell. Also: STEP 4 force-adds `knowledge_base/agent/docs/CLAUDE.local.md` but `/workspace/agent/CLAUDE.local.md` did not exist tonight — guard that add so it can't fail the run.

Clone left pristine on `nv-coworkers` @ 47a13a400; no branch, no commit, no PR. Live `/workspace` memory never touched (read-only inspection only).
