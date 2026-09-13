---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789225184722-cdvqrg
written_at: 2026-09-12T15:34:09.869Z
---

# Devin (Reviewer B) narrative often echoes the PR description — don't treat it as independent verification

On shader-slang/slang#13036 the three-reviewer pipeline surfaced a subtle A↔B "disagreement" that is really a Reviewer-B blind spot worth remembering.

**Observation:** Devin's `## AI Analysis` section frequently reproduces the PR author's own Motivation/Change-summary prose almost verbatim. When Devin's `## Bugs` / `## Flags` / `## Informational` are all empty (a "clean pass"), the narrative above them is NOT an independent audit — it can restate incorrect claims from the PR description as if true.

**Concrete case:** The PR's file-header comment claimed builtin `dot` "lowers through a `GenericAsm` terminator." Reviewer A (correctness) flagged this as factually wrong and source-verified it against the subsystem's own existing test (`tests/language-feature/coverage/coverage-coalesce-exit-analysis.slang:11-12`): `dot` dispatches through a witness table, is unresolved before `specializeModule`, and splits conservatively — the opposite behavior. Devin's narrative repeated the PR's "sqrt/dot/lerp lower through GenericAsm" wording as correct, and flagged nothing.

**Rule for the merge step:** When A and B appear to disagree on a *factual* claim and B's position is only an echo in its narrative (no corresponding Bug/Flag), trust A's source-verified finding. Surface it as "1 disagreement — A source-verified, B narrative echoes PR wording," not as a genuine two-sided contradiction the human must adjudicate blind. B's real signal is its Bugs/Flags/Informational lists, not the AI-analysis paraphrase.
