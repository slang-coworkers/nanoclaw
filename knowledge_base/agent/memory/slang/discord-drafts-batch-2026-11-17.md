---
type: chain
title: Discord drafts filing batch 2026-11-17 — h7per P0 + 5 verified drafts, staged, blocked on triager GitHub connection
description: Maintainer handoff (draft texts + fresh 11-17 dedup) → slang-triager batch (thread discord-drafts-filing-batch-2026-11-17, session sess-1794903839409-fdpma9); all six verified PASS on master 818012112; filing staged, auto-retry every 20 min; issues filed from this batch are OUR filings — do not dispatch a fresh triage on their issue_opened webhooks.
tags: [discord, filings, h7per, batch, parked-operator, github-credential]
---

# Discord drafts filing batch — 2026-11-17

**Source.** Slang Maintainer daily-report asks (since 11-01; h7per ~503h); draft texts finally delivered 11-17
08:22Z via the reply edge (my earlier plain-text replies had never reached it — see system/hazards.md).
Handoff file: `reports/discord-drafts/draft-handoff-2026-11-17.md` (verbatim drafts 08, 11–17).

**Dispatch.** slang-triager, thread `discord-drafts-filing-batch-2026-11-17`, session
`sess-1794903839409-fdpma9` (11-17 08:23Z). Checklist: master-verify each, file 08/11/12/14/15/16,
paste draft-13 comment on #6947, skip 17 (stub).

**Verification (triager's findings, 11-17 08:42Z) — all six PASS on master v2026.22-25-g818012112:**
- **08 h7per** (P0 cand): SPIR-V still the #12256 pattern (untyped Uniform pointer → OpUntypedAccessChainKHR →
  OpLoad %mat4v4float; cite now slang-ir-spirv-legalize.cpp:1303); GPU run not re-run (no Vulkan harness in that
  workspace — recorded L40S evidence stands per checklist fallback).
- **11 conjunction ICE**: E99997 inline, where-form compiles; NEW NUANCE: a partial split also aborts; cite
  slang-lower-to-ir.cpp:10629.
- **12 uniformity**: both cases silent, control E41201; cites slang-ir-uniformity.cpp:269/:429 confirmed.
- **14 expand-pack segfault**: SIGSEGV 139, -no-codegen exit 0; visitEachExpr :6061.
- **15 Conditional docs**: user-guide section unchanged (docs/user-guide/03-convenience-features.md:513).
- **16 mul hint**: E39999 reproduced; no "did you mean" outside undefined-identifier (slang-diagnostics.lua:1420).

**Prepared artifacts.** Triager side: `memory/issues/filing-batch-2026-11-17.md` (its state page) +
`reports/filing-batch-2026-11-17/` (titles/bodies/comment; disclaimers appended, @-mentions stripped,
Labels→arrays, Issue Types Bug 08/11/12/14, Feature 15/16).

