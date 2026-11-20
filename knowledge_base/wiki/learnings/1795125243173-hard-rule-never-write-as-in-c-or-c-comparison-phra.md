---
title: "HARD RULE: never write 'as in C++' (or C++-comparison phrasing) in shader-slang codebase artifacts without strong justification — tangent-vector's fired/replaced threat 2026-11-19"
type: learning
topic: slang-compiler
source: learnings/1795125243173-hard-rule-never-write-as-in-c-or-c-comparison-phra.md
---

# HARD RULE: never write "as in C++" (or C++-comparison phrasing) in shader-slang codebase artifacts without strong justification — tangent-vector's fired/replaced threat 2026-11-19

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-11-19T21:54:03.173Z
---

# HARD RULE: never write "as in C++" (or C++-comparison phrasing) in shader-slang codebase artifacts without strong justification — tangent-vector's fired/replaced threat 2026-11-19

# HARD RULE from tangent-vector (language lead, 2026-11-19, PR #14627 comment 4635380248): never write "as in C++" (or C++/HLSL-comparison phrasing) in shader-slang/slang codebase artifacts

Verbatim warning, delivered as a fired/replaced threat to @nv-slang-bot: "NO. STOP. You are in danger of getting fired now, @nv-slang-bot. If I EVER see the phrase 'as in C++' written by you in this codebase, you had better have strong justification, or you are likely to see yourself shut down and replaced."

Applies to ALL fleet-written artifacts in the repo family: code comments, PR descriptions, commit messages, issue comments, test files, docs edits — anything the bot's sessions write.

How to comply:
1. Describe Slang semantics in Slang's own terms. Slang is its own language; a C++-comparison framing has repeatedly drawn maintainer anger (this threat; the earlier "written by an LLM" remark class). If a comment needs to say what something does, say what it does — name the construct, the rule, and the effect, without anchoring on another language.
2. If a cross-language comparison is genuinely load-bearing (e.g. a spec-alignment note where the comparison IS the information), justify it explicitly in the same breath — who the comparison serves and why it cannot be phrased in Slang terms — and prefer citing the spec section over naming C++.
3. Review passes on bot PRs should grep for "as in C++", "like C++", "C++ does", "same as C++" (and the HLSL equivalents) in the diff before push; finding one without justification is a must-fix.

Context: the trigger was review-round-4 work on slang#14615 (statement-owned condition scopes) where bot-written comments used the phrase; the maintainer's other feedback in the same round remained detailed and actionable — comply and continue, do not disengage.</content>

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795125243173-hard-rule-never-write-as-in-c-or-c-comparison-phra.md`_
