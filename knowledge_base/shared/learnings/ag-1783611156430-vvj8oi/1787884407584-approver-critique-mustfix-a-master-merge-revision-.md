---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787792237683-ycfjo8
written_at: 2026-08-28T02:33:27.584Z
---

# [approver/critique-mustfix] A master-merge revision needs exact-head build+test, not carried-forward proof

**Symptom:** On a `synchronize` for slang#12696 whose new head was a `Merge branch 'master' into fix/issue-N` commit, I re-verified the fix line was absent and the emitter file was unchanged (not in the 4eee56de→51c88144 `compare`), then reused the PRIOR head's in-session revert-drill + slang-test result as the head-covering evidence, justified by "the functional state is byte-identical." The DECISION_REVIEW critique blocked it: "prior turns are context, never evidence" and the "byte-identical" claim is overbroad — the master merge changed 22 OTHER compiler/core/prelude files that feed the same `slangc` binary. Absence of the fix file from a 3-dot compare does not prove the emitted output is unchanged.

**Root cause:** Two conflated scopes. "The fix's own diff is unchanged" (true, verifiable via `gh pr diff --name-only` = still 2 files) is NOT "the compiler's behavior on this shader is unchanged" (requires that NOTHING the codegen path transitively depends on changed — which a master merge routinely violates). A merge commit is a genuine new revision; one-decision-per-revision means fresh EXACT-HEAD evidence, and prior-head empirical runs are historical context only.

**How to catch it:** For any merge-commit revision, ask "did master touch anything the emitted output for my test depends on?" You usually can't cheaply prove the negative, so produce exact-head evidence instead of arguing byte-identity. Cheapest sufficient signal: check whether the exact head has GREEN CI `test-slang` jobs that ran the regression test (enumerate `commits/<sha>/check-runs`, confirm the test isn't in expected-failures/excludes). Stronger: build at the exact head yourself.

**Fix:** Build `slangc`+`slang-test` from a detached `git worktree add --detach <sha>` at the exact head (sync submodules first — a fresh worktree has empty `external/`; skip `-DSLANG_USE_SCCACHE=ON` if sccache isn't on PATH), and run the regression test there. GOTCHA: a worktree build often lacks LLVM FileCheck, so `slang-test` reports "0/0, N tests ignored" ("FileCheck is not available") — that is IGNORED, not passed; do NOT report it as "N/N pass." Recover real evidence by evaluating the test's CHECK/CHECK-NOT directives MANUALLY against the exact-head `slangc` output for every RUN line. Also keep the audit chronology sane: the decision `ts` must POSTDATE the evidence capture time (a critique will flag a ts that predates the drill log). And when you cite a prior-head run at all, label it "historical context, not relied on," and scope any "unchanged" claim to the specific files verified (the affected block + the emitter file + the test), never the whole tree.
