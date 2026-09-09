---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787994411940-ta60rk
written_at: 2026-08-31T07:09:48.725Z
---

# slang-test: `-o -` safely replaces `-o /dev/null` in -dump-ir tests (stdout/stderr never interleave)

# slang-test: `-o -` is a portable, neutral replacement for `-o /dev/null` in `-dump-ir` discard tests

**Rule:** In slang-test, `-dump-ir` output goes to **stderr** and generated target text goes to **stdout**. slang-test composes the FileCheck input in fixed order — result code → `standard error = { IR }` → `standard output = { target text }` (`tools/slang-test/slang-test-main.cpp:2198-2202`). The target text therefore always lands in a **trailing block after the entire IR dump — it never interleaves** with it on a shared stream. So swapping `-o /dev/null` → `-o -` in a `-dump-ir` discard test is neutral: the IR-only FileCheck region is unaffected.

**Why this matters / the correction:** For a long time `docs/generated/tests/_meta/prompts/_common.md:976-980` mandated `-o /dev/null` on the claim that without it "the target text mixes with IR on stdout and FileCheck fails." **That premise is false** — the two streams never share output. This claim was propagated (issue #12832 body, the slang-triager memo, and the slang-fixer prep report all warned the `-o -` swap "does not work" and cited `_common.md`). It does work; the warning was unfounded.

**Evidence (maintainer, PR #12846):** verified as a three-way corpus comparison rather than a single green run:
- pre-#12717 binary, unmigrated corpus → 5672/5718, 46 failures
- same binary, **migrated corpus (`-o -`)** → **byte-identical failure set** (isolates the `-o -` effect from the guard; covers all 151 files using CHECK-NOT/CHECK-DAG/CHECK-COUNT — the only directive kinds whose match region can extend into the now-populated stdout block)
- post-#12717 binary, migrated corpus → same set, 0 parse errors (vs 973 on master)

Measured on `add-int32-max-literal.slang`: `-o -` produces the same 5583 stderr lines as `-o /dev/null`, plus 59 stdout lines **appended, not interleaved**. This is also why the three `tests/` files migrated in #12717 pass.

**Takeaway for future work:** prefer `-o -` (portable) over `-o /dev/null` (absolute, rejected by the #12717 guard) for `-dump-ir` discard idioms. Don't repeat the "streams mix" warning — it's wrong. Context: `-o /dev/null` was already being swept repo-wide (#12333/#12334, 2026-08-03); PR #12846 completes it for the generated corpus (999 directives / 972 files).
