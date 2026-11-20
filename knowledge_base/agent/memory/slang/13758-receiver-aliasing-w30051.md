---
type: project
title: "slang#13758 — W30051 misses an argument aliasing the receiver of a mutating method call"
description: "Maintainer-filed (jhelferty-nv 10-20) Diagnostics issue; fix chain = bot DRAFT PR #14533 'Warn when an argument aliases the receiver of a mutating method' (branch fix/issue-13758). Explanation comment verified on GitHub 11-17 08:23Z at head b0d4837."
---

**Issue.** [slang#13758](https://github.com/shader-slang/slang/issues/13758) — filed by maintainer
jhelferty-nv 2026-10-20 02:06Z, `W30051 does not detect an argument that aliases the receiver of a
method call`. Labels `Diagnostics`, `Office-Tess`, `reproduced`; assignee jhelferty-nv. OPEN.

**Fix chain.** DRAFT PR
[#14533](https://github.com/shader-slang/slang/pull/14533) — "Warn when an argument aliases the
receiver of a mutating method", branch `fix/issue-13758`, author nv-slang-bot. No dispatch history in
this group's memory before 11-17 (likely a sibling Main session's chain — check active Main sessions
before re-dispatching anything here).

**2026-11-17 08:24Z, fixer report (msg 10) — verified by Main against live GitHub.**
- PR OPEN, DRAFT, head `b0d483701942` (b0d4837).
- Explanation comment posted by nv-slang-bot[bot] 08:23:34Z, id 6942727185, marker
  `explain-diff-html:comment shader-slang/slang#14533 head=b0d483701942` — head matches PR head exactly.
  Content: `out`/`inout`/`__borrow` value semantics vs reference implementation, W30051 mode rules
  post-#13406, receiver-aliasing detection. HTML artifact:
  `/workspace/inbox/a2a-1794903878776-2n94st/2026-11-17-shader-slang-slang-pr14533-receiver-aliasing.html`.
- CI at this head: draft-skip (checks SKIPPED except board-sync SUCCESS) — expected while draft.

**State.** Ready-flip pending (maintainer flips drafts; weekly list, no per-PR ask). Resume on: PR
webhook (fixer session owns it), reviewer report, or maintainer activity.

**2026-11-17 08:41Z interim [Report] (msg 12) — verified by Main.** Fixer says all critique stages
approved and a [Fix Review Request] went to slang-reviewer; [Fix Report] follows the verdict.
Verified: slang-reviewer session `sess-1794904861377-tasfr5` active/running on the canonical thread
since 08:41 (same minute as the report) — dispatch real, not just claimed. Fixer session
`sess-1794891960491-1yts8k` (since 05:06), triager session `sess-1794891267122-0ekcm8` (since
04:54) also live on the thread. The artifact path the fixer named
(`/workspace/agent/reports/pr-explanations/…`) is the fixer's own group workspace; my copy is the
inbox delivery (above). Awaiting: reviewer verdict → Fix Report.

**2026-11-17 10:51Z interim [Report] (msg 18) — verified by Main.** Peer review R1 was
REQUEST_CHANGES (1 bug, 8 gaps), fully applied at new head `9fafdf7776cb` (PR head verified
9fafdf7776cb3f16ced04d236eca7be2c0b6bd70). The bug was a property-prefix false positive, fixed via
contained-storage-only extension steps; a revert drill showed the reviewer's suggested deref guard
was dead code and it was removed (fixer claim — internal pipeline). Round-2 [Fix Review Request] is
with slang-reviewer (session `sess-1794904861377-tasfr5` re-woken 10:50, running); round 2 is the
last per the two-round limit. Tests/diagnostics 1083/1083 (fixer claim); CI green-pending. The
explanation comment (6942727185) was rewritten in place for the new head — verified: updated
10:50:29Z, marker `head=9fafdf7776cb`. Awaiting: round-2 verdict → [Fix Report].

**2026-11-17 11:51Z near-final [Report] (msg 22) — verified by Main.** Round-2 peer verdict was
APPROVE_WITH_NITS; all nits applied at new head `a954962f3` (PR head verified
a954962f3b8ea3584a815e9012cfec00357146c7). Applied changes per the fixer: CastToSuperTypeExpr peel
for inherited-method receivers, diagnostic tails "passing overlapping storage to both", W30134
summary reworded, check renamed `_checkPotentiallyAliasedArguments`, user-guide trigger corrected,
tests extended to 278 lines (vector/matrix positives, swizzle/buffer/deref negatives). 3/3 alias
tests + 1083/1083 diagnostics (fixer claims). Review converged, no unresolved findings; no code
work outstanding.

**BLOCKED on codex-bridge HTTP 429 (per-IP rate limit; ~50 min across repeated attempts).** The
explanation-comment upsert for head a954962f3 (comment verified still at 9fafdf7776cb — consistent
with the fixer's report) and the final [Fix Report] are gated on the fixer's codex critique stages.
**Wake path (12:03Z msg 26, verified): fixer scheduled one-shot task `finish-13758-deliveries-f367`
(session `sess-1794917023295-w35ykg`, 13:30Z) to retry; it reschedules +90 min if still limited.**
Code work complete; no review findings open. Ready-flip pending after the Fix Report lands.

**2026-11-17 14:00Z TERMINAL [Fix Report] (msg 2) — verified by Main.** All codex stages cleared;
final deliveries landed. Verified live: PR #14533 OPEN/DRAFT, head `a954962f3` (matches report),
label `pr: non-breaking`; explanation comment 6942727185 rewritten in place 14:00:01Z at
`head=a954962f3b8e` (matches PR head). Issue #13758 still OPEN. Fixer claims (internal pipeline,
consistent throughout): repro fails at 6131ea996 pre-fix; peer round-2 APPROVE_WITH_NITS with all
nits applied at head; tests 3/3 alias + 1083/1083 diagnostics; PR CI yielded to human-priority
(no failed job).

**State: Terminal — parked on maintainer review.** Draft PR held for human review; ready-flip
pending (weekly list, no per-PR ask). No open review findings, no code work outstanding. Resume
path: PR webhook (fixer session `sess-1794891960491-1yts8k` owns the mapping) on maintainer
review/flip/merge; `/supervise-issues` walks it as a parked chain if it goes quiet.

Related: [#13964](13964-hlsl-default-inout-receiver-immutable.md) (receiver-mutability concept,
shared W30051/receiver machinery).
