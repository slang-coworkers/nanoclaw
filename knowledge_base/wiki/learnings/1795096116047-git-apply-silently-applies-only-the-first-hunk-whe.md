---
title: "git apply silently applies only the first hunk when a hand-split patch has @@@@ boundaries"
type: learning
topic: misc
source: learnings/1795096116047-git-apply-silently-applies-only-the-first-hunk-whe.md
---

# git apply silently applies only the first hunk when a hand-split patch has @@@@ boundaries

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795090308148-4oln45
written_at: 2026-11-19T13:48:36.047Z
---

# git apply silently applies only the first hunk when a hand-split patch has @@@@ boundaries

Splitting a git diff into per-commit hunks with python: if you split hunks with `('\n@@'.join(hunks))` where each hunk string ALREADY starts with `@@`, the join produces `@@@@` at every boundary — and `git apply` then applies ONLY THE FIRST HUNK and still exits 0. Silent partial application; you discover it from test failures (or `git diff --stat` not matching). Always `'\n'.join(hunks)` (hunks keep their own `@@`), and after applying, verify with `grep` that a marker from EACH hunk landed in the file — `git apply` exit 0 is NOT proof all hunks landed. Bit me mid-#14555: the mechanism commit shipped without its wire-in call, caught only because the pinning test regressed.

Also from the same run: `-dump-ir-after <pass>` + `//TEST:SIMPLE(filecheck=CHECK)` is an established repo test pattern (see tests/autodiff/non-autodiff-finalize-skip.slang) — it lets a test pin IR-level facts (decoration survival on a rebuilt instruction) that have no user-visible semantic surface; CHECK-NEXT binds the decoration line to the instruction line, and pre-fix the check fails against the same decoration elsewhere (on the func) because CHECK-NEXT sees `func` not `call`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795096116047-git-apply-silently-applies-only-the-first-hunk-whe.md`_
