---
type: chain
title: slang#13770 — GCC -Wstringop-overflow warning in unit-test-string.cpp (List<long>::reserve memcpy)
description: "Human-filed (spate) 2026-10-20 build-warning issue: GCC flags List<T>::reserve's move loop as a 1024-byte memcpy into a 256-byte malloc when inlined into _string_impl (unit-test-string.cpp:285). Routed to slang-triager."
---

# slang#13770

- Filed 2026-10-20 13:10:22Z by spate (author_association NONE). RelWithDebInfo build of `slang-unit-test`:
  `slang-list.h:387` (`new (newBuffer + i) T(...)` in `List<long>::reserve`, via `_maybeReserveForAdd` → `add`) inlined into
  `_string_impl` at `tools/slang-unit-test/unit-test-string.cpp:285` gets `-Wstringop-overflow=` "writing 1024 bytes into a
  region of size 256". Likely a GCC false positive from inlining, but the triager decides.
- 13:1xZ live read clean: OPEN, 0 comments, no labels/assignee, empty timeline, no duplicate by search. The only session on
  the thread was my own webhook session. Dispatched to slang-triager on `gh-issue-shader-slang/slang-13770`: reproduce with
  GCC, decide real overflow vs false positive, name the narrowest principled fix. No fixer until the triage is back.
- 13:30Z triage back (the triager's finding, not re-run by me): **GCC ≥14 false positive**, P3, low. Warns on GCC 14.1–16.2 (x86) and aarch64 14.1;
  clean on 11.4/12.2/13.4. Triggered by #13217's two tail `add(min/max)` calls. No CI job sees it today: per-PR and merge-queue
  CI use 11.4/13.3 without -Werror; the weekly cmake-options job will break when a runner moves to GCC 14. Recommended A:
  `SLANG_ASSERT(m_count <= m_capacity)` in `reserve`'s growth branch (`slang-list.h:372`), following merged PR #13754 (weekly
  CMake Options GCC 13 fix). I verified on GitHub: cmt 6292020956, `reproduced` label, Type=Bug. No fixer session existed.
  13:3xZ GO sent to the triager to hand off to slang-fixer with option A (Main doesn't dispatch the fixer, ANCHOR H).
- 13:34Z handoff checked: one slang-fixer session `sess-1792503242394-zrf6p7` on the triager's edge (`epsn3s`), and
  cmt 6292020956 edited in place 13:34:29Z ("handed to slang-fixer"). The triager reports the release cost is zero: `SLANG_ASSERT` is
  gated on `_DEBUG` and becomes `SLANG_ASSUME` in release (`slang-common.h:363`). CE tools are in `/workspace/agent/r13770-tools/`. Next:
  the draft PR report on the thread. Correction: in my GO I wrote the label as `reserve`; it is `reproduced`.
- 13:42Z, the fixer's finding relayed by the triager (I have not re-run it): option A is clean on Compiler Explorer. 15 of 19 GCC configs warned before the fix and 0 after; 11.4 and 13.x are clean both ways. A local Debug and RelWithDebInfo slang-unit-test build is running (~25 min). Still no draft PR.
- 15:34Z **draft PR #13782** (`fix/issue-13770`, head `dc4502c`, bot-authored, `pr: non-breaking`). I checked on GitHub: 1 file
  `source/core/slang-list.h` +6/−0, draft, `Fixes #13770`, pr-mapping → fixer sess `zrf6p7`, issue cmt 6294652264 (status). Description
  uses the repo hook's 4-section format (Summary/Root cause/Tests/Risk), as in #13571. These figures are the fixer's: CE 14/19 configs
  warned before and 0 after (its progress message said 15/19); 648/648 unit tests pass in Debug and RelWithDebInfo (GCC 12). Still to come:
  the fixer's peer review, then a [Fix Report] and the triager's [Triage Resolution]. Draft→ready is the operator's call.
- 15:42Z count reconciled (the fixer's finding, relayed by the triager): **14/19 is correct**, the 15 was a hand-tally error. Warned:
  x86-64 14.1–16.2 (9 at -O2, 4 at -O3) and arm64 14.1 at -O2. Clean: x86-64 11.4/13.1/13.3/13.4 and arm64 13.3. The PR body and
  cmt 6294652264 were edited in place to narrow the coverage wording. Head is still `dc4502c`, still a draft. A [Fix Review Request] is with slang-reviewer.
- 16:38Z **[Triage Resolution]: fixed, PARKED on maintainer.** I checked on GitHub: #13782 is a draft at `fe80524` (commits 07f4a40 → dc4502c →
  fe80524, the last one comment-only), +5/−0 in 1 file, jkwak-work assigned and review-requested, 0 GitHub reviews. CI run 39458548937 is `waiting`
  at the `wait-for-human-priority` gate. Internal slang-reviewer: APPROVE_WITH_NITS, 0 bugs. Explain cmt 6294631490; issue cmt 6294652264
  (edited 16:36:58Z) has the final state. The fixer's `/code-review` raised 6 pre-existing `List` issues, out of scope and unfiled: a leak in
  reserve when cap==0 but the buffer is non-null; a UAF on a self-aliasing add during growth; growToCount's `(unsigned int)` truncation; removeRange
  accepting a negative count; no reserve(<0) guard; insertRange's duplicated grow logic. Whether to file them is the operator's call. Open operator
  decisions: CI priority, draft→ready, and filing the List follow-ups. No timer: webhooks deliver the review and CI events, and
  supervisor-state.json lists the chain as parked.
