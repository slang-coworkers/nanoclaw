---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786435332070-exgjs1
written_at: 2026-08-11T08:34:18.677Z
---

# [approver/clause-gap] ci_green_on_sha folds commits/SHA/status — GREEN over the wrong object set; every compiled build is a check-run it cannot see

# `ci_green_on_sha` reads an endpoint that cannot see builds

**Symptom.** On shader-slang/slang#12446 @`b4dabca51fc6`, `ci_green_on_sha`
returned **pass** while `build-windows-debug-cl-x86_64-gpu / build` was
`conclusion=failure` and 5 check-runs were still running.

**Two distinct defects, and the reported one was not the active one.**

1. **The active cause here: policy short-circuit.**
   `eval-clauses.py:181-197` opens with
   `if not policy.get("require_ci_green", True): pass("policy does not require CI green")`.
   `APPROVAL_POLICY.json` (v0-shadow-wide) sets `require_ci_green: false`, so
   **the clause never fetched CI state at all.** Any theory about *which* CI
   signals it filtered is unfalsifiable on this run — nothing was examined.
   In particular a red `check-pr-label` co-existing with a passing clause is
   NOT evidence of deliberate metadata-gate exclusion; there is no
   metadata/build distinction in the code path.

2. **The latent, larger defect: wrong object set.** When the policy DOES
   require green, the clause reads `repos/{repo}/commits/{sha}/status` and maps
   `state`. Measured live on that SHA:

   | instrument | result |
   | --- | --- |
   | `commits/<sha>/status` | `state = success`, folded over **2** statuses (`CodeRabbit`, `SlangPy Tests`) |
   | `commits/<sha>/check-runs` | **81** runs: 22 success, **2 failure**, 52 skipped, **5 still running** |

   Every compiled build in this repo is a **check-run**, and check-runs do not
   appear in the combined-status endpoint. So the clause's instrument reports
   GREEN on a head with a red Windows build. This is not "green measured
   mid-run" — it is **green measured over the wrong object set**, and adding a
   terminal-state requirement would NOT fix it.

3. **A third, real issue that survives both:** the clause maps
   `success`/`failure`/`error`/else and has **no requirement that every run
   reached a terminal state**. A snapshot taken mid-matrix that happens to read
   `success` passes.

**Why it matters asymmetrically.** On an ABSTAIN path a false green is absorbed
— the abstain routes to a human anyway. On a `WOULD_APPROVE` path there is no
absorber: a false green is a false safe. So this must be fixed before any
enforcement, and before `require_ci_green` is ever flipped to true.

**How to catch it.** Generalizes the standing rule *never fold a combined
`/status`*:

- **`/status`'s `state` folds over whatever statuses happen to exist and does
  not know what a build is.** A CLA stamp or a bot status alone can make it
  `success` — green over zero compiled jobs, and such statuses never redden.
- *Did CI pass?* ⇒ enumerate `commits/<sha>/check-runs` **and** compare
  `fetched` vs `total_count`; *is CI done?* ⇒ read `actions/runs/<id>`
  `status`/`conclusion`. A count equality between two numbers from the same
  growing source is a truncation guard, not a completeness one.
- **When a clause passes, read WHICH BRANCH produced the pass.** A pass whose
  evidence string is "policy does not require X" carries **zero bits** about X.
  Treating it as an observation of X is the error; the evidence string is the
  tell, and it is right there in `clauses.json`.
- Corollary: before theorizing about a check's filtering behaviour, confirm the
  check ran at all. An explanation of *how* something was evaluated is worthless
  if the answer is "it wasn't".

**Fix.** Flagged as a policy/clause gap, not improvised around — the approver
does not hand-patch the scripted predicates. A correct `ci_green_on_sha` needs
to enumerate check-runs plus workflow-run terminal state, define which runs are
*required*, and distinguish `unevaluable` (still running) from `fail` (a
required run red).
