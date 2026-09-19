---
title: "Reviewing a stacked Slang PR in pr mode: expect the whole-stack diff + master-vs-PR-head false alarms"
type: learning
topic: slang-compiler
source: learnings/1789735770801-reviewing-a-stacked-slang-pr-in-pr-mode-expect-the.md
---

# Reviewing a stacked Slang PR in pr mode: expect the whole-stack diff + master-vs-PR-head false alarms

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789733284125-kp415w
written_at: 2026-09-18T12:49:30.801Z
---

# Reviewing a stacked Slang PR in pr mode: expect the whole-stack diff + master-vs-PR-head false alarms

When `/slang-pr-review` runs `--mode pr` on a **stacked** PR whose head branch has diverged from its declared base (base = an unmerged sibling fix branch, PR shows CONFLICTING/DIRTY), `gh pr diff` returns the **cumulative** diff — the whole stack — not just the top commit. Concrete case: PR #13176 was described by the fixer as "1 file, +12 net" (one guard in `validateSpvSnippet`), but `gh pr diff` returned **11 files / +332** because the base `fix/issue-13168` didn't yet contain the ancestor commits (#13171 error-count gate, #13173 the whole `validateSpvSnippet` function). This is normal for stacked PRs pre-rebase. Action: proceed in pr mode (it's a superset, more thorough), but **scope the verdict explicitly** — state which findings touch the #Ntop-commit delta vs. the ancestor code visible in the diff, and note it self-corrects on rebase.

Second, recurring, high-value pattern: the correctness runner (Reviewer A) checks out `origin/master` locally and reviews via `gh pr diff`. Subagents that read the **local checkout** (master) to verify a claim will MISS anything introduced by an unmerged stacked dependency. In #13176, 3 of 6 subagents raised a false alarm — "no `emitSPIRVFromIR` error-count gate exists, so the fix can't work" — because they grepped `master`, which predates dep #13171. The gate IS present at PR head (`slang-emit-spirv.cpp:12220-12222`). Reviewer A's editorial filter caught and dropped it. Lesson for the merge step: when a "the fix doesn't work / X doesn't exist" finding appears on a stacked PR, check whether the subagent verified against **PR head** or the local **master** checkout before relaying it — and tell the fixer explicitly not to chase master-vs-head false alarms.

Also: Devin (Reviewer B) reliably **times out (exit 3)** on DRAFT PRs it hasn't finished analyzing — treat as an expected best-effort skip, set `reviewers_complete=false`, and note the verdict rests on A+C.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789735770801-reviewing-a-stacked-slang-pr-in-pr-mode-expect-the.md`_
