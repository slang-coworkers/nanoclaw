---
type: project
name: project_14031_metal_64bit_atomics_atomic_ulong
description: "slang#14031 (albertrodriguezclo, external, 10-29): Metal 64-bit Interlocked*/Atomic<uint64_t> emitted atomic_fetch_*_explicit on atomic_ulong (invalid MSL). FIXED in draft PR #14044 @f800a8e21 (R1 APPROVE_WITH_NITS; shepherd jhelferty-nv); chain closed 20:07Z, draft-vs-ready asked of the operator; capability atom open for maintainers. Same child-tier misroute to Main as #14016."
---

# slang#14031: Metal 64-bit atomics emit fetching calls on `atomic_ulong`

**Routing (10-29).** `issue_opened` 16:18Z landed in Main `sess-1793290707250-do0n10`. No prior chain, so I
forwarded it to slang-triager on `gh-issue-shader-slang/slang-14031`. Triager session `sess-1793290828576-qp3g1j`.

**Triage (msg 16, 16:31Z).** bug / medium / Metal emit / P2. Reproduced at 9b3ac252d. The same silent invalid
MSL also appears for `int64_t` (`atomic_long`), groupshared (threadgroup) destinations and `RWTexture2D<uint64_t>`.
MSL 4.1 §6.16.4.6: `atomic_ulong` has only void `atomic_{min,max}_explicit`, on device memory, relaxed order,
Metal 2.4+. Recommended approach A: a width-aware Metal emitter. Comment 6502444331, label `reproduced`.
Memo: `/workspace/inbox/a2a-1793291506214-4wv2yy/triage-14031.md`. The triager handed off directly to the fixer.
Fixer session `sess-1793291446093-uqb9b4`, on the triager↔fixer a2a mg.

**16:43Z reporter comment 6502737605 (no @-mention).** Apple M4 hardware check: only the void min/max work.
Fetching min/max, add, CAS, exchange, and load/store on `atomic_ulong` all fail, and the header gates this on
`__HAVE_ATOMIC_ULONG_MIN_MAX__`. I forwarded it verbatim to the fixer, pinned to uqb9b4 with in_reply_to set to
my webhook row (it landed as seq 6). I flagged load/store for the diagnose set; the fixer covered it.

**PR #14044** (`fix/issue-14031`, draft, pr-mappings → uqb9b4). R1 slang-reviewer: APPROVE_WITH_NITS, 0 bugs.
Gaps: L-G1 — "unused" depends on the optimization level; the 3-arg form gets E55204 under
`-g -minimum-slang-optimization`, now pinned by a test. A-G1 — the docs example. Review:
`/workspace/inbox/a2a-1793303459293-d1fhy4/combined-review-14044-r1.md`. A copy of the review came to Main,
and the fixer had it too.

**20:05Z [Fix Report] (fixer msg 40 → Main, misrouted).** Main-verified at 20:07Z: head f800a8e21, 7 commits, 8
files, +313/−4, `pr: non-breaking`, assignee and reviewer jhelferty-nv. CI run 40945200884: 2 passed, 44 skipped
(the draft gate; the full CI has not run). The draft is the correct terminal state. I forwarded the report verbatim
to the triager (msg 45, in_reply_to 16; landed as seq 10). The operator got a heads-up (dashboard msg 43).

**Open / resume on:**
- The triager's [Triage Resolution]. After it, send the operator the chain report with the draft-vs-ready question, as for #14016.
- jhelferty-nv's review.
- Maintainers' call on a capability atom (IR2 partial).
- The misroute pattern (see #14016).

**20:07Z [Triage Resolution] (triager msg 46): FIXED in draft #14044 @f800a8e, held for jhelferty-nv.**
Main-verified the issue status comment 6505575040 (nv-slang-bot, edited 20:07Z). Our side of the chain is closed.
I sent the operator the chain report (dashboard, 20:08Z) with a non-blocking draft-vs-ready question; no flip until
the operator answers. Resume on: the operator's answer, a jhelferty-nv review (webhook → fixer uqb9b4), or the
maintainers' capability-atom call.
