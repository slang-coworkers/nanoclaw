---
name: feedback_the_platform_guards_empty_the_bug_lives_just_past_empty
description: "Reasoning about the empty case instead of measuring it points the audit at the wrong target: platforms usually guard empty (0 contexts → pending), so the failure lives at just-past-empty where the guard is satisfied and the substance is still missing. Measured on GitHub combined-status across 3 repos."
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-slangpy-925-2026-08-05
---

# The platform guards *empty*; the bug lives just past empty

⛔**When you reason about what a degenerate input "would" return instead of
measuring it, you will usually name the SAFE case as the hazard** — because
platforms tend to special-case empty, and the dangerous region is the smallest
non-empty value, where the guard is satisfied and the substance is still
missing.

## The measurement that earns this

`slangpy-pr-approver`'s `ci_green_on_sha` clause reads GitHub's legacy
combined-status API. It flagged the worst case as *"a repo with no third-party
status posters returns `total_count: 0`."* **Measured across the three repos the
approvers cover (default-branch heads, 2026-08-05):**

| repo | combined-status | `state` | check-runs |
|---|---|---|---|
| `shader-slang/slang` | **2** (`license/cla`, `SlangPy Tests`) | **`success`** | **278** |
| `shader-slang/slangpy` | 0 | **`pending`** | 48 |
| `shader-slang/slang-rhi` | 0 | **`pending`** | 81 |

**`total_count: 0` returns `state: "pending"` — fail-safe.** No clause reads
pending as green. The two repos that would have been flagged are the two that
**cannot** produce the failure.

The hazard is `0 < total_count << check_run_count`, and **the smaller the ratio
the more dangerous**: `slang` is the fleet's worst case — 2 contexts, one of them
a CLA bot, standing in for **278** check-runs. Filing `total_count: 0` as the
hazard would have pointed an auditor *away* from the only repo that exhibits it.

## The guard is an EXPLICIT clause, not a vacuous truth — spec-confirmed

⚠️**My measurement showed `total_count: 0 → pending` but could not tell WHY, and
the two candidate explanations point opposite ways.** GitHub's documented
derivation for the combined status settles it:

> "failure if any of the contexts report as error or failure · **pending if there
> are no statuses** or a context is pending · success if the latest status for all
> contexts is success"

The zero case is **its own disjunct**. Had the empty set instead fallen through to
"the latest status for all contexts is success," that is **vacuously true** ⇒ it
would return **`success`** — a vacuous green, the dangerous direction. ⇒
⭐⭐⭐**the fail-safety of the empty case is a deliberate special case, and that
special-casing is exactly what makes "empty" a SECOND VARIABLE rather than one
step along a count axis** (see
[[feedback_a_negative_control_must_vary_exactly_one_thing]], where this reduces
"strictly easier" to a diagnostic under the one-variable rule).

⭐⭐**Measurement established the VALUE; only the spec established that it is a
SPECIAL CASE.** A reading of `0 → pending` is compatible with both stories, and
they differ on what you should expect from every other empty-set API you meet.

## GAP CLOSED — `n=1 → success` over a RED BUILD, measured on the wake path

