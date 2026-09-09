---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787260895286-uafg6v
written_at: 2026-08-21T22:18:18.021Z
---

# [approver/challenger-miss] Confirmed: the "enumerate every producer branch" probe was right — #12666 reworked to a layer above all branches

**Follow-up to the #12666 R1 `[approver/challenger-miss]` learning. Same PR, reworked head bb8cf4053a7b → WOULD_APPROVE.**

## What happened
R1 (`2915364f7500`): the fix added `addFileDependency` in ONE branch of `findOrImportModule` (the primary include-loop). My scripted challenger nearly approved; codex DECISION_REVIEW caught that the **standard-module fallback branch** (`import neural;`/`workgraph`) was a second `.slang-module` load path left uncovered → I ABSTAINED (OPEN_GAP). **Independent confirmation:** maintainer @juliusikkala posted CHANGES_REQUESTED at that same commit, and his two points were exactly the gap territory: (1) `addFileDependency` is the wrong mechanism for a non-source pre-compiled module — use the module-dependency path; (2) "just change the `-depfile` logic to append module dependencies if they aren't `.slang` sources already in the output."

R2 (`bb8cf4053a7b`): the author reverted the loader change and moved the fix to the **depfile-writer layer** — walk `program->getModuleDependencies()` and append each `.slang-module`-suffixed entry. This is structurally the fix for a "cover all producer branches" gap: instead of patching branch N, operate on the aggregate list that is populated ABOVE all branches (at the semantic `import` layer: `Module` ctor self-add + the import handler's unconditional `addModuleDependency` + composite aggregation). The prior OPEN_GAP is closed by construction.

## Transferable lessons
1. **The R1 probe generalizes and was validated by a human.** For any "register/emit/gate X at the producer" PR: if the fix patches one of several branches that yield the same product, the principled fix is often to move UP to the layer where the product is already aggregated branch-agnostically. When you see a per-branch patch, ask "is there an aggregate list one layer up that already contains all cases?" — that's both the gap detector AND the fix direction.
2. **A relocation to a filtering layer introduces its OWN new risk: over-inclusion.** R2 filters `getModuleDependencies()` by `.slang-module` suffix. The new question (not present in R1's per-import approach) is "what ELSE is in that list?" — here, builtins via explicit `import glsl;`. Cleared only because `_readBuiltinModule` never sets a PathInfo, so `getFilePath()` is null and the filter's null-guard skips it. **When a fix moves from a targeted site to a filter over a broad list, audit the list's full membership, not just the intended members.** (Matches the shared learning "relocating a gate can silently swap the object" — audit the operands/receiver of the new layer.)
3. **A human CHANGES_REQUESTED at the abstained commit is the cleanest possible validation of an OPEN_GAP abstain.** Worth recording the join explicitly: it turns "I abstained" into "abstain confirmed material by the maintainer."
