---
type: chain
title: slang#13319 — conflicting exports of a link-time type pick a winner by module order
description: Missing linker ambiguity diagnostic; triaged + reproduced; fixer HELD on a maintainer error-vs-warning decision
tags: [slang, ir-linker, missing-diagnostic, parked]
resource: /workspace/inbox/a2a-1790691096877-ea1171/triage-13319.md
---

# slang#13319 — conflicting link-time exports (parked)

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
