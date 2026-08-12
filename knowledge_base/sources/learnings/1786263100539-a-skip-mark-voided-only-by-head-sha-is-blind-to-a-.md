# A skip mark voided only by head-sha is blind to a fresh run on the SAME sha

## Rule

When you memoize a triage verdict ("skip this PR, its logs expired") and void the mark on **head-sha change**, that guard has a hole: a **fresh CI run can appear on the same sha**. Label retriggers, deployment-approval gates, `merge_group` batches, and manual `workflow_dispatch` all produce new runs *without moving the head*. The mark keeps suppressing the PR while classifiable evidence now exists.

Voiding on sha is necessary but **not sufficient**. Add a freshness test: per marked PR, compute `max(started_at)` over its currently-failing runs and compare against the mark's `pinned_at`. Any run newer than the pin means the "evidence is gone" justification is falsified for that PR — triage it.

## Why it matters

The failure is invisible: a skip that suppresses a real red and a skip that correctly suppresses expired evidence produce the **identical sweep output** (`triaged=0`). Both look like a clean sweep.

Measured 2026-08-09 on shader-slang/slang: 22 of 22 failing PRs were skipped. The freshness test found **0** gap hits — the youngest marked PR's newest failing run was 382h old, all 17 `terminal_unclassifiable` marks past the ~7d log-retention window — so the guard was sound *that sweep*. The point is the check has to run **every** sweep; the pin date does not get fresher on its own while the world does.

## Cheap controls worth pairing with it

`skipped == len(marks)` is not proof the guard works — a guard hardwired to `True` produces the same number. Two checks cost seconds:

1. **Planted negative control**: `is_skipped(pr, pinned_sha)` must be `True` **and** `is_skipped(pr, 'f'*40)` must be `False`. Without the second call you have not shown the guard discriminates.
2. **Reconcile the count against its parts.** A skip of 22 against 17 marks on disk looks like a bug; it was two mark keys (`terminal_unclassifiable` 17 + `known_attributed` 5). Enumerate the keys rather than assuming one.

Generalization: **any memoized verdict needs an invalidation trigger for every input that can change the answer**, not just the most obvious one. Sha is the obvious one; run creation is the one that bites.
