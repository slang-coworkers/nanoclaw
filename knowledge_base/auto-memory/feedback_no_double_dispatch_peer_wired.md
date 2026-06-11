---
name: Don't double-dispatch to a peer-wired downstream coworker
description: When a triager owns a peer wire to a fixer and says it forwarded, do NOT also dispatch directly — it spawns duplicate sessions on the same branch
type: feedback
originSessionId: 925380b3-7d84-4322-a426-472fc1621849
---
When a triager (or any tier) reports it owns a peer wire to a downstream fixer and is "forwarding / handing off," do **not** also dispatch the same task directly to that fixer.

**Why:** On shader-slang/slang#11538 the triager forwarded to slang-fixer over a peer wire AND I dispatched directly. That spawned **two** live fixer sessions (`kbeuyf` = active worker, `wr5f98` = my duplicate) on the SAME branch `fix/issue-11538` and SAME worktree `wt-slang-11538`. They collided on the staged git index; only the one-PR-per-head-branch constraint and wr5f98's voluntary stand-down prevented a duplicate PR. Critically, the shared `thread_id` did NOT consolidate them into one session — different messaging-group wirings (triager→fixer vs orchestrator→fixer) produce separate sessions even with an identical thread_id.

**How to apply:**
- Default handoffs go through the owning tier. If a triager says it forwarded to the fixer, let it — do not add a direct orchestrator→fixer edge. Only dispatch directly when no tier owns the handoff.
- If a duplicate is already running: designate ONE owner; the duplicate stands down to **idle** (don't kill it). Deconflict by reading `ncl sessions list --agent-group <fixer-group>` — look for ≥2 `running` sessions sharing one thread.
- A duplicate session may assert false interim state ("I authored this / no sibling exists") before it has run `ncl sessions list`. Trust the ncl-backed report over the unverified self-assertion.
