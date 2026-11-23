---
type: project
title: "slang#14645 — internal error storing to one component of an RWTexture2D texel at a runtime index"
description: "Human issue (pdeayton-nv): ICE storing to a single component of an RWTexture2D texel at a runtime index. TERMINAL 11-20: PR #14650 MERGED by jkwak-work @ 6c984fe14 (08:22:17Z) after pdeayton-nv's approval; issue auto-closed via Fixes. Full lifecycle: triage → 5-commit fix (repro, fix, bot-nit round, maintainer thread asks, structural padding test) → 3-reviewer APPROVE_WITH_NITS applied → maintainer approval → merge. Nothing owed."
---

**Issue #14645** (pdeayton-nv, human, open): "Internal error when storing to one component of an
RWTexture2D texel at a runtime index."

**Chain provenance note:** pre-dates my records — earlier history on GitHub + fixer group (bot PR
#14650, `pr: non-breaking`, references #14645; four maintainer comment rounds through 11-20 morning).

**2026-11-20 04:49Z fixer [Report] — maintainer APPROVED (Main-verified live).** pdeayton-nv's
review **5987637877 APPROVED at 04:48:05Z** after resolving every review thread incl. the structural
padding test — all four maintainer asks accepted; no reply owed on the empty approval. Head
**`6c984fe14`** (Main-checked: PR #14650 head matches, open, non-draft). CI on that head: 0 failures,
11 checks pending. **Next:** when CI settles green, merge `origin/master` into `fix/issue-14645`
(branch BEHIND; merge NOT rebase per repo convention), push, explanation comment follows the new
head. Human merge decision stays with maintainers — the fixer never merges or flips drafts.
**Blocker: none — waiting on CI.**

Resume on: CI-settled webhook → fixer's master-merge report; maintainer merge activity.

**11-20 08:22Z — TERMINAL (Main-verified: PR #14650 merged by jkwak-work at `6c984fe14`,
08:22:17Z; issue #14645 CLOSED via `Fixes`).** Chain complete end-to-end: triage → 5-commit fix
(failing repro → fix → bot-nit round → maintainer thread asks → structural padding test) →
3-reviewer APPROVE_WITH_NITS applied → maintainer threads resolved → pdeayton-nv approval
(5987637877) → jkwak-work merge. CI priority-yield classification was infra (push-run green,
0 failures); no open threads, no unanswered pings. Fixer cleaned up worktree
(wt-slang-14645), sentinel, repro dir; fix-14645.md marked MERGED. Process learnings shared
(critique-gate delivery recipe). **Nothing owed from any party; chain closed.**
