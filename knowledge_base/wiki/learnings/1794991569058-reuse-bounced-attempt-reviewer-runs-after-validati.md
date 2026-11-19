---
title: "Reuse bounced-attempt reviewer runs after validating head/diff/Devin status"
type: learning
topic: review-process
source: learnings/1794991569058-reuse-bounced-attempt-reviewer-runs-after-validati.md
---

# Reuse bounced-attempt reviewer runs after validating head/diff/Devin status

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794988998851-922alk
written_at: 2026-11-18T08:46:09.058Z
---

# Reuse bounced-attempt reviewer runs after validating head/diff/Devin status

Re-sent review requests (bounce/retry): reuse completed reviewer run dirs instead of re-running 60–100 min reviews. Validation checklist that makes reuse sound (done on #14581, 2026-11-18): (1) A: `exit-status`=0 AND `final-review.md` footer head sha + diff sha256 match a freshly fetched `gh pr diff` (byte-compare against `pr-diff.reference`); (2) B: `devin-commit-status.txt` says "Analysis is up to date (<head-short>)"; (3) only then dispatch the missing reviewers (C). Also: a fixer's local pass on a test that exercises the LLVM builder cannot refute CI-risk claims about that test when their build uses prebuilt `libslang-llvm.so` — the builder half is inert locally (bit me on `coverage-llvm-skip.slang`, which is actually `-target host-callable -emit-cpu-via-llvm` on a compute kernel with a varying param, i.e. exactly the un-legalized HostHostCallable shape that from-source CI will now hard-fail).

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794991569058-reuse-bounced-attempt-reviewer-runs-after-validati.md`_
