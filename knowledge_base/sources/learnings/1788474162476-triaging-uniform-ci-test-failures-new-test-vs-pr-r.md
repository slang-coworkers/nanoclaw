---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788396091684-auqtux
written_at: 2026-09-03T22:22:42.476Z
---

# Triaging uniform CI test failures: new-test vs PR-regression vs inherited master breakage

When a PR shows *every* `test-slang` job failing uniformly (all platforms/arches, debug+release, incl. CPU-only), that pattern means a **deterministic .slang test failure**, not a GPU flake or infra issue. To find the culprit, don't assume — separate three causes:

1. **The PR's own new test** failing → read the failing-test verdict lines (`gh run view --job <id> --log-failed | grep "FAILED test:"`). If the new test *passes* and something else fails, the new test is fine.
2. **A regression from the PR's change** breaking a *pre-existing, unrelated* test.
3. **Inherited master-side breakage** — PR CI merges the PR into current master, so a red master (e.g. a just-landed semantic-merge conflict between two PRs) makes every rebasing PR red.

**Decisive checks used on PR #12892:**
- Grep the PR's CI log for the suspect master change's fingerprint (here: `E40021` warning from #12830). **Zero hits** ⇒ the PR's CI base predates that commit ⇒ the failure is NOT the inherited master breakage (#12902).
- Confirm the failing test's verdict on **plain master's own CI run** for the suspect commit (`gh run list --workflow CI --branch master`, find the `workflow_dispatch`/push run on that SHA, check the CPU-only job). Here `overload-ambiguous-2.slang` **passed** on master but **failed** on the PR ⇒ regression from the PR, since the test file itself is unchanged (only the 3-line parser diff differs).
- Reproduce locally on the exact PR head: `git fetch origin pull/<n>/head`, `git worktree add <wt> FETCH_HEAD`, build, run the test. (Note: `cmake --preset default` may need `git submodule update --init --recursive` first for `SPIRV-Headers`.)

**Compiler mechanism (the actual bug):** PR #12892 changed `tryParseGenericApp` to feed the already-`CheckTerm`'d base (`checkedBase`) into `parseGenericApp` for the *entire* `BaseGenericKind::Generic` branch (`slang-parser.cpp:3012`). That branch is also reached by overloaded generic *free-function* calls (`myFunc<10,20>(...)`) via the `OverloadedExpr` path (`:2984`). For an overloaded call the correct overload is only determinable from the **call arguments**, which are known only when the full `GenericAppExpr` is checked later — feeding a pre-checked/overloaded base pins the wrong overload early → `error 30019` type mismatch. The narrow, principled fix: only reuse `checkedBase` when `base` is a member-access expr (`as<MemberExpr>(base)` — covers `foo.Bar<>` and `foo->Bar<>` since `DerefMemberExpr : MemberExpr`), whose re-check corrupts the pointer base (the actual #9810 defect); keep the raw `base` otherwise.

Meta: `tests/bugs/overload-ambiguous-2.slang` (issue #4476) is a sensitive canary for overload-resolution / generic-app parser changes — if you touch `tryParseGenericApp` or overload ranking, run it.
