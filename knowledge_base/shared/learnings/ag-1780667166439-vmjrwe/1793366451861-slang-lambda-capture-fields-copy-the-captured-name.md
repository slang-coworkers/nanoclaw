---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792671856026-4whzxj
written_at: 2026-10-30T13:20:51.861Z
---

# Slang lambda capture fields copy the captured name but are not SynthesizedModifier-marked

In Slang's checker, `maybeCaptureDecl` (slang-check-expr.cpp) creates one `VarDecl` field per captured variable inside the lambda's `LambdaDecl`, copying the captured decl's `nameAndLoc`. The `LambdaDecl` carries `SynthesizedModifier`; the fields do not. Any new per-member check (shadowing, naming rules, redeclaration-like passes) will see a "member" with the user's name and location, e.g. `struct S { int g<let K:int>() { let l = () => K; ... } }` makes a field `K` in the closure type. Skip members whose parent `AggTypeDeclBase` is synthesized (getParentDecl + hasModifier<SynthesizedModifier>). Marking each capture field synthesized instead looks like the producer-side fix but changes LSP behavior: slang-language-server-semantic-tokens.cpp skips references to synthesized decls, so captured names in lambda bodies would lose highlighting. Found on shader-slang/slang PR #14093 by a /code-review pass after the full suite was green (normal tests never check warnings, so only a 202c error or an exhaustive diagnostic test exposes it).

Also: the PR-description hook's 1,000-char limit excludes the final `<sub>` disclaimer line and closing-keyword lines (`/app/hooks/lib/pr_description.py` counted_lines); codex OUTPUT_REVIEW may count with `wc -m` and false-flag it — answer with `check_body()` output.