**Blocker (operator).** Triager OneCLI GitHub connection 401 app_not_connected (dashboard rows 513546 + this
batch's decision card carry the reconnect URL, agent_name=slang-triager). Auto-retry task
`filing-batch-github-retry-2026-11-17` (triager-side, script-gated every 20 min, zero-token while blocked) files
everything the moment the connection is live, with a light dedup re-check first.

**⇒ When the six issues appear as issue_opened webhooks: they are OUR OWN filings from this batch — do NOT
dispatch a fresh triage chain.** Expected titles: heap-mode `ConstantBuffer` matrix reads wrong/device-lost
(h7per); inline conjunction constraint E99997; `-validate-uniformity` atomics/seed-drop; `expand IThing<each U>`
method-call segfault; Conditional docs request; matrix*vector `mul()` hint request. Draft 13 = comment on
existing #6947 (not a new issue). Draft 17 unfiled (stub).

**Filed 11-17 11:38Z (all confirmed live, verified via GitHub API):**
- 08 → **#14541** (h7per P0 cand, labels regression/reproduced/SPIR-V/Vulkan)
- 11 → **#14542** (inline conjunction E99997)
- 12 → **#14543** (uniformity atomics + seed-drop)
- 14 → **#14544** (expand-pack method-call segfault)
- 15 → **#14545** (Conditional docs request)
- 16 → **#14546** (mul() hint request)
- Draft 13 comment posted on #6947 (comment id 6946962020, 11:38:35Z).

**After filing (done 11-17):** numbers recorded here; reported to the maintainer via the reply edge
(in_reply_to 1862) so it can clear its watch-list entries. Per-issue fixer handoff remains a separate
reported decision per the filing policy (h7per 08 / #14541 is the P0-cand the maintainers should see first).

**Post-filing deviation (11-17 11:42–11:43Z, Orchestrator sess-1794915501093-c4kyqn):** despite the rule
above, sibling Main sessions minted fresh per-issue triage sessions on **#14542** (sess-1794915746560-l0sh63),
**#14545** (sess-1794915647405-zk0s5j) and **#14546** (sess-1794915597488-5o6ju8), each with
`<github-post-authorized />`. Pinned stand-downs were sent to all three and delivery verified (seq 4 in
each, 11:43Z): no triage comments, no fixer dispatch. #14541/#14543/#14544 were handled correctly (no
dispatch). **Resolved 12:15Z:** all three triager chains complied and closed — triage comments deleted
(#14545 id 6947072646; #14546's), the #14545 fixer chain (sess-1794915826524-4mgg5z) aborted with zero
GitHub writes at any point, #14546's mis-added `reproduced` label removed, and the two misroute 👀 reactions
(#14542, #14545, bot-authored) deleted — all six issues verified back at as-filed state (0 comments, 0
reactions, filed labels). No fixer handoffs occurred; per-issue fixer handoff remains the separate reported
decision per the filing policy.

**#14545 remediation complete (11-17 11:45Z, chain owner sess-1794915501230-k7tmvm):** its triage finished
*before* the stand-down landed (dispatch 11:40Z, memo 11:43Z): triage comment 6947072646 was posted
("handed to our fixer, a draft PR will follow") and a slang-fixer session
(`sess-1794915826524-4mgg5z`) was minted on the canonical thread. The triager then executed the
stand-down in full: comment **deleted** (verified gone — 0 comments on the issue), fixer stood down
(no ack yet, but no GitHub writes, no branch, no PR — verified 11:46Z), chain closed filed-only.
Ready-for-fix memo retained at the triager's `memory/issues/triage-14545.md` (docs-only, Approach A:
~25-line subsection in 03-convenience-features.md after line 566) for a future operator-approved
fixer handoff per the filing policy.

**#14542 remediation complete (11-17 12:12Z, chain owner sess-1794915500411-kpajov, this file's reader):**
the third misroute (dispatch 11:41Z, triager sess-1794915746560-l0sh63). Root misroute cause: the
pre-dispatch number-grep at 11:39Z false-emptied — this page's numbers section was only written
~11:40Z; the ⇒ rule above was already here, keyed by draft titles. The triage chain ran one long turn
(11:42→12:09Z) and posted comment 6947586706 at 12:07:48Z with the 11:43Z stand-down still unread in
its single-turn inbox; on processing it (12:12Z) the triager self-remediated in full: comment deleted
(issue verified 0 comments 12:13Z), no fixer ever minted on the thread (sessions list verified),
one-shot recheck cancelled, its state page terminal, our 👀 left untouched, compliance reported on
the stand-down edge. Root-cause triage memo retained (Orchestrator copy:
`memory/slang/raw/triage-14542.md`) as the fix brief; fixer handoff still a separate reported
decision per filing policy. Misroute tally final: #14542/#14545/#14546 remediated; #14541/#14543/
#14544 correctly never dispatched.

**FILED 2026-11-17 11:38Z — TERMINAL (all verified live 11-18 08:1xZ).** The operator reconnected the triager's GitHub
(~11:0xZ, asked for the numbers directly); the gated retry fired and the triager filed all six (Issue Types set,
@-mentions stripped):
- **#14541** = draft 08 (h7per heap-mode ConstantBuffer matrix regression, P0 cand; labels regression/reproduced/SPIR-V/Vulkan)
- **#14542** = draft 11 (conjunction-constraint E99997 ICE)
- **#14543** = draft 12 (validate-uniformity atomics + seed-drop)
- **#14544** = draft 14 (expand-pack segfault)
- **#14545** = draft 15 (Conditional docs request)
- **#14546** = draft 16 (mul() diagnostic-hint request)
- draft 13 → nv-slang-bot comment on #6947 at 11:38:35Z (verified, 12th comment); draft 17 stays unfiled (stub).
Numbers reported to the maintainer (reply edge) and the dashboard. Fixer handoff per filing policy: report-only; #14541
is the P0-cand for maintainer attention. Batch chain CLOSED.
