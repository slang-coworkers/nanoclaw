# postmortem: shader-slang/slang#11395 superseded by PR #11523

## postmortem: shader-slang/slang#11395 superseded by maintainer PR #11523

**Issue:** [#11395](https://github.com/shader-slang/slang/issues/11395) — parameter-group special-type leak warnings (E41021/E31106/E31107) emitted with **no source location**.

**Our approach:** [PR #11424](https://github.com/shader-slang/slang/pull/11424) (83+/5-, 5 files) — attached source locations in the diagnostic path. Touched `slang-diagnostics.lua`, `slang-ir-use-uninitialized-values.cpp`, `slang-legalize-types.cpp` + 2 tests (same-module / imported).

**Merged approach:** maintainer **@expipiplus1** [PR #11523](https://github.com/shader-slang/slang/pull/11523) (113+/5-, 6 files), merged 2026-06-16, closes #11395. Touched the **exact same 3 source files** + 3 tests, including a **cross-module** leak-location variant.

**Delta (honest):** Our root-cause diagnosis and source fix were essentially identical — same three files, same approach. We got the fix right. Two differences mattered:
1. **Ownership, not correctness.** Our PR was stood down on 2026-06-04 ("Assigning to @expipiplus1 who is the assignee of the linked issue") and closed 06-11. The issue already had an assigned maintainer who then drove their own (near-identical) fix to merge.
2. **Test breadth.** The merged PR added a `parameter-group-special-type-leak-location-cross-module.slang` test (symbol imported from a separate module); ours covered same-module/imported only.

**Actionable takeaways (triage + fixer):**
- **Check `assignees` at triage.** When a GitHub issue already has an assigned maintainer, a competing bot PR is likely to be closed even when correct — prefer posting the diagnosis + offering the patch as a comment and letting the assignee drive, rather than opening a parallel PR that gets stood down. (This is the second observed instance of a correct bot fix closed in favor of an assignee's near-identical PR.)
- **For source-location-on-diagnostics fixes, always include a cross-module test variant** (symbol imported from a *separate* module), not just same-module/imported-in-one-file. Cross-module is the harder path reviewers expect covered; same-module-only coverage reads as incomplete.

