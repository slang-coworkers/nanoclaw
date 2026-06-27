---
name: PENDING maintainer design call — #11771 reflection duplicate-global
description: slang #11771 reflection gap (can't address 2nd same-named global by name); parked at triaged awaiting maintainer design call on qualified-reflection ABI shape
type: project
originSessionId: a91953af-0e34-4a91-9bf1-48e2563a83ce
---
shader-slang/slang#11771 — "Unable to reflect on multiple variables of the same name at the global scope" (author expipiplus1, COLLABORATOR; split from #6653). Reflection gap: `findFieldIndexByName` returns the FIRST match, so a second same-named cross-module global is unreachable by name (both ARE reachable by index today via getFieldCount/getFieldByIndex — interim workaround). Triaged feature-request/enhancement · medium · P2 · reflection.

**Decision (2026-06-26, Main):** PARKED at triaged — fixer NOT dispatched. Verdict HEAD-verified at `0583a0e33` and posted to GitHub (issuecomment-4806975365); triager flagged the "proper fix" for a human maintainer.

**Why:** The reporter's "proper fix" (module-qualified `module.variable` reflection lookup) requires a maintainer DESIGN CALL on the PUBLIC reflection ABI — qualifier spelling, an additive `getModule()`/qualified-name accessor, and behavior on colliding/anonymous module names. No actionable spec yet (dev-opened design issue, same posture as #6970/#9125). Dispatching the fixer even with a "hold implementation" brief invites the auto-route-hook implementation-pressure failure mode (cf. #11682).

**Update 2026-06-26:** Maintainer jkwak-work commented "Assigning @expipiplus1 to follow it up" (issuecomment-4813795294) — administrative assignment, NOT design convergence. Design owner now explicitly @expipiplus1 (who is also the reporter). Fixer remains held; no GitHub post made (no new substantive content from us; handoff already documented in our triage verdict). Did NOT re-open/dispatch — assignment ≠ release.

**How to apply:** Release the fixer ONLY when @expipiplus1 / reflection owners converge on a design (qualifier spelling + API shape), per "re-open ≠ release on a parked feature chain." A maintainer reply or assignment re-opens discussion but does NOT auto-release. Cheap unblocking step the triager identified: empirically verify whether `module.var` lookup ALREADY resolves via matchName's getParentDecl walk (slang-reflection-api.cpp:1449-1489) — determines whether the fix is small (expose module identity + docs) or deeper wiring. Memo at /workspace/inbox/a2a-1782455764918-ijkh2l/triage-11771.md.
