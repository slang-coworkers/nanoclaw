---
name: project_nanoclaw_1137_sync_nvcoworkers_qodo_gmail_removal
description: "slang-coworkers/nanoclaw#1137 nv-coworkers upstream sync (deletes 4 skills) — verified inline, MERGED 2026-08-06; adds the deletion-sync check the earlier sync memos lacked"
metadata:
  node_type: memory
  type: project
  originSessionId: pr1137-webhook
---

**slang-coworkers/nanoclaw#1137** — `Sync nv-coworkers with upstream/main`, `sync/upstream-nv-coworkers` → `nv-coworkers`, author `nv-slang-bot[bot]` (`sync-upstream.sh`). **MERGED 2026-08-06 by me via REST** (`merge_method=merge`, merge commit `16907a33f`; `behind_by: 0` vs upstream `743e32df4` after). One upstream commit: `743e32df4` *"chore(skills): remove stale qodo and Google MCP skills (#3172)"* by `glifocat` ([REDACTED-EMAIL]).

**Handled inline, NOT routed.** The webhook task says "route to the project's `*-pr-approver`" — there is **no `nanoclaw-pr-approver`**; only `slang-pr-approver`/`slangpy-pr-approver` exist and both are wrong-domain for platform-fork code. Same class as [[project_nanoclaw_pr864_sync_blocked]] / [[project_nanoclaw_pr873_sync_nvmain]] / [[project_nanoclaw_kb_sync_pr_autoref_noop]]. Merge authority: [[feedback_nv_coworkers_automerge]] (nv-coworkers-scoped, explicitly covers `sync-upstream.sh` PRs).

**Shape:** 14 files, **+2 / −1606** — i.e. a near-pure DELETION sync, unlike every prior sync memo (all large `+` diffs). Removes `.claude/skills/{add-gmail-tool,add-gcal-tool,get-qodo-rules,qodo-pr-resolver}/` (13 files) and edits `customize/SKILL.md` (2 lines: drops the gmail/gcal names from the MCP-tool list, generalizes the credential line to "if a dedicated `/add-<service>-tool` skill exists"). `mergeable_state: clean`, `label` check ✓, no CI gate (`ci.yml` only fires on PRs into `main`).

⭐⭐**A deletion sync needs a check the addition-sync memos do not specify: does the fork depend on what upstream deleted?** A `+`-heavy sync can only add unused code; a `−`-heavy one can strip a path something else still names. Three questions, all answered from the real trees (not the PR page):
1. **Fork-only commits on the deleted paths?** For each of the 4 dirs, compared the commit sha sets on `main` (upstream-tracking) vs `nv-coworkers`: **9/9, 7/7, 1/1, 1/1 — identical, zero NV-only shas.** ⇒ the fork never customized these skills, so nothing fork-authored is lost.
2. **Dangling references after the merge?** `git grep -E 'qodo|add-gmail-tool|add-gcal-tool'` on the **PR head tree** (`refs/pull/1137/head`), excluding `knowledge_base/` and `CHANGELOG.md`: **zero hits.** Before the merge the same grep on `nv-coworkers` hit 7 files — 5 of them inside the dirs being deleted, plus `customize/SKILL.md` (fixed by this PR) and `CHANGELOG.md` (historical entry, correctly left). ⇒ the upstream commit is self-consistent; the deletion is complete.
3. **Runtime wiring?** No `groups/*/container.json` references gmail/gcal/calendar; no hits in `src/ container/ setup/ docs/ .github/ coworkers/`. ⇒ no group loses a live MCP tool.

**Merge safety:** `git merge-base --is-ancestor` confirmed **both** parents are ancestors of the PR head (`f18dc7f69` = nv-coworkers, `743e32df4` = upstream) and `git diff nv-coworkers..pr-head` is **exactly** the 14 files — so the merge adds no hidden fork-history rewrite. Merge commit (not squash) per the PR body's "Create a merge commit" ask, preserving the upstream parent link for future syncs.

⚠️**Instrument trap hit here:** `git fetch origin refs/pull/1137/head:pr1137` **clobbered `FETCH_HEAD`** from the earlier `fetch origin nv-coworkers`, so a `git diff FETCH_HEAD pr1137` printed **empty** — which reads identically to "no differences" (the desired-looking answer) rather than "you diffed a ref against itself". ⇒ **In a multi-fetch session, pin every ref to an explicit sha before diffing; never carry `FETCH_HEAD` across a second fetch.** Re-run with the literal sha gave the true 14-file stat. Same family as the false-zero lessons in [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].

⚠️`gh api repos/nanocoai/nanoclaw/...` (upstream org) returns **401 Bad credentials** under the OneCLI App token, while the same reads against `slang-coworkers/*` work. ⇒ **verify "does upstream still have X" through the fork's own `main`** (which tracks upstream: head `358f1a816`, and `743e32df4`'s sole parent) — not by querying the upstream org.

**No GitHub comment posted** — bot lacks `addComment` on this repo, and a self-verified bot sync PR that I merged in the same turn has no human awaiting a note. **On webhook redelivery: terminal (merged). Do not re-verify, do not route.** The repo auto-deletes head branches on merge, so the next daily run opens a fresh PR number.
