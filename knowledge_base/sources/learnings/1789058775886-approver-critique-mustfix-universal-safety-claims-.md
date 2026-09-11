---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789056898018-6jc0xs
written_at: 2026-09-10T16:46:15.886Z
---

# [approver/critique-mustfix] Universal safety claims ("all access via X") need whole-function evidence, not a truncated grep

**Context:** slang#12993 (WOULD_APPROVE, correct — matched a MEMBER human APPROVE). A trivial test-only cleanup, yet DECISION_REVIEW returned must-fix twice on the *accuracy* of my challenger rationale before approving. The decision never changed; the derivation prose did.

**Symptom:** My challenger wrote "the unused `a0` was never dereferenced — all argument access goes through the bounds-checked `get(i)` lambda." Codex caught a direct `args.empty() ? … : args[0]` read at `glsl_std_450.cpp:1059`, so "all access via get(i)" was false. Second round: I wrote removing `a0` makes "the empty-argument case go from UB to defined" and "removal cannot alter behavior on any path" — both over-broad (PackSnorm2x16 still indexes an empty `elements` vector at :958, independent UB; and removing the eager null-ref DOES change the invalid empty-args path).

**Root cause:** I asserted a **universal** ("all", "never", "cannot") from a **partial** read. I had run `gh api …contents… | base64 -d | grep … | head -40` on a file that was actually **1067 lines** and concluded from the first 40 matches. The direct `args[0]` lived at line 1059, far past my window.

**How to catch it:** Before writing any universal claim in an approval rationale, ask "did I read the whole function/file, or a truncated slice?" A `head -N` on `grep`/file output is a truncation trap — check `wc -l` first, and for "all callers / all access / no other uses" claims, grep the *entire* file for the specific token (`args\[`, the identifier) with no `head`. For a dead-code removal, the load-bearing evidence is "grep shows zero remaining references at head" + green CI — NOT a claim about how the surrounding code is structured.

**Fix (transferable):**
- Scope claims to what you verified: "removal is safe because `a0`/`is64` are unreferenced at head (verified, full-file grep) and CI is green" — do not additionally assert an access-pattern invariant you didn't fully check.
- Characterize UB precisely: name *which* UB and *which* path ("eliminates one eager null-reference UB at function entry on the empty-args path"), never "makes the empty case defined" (other independent UB may remain) and never "cannot alter behavior on any path" (a UB-removal by definition alters the invalid path).
- The critique gate is cheap insurance here: it turned a correct-but-sloppy rationale into an accurate, auditable one at zero cost to the verdict. Don't resent the must-fix rounds on trivial PRs; the ledger row is the artifact, and its prose should survive a maintainer re-reading it.
