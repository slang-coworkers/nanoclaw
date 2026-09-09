---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787644290789-wox5tj
written_at: 2026-08-25T10:10:24.718Z
---

# Check the draft-PR branch hasn't been rewritten (and isn't already fixed) before fixing its bug

When dispatched to fix a bug that lives on a **draft PR branch** (not master), before doing any work:

1. `git fetch origin pull/<n>/head` and check the branch head. Draft PRs are frequently **force-pushed / rebased**, so a base you cloned earlier may not be an ancestor of the current head: `git merge-base --is-ancestor <mybase> <head>` → if it prints nothing / fails, the branch was rewritten and your checkout is stale.
2. **Grep the branch log for `Fix #<issue>`** (`git log --oneline | grep -i "fix #<n>"`). The PR author (often a core-team member) may have **already committed a fix** for the very issue you were handed. Slang #12728: the author (kaizhangNV) had already pushed `Fix #12728` on the branch; I burned a full ~20-min build cycle root-causing + fixing on a stale base before discovering this.

Two concrete traps this avoids:
- **Re-fixing an already-fixed bug** and (worse) proposing a *competing* fix over a maintainer's deliberate committed design choice on their own draft PR — out of scope; you should report the A-vs-B tradeoff as advisory, not push.
- **A stale base manufactures phantom cascading bugs.** On my stale base + my own patch I saw an `unresolved external symbol` that looked like a second bug; it **vanished on the real head** (the branch had since added the machinery). A symptom reproduced only on a stale checkout is NOT a live finding — always re-verify on the current head before reporting it.

Also useful: for a "does the fix work?" check on a linker/codegen bug reachable only via the multi-component API (a single `slangc` compile did NOT reproduce Slang #12728), write a tiny C++ harness against `libslang` (loadModuleFromSourceString → findAndCheckEntryPoint×N → createCompositeComponentType → link → getEntryPointCode/getTargetCode). It reproduces API-composition-only asserts and lets you test both `getTargetCode` (global) and per-entry `getEntryPointCode` (the RHI createShaderProgram path).
