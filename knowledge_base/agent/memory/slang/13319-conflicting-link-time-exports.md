---
type: chain
title: slang#13319 — conflicting exports of a link-time type pick a winner by module order
description: Missing linker ambiguity diagnostic; draft PR #13471 (E45002 warning) open, held on kaizhangNV's error-vs-warning call + CI release
tags: [slang, ir-linker, missing-diagnostic, draft-pr]
resource: /workspace/inbox/a2a-1790691096877-ea1171/triage-13319.md
---

# slang#13319 — conflicting link-time exports (released to draft)

Reporter tdavidovicNV (MEMBER). Two modules each `export struct Renderer : IRenderer = X;`
for one `extern struct Renderer` link with rc=0 and no diagnostic; the winner depends on
module order, and not even stably (last export wins when `contract` is listed first, first
export wins when the renderers come first). Also reproduces for `export static const` and
exported functions.

**Mechanism (triager, verified against its posted comment 2026-09-29):** in
`slang-ir-link.cpp`, `insertGlobalValueSymbol` (:1671-1701) splices candidates after the list
head. The selection loop (:1610-1615) replaces best only on a strict `isBetterForTarget` win
(:1294). The ambiguity error that the comment at :1316-1320 calls for was never implemented.
Only E45001 exists in the 45xxx range.

**State 2026-09-29 14:1xZ:** triage comment
[5892001495](https://github.com/shader-slang/slang/issues/13319#issuecomment-5892001495)
answers the reporter's two questions and asks maintainers **error vs warning**. Labels:
`reproduced`, `Missing Diagnostic`. slang-fixer is HELD with an Approach-A briefing: E45002 on
a true tie after all ranking steps, with a note per definition.

**Decision (Orchestrator): hold the fixer.** The chain is P2 and un-prioritized, and the
severity choice is a maintainer call, because an error is a breaking change. Bot open-PR
backlog measured at 140 open / 101 draft (was 69–81 on 09-08). Same reasoning as the #12923
hold on 09-08.

**Release condition:** a maintainer comment that actually *decides*, meaning error vs warning
or an explicit request for a fix, or prioritization (Dev Reviewed / assignment / milestone).
The arrival of a comment alone does not release. Read polarity: "working as intended" is
terminal. Re-chase task `rechase-13319-severity-595a` fires 2026-10-06T14:00Z.

**2026-10-06 re-chase: RELEASED by prioritization.** No comments since 5892001495. The timeline
shows that 6h after the park, at 09-29T20:01Z, `jhelferty-nv` labeled `RTR` and assigned
`kaizhangNV`. That's the same RTR batch pattern as #13265 → bot draft #13437 and #13436 → bot
draft #13450. The `updatedAt` 20:01Z vs comment-only `since` query difference was the tell.
Dispatched slang-triager (msg 9, pinned `sess-1790689419811-rws60f`) to release the fixer for a
**draft** PR. Since severity is still undecided, it defaults to a **warning**
(`pr: non-breaking`, can be raised to an error), and the PR description puts error vs warning to
kaizhangNV as the one open decision. Task closed (one-shot; no re-arm). **RESUME** on the
triager's PR report; kaizhangNV's severity answer → fixer flips to error + breaking-change if
chosen.

**2026-10-07 00:31Z: draft PR [#13471](https://github.com/shader-slang/slang/pull/13471) open.**
I verified it live:
- draft; base master; head `fix/issue-13319` @ `74ce152746`;
- `pr: non-breaking`; closes #13319; +584/−0 across 20 files;
- PR→session mapping exists (slang-fixer `sess-1790691096900-1m4j24`);
- the PR body ends with the merge-blocking question to kaizhangNV (error vs warning);
- the issue comment was edited in place and is still the only comment.

CI is all SKIPPED because the PR is a draft; workflow_dispatch 37551523524 is `waiting`.
**RESUME:** wait for the fixer's [Fix Report] after slang-reviewer, which the triager rolls up
as [Triage Resolution], and for kaizhangNV's severity call. Re-chase task
`rechase-13471-severity-fbf6` fires 2026-10-14T01:00Z.
