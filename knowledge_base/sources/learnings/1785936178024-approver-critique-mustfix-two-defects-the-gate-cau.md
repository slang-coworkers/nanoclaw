# [approver/critique-mustfix] Two defects the gate caught on slangpy#925: harvest exit 10 on a minutes-old head, and checking one variable when a replace drops all of them

## Symptom

On slangpy#925 the DECISION_REVIEW critique returned **must-fix** on two
independent points. Both were mine, both were avoidable, and one of them was a
**real regression in the PR that my challenger had cleared**.

## Defect 1 — harvest exit 10 on a head pushed seconds ago is a RACE, not a fact

Timeline:
- head `4743d90ff367` pushed **12:55:32Z**; I was invoked **12:57Z**.
- `collect-reviews.sh` at **13:01Z** → exit **10** (stale-only: newest review was
  6 weeks old against a different commit).
- CodeRabbit posted its **head-current** review at **13:06Z**.
- I synthesized `review-doc.md` at ~13:09Z still describing the tier as
  *Devin-only* and asserting no head-current review existed.
- Re-harvest after the critique → exit **0**, `stale=false`,
  `commit_id == pinned head`.

**Root cause.** Exit 10 (only stale reviews) and exit 22 (no review yet, bot
still working) are *indistinguishable at the moment of observation* when the head
is minutes old. The workflow has an explicit wait-and-re-poll loop for 22 but
none for 10 — and the "run it once, do NOT re-harvest per turn" guidance (a
context-hygiene rule) reads like a prohibition on re-checking. It isn't.

**How to catch it.** Before trusting exit 10, compute head age:

```bash
gh pr view <pr> --repo <o>/<r> --json commits \
  --jq '.commits[-1] | "\(.oid[0:12]) \(.committedDate)"'
```

If the head is younger than ~10 min, treat exit 10 exactly like exit 22: poll and
re-harvest before synthesizing. Cost is one cheap call; the miss discards the
primary review signal — the same class of failure as the slang#12064
`harvest_used=0` miss.

**Fix.** Re-harvest before writing the doc whenever head age < ~10 min. Disclose
the correction in the doc rather than silently overwriting — the timing error is
itself audit-relevant.

## Defect 2 — "replace, not extend" means enumerate EVERY variable, in EVERY scope

The PR added, at workflow level:

```yaml
CIBW_ENVIRONMENT_LINUX: "BUILD_RELEASE_WHEEL=1 CMAKE_ARGS=-DSGL_SLANG_GLIBC_COMPAT=ON"
```

I correctly identified that cibuildwheel's `CIBW_ENVIRONMENT_<PLATFORM>`
*replaces* rather than extends `CIBW_ENVIRONMENT`, checked that
`BUILD_RELEASE_WHEEL=1` was re-declared, found it was, and wrote *"the author got
this right."*

Wrong. There was a **second** variable — in a **different scope**. The
`Build wheels` step sets, at step level:

```yaml
CIBW_ENVIRONMENT: "BUILD_RELEASE_WHEEL=1 SLANGPY_VERSION_OVERRIDE=${{ env.SLANGPY_VERSION_OVERRIDE }}"
```

Step-level `env:` overrides workflow-level **for the same key only**. The step
never sets `CIBW_ENVIRONMENT_LINUX`, so the new workflow-level value survives
into the step and wins on Linux ⇒ `SLANGPY_VERSION_OVERRIDE` is silently dropped
for Linux wheels. On `nightly` that variable carries the computed
`${MAJOR}.${NEXT_MINOR}.0.dev${N}` version, so Linux dev wheels would be
versioned differently from the Windows/macOS wheels built in the same run — and
published that way.

**Root cause.** I applied the right rule to a sample of size one. Establishing
"this replacement drops everything not re-declared" creates an obligation to
enumerate the *complete* set of variables the replaced value carried, across
*every* scope that sets it — not to spot-check the one visible at the same level
as the new line.

**How to catch it.** Grep the whole file for both the generic and the
platform-specific key, and diff the effective sets:

```bash
gh api "repos/$O/$R/contents/$WF?ref=$SHA" --jq '.content' | base64 -d \
  | grep -n 'CIBW_ENVIRONMENT\|<VAR_OF_INTEREST>'
# then the same against ref=main and compare pre/post effective env per platform
```

The pre-vs-post comparison is what proves *regression* rather than pre-existing
condition — and it is what turns a bot's finding into confirmed evidence.

## Fix (transferable rule)

When a diff introduces a **narrower-scope override** of an existing config key —
`CIBW_ENVIRONMENT_LINUX` vs `CIBW_ENVIRONMENT`, a platform/target-specific CMake
var, a per-job `env:` shadowing workflow `env:`, a `_DEBUG`/`_RELEASE` variant —
the check is:

1. Enumerate every scope that sets the generic key (workflow, job, step).
2. Union all variables those values carry.
3. Confirm each survives in the narrower value, per platform.

Verifying one variable and generalizing is the failure mode. And note the
direction of the miss: the bot review caught what my challenger cleared, while
Devin also reported clean — so on packaging/CI-infra diffs, a head-current
CodeRabbit finding deserves weight even though its verdict mapping is "fuzzier"
than a production review's.

See also: `[approver/challenger-miss]` on the trigger-present control (same PR —
green CI was vacuous and did not surface this defect either).
