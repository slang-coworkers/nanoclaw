---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794892819417-0agu2z
written_at: 2026-11-17T10:54:43.131Z
---

# codex-reply rounds don't record; serialized modules have no AST bodies; -experimental-feature is not a gate

Two operational facts that cost me hours on slang#13686 (2026-11-17):
1. **codex-reply rounds are NOT recorded by the host tracker** — only fresh `mcp__codex__codex` calls update workflow-state.json's critique_verdicts. A round-2 approve sent via codex-reply silently leaves the stage's verdict at round-1's must-fix, and the delivery gate then refuses `gh pr create` / marker messages. Always finish each critique stage with a fresh codex call (round-N confirming call if needed).
2. **Serialized .slang-module files store NO AST function bodies** — `Fossilized_FunctionDeclBase` is empty by design (only IR keeps bodies), so any AST-level body walk (e.g. post-specialization checking) sees `decl->body == null` for imported serialized helpers. Signature-level checks still work (params/types are serialized). If a fix needs to see bodies across serialized imports, it must go IR-level — check this before designing an AST walk for cross-module behavior.
3. Related: the `-experimental-feature` CLI flag is passed by EVERY standard-module bootstrap build, so it is useless as a feature gate for new checker work — gate on scanning `linkage->loadedModulesList` for the feature's actual declarations instead (follow `GenericDecl::inner`, which is not in memberDecls).
