---
name: feedback_gh_paginate_401s_on_page2_use_explicit_pages
description: "A paginated `gh` fetch can stop early and still look complete. During the OneCLI outage `--paginate` 401'd on page 2+, and a `| jq`/`| wc -l` wrapper hid gh's exit 1. To COUNT, use `search/issues` total_count at per_page=1 (abort on incomplete_results). To LIST, loop explicit ?page=N until a short page and reconcile against the count. A page length equal to per_page means another page."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-03
---

# A paginated fetch that stops early looks exactly like a complete one

**Use this when you are counting or listing anything repo-wide with `gh`.** Reproduced by Main on
2026-08-03 against shader-slang/slang#12208 (126 check-runs), after slang-ci-babysitter reported it.
Distilled 2026-10-01 from an append log; the re-measured mechanism below replaces the earlier wording.

## The defect

During the OneCLI GitHub-connection outage ([[project_github_actions_graphql_401_outage]]),
`gh api --paginate ".../check-runs?per_page=100"` returned page 1 (100 items) and then got a 401
`app_not_connected` on page 2. An explicit `?page=2` on the same URL returned the other 26 items.
The babysitter saw `--paginate` fail 4 out of 4 times and explicit `?page=N` succeed 6 out of 6.

**What hides it is the wrapper, not `gh`.** Main re-measured this with `PIPESTATUS` on 2026-08-04:

| form | result |
|---|---|
| `gh api … --paginate --jq '…'` (bare) | **exit 1**, so `gh` reports the failure honestly |
| `gh api … --paginate \| wc -l` / `\| jq …` | `$?`=0 because the shell reports the **last** stage (`PIPESTATUS`=`1 0`) |
| with `set -o pipefail` | `$?`=1, so the failure comes back |

- The `app_not_connected` JSON is printed on **stdout**, joined to the last item with no newline in
  between. It breaks `jq` and any strict parser.
- `jq '[.[]|.check_runs[]?]'` also drops the error document silently, because of the `?`.
- Net effect: the list stops at 100 items, the exit code is 0, and nothing signals the problem. A red
  check on page 2+ reads as GREEN. On 08-03, 6 of the open PRs had more than 100 checks. The
  babysitter re-swept all 6 and found no hidden reds.
- ⛔ Don't record that "gh swallows its own error". It doesn't. That earlier claim blamed the tool for
  what our own command did. General rule: [[feedback_never_read_an_exit_status_through_a_pipe]].

## The rule

1. **To count:** use the search API. It has `total_count`, so there is no pagination loop:
   ```bash
   gh api "search/issues?q=repo:OWNER/REPO+is:pr+is:open+draft:false&per_page=1" \
     --jq '.total_count, .incomplete_results'
   ```
   ⛔ **Abort if `incomplete_results` is true.** A partial answer still parses cleanly (this guard came
   from slang-ci-babysitter). Search has its own small rate bucket (`limit: 30`), so use it for the
   **denominator only**, never for the fan-out (see [[project_critique_gate_pulls_pattern_builtin_floor]]).
   Search is a different code path from the listing it checks, which is why it works as a real
   cross-check.
2. **To list items:** loop explicit `?page=N`. `/pulls`, `/issues` and `/commits` have no
   `total_count`, so stop only on a **short page** (`length < per_page`). Then reconcile the number of
   items you collected against the count from step 1, and fail loudly on a mismatch (the babysitter's
   guard is called `__COUNT_MISMATCH__`).
3. If you must pipe, `set -o pipefail` or test `PIPESTATUS[0]`.
4. **Report `checked N of M`.** Never report "no failures" without the denominator. Sweeping 20 of 76
   is silent loss of coverage, not a saving.

⭐ **Check the raw page length, not your filtered subtotal.** On 08-03 Main reported "54 non-draft open
PRs" from a single `per_page=100` call. 54 is under 100, so it didn't look capped, but the
*unfiltered* page held exactly 100 rows, which was the tell. The full count was 233 open / 76
non-draft. See also [[feedback_a_round_count_at_a_page_boundary_is_a_truncation_signal]].

## Reference values (shader-slang/slang, 2026-08-03 ~18:5xZ, drifting about −1/hr)

| population | count | method |
|---|---|---|
| open PRs, non-draft | 76 | paginated REST *and* `search draft:false` |
| open PRs, draft | 157 | `search draft:true` |
| open PRs, total | 233 | pages 100/100/33, page 4 empty; unfiltered search |

76 + 157 = 233. Reconciling three ways pins down the whole split, not just each part. These numbers
are a historical datum to check against. Re-measure before you rely on them.

## Lessons this produced

- **Correcting someone needs more rigour than the claim it corrects.** The truncated "54" was produced
  while checking the babysitter's figure, which turned out to be right. When you are checking someone
  else's number, a cheap spot-check feels like enough, and the wrong correction then carries extra
  authority.
- **When the answer is a total, checking its size proves nothing.** 53 and 32 looked plausible, but
  they were page 1 of 3. The only control that works is a **second, independent instrument** (search
  vs. REST). State any disagreement plainly; don't explain it away as "probably a scope difference".
- **This was a retrieval failure, not a new discovery.** On 08-04 Main used `--paginate` four times,
  one day after writing this file, and the triager published `32 of 53` as a base rate (the truth was
  50 of 74). Every result under 100 items came back correct, which is why the habit survived. File a
  lesson under the **question** that should bring it to mind ("am I counting repo-wide?"), not under
  the incident: [[feedback_a_rule_filed_under_its_consequence_never_fires]].
- Same family: the babysitter's 200-byte error-scan window ([[project_12116_dxc_prebuilt_zip_500_fetch_flake]])
  and `gh pr checks` showing green on empty stdout ([[feedback_gh_auth_status_misleading]]).

## Related caps (they have their own concepts)

- `ncl` `list` verbs cap silently at 200 rows. On 08-04 a capped `ncl sessions list | grep` made it
  look as if #8306/#8785 had never been dispatched. Before you conclude a record is ABSENT from any
  listing, count the rows and compare against the cap. See [[command_ncl_flags_and_caps]] and
  [[project_8306_8785_triager_session_never_produced_a_turn]].
- The babysitter wake payload was clamped at 20 PRs, and its `evicted` field was empty because of the
  outage: [[project_babysitter_wake_payload_clamp_20]].
