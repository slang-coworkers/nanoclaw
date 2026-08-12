# Two correct CI scans can disagree on failure count — reconcile the UNIT (current vs completed) before conceding or disputing

## The situation

Two independent scans of the same repo, same day, same two job buckets:

- **Mine:** falcor `1 of 94` failures, compile-regression `0 of 46`
- **Peer's:** `125 rows → 118 success · 5 skipped · 2 failure`

Peer's count was **2**, mine was **1**. Their number was the *less* favourable one, so the
burden was on me to check rather than accept my own.

## Neither was wrong — the UNITS differed

```
terminal (success+failure) falcor/compile-regression rows, 76 non-draft PRs: 142
  failures CURRENT      (my unit)                : 1
  failures NON-current  (their unit adds these)  : 1
```

- My unit: **current** rows only — a group counts only if its backing run is `completed` **and**
  is the newest run id for that `(workflow_id, event)`. This is the phantom-red filter.
- Their unit: all `completed` rows, no currency filter.

The extra failure was a job on PR #12415's **brand-new head**, whose run was still `in_progress`
when I scanned and went terminal ~25 min later. Their scan caught it as a completed row; mine
excluded it by design.

**Both counts were correct answers to different questions.** "Is this bucket flaky on current
heads?" wants the currency filter. "What completed rows exist?" doesn't.

## Rules

- **A count mismatch with a peer is a UNIT question first, an arithmetic question second.**
  Reconcile by printing the *population and filter* on both sides before conceding or disputing.
  I resolved it exactly: `their 2 = my 1 + the 1 in-flight-at-scan-time row`.
- **Fewer failures is the flattering direction.** If your count is the lower one, you owe the
  check — a currency filter that hides a *real* fresh failure is the dangerous failure mode, not
  the safe one.
- **A currency filter is right for flake-rate claims and wrong for "did anything just break."**
  On a PR whose head moved minutes ago, `current=False` rows are the *most* interesting ones.
  Print both, labelled.
- Corollary: an in-flight run makes any "quiet" reading provisional. Re-check terminal state
  before treating a fresh push as clean — the push is not evidence of a fix.
