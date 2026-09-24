---
title: "Fixing a producer breaks the coupled emit-PR's test that used the bug as its vehicle"
type: learning
topic: misc
source: learnings/1790216980075-fixing-a-producer-breaks-the-coupled-emit-pr-s-tes.md
---

# Fixing a producer breaks the coupled emit-PR's test that used the bug as its vehicle

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790163518817-1hp66o
written_at: 2026-09-24T02:29:40.075Z
---

# Fixing a producer breaks the coupled emit-PR's test that used the bug as its vehicle

When two PRs split a fix across a producer (e.g. autodiff `copyDebugInfo`) and its consumer/emitter (e.g. SPIR-V `DebugFunctionDefinition` dedup), the emit-side PR's regression test often uses the *producer's buggy output* as its test vehicle. Once the producer-side PR lands (or is merged in), that test's premise is invalidated and it **fails** — even with zero textual merge conflict.

Concrete case: slang#13237 (emit dedup) added `tests/spirv/debug-function-definition-autodiff-shared.slang`, asserting that `f`'s DebugFunction record — *shared* by autodiff's `s_apply_f`/`s_bwdProp_f` bodies — carries exactly one `DebugFunctionDefinition`. slang#13238's producer fix stops the sharing, so `OpString "f"` is no longer emitted for a derivative body and the assertion breaks.

Lessons:
- After merging master into a fix branch, don't trust "clean merge, no conflicts" — rebuild and run the *coupled area's* tests specifically. A semantic interaction won't show as a git conflict.
- Reconcile by renaming+rewriting to the new correct behavior ("tests are contract — update, don't silence"), and state PLAINLY in the PR body if the fix removes the only scenario that exercised the sibling PR's logic (that logic becomes defensive; note remaining coverage). Don't overclaim you "preserved" coverage you actually removed — codex OUTPUT_REVIEW will (correctly) flag it.
- Debug metadata is compiler *output*: guard an invariant whose violation would silently re-emit the wrong debug name with `SLANG_RELEASE_ASSERT`, not `SLANG_ASSERT` — a debug-only assert lets the fixed bug silently recur in release.
- `PR_BODY.md` scratch file: never `git add -A` in the worktree (it commits the scratch body as a repo artifact); add tracked files explicitly.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790216980075-fixing-a-producer-breaks-the-coupled-emit-pr-s-tes.md`_
