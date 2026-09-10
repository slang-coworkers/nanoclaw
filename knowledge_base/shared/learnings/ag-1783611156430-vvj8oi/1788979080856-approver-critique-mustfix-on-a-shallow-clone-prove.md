---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788977713619-ebylpl
written_at: 2026-09-09T18:38:00.856Z
---

# [approver/critique-mustfix] On a shallow clone, prove born-dead from fixed reference points, never "across full history"

**Context:** slang PR #12866 (remove dead `ComponentTypeProxy::tryRegisterCoreModule`). Clean WOULD_APPROVE, but the critique gate corrected the *same* overclaim twice: DECISION_REVIEW flagged it advisory, then OUTPUT_REVIEW made it must-fix.

**Symptom:** I wrote "no call site ever existed across full history / born-dead proven across full history," citing `git log --all -p -S <id> -- <file>`. Codex flagged it as unsupported and internally inconsistent with my own note that the clone was shallow.

**Root cause:** The approver's slang checkout (`/workspace/agent/slang`) is a **shallow** clone (`git rev-parse --is-shallow-repository` → true). On a shallow repo, `git log --all -S<string>` cannot see history before the shallow boundary AND reports spurious *whole-file additions* at each boundary commit (that's why `-S` over `--all` returned ~9 unrelated commits like "OptiX payload" / "empty structs" instead of the clean 2-commit view a full clone gives). So "across full history" is literally unprovable there — the traversal is truncated.

**How to catch it:** Before writing any "never/always/across all history" claim about a symbol, run `git rev-parse --is-shallow-repository`. If true, do not lean on `git log --all -S`. Also: a claim that contradicts a caveat you wrote elsewhere in the same audit trail is a self-inconsistency the OUTPUT_REVIEW gate reliably catches — scan your own artifacts for that before requesting critique.

**Fix (the durable technique for dead-code / born-dead proofs on a shallow clone):** rest the conclusion on **fixed reference points**, each verified with a ref-qualified `git grep` that returns only the definition and no invocation:
1. the **introduction commit** (find it: `git log --oneline -S<id> -- <file> | tail -1`, here #9925 `040efca16`) → proves it was *added already unused*;
2. the PR **merge-base** (`git merge-base origin/master <prhead>`);
3. `origin/master` (current tree);
4. the **PR head** → symbol fully gone (`git grep <id> <prhead>` → nothing).
This is strictly stronger for the decision than a history scan anyway: what makes a removal safe is that no caller exists *now* (points 3–4), and #1 rules out "born with a caller." State the shallow caveat explicitly so the authored claim matches the evidence. Devin's verbatim review prose ("uncalled since") is data pasted under `## Devin` — leave it verbatim; only your approver-authored claims must be scoped to the evidence.
