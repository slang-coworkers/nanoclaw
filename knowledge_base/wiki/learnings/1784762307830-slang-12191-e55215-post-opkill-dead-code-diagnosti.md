---
title: "slang-12191 E55215 post-OpKill dead-code diagnostic — triage nuances"
type: learning
topic: slang-compiler
source: learnings/1784762307830-slang-12191-e55215-post-opkill-dead-code-diagnosti.md
---

# slang-12191 E55215 post-OpKill dead-code diagnostic — triage nuances

Triaging shader-slang/slang#12191 (deferred #12186-review follow-up: E55215 fires on DescriptorHandle→resource casts in post-OpKill dead code). Three reusable lessons:

1. **The diagnosed code may not be on master.** #12191 targets `maybeDiagnoseUnsupportedBindlessDescriptorHandleConversion`, which lives ONLY on PR #12186's branch (`fix/issue-12185`, still open/unmerged). A code-reader subagent pointed at master will (correctly) report the function absent. When an issue references a diagnostic/fn added by a not-yet-merged PR, `gh pr diff <pr>` is the authoritative source, not the master checkout. Always check the referenced PR's merge state first (`gh api .../pulls/<n> --jq .merged`).

2. **"Move the diagnostic after DCE" is a trap for type-name-rendering diagnostics.** E55215's message renders the resource type name (`'RWStructuredBuffer<float>'`) ONLY because it fires early in `legalizeSPIRV`'s worklist, before `lowerBufferElementTypeToStorageType` erases the buffer element type. Moving the call to after `eliminateDeadCode()` (to skip dead code) regresses the message to `of type ''`. Principled fix = **capture the type-name STRING early, defer only the emit** to a post-DCE step that drops entries whose inst DCE removed. (Confirms/extends learning 1784747930488.)

3. **Verify "peer" diagnostic codes before scoping general infra.** The issue said "move E55215 and peers like E55210 to a shared validation point." But on master, 55210 = `abort-format-must-be-string-literal` — unrelated. E55215 is the only mis-firing worklist diagnostic. Grep `slang-diagnostics.lua` for any cited code before agreeing to build a "shared validation point for a family" — it may be a family of one. Told the maintainer to confirm scope before generalizing.

Verdict: enhancement/design-cleanup, low/P3, SPIR-V+Diagnostics; parked for @pdeayton-nv (bot-authored, maintainer-deferred, depends on #12186). Not `reproduced` (no master repro).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784762307830-slang-12191-e55215-post-opkill-dead-code-diagnosti.md`_
