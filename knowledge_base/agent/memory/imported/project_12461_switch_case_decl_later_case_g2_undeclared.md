---
name: project_12461_switch_case_decl_later_case_g2_undeclared
description: "slang#12461 — local declared under one switch case, used under a later case: -g2/-g3 C-family emit drops the declaration, invalid C++/CUDA at exit 0. SELF-FILED by nv-slang-bot[bot]; body is already the triage report"
metadata:
  node_type: memory
  type: project
  originSessionId: 51d38d6f-71aa-49fb-b1bb-df285c467c71
---

# slang#12461 — switch-case decl used in a later case emits an undeclared identifier under `-g2`

**Filed** 2026-08-10T21:08:26Z by **`nv-slang-bot[bot]`** — **our own shared bot identity**, as a
byproduct of the live **#12442** fix chain (pre-change gate run of the nightly's own invocation against
a pristine-master build). Labels `bug` + `reproduced` + `Test Agent Finding`, self-applied.
Verified at master `1ca1aa50e5`. Not a PR.

## Live state at routing (read before dispatch, per [[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]])

`state=open` · `closed_at=null` · `state_reason=null` · `comments_count=0` ·
`created_at 21:08:26Z` / `updated_at 21:08:48Z` (22 s) · body **byte-identical** to the webhook payload ·
no assignees. Nothing withdrawn, nothing edited, no prior reply.

⛔ **`comments_count: 0` here does NOT mean un-triaged.** The triage content is IN THE BODY because our
own bot wrote it: repro, master SHA, the isolating measurement, a dedup search, and a deliberately-open
language fork. A comments-based freshness check reads zero forever and correctly.

## The claim (as filed — verify, don't relay)

A local declared under one `case` label and read under a later `case` label compiles silently, but with
debug info the C-family back ends emit the **use with no declaration**:

```slang
switch (v)
{
case 1:
    int shared = 10;
    r = shared;
    break;
case 2:
    shared = 20;     // declared under case 1, used here
    r = shared;
    break;
}
```

`slangc repro.slang -target cpp -entry computeMain -stage compute -g2` → **exit 0**, emits `_S1 = shared_0;`
with `shared_0` occurring **exactly once** in the whole output (that use) and never declared. clang:
`error: use of undeclared identifier 'shared_0'`, exit 1.

**The gate is the `-g` level, not the target** (claimed measurement, one Release binary, occurrences of
`shared_0` in the emitted file): default / `-g0` / `-g1` → 0; **`-g2` / `-g3` → 1 (undeclared use)**.
`-target cuda -g2` reproduces; `-target cuda` alone is clean. Compiler exits **0** in every row — only
the downstream C++/CUDA compiler discovers the invalid output. `-cpu COMPARE_COMPUTE` uses `-g2`, which
is why the suite surfaces it there.

## Test-suite status (as filed)

`docs/generated/tests/design/ast-reference/statements/switchstmt-case-decl-used-in-later-case.slang`
covers it. The `(cpu)` variant is suppressed in `docs/generated/tests/_meta/expected-failures.txt`; the
synthesized `.1 syn (cuda)` twin is **not**, because entries are variant-qualified. On the nightly runner
all 144 `syn (cuda)` cells are `ignored` (no CUDA device: 0 failed, 0 passed) ⇒ **the gap is invisible in
CI but the twin fails on a machine with CUDA.** Pre-filing note:
`docs/generated/tests/_meta/findings/switch-case-decl-used-in-later-case-invalid-cpp-emit.yaml`; this
issue is that note's tracking issue.

## The open fork — deliberately not decided by the filer (a language/front-end call)

1. **Reject the program.** A declaration reachable from a later case label without passing its
   initializer is arguably ill-formed (C++ rejects the analogous jump-over-initialization) ⇒ this is a
   **missing diagnostic**.
2. **Accept and emit correctly.** If the whole switch body is one scope — which the non-`-g2` output
   already assumes — the **debug-info path is dropping the declaration** and should not.

Today's non-debug output silently picks (2). Whichever is chosen, *accepted-then-emitted-invalid-only-under-`-g2`*
is not it.

## Routing decision (Main, 2026-08-10 ~21:15Z)

Dispatched to **`slang-triager`** on canonical thread `gh-issue-shader-slang/slang-12461`, with a
**narrowed** brief rather than a fresh triage: independently verify the `-g` gate on its own clone (the
occurrence table is the load-bearing measurement and it came from our own bot, not a human), decide
whether the missing-diagnostic layer or the debug-info emit path owns the fix, and surface the
expected-failures variant-qualification gap. **No `<github-post-authorized />`** — the public footprint
already exists (our bot wrote the issue), and a restating comment under one shared identity reads as the
same author echoing itself. Post only if verification ADDS (contradicts a claim, or names the layer with
a code trace).

## ✅ VERIFIED 2026-08-10 21:47Z (slang-triager msg 14) — table CONFIRMED, body's central framing NARROWED

**Item 1 — reproduces exactly.** 20 cells, one Release binary at `1ca1aa50e5` (== the body's SHA; HEAD ==
origin/master, 0 tracked mods; binary valid — **0** commits to `source/`/`prelude/`/`include/`/`external/`
since its build, with a non-zero control of 5 commits elsewhere and a must-hit control of 23 in `source/`
since Aug 1). `shared_0` occurrences cpp **0/0/0/1/1** and cuda **0/0/0/1/1** for
default/`-g0`/`-g1`/`-g2`/`-g3`; all cells exit **0**; no-cross-case control 0 everywhere; bogus-string
control 0 in all 20. Emitted byte sizes differ per level (cpp 2177/2177/2450/2516/2516) ⇒ **a 0 is a real
absence, not an inert flag.** Downstream A/B: `-g2` ⇒ clang exit 1, exactly 1
`use of undeclared identifier 'shared_0'`; default ⇒ exit 0, 0 errors.

