# [approver/clause-gap] "6/6 clauses pass" is meaningless without naming the loaded policy — on slangpy#1090 R2 two of the six passes were bought by v0-shadow-wide's widening

## Symptom

A decision record reading `clauses 6/6 pass, fail: []` invites the reading "this PR
cleared every eligibility gate." Under a widened measurement policy that inference is
unsound, and on shader-slang/slangpy#1090 R2 (`bb870c1750cc`) it was **concretely
wrong for two of the six**.

## Verified diff, bundled `v0-shadow` → mounted `v0-shadow-wide`

| key | bundled | wide |
|---|---|---|
| `allow_fork_head` | `false` | **`true`** |
| `require_ci_green` | `true` | **`false`** |
| `max_total_lines` | 400 | **8000** |
| `max_files` | 30 | **150** |
| `protected_paths` | 8 globs | **1** |
| `trusted_associations` | 3 | **7**, incl. **`NONE`** |

Nearly every Step-1 gate relaxes at once, so a `pass` under `wide` is a much weaker
statement than the same `pass` under the bundle.

## Which passes were actually bought — the specific part

Recorded evidence, cross-checked against the bundled policy:

- **`head_provenance`** — evidence reads *"fork head allowed by policy
  (fknfilewalker/slangpy)"*. Bundled `allow_fork_head: false` ⇒ this clause **would
  not have passed**. The pass is entirely a policy grant.
- **`no_protected_paths`** — evidence reads *"7 changed path(s), none protected"*, true
  against `wide`'s single glob (`**/slang-tag-version.h`). But the PR touches
  **`external/slang-rhi`**, which matches the bundle's `external/**` ⇒ this clause
  **would have FAILED** under the bundle. Only 1 of 7 paths hits, and it is the
  submodule bump that carries the entire Vulkan/Metal import implementation — i.e. the
  most consequential path in the diff, not an incidental one.
- `ci_green_on_sha` — passed via the `:184` skip path (`require_ci_green: false`),
  certifying nothing about CI.
- `author_trust` (MEMBER), `commit_match`, `tier_eligible` (220 lines / 7 files) —
  these hold under **either** policy.

So the honest summary is *"6/6 under `v0-shadow-wide`; 4/6 under the bundle, with
`no_protected_paths` failing on `external/**` and `head_provenance` on fork-head."*

## Why this matters beyond bookkeeping

The widening is deliberate and human-signed (haaggarwal, 2026-08-04) to buy measurement
signal, and it carries `MUST BE RE-TIGHTENED BEFORE ANY ENFORCEMENT`. That makes these
passes **scheduled to reverse**. At re-tightening, a PR shaped exactly like this one
stops being eligible — so any precision statistic gathered under `wide` describes a
population the enforcing policy will not admit. Reporting `6/6` without the policy
version silently transfers confidence across that boundary.

None of this touches #1090's verdict: the decision was **BLOCK** on a verified bug found
in review, and eligibility clauses only gate whether a decision gets made at all.

## How to catch it

Never quote a clause tally without the policy version, and diff the loaded policy
against the bundle before reading a tally as reassurance:

```bash
grep -nE 'policy_version|require_ci_green|allow_fork_head|max_total_lines|max_files' \
  work/<pr>-<sha12>/policy/APPROVAL_POLICY.json
# then re-test changed paths against the BUNDLE's protected_paths with fnmatch
```

A clause whose `evidence` string cites a policy grant ("allowed by policy", "policy does
not require") is a pass **conditional on configuration**, not a property of the PR.

## Fix

Emit the policy version alongside every tally, and mark policy-granted passes distinctly
from substantively-verified ones — the same defect as `:184`/`:190` both emitting bare
`pass`. Ideally record a shadow tally against the bundle so the gap is visible at record
time rather than reconstructed later.
