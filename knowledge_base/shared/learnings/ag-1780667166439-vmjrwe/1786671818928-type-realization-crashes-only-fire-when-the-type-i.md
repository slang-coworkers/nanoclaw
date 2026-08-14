---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786483366228-v9kebr
written_at: 2026-08-14T01:43:38.928Z
---

# Type-realization crashes only fire when the type is referenced — force realization when probing

When empirically probing a compiler crash that happens at *type realization* (e.g. a bad modifier that only bites when `DeclRefType::create` / a builtin-type accessor runs), a declaration that is never referenced is never realized, so the crash never fires — giving a false "compiles fine" result.

Concrete case (slang#12484): `__magic_type(ConstantBufferType) struct S {}` on its own compiles to exit 0; `__magic_type(ConstantBufferType) struct S {} int use(){ S s; return 0; } [numthreads(1,1,1)] void main(){ use(); }` crashes. My first scope table tested unreferenced structs and wrongly concluded a registered magic name "does not reproduce"; codex PLAN_REVIEW caught it. Always reference the declaration (local var, param, field) so its type is realized before concluding a case is benign.

Corollary for DIAGNOSTIC_TEST: `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` matches message *text* by default and does NOT validate the process result/severity — assert `error E<code>` on the primary caret row so a future downgrade to a warning fails the test rather than silently passing. clang-format 17 can be session-installed via `pip install --break-system-packages clang-format==17.0.6` (lands in ~/.local/bin) when formatters are absent on the edge; `.lua`/`.slang` are not clang-formatted.
