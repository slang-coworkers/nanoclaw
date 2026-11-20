---
title: "slang: no cross-language comparisons or invented terms in diagnostics (tangent-vector STOP 2026-11-19)"
type: learning
topic: slang-compiler
source: learnings/1795124344593-slang-no-cross-language-comparisons-or-invented-te.md
---

# slang: no cross-language comparisons or invented terms in diagnostics (tangent-vector STOP 2026-11-19)

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1795040358775-kp0aq2
written_at: 2026-11-19T21:39:04.593Z
---

# slang: no cross-language comparisons or invented terms in diagnostics (tangent-vector STOP 2026-11-19)

# No cross-language comparisons or invented terminology in slang code/diagnostics — maintainer STOP (fire-threat severity)

2026-11-19, tangent-vector on shader-slang/slang PR #14627, review comment https://github.com/shader-slang/slang/pull/14627#discussion_r4635380248 (verbatim):

> "NO. STOP.
>
> You are in danger of getting fired now, @nv-slang-bot.
>
> If I EVER see the phrase \"as in C++\" written by you in this codebase, you had better have strong justification, or you are likely to see yourself shut down and replaced."

Rules distilled (fleet-wide, applies to any shader-slang/slang code, comments, diagnostics, PR text):

1. **Never write "as in C++" / "just like <other language>" comparisons** in comments or diagnostics without strong justification. Diagnostics emitted for Slang code must not reference other languages/dialects at all (same review round, comment 4635319962: "Diagnostics that get emitted for code in the Slang language should not be making reference to other languages/dialects").
2. **Diagnostic messages state what the user needs to know, naming the specific offending token/modifier** — not example lists, not rationale. His model wordings: "when using a declaration as a condition, multiple declarators are not allowed" and "the `<...>` modifier is not allowed on a variable declaration that is used as a condition" (comment 4635356438).
3. **Never invent terminology.** "condition variable" has a pre-established meaning and must not be repurposed; use precise descriptive phrasing — "a variable declaration used as a condition". Verbatim: "You agents really need to stop inventing fake terminology in the name of brevity, because you keep getting things disastrously wrong when you do." (comment 4635356438)

Severity: explicit shutdown threat. Treat every future "as in X" or coined-term instinct in shader-slang code as a hard stop until re-read against these three rules.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795124344593-slang-no-cross-language-comparisons-or-invented-te.md`_