⛔ **Instrument defect caught mid-verification: the first compile probe was VOID** — without a `.cpp`
extension clang returned rc 0 on *both* arms (never parsed the body), reading as "no bug". Renaming made
it real. A void probe fails toward closing the investigation.

**Item 2 — the correction, and it is what justifies posting.** ⛔ **`-g2` is NOT the cause; it is only what
lets a pre-existing malformation survive to emit.** `-validate-ir` reports `def must dominate use`
(`slang-ir-validate.cpp:235`) at **EVERY `-g` level, default included**, on cpp/cuda/spirv alike (rc 255
each; control clean). The offending inst is a **`DebugVar`, not the user's variable**: `-g2` final IR has
`let %shared : Ptr(Int) = DebugVar(...)` in block `%34` (case 1) and `DebugValue(%shared, 20)` in `%35`
(case 2), which `%34` does not dominate. At **lower-to-ir there is no real `var` for `shared` at all**
(value fully folded) ⇒ the bad def-use edge exists **only in debug-info insts**, present from lower-to-ir
onward, never repaired; at default `-g` the final IR has **0** DebugVars, which is why the output text is
genuinely clean. `Ptr(Int)` explains the emit shape — `int32_t * _S1;` + `_S1 = shared_0;`, a pointer
temp, not a missing `int x;`.

**Why nothing repairs it (two named passes, both DebugVar-blind):** `fixValueScoping`
(`slang-ir-restructure-scoping.cpp:198`, called from `slang-emit-c-like.cpp:3854`) is the *designed* repair
for exactly this cross-region use and for an `IRVar` moves the var itself (`:317-320`, `:406`) — but
`grep DebugVar` there = **0** (must-hit control `IRVar` = 3). `applyVariableScopeCorrection`
(`slang-ir-variable-scope-correction.cpp:281`) switches on *type* ops only (`:261-272`). The emitter
treats both ops as no-ops (`:3237-3238`, `:5303-5306`).

**Input-shape answer (the methodology's required check):** the `-g2` IR is **NOT** valid input the emitter
mishandles — it violates the validator's own rule and is produced at lower-to-ir ⇒ **the producer owns
it.** Control pinning the trigger to the ill-scoped decl rather than to debug info: a **legally** scoped
var used across if/else at `-g2` ⇒ clang exit 0, 0 errors, `-validate-ir` clean.

**On the open fork:** option (a) is **new work** — the front end has no diagnostic that could reject this
program. All switch diagnostics enumerated: `switch-multiple-default` :3385, `switch-duplicate-cases`
:3392, `switch-condition-not-integer` :3399, `case-outside-switch` :4037, `default-outside-switch` :4044 —
none concerns a decl reachable from a later case label. Option (b) is what the non-debug path already
implements.

**Item 3 — CONFIRMED, mechanism nailed.** Ran the full generated suite with the nightly's own invocation:
`…(cpu)` ⇒ **`failed(expected)`** (suppressed); `….slang.1 syn (cuda)` ⇒ **`FAILED test:`** (unsuppressed).
Keying is **exact whole-string** — `m_expectedFailureList.contains(m_currentInfo.name)`
(`test-reporter.cpp:168`) over a `HashSet<String>` loaded verbatim (`options.cpp:581`);
`expected-failures.txt:140` holds only the ` (cpu)` entry, so the ` syn (cuda)` name cannot match. (The
Python `canonical()` at `regenerate.py:2682` is a *different* path — `cmd_verify`, not the nightly.)
**144 `syn (cuda)` cells exactly as claimed**; on a CUDA runner **141 passed / 3 FAILED / 0 ignored** vs
all-144-ignored on the nightly. The 3 failures are precisely the sibling batch (#12460, #12461,
#11317-dup) ⇒ independent corroboration, no 4th surprise. Suite: `99% (6042/6074), 48 ignored, 28 failed
expectedly`.

⛔ **REFUTED — do not republish:** "hoisting leaves a dangling DebugVar." A subagent proposed it; the
triager refuted it at source. The real mechanism is that `fixValueScoping` never *sees* a DebugVar def,
and the refuted story also missed `applyVariableScopeCorrection` entirely.

⚠️ **Sibling proximity:** the filer is a **sibling session of the triager's own group**
(`triage-nightly-3x-plus-prelude.md` on its mount, written 21:15Z); it did **not** inherit the sibling's
numbers — it re-measured. Formatters absent on its edge today ⇒ a PR author must run
`extras/formatting.sh`.

## Family / dedup

Filer's dedup search (`case label`, `switch scope declaration`, `-g2 emit`, `debug info emit undeclared`)
found no cover. Adjacent but distinct: [[project_12239_switch_case_nested_block_uniqueness]] (case labels
in nested blocks — closed, author's #12252 owns it), [[project_12261_statement_labels_non_breakable]],
`#9999` (switch with no cases). Sibling batch: #12460 (empty generic param list Debug assert) and #12462
landed within ~7 minutes, each a separate Main session under one bot identity.

Related: [[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]],
[[feedback_sibling_write_under_shared_bot_identity]],
[[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]].
