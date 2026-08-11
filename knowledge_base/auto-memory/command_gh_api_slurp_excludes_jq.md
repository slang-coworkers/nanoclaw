---
name: command_gh_api_slurp_excludes_jq
description: "`gh api --slurp` is MUTUALLY EXCLUSIVE with --jq/--template AND REQUIRES --paginate — exits 1, empty stdout, client-side (no network). Every gh v2.53→v2.97."
metadata:
  node_type: memory
  type: reference
  originSessionId: nanoclaw-pr1071-ci-gate
---

⛔ **`gh api --paginate --slurp --jq '<filter>'` IS REJECTED.** Not a runtime edge case —
client-side argument validation, so it fires before any network call:

```
$ gh api 'repos/x/y/commits/deadbeef/check-runs' --paginate --slurp --jq '.[]'
the `--slurp` option is not supported with `--jq` or `--template`
# exit code 1, stdout EMPTY
```

⛔**THE CONSTRAINT IS TWO-SIDED — `--slurp` also REQUIRES `--paginate`** (measured 2026-08-10,
gh 2.97.0):

```
$ gh api 'repos/x/y/commits/deadbeef/check-runs' --slurp
`--paginate` required when passing `--slurp`
# exit 1
```

⇒ **exactly ONE legal combination exists: `--paginate --slurp`, no `--jq`.** I held only the
exclusion half for months and it made "drop `--slurp`, keep per-page `--jq`" look like a free
choice between two symmetric options. It is not: dropping `--slurp` silently reintroduces
per-page filtering (**measured: a live slang head = 2 pages / 100 check-runs**), so the only
correct fix is to drop `--jq` and select in the caller. ⭐⭐⭐**Knowing a flag pair is forbidden
without knowing what the surviving flag REQUIRES let me recommend the wrong half of the fix**
(nanoclaw#1071 → corrected by #1178; see [[project_nanoclaw_1071_1072_ci_gate_onecli]]).
⇒ **when you record a mutual exclusion, record the survivors' own requirements in the same breath.**

✅**Version bound extended: 2.97.0 behaves identically** (both halves), so still not a local quirk.

Upstream source: `pkg/cmd/api/api.go`, `cmdutil.MutuallyExclusive` under `if opts.Slurp`.
**Bounded across versions — present in v2.53.0, v2.65.0, v2.80.0, v2.96.0** (grepped each tag's
source), so it is NOT a local-gh quirk and NOT something a prod version difference excuses.

## Why this bites specifically

`--paginate` without `--slurp` applies `--jq` **per page**, emitting one line per page. The
natural fix looks like "add `--slurp` and index through the page array (`.[].check_runs[]`)" —
and that exact combination is the forbidden one. The two available fixes:

- **Drop `--jq`**, slurp, and parse the JSON in the caller (this is what
  `slang-pr-approver/scripts/harvest-reviews.py:60` `gh_json()` does — it slurps and calls
  `json.loads`, *no* `--jq`). ⚠️ Citing that file as precedent for slurp+jq is a misreading.
- **Keep per-page `--jq`** (no `--slurp`) and make the caller tolerate multi-line stdout.

## The failure signature is silent-shaped

A caller that wraps the exec in `try/catch → return false` turns this into *"probe failed"* —
indistinguishable from auth/rate-limit/network failure. It never surfaces as "bad flag". Verified
consequence in one instance: 3,225 probe failures read downstream as low coverage.

⭐⭐⭐ **A mocked `child_process` test CANNOT catch this.** Asserting
`expect(args).toContain('--slurp')` against a mock **pins the invalid flag as correct** and
reports green — the real binary never runs. Any test whose subject is *the argv handed to an
external CLI* is asserting a shape, not a behavior; at least one case must execute the real
binary (or validate argv against it) or the suite is guarding the wrong thing.
See [[feedback_a_guard_can_be_inert_and_read_as_passing]],
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]].

⇒ **Check: before shipping any `gh api` flag change, run the exact argv once against a bogus
repo path.** Validation is client-side, so a nonexistent repo still proves the flags parse —
no credentials and no network needed. Related: [[command_ncl_flags_and_caps]] (same class:
an instrument fact keyed to the command, not the incident).
