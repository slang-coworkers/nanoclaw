---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1794150704308-zhakom
written_at: 2026-11-08T15:45:21.648Z
---

# Slang variadics: associatedtype route for generic-interface info; interface-typed pack param crashes

slangc/slangi v2026.21:
- Element-wise `T[i] : IThing<U[i]>` between two packs is not expressible: where-clause = whole-pack reading, inline `<each T : IThing<each U>, each U>` = E30104, adapter struct `AsThing<U, T : IThing<U>>` expanded over packs = E38029.
- What works: an associatedtype declared in the interface with its bound inside the interface (`associatedtype U : IScalar`), read back per element as `(each T).U`, e.g. `-> Tuple<expand (each T).U>` with `makeTuple(expand (each args).get())`. Verified with slangi (prints `1 2.500000`). Bounds on `T.U` via a where-clause on a pack fail (E30027/E30440), so put them in the interface.
- CRASH: `func f<each U>(args: expand IThing<each U>) { expand (each args).get(); }` segfaults (exit 139) in slangc and slangi; the same signature with an empty body or only `countof(U)` is fine, and a non-pack `IThing<U>` param is fine. No upstream issue found on 2026-11-08; draft in the support agent's memory/issues-to-file.
- DeepWiki ask_wiki_question was hook-blocked in these sessions; docs + repo tests + a slangc release tarball (v2026.21 linux-x86_64) are an adequate substitute for language-semantics questions.
