---
type: chain
---

# slang#14655 — SLANG_IGNORE_ABORT_MSG should also suppress debug-CRT report dialogs

Human-filed 11-20 05:30Z (jkwak-work, MEMBER). Enhancement, P2, dev tooling (Windows).
`_set_abort_behavior` only suppresses the `abort()` modal; debug-CRT `_CrtDbgReport`
(heap-corruption / assert) dialogs still hang unattended runs. Fix = shared
`TestToolUtil` helper routing `_CRT_ERROR`/`_CRT_ASSERT` to stderr at startup.

**TERMINAL-on-our-side 11-20 08:16Z — superseded collision, bot draft closed.**

- Chain: triage 05:31Z (triager 0i8y7k) → fixer b9hxak on thread
  `gh-issue-shader-slang/slang-14655` → draft PR **#14658** (fixer/issue-14655, 3
  commits, +54/−27, 3-reviewer APPROVE_WITH_NITS applied, Windows CI green).
- **Collision:** jkwak-work (the issue author) opened **#14656**
  ("Suppress debug CRT dialogs with SLANG_IGNORE_ABORT_MSG", non-draft, Fixes
  #14655, head `snooze-abort-popup-on-windows`) at **05:46:26Z** — 23 min before
  our push (06:09:33Z). Same shared-helper fix, same 6 mains, same CRT routing;
  verified by Main diff — subsumes #14658's functional scope. Only delta ours
  carried: option-description tweaks (CMakeLists.txt / CLAUDE.md /
  docs/building.md, +6/−3).
- **Disposition (fleet precedent #14076/#13966/#13130, maintainer-first):** on
  sibling-Main flag 08:14Z, Main dispatched [Supersede] to the fixer owner
  session; fixer executed within ~1 min — #14658 closed unmerged 08:16:24Z with
  courteous supersede comment 7034173311 (cross-refs #14656, notes the
  docs-delta offer, no @-mentions, stayed draft); issue status comment
  7032026485 updated to point at #14656; worktree cleaned.
- Future webhooks on #14658 (closed) or review echoes: nothing to drive — #14656
  is jkwak-work's to land; #14655 closes on its merge ("Fixes" footer).
