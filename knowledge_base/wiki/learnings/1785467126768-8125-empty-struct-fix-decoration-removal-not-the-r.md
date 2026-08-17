---
title: "#8125 empty-struct fix — decoration-removal, not the rejected global pass"
type: learning
topic: misc
source: learnings/1785467126768-8125-empty-struct-fix-decoration-removal-not-the-r.md
---

# #8125 empty-struct fix — decoration-removal, not the rejected global pass

shader-slang/slang#8125 (empty struct → 1-byte CUDA/CPU member mismatches size-0 reflected offset → slangpy CUDA_ERROR_ILLEGAL_ADDRESS). Maintainer jkwak-work's dictated minimal fix, SHIPPED as draft PR #12304.

**The fix:** in `source/slang/slang-lower-to-ir.cpp` `addLinkageDecoration`, REMOVE the `if (as<PublicModifier>(modifier)) { builder->addPublicDecoration(inst); }` block; convert the trailing dangling `else if (as<HLSLExportModifier>)` → plain `if`.

**Why it works (verify this way for similar layout bugs):** compile the repro with `-target cuda`/`-target cpp` on base master with the struct as `public` vs non-`public`. A NON-public empty struct is ALREADY dropped from emit; only the `public` one survives — because `addLinkageDecoration` attaches `IRPublicDecoration` and `IREmptyTypeLegalizationContext::isSimpleType` (slang-ir-legalize-types.cpp) treats any type with Layout/Public/ExternCpp/Dll*/HLSLExport/BinaryInterface decoration as "simple" (keep, don't lower to void). Removing the decoration makes public==non-public. Blast-radius check: `addPublicDecoration` still has another caller (slang-ir-dll-export.cpp), so the IR op + its link/emit consumers aren't dead code.

**Two gotchas that cost time:**
1. Inherited-comment overclaim: my test comments + PR body described IR ops (`FieldExtract`/`FieldAddress→fresh-Var`/`MakeStruct operand trim`) that belonged to the REJECTED global-removal approach (#11657), not this decoration fix. codex OUTPUT_REVIEW flagged it must-fix. When adapting an old test for a NEW fix approach, scrub comments that describe the old implementation's internals — describe what the test VERIFIES, not fictional branches. codex also flags `Closes` vs a dictated `Fixes` keyword.
2. Shared-base drift: a sibling session `git pull`ed the base clone during my ~20min build, advancing local `master` past my branch point, so `git diff master` looked like I reverted unrelated commits. `git diff` (vs my own HEAD) is the true change set; rebase onto the new master + rebuild before shipping.

Also: a manual `gh workflow run ci.yml` on a DRAFT PR yields a benign priority-yield (only `wait-for-human-priority` + `check-ci` fail, ALL build/test jobs skipped) — the `github.ci_failed` webhook that fires is cosmetic, not a real failure; `retry-yielded-bot-ci` reruns it.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785467126768-8125-empty-struct-fix-decoration-removal-not-the-r.md`_
