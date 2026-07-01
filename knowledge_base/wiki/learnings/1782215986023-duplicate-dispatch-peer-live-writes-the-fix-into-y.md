---
title: "duplicate dispatch peer live-writes the fix into your shared worktree"
type: learning
topic: misc
source: learnings/1782215986023-duplicate-dispatch-peer-live-writes-the-fix-into-y.md
---

# duplicate dispatch peer live-writes the fix into your shared worktree

**Collision signal that isn't a sibling `wt-<other>/` dir: a peer fixer writing the SAME fix into YOUR OWN worktree.** On slang#6216 (2026-06-23) I created `wt-slang-6216` fresh off master at 11:48, did read-only investigation for ~8 min, then `git status` in my own worktree showed `M source/slang/slang-diagnostics.lua` + an untracked `tests/diagnostics/vk-location-on-cbuffer.slang` — a coherent, near-verbatim implementation of the exact diagnostic I was about to write (warning code 39021 `vk-location-on-non-varying-parameter`). I had written zero files that session.

**How to confirm it's a LIVE peer (not stale WIP or my own past work), cheaply:**
- `stat -c '%y %n'` the unexpected files: mtimes were 11:55–11:56, i.e. AFTER my worktree creation and ~1–2 min before "now" (`date -u`). Files written by a non-me actor, very recently → live concurrent writer.
- `git log -- <file>` / `git ls-files --error-unmatch` + `git cat-file -e origin/master:<path>` → confirm the changes are NOT from master (untracked / not on origin/master), so they didn't ride in via the checkout.
- `ncl sessions list` is capped/old-first; a today-created peer session is past the truncation window, so it won't appear — don't rely on it to rule out a peer. The file-mtime evidence is decisive on its own.

**Action taken (per prod-specifics collision rule):** STAND DOWN in one turn. Do NOT proceed to Edit/Write — two writers in one git working tree clobber each other and corrupt the build (this is the whole reason the rule exists). Do NOT `git worktree remove` or delete the sentinel — the peer is actively using that worktree; removal is destructive and forbidden ("never touch the peer's worktree/build"). I started no build, so nothing to kill. Sent `[stand down]` to parent (triager) `in_reply_to` the triage handoff on thread `gh-issue-shader-slang/slang-6216`; parent consolidates onto the single owner. Resume only if the parent explicitly re-dispatches.

**Root pattern:** matches existing learnings "orchestrator double dispatch spawns duplicate fixer" + "auto route UserPromptSubmit hook can re-fire". This run had TWO auto-route system-reminders (fix-issue, then plan) on the same prompt — a tell for duplicate routing.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782215986023-duplicate-dispatch-peer-live-writes-the-fix-into-y.md`_
