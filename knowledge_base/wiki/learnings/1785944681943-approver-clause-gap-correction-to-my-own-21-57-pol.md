---
title: "[approver/clause-gap] CORRECTION to my own 21/57 policy-staleness claim — 17 were era-correct; the real defect is 4 runs where STAGING FELL BACK to the skill-bundled default (byte-identical) and precedence 2 then loaded it over the mount"
type: learning
topic: review-approval
source: learnings/1785944681943-approver-clause-gap-correction-to-my-own-21-57-pol.md
---

# [approver/clause-gap] CORRECTION to my own 21/57 policy-staleness claim — 17 were era-correct; the real defect is 4 runs where STAGING FELL BACK to the skill-bundled default (byte-identical) and precedence 2 then loaded it over the mount

# [approver/clause-gap] I compared every snapshot to *today's* policy instead of the one in force at its own timestamp

## Symptom

I reported that **21 of 57** approver run workspaces were decided under a stale
policy, because their per-PR `policy/APPROVAL_POLICY.json` was not
`v0-shadow-wide`. That number is wrong by 4×.

Policy eras, from the policy's own `_comment`: `v0-shadow` → `v0-shadow-relaxed`
(2026-07-10) → `v0-shadow-wide` (2026-08-04, human-signed). Comparing each staged
snapshot's version against the era of its own staging mtime:

```
918-57259b457b4c   v0-shadow          2026-07-22   *** STALE (expected v0-shadow-relaxed)
1078-b76c8065612d  v0-shadow          2026-08-04   *** STALE (expected v0-shadow-wide)
1078-06e7ddad232a  v0-shadow          2026-08-05   *** STALE (expected v0-shadow-wide)
925-4743d90ff367   v0-shadow          2026-08-05   *** STALE (expected v0-shadow-wide)
… the other 17: v0-shadow-relaxed staged 07-10 … 08-03 = CORRECT for their era
```

**17 of the 21 loaded exactly the policy in force when they ran.** Pinning the
then-current policy at decision time is *correct* auditability behavior, not
contamination. My inventory flagged them only because I compared every snapshot to
the version current *now*.

## Root cause

Two distinct errors, and the second one only became visible after fixing the first.

**1. I dated correctness from now instead of from when the condition obtained.** This
is the two-birthdays error — the same one I had already filed twice in this same chain
(a risk dates from when the condition arose, not when it was reported). A staleness
test is inherently era-relative; an absolute comparison manufactures a false positive
per policy transition. 21 alarms, 4 real.

**2. The 4 real ones have a narrower mechanism than "staging precedence."** All four
are **byte-identical** (`cmp -s`) to the skill-bundled
`scripts/APPROVAL_POLICY.json`; the 17 era-correct snapshots all **differ** from it
(negative control). The bundled default is `v0-shadow`, which is exactly what all four
pin. So the defect is not "a stale snapshot got staged" — it is:

> **staging fell through to precedence 4 (the bundled default) and wrote that into
> `<ws>/policy/`, where precedence 2 then loaded it in preference to the group mount.**

A *fallback* silently became an *authoritative pin*. That reframes the fix: per-PR
pinning stays (it's the auditability feature); what must change is that staging never
falls back to the bundled default when a mount exists.

## How to catch it

Make every staleness comparison era-relative, and control against the fallback source:

```bash
# era-relative: staged version vs the era of its own mtime
for d in work/*/; do P="$d/policy/APPROVAL_POLICY.json"; [ -f "$P" ] || continue
  v=$(python3 -c "import json;print(json.load(open('$P'))['policy_version'])")
  m=$(stat -c '%y' "$P" | cut -d' ' -f1); echo "$(basename $d) $v $m"; done
# is the snapshot just a copy of the bundled fallback?
cmp -s "$P" "$SKILL_DIR/scripts/APPROVAL_POLICY.json" && echo "FELL BACK TO BUNDLED"
```

Falsifiers: (1) staged version == the version in force at staging mtime ⇒ **not**
stale, however old it looks now; (2) snapshot byte-identical to the bundled default ⇒
staging fell back rather than copied the mount — and the *negative control* (era-correct
snapshots differ from bundled) is what makes that diagnostic rather than coincidental.

## Fix

- **4 decisions to re-derive, not 21:** `925-4743d90ff367`, `1078-b76c8065612d`,
  `1078-06e7ddad232a`, `918-57259b457b4c`. #925's ABSTAIN_POLICY
  (`CLAUSE_FAIL:no_protected_paths` on `.github/**`) remains spurious — that finding
  is unaffected.
- Staging must copy the **live mount**, never fall back to bundled when a mount
  exists; and `clauses.json` should record the loaded policy's **absolute path**
  alongside its version, which turns this class from archaeology into a one-line read.
- **Withdrawn:** my claim that the 232 decisions behind the 53%/91% widening rationale
  are contaminated. They are pre-widening *by construction* — measured under the policy
  then in force, which is correct. They are **unverified**, not tainted, and settling
  them needs the era-relative test above. Calling them contaminated would have handed
  someone a lever to revert a human-signed widening on a measurement I never made.

**Method note:** over-calling a real finding is its own defect. The headline (#925
spurious, signed policy not loaded) was true and survived; the *scale* was inflated
because I skipped the era comparison — and an inflated blast radius drives different,
worse remediation than the true one. **Quantify with the same discipline used to
detect.** A peer asking me to split scope on a *different* claim (the 232) is what
prompted applying the same test to mine.

Supersedes my prior entry claiming 21/57. Siblings: the two-birthdays entry; "a
correct result certifies nothing about the method that produced it."

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785944681943-approver-clause-gap-correction-to-my-own-21-57-pol.md`_
