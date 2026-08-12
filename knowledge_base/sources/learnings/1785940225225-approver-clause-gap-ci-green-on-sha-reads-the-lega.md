# [approver/clause-gap] ci_green_on_sha reads the legacy combined-status API, which structurally cannot see Actions check-runs — it is the wrong instrument, not a weak one

## Symptom

On slangpy#925 the `ci_green_on_sha` clause read **pass** —
`combined status=success @ 4743d90ff367` — at ~13:10Z. Measured back-to-back on
both surfaces at the same SHA:

```
# legacy combined-status API — what the clause reads
state=success  total_count=2  contexts=license/cla, CodeRabbit

# check-runs API — where every build leg actually lives
total=17
build (windows, x86_64, msvc, Release, 3.10) | success | completed=2026-08-05T13:44:09Z
build (windows, x86_64, msvc, Debug,   3.10) | success | completed=2026-08-05T13:36:01Z
build (linux,   x86_64, gcc,  Debug,   3.10) | success | completed=2026-08-05T13:29:57Z
…
```

The clause returned green from a surface containing **zero build legs**, while
`build (windows, x86_64, msvc, Release, 3.10)` was still `in_progress` — it
finished **34 minutes after** the pass. (The legs did all eventually succeed, so
the pass was accidentally right about the outcome and entirely unfounded at the
time. That is worse than being wrong, because nothing flagged it.)

## Root cause

`gh api repos/$R/commits/$SHA/status` is the **legacy commit-status API**. It
reports only statuses posted via the statuses endpoint — typically third-party
integrations (CLA bots, CodeRabbit). GitHub **Actions** jobs are *check-runs*, a
different object on a different endpoint, and the combined-status API
structurally cannot see them.

So on any repo whose CI lives in Actions, this clause reads a surface that is
nearly disjoint from the build. Here it was 2 contexts vs 17 check-runs. On a
repo with no third-party status posters at all it would report `state: pending`
with `total_count: 0` — or, with one trivial integration green, a confident
`success` on a repo that never compiled anything.

This is not a precision problem to be tightened. **It is the wrong instrument.**

Documented in-tree, and this is the part to sit with: the host-side
`APPROVER_CI_GATE` exists specifically to replace *"the in-session
`ci_green_on_sha` self-check that was blind to Actions check-runs"* — the defect
was known, a replacement was built, and the replacement defaults **OFF**. A
known-blind check remained the live path.

## How to catch it

Never read one CI surface. Read both and reconcile:

```bash
gh api repos/$R/commits/$SHA/status --jq '"state=\(.state) n=\(.total_count) ctx=\([.statuses[].context]|join(","))"'
gh api "repos/$R/commits/$SHA/check-runs?per_page=100" \
  --jq '"total=\(.total_count)", (.check_runs[] | "\(.name) | \(.status) | \(.conclusion)")'
```

Two falsifiers, both cheap:

1. **Coverage** — if `total_count` on combined-status is small (or its contexts
   are all bots/CLA) while check-runs is large, the green you have is about
   nothing you care about.
2. **Completeness** — any check-run with `status != "completed"` means CI is not
   green *yet*, regardless of what combined-status says. Also compare the latest
   `completed_at` against your decision timestamp: a leg finishing after you
   decided means you decided on an incomplete build.

## Fix

- Treat `ci_green_on_sha` as **unevaluable** unless check-runs were consulted and
  every relevant leg is `completed` with `conclusion: success`. Green on
  combined-status alone is `unevaluable`, never `pass`.
- Prefer `gh pr checks` (which merges both surfaces) over a raw
  `commits/$SHA/status` call, and read the check-run *names* — they carry matrix
  values, which is how you tell whether the leg exercising your change ran at
  all.
- **General principle, and the reusable artifact from this whole exchange:** for
  any clause, ask *which surface does this read, and is that the surface the fact
  lives on?* A green from an endpoint that cannot observe the thing you are
  gating on is a false-safe, not weak evidence. Related audit heuristic: grep a
  clause's source for how many distinct states map to `pass` — more than one
  (here `:184` "policy doesn't require CI" and `:190` "CI actually green") means
  the clause cannot express its own doubt.

This is the same clause failing for a **second, independent** reason; see the
sibling `[approver/clause-gap]` entries on `commit_id` re-pointing and on
`autoMergeRequest`. Common thread across all of them: verify *when* and *where* a
fact was established, not merely whether the field says yes.

## Bonus: how to check whether APPROVER_CI_GATE is armed

Do **not** grep `.env` — that tree has only `.env.example`, so the grep returns a
**false zero**, and a synced snapshot on disk cannot tell you what a running
*process* loaded either. Use the code path: `config.ts:318-320` defaults OFF (an
empty string fails `/^(1|true|yes|on)$/i`); `webhook-github.ts:657` parks on
`APPROVER_CI_GATE && event.headSha`, and since a reviewable event always
populates `headSha` (`github-webhook-server.ts:347`), the guard reduces to the
flag alone — immediate delivery ⇒ gate OFF.

And when enabling it, set `CI_GATE_REQUIRED_SUITE` **in the same change**:
`config.ts:322-329` releases on *any* successful suite when it is unset, so on
this very PR `coderabbitai` plus two trivial suites going green would have
released the approver straight back into the race the gate was built to prevent.
Note the task string is **not** a discriminator — `releaseParkedReviewable`
(`:721`) omits `headSha` and re-enters the same function, so parked-then-released
and never-parked are byte-identical; only timing distinguishes them.
