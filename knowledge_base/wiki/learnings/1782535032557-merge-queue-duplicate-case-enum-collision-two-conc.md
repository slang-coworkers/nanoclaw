---
title: "Merge-queue duplicate-case enum collision: two concurrent PRs appending to the same public enum"
type: learning
topic: misc
source: learnings/1782535032557-merge-queue-duplicate-case-enum-collision-two-conc.md
---

# Merge-queue duplicate-case enum collision: two concurrent PRs appending to the same public enum

**Symptom:** An approved PR whose own head CI is fully green gets evicted from the merge queue by a `duplicate case value` compile error at *merge-group* build time (e.g. `slang-options.cpp: 'SPIRVUnifiedDescriptorHeapStride' and 'CompilerVersion' both equal '153'`). The error never reproduces on the PR branch alone.

**Root cause:** Two PRs both **append a new enumerator** to the same public enum (`CompilerOptionName` in `include/slang.h`, aliased as `OptionKind` in slang-options.cpp). Both branched when the enum tail was at value N, and each independently took "next free = N+1". On their own branches each is unique and green; only when the merge queue batches them together do the two `case` labels collide → duplicate-case build break → both evicted.

**Diagnosis:** `gh pr list --repo <r> --state open --search "<EnumMemberName> in:title,body"` to find the queue-mate, then `gh pr diff <n> | grep -nE "<EnumName>|= 15[0-9]|CountOf"` to confirm it appends the same value.

**Fix (the one the parent confirmed correct):** Renumber YOUR enumerator to the next free value *above the highest claimed value across master + the active queue-mate* (e.g. 153→154), yielding the lower value to the other PR. **Append-only ⇒ no existing enumerator value shifts ⇒ ABI-safe** per the include/ enum rule. The two then hold distinct values in any merge order, and if one merges first the other's explicit literal still slots in cleanly (no permanent gap). Add a clearly-labeled commit explaining the deconfliction.

**Process gotchas:**
- A queued branch blocks ALL pushes (`GH006: queued for merging cannot be updated`). You must **dequeue first** — dequeue is NOT operator-gated (only `gh pr ready`/`merge` are); GitHub's permission model arbitrates. `gh` has no dequeue verb → GraphQL `dequeuePullRequest(input:{id:<PR node id>})`.
- Rebase rewrites history → push with `--force-with-lease=<branch>:<old-remote-sha>`; dequeue doesn't move the head so the lease holds.
- Do NOT re-queue (maintainer-gated); after push, head CI re-runs and a maintainer re-queues.
- The build subagent may need `git submodule update --init external/fast_float` (env-only) before slang compiles — fast_float is reached by slang-lexer.cpp before slang-options.cpp.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782535032557-merge-queue-duplicate-case-enum-collision-two-conc.md`_
