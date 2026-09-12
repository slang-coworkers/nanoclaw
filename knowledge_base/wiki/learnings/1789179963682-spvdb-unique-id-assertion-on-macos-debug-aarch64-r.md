---
title: "spvdb unique_id_ assertion on macos-debug-aarch64 — real bug, flaky trigger, already tracked as #13024"
type: learning
topic: misc
source: learnings/1789179963682-spvdb-unique-id-assertion-on-macos-debug-aarch64-r.md
---

# spvdb unique_id_ assertion on macos-debug-aarch64 — real bug, flaky trigger, already tracked as #13024

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1789178970225-jy38dy
written_at: 2026-09-12T02:26:03.682Z
---

# spvdb unique_id_ assertion on macos-debug-aarch64 — real bug, flaky trigger, already tracked as #13024

**Signature:** `test-macos-debug-clang-aarch64 / test-slang` fails on `tests/debuginfo/debug-do-while-locals.slang` with `Assertion failed: (unique_id_ != 0), function unique_id, file instruction.h, line 251.` — this is `spvtools::opt::Instruction::unique_id()` in the **vendored** `external/spirv-tools` submodule, not Slang's own source.

**Classification: real bug, non-deterministic trigger — not classic GPU/infra flake, not a simple deterministic regression either.** Introduced by PR #12896 ("Vendor spvdb and add SPVDB_DEBUGGER regression tests," merged 2026-09-09). Across 13 completed `merge_group` runs since that merge, 6 failed on this exact job+assertion and 4 passed the identical job/config with zero code changes — PR #12907 alone flip-flopped fail→pass→fail→pass across four requeues. Confined to one job/config (macOS debug clang aarch64); never seen on macos-release-clang-aarch64 or any Linux/Windows leg — consistent with the assert being compiled out under `NDEBUG` in Release. Working hypothesis (unconfirmed): stale/shared state in vendored `libspvdb`'s `Instruction`/IR handling, now linked unconditionally into the long-lived `slang-test` process, so reproducibility depends on test execution order within a worker, not GPU/runner conditions.

**Already tracked — do not re-file.** Issue **#13024** (opened 2026-09-11T23:29:43Z) has the full evidence trail; draft mitigation **PR #13026** quarantines the test pending root-cause fix in spvdb. Sighted again 2026-09-12 ~00:44-02:00Z on an unrelated PR (#13021, packaging/docs-only) and on two other unrelated branches — confirms it's still live/unresolved, but doesn't need a new issue, just cross-reference #13024.

**Process note:** when classifying, check `memory/` for an existing memo BEFORE spawning a fresh CI-history investigation — a same-signature memo (`spvdb-merge-queue-issue-memo.md`) already existed in one babysitter's own memory from ~40 min earlier in this case, and a duplicate ~800s subagent investigation re-derived the same conclusion from scratch. Grep your own memory index for the assertion text / test name first.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789179963682-spvdb-unique-id-assertion-on-macos-debug-aarch64-r.md`_
