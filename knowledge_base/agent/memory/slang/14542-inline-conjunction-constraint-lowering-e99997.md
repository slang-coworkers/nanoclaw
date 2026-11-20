---
type: chain
title: slang#14542 — inline conjunction constraint (`R : IA & IB`) feeding a later constraint — E99997 ICE; MISROUTED triage chain, stood down, filed-only
description: Bot-filed by our own 11-17 Discord drafts batch; my issue_opened dispatch was a misroute (batch page ⇒ rule missed — number-grep false-emptied); triage ran + posted, then stood down, comment deleted, recheck cancelled; root-cause memo retained as fix brief, fixer gates on operator
---

# slang#14542 — E99997 "generic type constraint during lowering", inline conjunction constraints

**TERMINAL (2026-11-17 12:12Z): STOOD DOWN, FILED-ONLY.** Filed by our own Discord drafts batch
(#14541–#14546, 11:38Z, operator-ruled). Its `issue_opened` webhook is a self-echo — the batch page
[discord-drafts-batch-2026-11-17.md](discord-drafts-batch-2026-11-17.md) ⇒ rule says DO NOT
dispatch a fresh triage chain. I misrouted it anyway (see Misroute below): a triage chain ran to
completion and posted a comment, then executed the stand-down (comment deleted, no fixer ever
minted, one-shot recheck t-9e0226 cancelled). Issue final state = exactly as filed: open, labels
`bug`+`reproduced`, 0 comments, 👀 from the filing batch (verified live 12:13Z). **Do not re-dispatch
this issue's webhooks**; next action is a human's (comment) or the operator's (fixer-start
authorization per filing policy).

## Misroute (my routing defect, 2026-11-17)- 11:39Z: my R6 pre-dispatch `grep -rl '14542' memory/` returned no hits — the batch page existed
  since 08:23Z with the ⇒ rule, but its numbers section ("11 → #14542") was only written ~11:40Z
  after filing; the rule is keyed by draft titles ("inline conjunction constraint E99997"). My
  grep missed it by a minute. I then dispatched slang-triager on the canonical thread (11:41Z,
  session sess-1794915746560-l0sh63) following the #14537 bot-filed precedent — wrong precedent:
  #14537's filer was a fixer side-find with no batch page rule.
- 11:43Z: sibling c4kyqn (handling #14544) sent pinned stand-downs to all three misrouted triage
  sessions (#14542/#14545/#14546) and reported the correction to the dashboard (row 513666).
- The triage chain ran one long turn (11:42→12:09Z: rebuilt ToT slangc 2a91af5b7, 6-variant
  matrix), posted triage comment 6947586706 at 12:07:48Z, reported to me 12:09Z — the 11:43Z
  stand-down sat unread in its inbox the whole turn (single-turn inbox).
- 12:12Z: triager processed the stand-down and self-remediated in full (its learning
  `ag-1780667166418-apezq5/1794917533012-...`): comment deleted (0 comments verified 12:13Z),
  recheck cancelled, state page terminal, filing batch's 👀 left untouched. Compliance report on
  the stand-down edge (c4kyqn).
- Sibling handling: #14541/#14543/#14544 correctly no-dispatch; #14545 (k7tmvm) and #14546
  remediated the same way.

## Triage knowledge (RETAINED — fix brief for the future operator-approved fixer chain)

Memo: [raw/triage-14542.md](raw/triage-14542.md) (triager's, verified vs its report); repro files
`/workspace/agent/.repro-14542/` (triager workspace). Summary: bug / medium / P2 / frontend
(generic constraint checking) → IR lowering / no duplicate (#9334 related, different failure mode).

Root cause (triager's finding, 3-way verified): the checker flattens `R : IA & IB` keeping the
FIRST conjunct on the original constraint and APPENDS the sibling `R : IB` at the END of the
generic's member list (slang-check-decl.cpp:4930, `visitGenericTypeConstraintDecl` 4910-4934).
Checking `T : IFoo<R>` binds IFoo's hidden witness to that late sibling, but lowering emits
constraint params in member-list order (slang-lower-to-ir.cpp:13091-13134) — it forward-references
the sibling, gets no lowered value, falls through to `SLANG_UNEXPECTED` at slang-lower-to-ir.cpp:10629.
Order sensitivity (`IB & IA` works) falls out exactly. NOT AndType survival (2026-11-04 wiki
hypothesis disproven) — purely declaration ordering.

Deltas vs the issue body: (1) a SINGLE `where R : IA & IB` clause also aborts — the workaround must
SPLIT the conjunction into separate `where` clauses; (2) partial split also aborts (matches body).

Recommended fix (triager): **A** — insert flattened siblings ADJACENT to the original constraint at
the producer (slang-check-decl.cpp:4923-4932; dedupe the shadowed duplicate block :4938-4972 in the
same change). B (two-pass order-independent emission in emitGenericDecl) = defense-in-depth, larger
blast radius. C (consumer guard) rejected — masks ordering bugs. Files:
slang-check-decl.cpp:4910-4934 · slang-lower-to-ir.cpp:13091-13134 + :10629 ·
slang-parser.cpp:1793-1810/:1843 (attachment order).

## HUMANS TOOK THE FIX (2026-11-18) — bot stays off unless explicitly asked

- 11-18 18:25Z: jhelferty-nv added the `ICE` label (labels now `bug`+`reproduced`+`ICE`).
- 11-18 18:26Z: **tangent-vector** and **jvepsalainen-nv** SELF-assigned (events API: each is their
  own assigner, 1 s apart).
- 11-18 18:26:51Z: jhelferty-nv comment 6987712941 — "Assigned to both of you, whomever gets to it
  first? 😁" — addressed to the two human assignees. **No bot mention** (live body verified verbatim);
  the `pr_mention` webhook fired on the comment activity, not a mention.
- Disposition: stood down, no GitHub action (no mention → no `<github-post-authorized />`;
  assigned-human stand-down rule). No cross-referenced fix PR existed at 18:2xZ (timeline checked).
- The operator's pending fixer-start decision for #14542 is RETIRED — the fix is in human hands;
  authorizing a bot fixer now would compete with two maintainer assignees. The triage memo
  (raw/triage-14542.md) stands ready only if a maintainer explicitly asks the bot for the analysis.
- If a maintainer later @mentions the bot on this issue, treat it as a live inbound and re-check
  live assignees before any action; if a human PR cross-references this issue, stand down and
  validate theirs instead.
