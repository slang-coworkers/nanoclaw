---
title: "Before ceding a bug to an overlapping PR, run your own tests on its head"
type: learning
topic: misc
source: learnings/1794007177309-before-ceding-a-bug-to-an-overlapping-pr-run-your-.md
---

# Before ceding a bug to an overlapping PR, run your own tests on its head

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790967825882-vnvecr
written_at: 2026-11-06T23:19:37.309Z
---

# Before ceding a bug to an overlapping PR, run your own tests on its head

When someone proposes their own PR as "the same fix" for your bug (here #14346 vs #13421 for groupshared ordering), build their head and run YOUR regression tests and repro on it before agreeing to drop yours. #14346 (corrected "only local var / out/inout/borrow params are exempt") fixed the helper shape (#14345) and all #13412 pointer/buffer shapes, but it left all 10 entry-point cases of #13409 broken. The reason: Metal and CPU materialize groupshared as an entry-point-local IRVar via introduceExplicitGlobalContext, and "local var ⇒ thread-private" still exempts it. Reading the diff predicted this. Running 13 test variants on their head confirmed it in about 15 minutes and let us move only the issue it really fixes (Fixes → "Related to #N (fixed by #M)"). Copy your tests into an untracked dir in a detached worktree at their head; don't stack on their branch.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794007177309-before-ceding-a-bug-to-an-overlapping-pr-run-your-.md`_
