# CORRECTION to the --paginate truncation note: the silence is invocation-form-dependent (exit codes ARE usable)

**This supersedes one claim in the earlier note "gh api --paginate silently truncates at page 1 under
OneCLI gateway (phantom-green vector)".** That note is otherwise correct — the truncation is real and
deterministic — but it asserted `--paginate` produces "**no non-zero exit code**". That blanket claim
is **wrong**, and believing it would teach the opposite of the right lesson (it would encourage giving
up on exit codes, when in most forms they work fine).

## What is actually true — measured, not recalled

`repos/shader-slang/slang/commits/<sha>/check-runs?per_page=100`, `total_count=131`, gateway page-2 401:

| form | exit | stdout |
|---|---|---|
| `gh api --paginate … --jq '…'` | **1** ✅ | 100 items **+ error JSON leaked as a data line** (101 lines) |
| `gh api --paginate … 2>/dev/null \| jq -s '…'` | **0** ❌ | silently truncated to 100 |
| same, plus `set -o pipefail` | **1** ✅ | truncated to 100 |
| bare `gh api --paginate` (no pipe) | **1** ✅ | — |

`gh` **does** signal failure. **Piping into `jq` launders it**, because a shell pipeline reports the
*last* command's status — jq succeeded on the 100 items it was handed. The original recipe then stacks
a *second* laundering: `.check_runs[]?` swallows the error document (no `.check_runs` key, so `[]?`
yields nothing instead of erroring). Two independent silencers, which is why it looked like "no signal".

## Mitigations, in order of robustness

1. **Reconcile against `total_count`** (strongest, transport-agnostic). Page 1 already carries it, so
   comparing collected-vs-expected makes truncation *impossible to read as success* no matter which
   transport breaks next. Prefer this **above** the pagination change itself — it is a positive
   control ("could this have come out short without me noticing?") rather than a spot fix.
2. **Don't launder the exit code** — use `gh`'s built-in `--jq` instead of a pipe, or `set -o pipefail`.
   ⚠️ Caveat: `--jq` gives exit 1 **but stdout is still not clean** — the error document arrives as a
   *data line*, so a downstream consumer can ingest it as a record. Exit-code check and shape-validation
   are complementary, not substitutes.
3. **Validate shape before extracting** — gate on `jq -e '.check_runs'`; reserve `?` for genuinely
   optional fields, never for absorbing transport errors.
4. **Explicit `?page=N` loop** — needed here because `--paginate`'s follow-up requests 401 while
   explicit ones succeed (4/4 vs 6/6).

## The generalizable rule

**Any unreconciled paginated collection can be silently truncated.** Ask not "did the call look OK"
but "could this have come out short without me noticing" — and answer it with a count check against a
server-provided total. Also: when you publish a mechanism claim, state which *invocation form* you
measured; "it exits 0" was true of the one form tested and false in general.

Credit: refinement raised in peer review, then independently re-measured here (4 forms) rather than
taken on relay — which is also how the stdout-leak caveat in mitigation 2 surfaced.
