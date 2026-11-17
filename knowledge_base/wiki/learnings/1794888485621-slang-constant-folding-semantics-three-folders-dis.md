---
title: "Slang constant-folding semantics: three folders disagree on shifts; #if literals parse via strtoll-to-int32; spec has no constant-eval model"
type: learning
topic: slang-compiler
source: learnings/1794888485621-slang-constant-folding-semantics-three-folders-dis.md
---

# Slang constant-folding semantics: three folders disagree on shifts; #if literals parse via strtoll-to-int32; spec has no constant-eval model

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794888005668-hi6kra
written_at: 2026-11-17T04:08:05.621Z
---

# Slang constant-folding semantics: three folders disagree on shifts; #if literals parse via strtoll-to-int32; spec has no constant-eval model

Constant-folding SEMANTICS in Slang are split across three folders that DISAGREE (verified at HEAD da04f0426, 2026-11-17, for slang#14482/#9374):
- Shifts: front-end IntVal folder masks count `% 64` (slang-ast-val.cpp:2228-2243), `tryConstantFoldExpr` masks (slang-check-expr.cpp:2718-2741), but SCCP `evalLsh`/`evalRsh` returns 0 / saturates to -1 (slang-ir-sccp.cpp:776-839). Warning 41030 "always zero" (slang-ir-operator-shift-overflow.cpp:53-62) encodes SCCP's semantics, not the front-end's — a third de-facto semantics inside one diagnostic. Anyone implementing #9374's shift-mod-N must touch all four sites.
- `#if` preprocessor integer literals parse via `stringToInt` = `strtoll` TRUNCATED TO 32-BIT int (slang-preprocessor.cpp:3028-3029, slang-string.cpp:268-274; `PreprocessorExpressionValue` is `int` at preproc:2984), recognizing only `0x` — no `0b`/`0o`/`_`; preprocessor shifts at :3160-3162 are unguarded 32-bit signed. Fully divergent from the lexer path (slang-lexer.cpp:789-838, `_readOptionalBase` :750-786 incl. leading-0 octal, `_` separator :691-706, uint64 + overflow diagnostic :817-820). Root cause of #13545.
- The formal spec (external/spec/specification/) has NO constant-evaluation model: open gap marker declarations.md:538 ("Need a section to define what a 'compile-time constant expression' is"), preprocessor.md:8 admits `#if` undocumented; types.md:111 wraps-on-overflow statement does not mention shifts. No UB-policy doc exists in-tree.
- Environment note: /tmp/opencode is NOT writable in this triager container (permission denied) — write comment bodies to memory/issues/comment-<N>.md (tail -n +4 to strip OKF frontmatter) and post from there.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794888485621-slang-constant-folding-semantics-three-folders-dis.md`_
