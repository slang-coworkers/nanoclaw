---
type: chain
title: slang#13733 — WGSL loops put the increment in the body, so Tint robustness blocks unrolling
description: "albertrodriguezclo, human-filed 10-17. Follow-on to #13066/PR #13071. Triaged P2 enhancement, parked on a maintainer (jkwak-work) choice of emission shape. No fixer handoff."
---

# slang#13733

**2026-10-17 14:54Z, `issue_opened`.** Live read before dispatching: OPEN, 0 comments, no labels, human-filed
by albertrodriguezclo (same reporter as slangpy#1232 / slang#13713). Related #13066 closed 09-28 by PR #13071
(BarthPaleologue, merged 09-28T20:55Z). Dispatched to `slang-triager` on `gh-issue-shader-slang/slang-13733`.
15:05Z: the reporter commented with the Tint tracker https://issues.chromium.org/issues/574559077, and I relayed it to the triager.

**15:42Z, triaged** ([cmt 6235943785](https://github.com/shader-slang/slang/issues/13733#issuecomment-6235943785),
checked live: nv-slang-bot, label `reproduced`, Type=Feature, no assignee; memo
`/workspace/inbox/a2a-1792251774388-c62tc2/triage-13733.md`). Enhancement / medium / P2 / WGSL emit + IR restructure.
The triager reports the following (not re-run by me):
- Reproduced on master 60a7c8c88. The shape comes from #13071. It is not a regression: 2026.13.1 `for(;;)` gets the same Tint counter. Dawn/Vulkan on the L40S shows the counter. The D3D12/DXC numbers were not reproduced.
- Tint LoopAnalysis finds the index only in a WGSL `for` initializer, so `loop{…continuing{inc}}` alone does **not** avoid the counter.
  The only Slang-side shape that works today is `for (var p = init; ; p = p ± 1) { body }` (hand-edited repro confirmed).
- Options: A = WGSL counted-`for` (recommended), B = general `continuing` (not enough on its own), C = the Tint fix.
  For `[unroll]`: D = warn (recommended, W56005 precedent), E = best-effort unroll (changes semantics; E40020).
- Files: `slang-ir-restructure.cpp:397-529`, `slang-emit-c-like.cpp:3854-3880`, `slang-emit-wgsl.h:36`.
- The triager asked the reporter whether they plan to send a PR (they did for #13660/#13645/#13648).

**Side note, checked structurally by me @60a7c8c88c:** `slang-ir-restructure.cpp:321-323` reads the prior
block→region mapping into a *local* `nextSimpleRegionForSameBlock` and never stores it in the field
(`slang-ir-restructure.h:104`). No other writer exists (`git grep` finds 4 hits), so the chain walked at
`slang-ir-restructure-scoping.cpp:389` is always one entry long. Whether this changes behaviour is unverified.
Unfiled: the operator decides.

**Parked on:** maintainer pick (A/B/C, D/E) by @jkwak-work, or a reporter PR. **Timer:** one-shot `recheck-13733-15e7`
(triager group) 10-24 15:00Z. **Resumes on:** a human comment on #13733, a reporter PR, or the recheck firing.

**2026-10-19 20:07Z, the reporter followed up** ([cmt 6276225025](https://github.com/shader-slang/slang/issues/13733#issuecomment-6276225025),
no @nv-slang-bot mention): their PR **#13740** (`fix/wgsl-counted-loop-for`, opened 10-17 18:24Z, not a draft,
5 files / +867, refs #13733 with no closing keyword) implements option A. Checked live 20:1xZ: CI 7/7 SUCCESS, review requested from
dshreiner-nv, no labels, prod bot + coderabbit have commented. No pr-mapping, so #13740 webhooks reach Main. Ask 2 (`[unroll]`/D):
the reporter is not doing it, and `[ForceUnroll]` covers their case. The issue is still assigned to jkwak-work. Relayed to the
triager owner session `sess-1792249248034-ytplg9` on the canonical thread. **Now parked on:** maintainer review of #13740; Ask 2 has no owner.

**20:11Z, triager [Report]:** `recheck-13733-15e7` was retargeted to watch #13740's review/merge state and Ask 2. The triager posted a delta
([cmt 6276292805](https://github.com/shader-slang/slang/issues/13733#issuecomment-6276292805)) asking @jkwak-work to decide Ask 2:
D (warn), E (unroll), or close the issue when #13740 merges. #13740 has no closing keyword, so the issue stays open after the merge. If jkwak-work
picks D and nobody claims it, the recheck sends an Ask-2-only handoff to slang-fixer.

**2026-10-24 15:02Z, recheck `recheck-13733-15e7` fired. Triager [Report]: no change that needs action, nothing posted.** I checked it live at 15:0xZ and it matches.
#13740 is OPEN and BEHIND, head still d266ea6, last update 10-17T19:25Z. It has 0 human reviews (only the bots and the author's own threads), and the dshreiner-nv request
is still pending. #13733 is assigned to jkwak-work; its last comment is our 10-19 delta. The triager also reports these, which I did not re-check: on 10-22, jkwak-work changed the Type from Feature to Performance,
and sibling PR #13781 merged. Neither affects Ask 1 or Ask 2. **Still parked on:** a human review of #13740, plus jkwak-work's D/E choice for Ask 2. **Timer:** a one-shot triager recheck
`t-879c7d`, set for 10-31 15:00Z (per the triager; from Main I cannot see it in the triager's group). I did not nudge the reviewers on the reporter's PR. A 7-day wait for a first review is not a reason for the bot to ping;
the operator can raise it if needed.

**2026-10-31 15:09Z, recheck `t-879c7d` fired. Triager [Report]: parked, nothing posted.** I checked it live at 15:1xZ and it matches. #13740 is OPEN, BLOCKED and not a draft, head
13a739b6e3 (jkwak-work rebased it 10-27). It is labeled `pr: non-breaking` and is 37 behind / 3 ahead of master. The review request moved from dshreiner-nv to **jkwak-work** on 10-28 (per the triager; the live
request list is `[jkwak-work]`). It still has 0 human reviews (only github-actions and the author's thread replies). On #13733 the last comment is still our 10-19 delta, and there is no D/E pick for Ask 2. The triager also reports that the Chromium bug 574559077
is unchanged (New/P2, unassigned); I did not re-check that. **Escalated to the operator (dashboard):** at 14 days a human should ask jkwak-work to review. The bot does not nudge the reporter's PR. **Timer:** the triager's
one-shot `t-b53ffe`, 11-07 15:00Z (I cannot see it from Main).

**2026-11-07 15:02Z, recheck `t-b53ffe` fired. Triager [Report]: no change, nothing posted, no further re-check scheduled.** I checked it live at 15:0xZ and it matches.
#13740 is OPEN, not a draft, head 13a739b6e3, CI green, **85 behind** / 3 ahead of master, last update 10-28. The review request is `[jkwak-work]`; the PR assignees are jkwak-work
and albertrodriguezclo. There are still 0 human reviews (21 days). #13733's last comment is still our 10-19 delta, and Ask 2 has no D/E pick. **Escalated to the dashboard a 2nd and
final time** (row 511796): a human should nudge jkwak-work or pick another WGSL reviewer. The bot does not ping the reporter's PR. **Parked webhook-only, no timer:** the
`supervisor-state.json` operator_decisions entry is marked FINAL, so do not re-ask. **Resumes on:** a #13740 review/merge webhook, a human comment on #13733, or an operator reply.
