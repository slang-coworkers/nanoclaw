---
title: "Coworker Memory Persistence: Reap-Restore, OKF Relocation, and the Spine-Baked Write Path"
type: concept
group: agent-infra
tags: [memory, okf, reap, persistence, spine, git-tracking, backup, dossier, snapshot]
source_count: 2
---

# Coworker Memory Persistence: Reap-Restore, OKF Relocation, and the Spine-Baked Write Path

How a coworker's `/workspace/agent/memory/` tree behaves under container reap/restart, OKF relocation, and host-composed spine regeneration — and why it is best-effort scratch, not the durable record of a chain.

## TL;DR

- A coworker's `/workspace/agent/memory/` tree is **best-effort, not durable**. A container reap/restart can restore it from a stale snapshot, silently discarding in-session `.md` writes made since that snapshot.
- Do NOT treat `memory/*.md` as the source of truth for a live chain. The durable record is the GitHub artifacts (PR body with `Fixes #N`, the issue 5-bullet trail) and your report-up messages to parent. After any gap/restart, re-derive live state from GitHub.
- `memory/` is NOT git-tracked — there is no `.git` up the tree, so "keep it revertible via git" is false. Before a bulk memory migration, snapshot with a tarball and record the exact revert command.
- The okf-synthesis skill relocates top-level issue memos (`triage-<N>.md`) into `memory/issues/` and can leave a stub at the old path — a later `>>` append to the top-level path then creates split-brain.
- The memo-write path is baked into the host-composed spine + okf-synthesis skill, so a relocation regrows at the old path until the operator edits the host-side source. A container-side reorg cannot make it stick.
- Don't burn turns chasing a churning tree: write a compact resume note once, verify it persists ~20s later, and move on. The wipe is infra, not your error.

## Coworker memory is best-effort — reap-restore wipes in-session dossiers

A container reap/restart can restore `/workspace/agent/memory/` from a **stale snapshot**, silently discarding in-session `.md` writes made since that snapshot [Coworker memory/ is best-effort: reap-restore wipes in-session dossiers; okf-synthesis relocates issue memos to issues/](../learnings/1789187760131-coworker-memory-is-best-effort-reap-restore-wipes-.md). Observed 2026-09-12: mid-session, `memory/triage-12549.md` went 172 lines → gone; the whole tree re-materialized at one identical mtime showing OLDER artifacts (issues that predated the session) with the recent triage file absent everywhere (`grep -rl` and `find -iname` both empty), then it settled and a re-written note persisted.

Consequences: **do not treat `memory/*.md` as the durable source of truth for a live chain.** The authoritative, stable record is (a) the GitHub artifacts (PR body with `Fixes #N`, the issue 5-bullet trail) and (b) your report-up messages to parent — the parent's session memory persists independently and can re-brief you on resume; a chain is always reconstructable from GitHub even if the local memo is wiped. After a gap/restart, **re-derive live state from GitHub** rather than trusting the local memo's "current state," which may be a stale snapshot. And don't burn many turns chasing a churning tree — write a compact resume note once, verify it persists ~20s later, and move on; the wipe is infra, not your error.

## Not git-tracked, and the memo-write path is spine-baked

Two gotchas confirmed during the slang-triager OKF memory migration (2026-09-12, issue-dossier pile → `issues/` subfolder) [Coworker OKF memory trees are not git-tracked; memo-write path is spine-baked](../learnings/1789188194373-coworker-okf-memory-trees-are-not-git-tracked-memo.md).

**(1) `/workspace/agent/memory/` is NOT git-tracked.** There is no `.git` up the tree, so "keep it revertible via git" is false for coworker memory. Before any bulk memory migration, snapshot with a **tarball** first (`tar czf memory-migration-backup-<ts>.tgz memory CLAUDE.local.md`) and record the exact revert command (`rm -rf memory && tar xzf <backup> -C /workspace/agent`).

**(2) The memo-creation path is baked into the host-composed spine and the okf-synthesis skill.** The triage/comment memo-write path (`cat > memory/triage-<N>.md`) lives in step-6 of the composed `CLAUDE.md` (regenerated at container start) AND in the okf-synthesis skill — both host-side source in `container/skills/` + the spine fragment. A coworker CAN change its *behavior* durably via an always-loaded override in its own `system/definition.md`, but CANNOT change *where new memos are written*. So a memory reorg that relocates memos (root → `issues/`) will REGROW at the old path until the operator edits the two host-side paths; authorize the migration for the pile, but flag that a regrowth-proof fix needs a host-side spine + skill edit outside the container. Relatedly, the okf-synthesis skill itself (daily cron; `.okf-synth-state.json`) relocates top-level issue memos (`triage-<N>.md` → `memory/issues/triage-<N>.md`, adding `type: triage` frontmatter) and can leave a stub at the old path — a subsequent `>>` append to the top-level path lands in the stub, not the authoritative `issues/` copy, creating split-brain. If a `triage-<N>.md` append makes the line count SHRINK, suspect okf relocation: check `memory/issues/triage-<N>.md` and write to the authoritative path. Expect concurrent sibling sessions to re-materialize memos at the old path mid-migration (one did: #12549) — reconcile and leave a thin pointer breadcrumb.

**Source learnings (2):**
- [Coworker memory/ is best-effort: reap-restore wipes in-session dossiers; okf-synthesis relocates issue memos to issues/](../learnings/1789187760131-coworker-memory-is-best-effort-reap-restore-wipes-.md) — don't trust the local memo as durable; re-derive live state from GitHub; write a resume note once and move on.
- [Coworker OKF memory trees are not git-tracked; memo-write path is spine-baked](../learnings/1789188194373-coworker-okf-memory-trees-are-not-git-tracked-memo.md) — tarball-snapshot before a memory migration; relocated memos regrow until a host-side spine + skill edit.

_Catalog: [[wiki/index.md]]_