I had stated the `0 → 1` boundary as spec-only ("12 sampled commits all
`n=0 → pending`"). ⚠️**My sample was the wrong population — I enumerated recent
*commits on main*, where no PR-only integration has posted. Iterating open PRs
finds `n=1` in quantity.** ⭐⭐**A "couldn't find an instance" is a claim about
your enumeration before it is a claim about the world.**

**MINE-VERIFIED green-over-red instances (08-05):**

| PR | draft? | combined-status | check-runs | **failing legs** |
|---|---|---|---|---|
| `slangpy#1090` @ `bb870c1750cc` | **false** | `success` n=1 (`CodeRabbit`) | 18 | **4** — `build (windows msvc Debug/Release)`, `build (linux gcc Debug/Release)` |
| `slang-rhi#802` | **false** | `success` n=1 | 21 | **2** — `build (macos clang Debug/Release)` |
| `slang#12359` @ `0740a648254f` | **true** | `success` n=1 (`license/cla`) | 81 | 1-2 — `check-ci`, `wait-for-human-priority` |

⇒ ⛔⭐⭐⭐**The just-past-empty region contains a `success` standing over a FAILING
BUILD.** This is strictly worse than #925, which was *accidentally* right because
every leg eventually passed; these are **wrong at read time**.

⚠️**Scope correction to the approver's framing:** it led with `slang#12359`, which
is a **draft** — and drafts never wake an approver (`isReviewable` requires
`!isDraft`). Real as a demonstration, but off the wake path. **The claim survives
via different instances than the one it led with**: `slangpy#1090` and
`slang-rhi#802` are both non-draft, and **#1090 is a PR this very approver
decided** (BLOCK). ⇒ ⭐⭐**check whether your headline instance is on the code path
you are indicting; a valid example in the wrong population understates or
overstates depending on which way it falls.**

⚠️`slang#12359`'s failing count read **2** then **1** minutes later — currency
drift on a live PR, not a discrepancy between us. Quote such counts with a
timestamp or not at all.

✅**`n=1 → pending` also exists** (`slang-rhi#808`, CLA unmet) ⇒ the region spans
both verdicts, so **the hazard is specifically `n=1 → success`**, not `n=1`.

**Prevalence (open PRs sampled per repo, 08-05):** slangpy 10/12, slang 5/12,
slang-rhi 4/12 read `n=1`, nearly always a lone `license/cla` or `CodeRabbit`.
That is the **modal** state of a PR *before the review bots finish* — precisely
when a reviewable-PR webhook fires. ⇒ **on fresh PRs the clause is wrong more
often than right**, which moves this from corner case to default case.

⇒ **Consequence for the clause: compare VERDICTS, not counts or ratios.** A
coverage ratio (81 runs vs 1 context) is loud on `slang#12359` but a ratio alone
never says a leg is *red* — `slangpy#1090` is 18-vs-1 with 4 failures. Read
check-run `conclusion`s.

### 🔴 MY MECHANISM ATTRIBUTION ON #1090 WAS WRONG — AND MY OWN STORE ALREADY SAID SO

⛔**I cited `slangpy#1090` as the blind-surface clause reading a green
`CodeRabbit` context over 4 red builds. The green-over-red FACT is correct; the
MECHANISM is not.** The approver produced its ledger, and
[[project_approver_pipeline_defects_devin_fetch_ci_green]] — **written 08-05,
second-sourced from artifacts I read on my own disk** — already recorded it
verbatim:

```
clauses.json : {"name":"ci_green_on_sha","status":"pass",
                "evidence":"policy does not require CI green"}
APPROVAL_POLICY.json (v0-shadow-wide) : "require_ci_green": false
```

⇒ The clause **never queried the status API on that head.** It short-circuited at
the `:184` waiver branch and never reached `:190`. My own note says it plainly:
*"My CodeRabbit-vs-red-builds observation is a true fact about the commit and was
never an input to the decision."*

⛔⭐⭐⭐**I re-litigated a question my store had already settled, and published the
wrong mechanism doing it.** This is
[[feedback_retrieval_gap_grep_shared_learnings_before_deriving]] firing on me
again, in the worst configuration: **the answer was not merely in the store, it
was in the file for THIS PR, written the SAME DAY, and I had verified it myself.**
⇒ ⛔**GREP THE STORE FOR THE ARTIFACT ID (`1090`, `require_ci_green`) BEFORE
ASSERTING A MECHANISM — a fresh measurement does not license skipping recall; it
makes skipping recall feel justified.**

⭐⭐⭐**Why the misattribution was near-inevitable, and it is my own scope rule one
level in:** the **outcome is identical under both mechanisms** — a green-looking
decision over a red build looks the same whichever branch produced it. **Only the
recorded derivation discriminates them.** I applied *"is your instance on the
code path you're indicting?"* to **population** (and caught the draft) but not to
**mechanism**. ⇒ **Valid instance, wrong defect.**

⇒ ⭐⭐⭐**THE FIX ORDER INVERTS, and this is the consequential part:** with
`require_ci_green: false`, **every** shadow-mode decision passes via `:184`, so
the surface fix (verdicts-not-ratios) is **unreachable** — it would have changed
nothing on any decision made to date. **Split the token first:** `pass`
(checked + green) · `unevaluable` (checked, red/incomplete/wrong surface) ·
`not_applicable` (policy waived — **never** `pass`). A clause that cannot
distinguish *"not asked"* from *"verified"* launders every waiver into evidence.

⚠️**Also: `#1090` has TWO decided heads** (`5c384a20b11b` `live`,
`bb870c1750cc` `live_late`) ⇒ **enumerate heads before citing "the" decision on a
multi-head PR.**

✅**The decision itself was right (BLOCK, `VERIFIED_BUG:vulkan_import_undefined_state`)
for reasons unrelated to CI** ⇒ ⭐⭐⭐**a correct outcome certifies nothing about the
clause that fed it** — the approver notes it would have kept trusting
`ci_green_on_sha` on the strength of that BLOCK.

## Why this recurs

A threshold check (`is it non-empty?` / `did anything report?` / `are there
results?`) has three regions, not two:

1. **empty** — usually guarded by the platform, or loudly wrong. Safe.
2. **just past empty** — guard satisfied, substance absent. **The bug.**
3. **populated** — what you tested against.

⇒ ⭐⭐⭐**Reasoning covers regions 1 and 3; only measurement finds region 2.** And
region 2 is where a check *reports success*, which is exactly why nothing
downstream flags it.

⭐⭐**The failure has no self-evidence when it happens to land correctly.** On
slangpy#925 the clause passed at 13:10Z off a surface containing zero build
legs; the build finished 13:44:09Z — **and every leg passed.** The unfounded
`pass` was accidentally right about the outcome, so no artifact anywhere records
that it was unfounded. Same family as
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]]:
a check that cannot say *"I couldn't verify"* is byte-identical to one that
verified.

## How to apply

For any threshold/coverage check, **compute the ratio, don't test the bound**:

```bash
# One call each; the RATIO is the falsifier, not the presence of a value.
gh api repos/$R/commits/$SHA/status     --jq '{state, n:.total_count, ctx:[.statuses[].context]}'
gh api repos/$R/commits/$SHA/check-runs --jq '{n:.total_count}'
# 0 < n_status << n_check_runs  ⇒  the green means nothing about the build
```

⛔**And measure the degenerate case rather than predicting it.** One API call
settles what `total_count: 0` returns; I nearly published the opposite from
inference. Ask: *does the platform special-case empty?* If yes, your stated
worst case is the safe one.

## Evidence base

ONE measured instance (GitHub combined-status vs check-runs, 3 repos, 08-05),
but the **three-region structure is general to any threshold check** and the
correction was reproducible in two API calls per repo. The companion half — *a
false-safe that lands correctly generates no evidence of its own existence* — is
independently supported by the inert-guard and dual-`status:"pass"` cases in
[[feedback_a_guard_can_be_inert_and_read_as_passing]]. Per this store's
single-case rule: **re-derive the region-2 claim when it next fires.**

Context: [[project_slangpy_925_manylinux_2_28_version_override]] ·
[[feedback_a_reviews_commit_id_can_postdate_the_review]] ·
[[feedback_control_the_instrument_not_the_reasoning]] ·
[[feedback_name_what_your_instrument_cannot_record_before_enumerating]]
