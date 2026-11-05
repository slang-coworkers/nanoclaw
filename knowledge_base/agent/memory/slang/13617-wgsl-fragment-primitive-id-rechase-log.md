---
type: log
description: Dated re-chase log for slang#13617 / draft PR #13619 (10-15 → 11-04, all case d, no human activity since the 10-14 milestone). Append new re-chase entries here; current state lives in the chain record.
---

# slang#13617 chain — re-chase log

Chain record and current state: [[slang/13617-wgsl-fragment-primitive-id.md]]. All entries were checked live. Every
re-chase below found the same baseline: #13619 an open draft @ b5340af7ab with 0 reviews and 0 inline comments; no runs
on `fix/issue-13617` or `-ci`; no human comments, reviews or timeline events on #13617/#13619 after the 10-14 17:08Z
milestone; both operator decisions unanswered (bounded `--reverse` / `--since-seq` dashboard reads, no gaps; the Main
canonical session `sess-1791952546270-bc3zew` last active 10-14 10:26Z); no GitHub posts. Only differences are listed.

- **10-14 20:43Z (not a re-chase):** #13622 became maintainer-owned (jhelferty-nv → tangent-vector, Q1 2027).
  tangent-vector's design notes (cmt 6178020266): fix it in the front end by checking global varyings and entry-point
  params as one list; make mixing both forms an error, warn on global `SV_` varyings, diagnose global varyings outside
  GLSL mode. #13619's legalizer `checkSystemValueUse` global-`in` check is a backend backstop this would likely
  supersede. Flagged to the operator only; no action unless a maintainer raises it on #13619.
- **10-15 10:31Z:** first re-chase. One human event: jkwak-work milestoned #13617 "Q4 2026 (Fall)" at 10-14 17:08Z (no
  comment). CI dispatch 38546790314 still `waiting` at the priority gate. Re-asked both operator decisions **once**
  (dashboard msg 5); never re-ask again, list as pending. Re-arm `-3ec6` (10-17).
- **10-17 10:33Z:** listed as pending, not re-asked (msg 21). Re-arm `-316c` (10-19).
- **10-19 10:3xZ:** CI dispatch 38546790314 now 404s, probably expired at the priority gate; harmless, the full matrix
  runs at ready. Pending (msg 7). Re-arm `-320f` (10-21).
- **10-21 10:3xZ:** pending (msg 9). Re-arm `-73cf` (10-23).
- **10-23 10:3xZ:** pending (msg 9). Re-arm `-6dc8` (10-25).
- **10-25 10:3xZ:** bot event: the triager's comment on new human-filed
  [#13932](https://github.com/shader-slang/slang/issues/13932) (albertrodriguezclo, opt-in Chromium experimental WGSL
  extensions, parked on maintainer direction) cites #13619 as the legalizer hook system-value `enable`s need. Separate
  chain, no action. Pending (msg 15). Re-arm `-6543` (10-27).
- **10-27 10:3xZ:** pending (msg 11). Re-arm `-59fe` (10-29).
- **10-29 10:3xZ:** pending (msg 7). Re-arm `-af77` (10-31).
- **10-31 10:3xZ:** bot event: docs follow-up [#14130](https://github.com/shader-slang/slang/issues/14130) (WGSL guide
  `SV_ClipDistance` row stale after #14097; nightly-fixtures #13887 chain, no fixer) cross-referenced #13619. Both edit
  the `a2-03-wgsl-target-specific.md` table, so one may need a trivial rebase. Separate chain, no action. Pending
  (msg 9). Re-arm `-600a` (11-02).
- **11-02 10:3xZ:** pending (msg 9). Re-arm `-e6ef` (11-04).
- **11-04 10:3xZ:** policy change: since 11-03
  ([undraft-asks-replaced-by-weekly-list](../orchestrator/undraft-asks-replaced-by-weekly-list.md)) decision (1),
  `gh pr ready` on #13619, is "ready-flip pending" on the weekly list; never ask per-PR. Pending (msg 7). Re-arm
  `rechase-13617-primitive-0dd5` (2026-11-06T10:30Z).
