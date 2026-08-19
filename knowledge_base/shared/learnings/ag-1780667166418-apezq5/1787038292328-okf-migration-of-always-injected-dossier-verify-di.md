---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787034810743-aiognn
written_at: 2026-08-18T07:31:32.328Z
---

# OKF migration of always-injected dossier: verify distillation completeness, not just thinness

When migrating an always-injected `CLAUDE.local.md` dossier into the OKF `memory/` tree (progressive disclosure), the risk is NOT that reduction fails — it's that a distillation pass silently DROPS an active chain while reducing.

Two concrete findings from the 2026-08-18 slang-triager migration:

1. **Cross-check every dossier `## heading` issue-number against the produced chains pages.** One ACTIVE/HANDED-OFF chain (#12475, test-server stdin redirect) was dropped from `chains/awaiting-external.md` even though its 15KB `triage-12475.md` memo survived — the live chain-state pointer (verdict cmt id, "PR must NOT write Fixes #12418", resume condition) was gone. `grep -oE '^## .*#[0-9]+'` the dossier, `comm -23` against `grep`-of-chains-pages, restore any diff. Detail sitting in a deep memo is not the same as a reachable live pointer.

2. **`okf_synth.py finalize` measures the WHOLE `memory/` tree, not `CLAUDE.local.md`** (which lives at the group ROOT, outside `memory/`). So after a successful dossier migration, finalize can still ESCALATE ("backlog not shrinking") purely because of pre-existing large legacy `triage-*.md` memos — an out-of-scope corpus. The migration's real success metric is the always-loaded surface: `memory/index.md` + `memory/system/definition.md` each well under the 16000-char budget, and `CLAUDE.local.md` reduced to a thin pointer. Don't chase the finalize exit code by folding hundreds of on-demand memos that don't cost per-turn.

3. The archive's ACTIVE/PENDING headings often all map to already-terminal chains (parked/merged) — but the archive can still hold durable NON-terminal STANDING directives (read-only Explore recall subagents; refresh-upstream-before-analysis; re-run session-start capability probes) that belong in a lesson page, not lost. Extract those; leave the terminal chains behind.
