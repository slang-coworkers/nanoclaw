---
title: "[approver/clause-gap] The closest instance was mine, but the mechanism was NOT the blind API — my ledger shows ci_green_on_sha passed via 'policy does not require CI green' (require_ci_green:false), so the surface was never read at all"
type: learning
topic: review-approval
source: learnings/1785943474723-approver-clause-gap-the-closest-instance-was-mine-.md
---

# [approver/clause-gap] The closest instance was mine, but the mechanism was NOT the blind API — my ledger shows ci_green_on_sha passed via "policy does not require CI green" (require_ci_green:false), so the surface was never read at all

# [approver/clause-gap] Two different ways to pass on nothing — and on my own decision it was the other one

## Symptom

My orchestrator located the closest possible instance of the just-past-empty
false-safe: **slangpy#1090** — a PR **I decided myself** — where at the head I
pinned, combined-status read `success` from a lone context while build legs were
red. Verified at 2026-08-05T15:23:13Z:

```
slangpy#1090 @ bb870c1750cc   draft=false  state=OPEN
  combined-status : success  n=1  ctx=CodeRabbit
  check-runs      : total=18, FAILING=4
    build (windows, x86_64, msvc, Debug/Release, 3.10)
    build (linux,   x86_64, gcc,  Debug/Release, 3.10)
```

Its framing: *"Your clause read a green `CodeRabbit` context while four build legs
were red on the head you were deciding."* Reasonable, and the instance is real.

**But my own recorded ledger says the clause never read that surface.**
`work/1090-bb870c1750cc/tmp/record-payload.json`:

```
ci_green_on_sha   pass   "policy does not require CI green"
```

and `policy/APPROVAL_POLICY.json` (`v0-shadow-wide`): `"require_ci_green": false`.

So the clause passed at the **`:184` branch** ("policy doesn't require CI"), never
reaching the `:190` branch ("CI actually green"). It never called the legacy
combined-status API on that head at all. The green-over-red state existed; my
clause was blind to it for a *different reason* than the one being attributed.

## Root cause

This is the "more than one state maps to `pass`" defect I had already filed — and
here it is doing real work. Two distinct epistemic states share one token:

| branch | what it means | reads CI? |
|---|---|---|
| `:184` | policy doesn't require CI green | **no** |
| `:190` | CI is actually green | yes (wrong surface) |

On #1090 the pass came from `:184`. Both are false-safes, but they need different
fixes: the `:190` path needs the right instrument (check-run conclusions); the
`:184` path needs the clause to **report `unevaluable`/`not-applicable` instead of
`pass`** when policy waives the requirement. A waived check is not a satisfied one,
and emitting `pass` launders "not asked" into "verified."

Why the misattribution is easy and worth guarding against: the *outcome*
(green-looking decision over a red build) is identical under both mechanisms, so an
external observer measuring only the PR state cannot distinguish them. Only the
recorded derivation can. **The ledger is the discriminator between two failure
modes that look the same from outside.**

## How to catch it

When an instance is offered against a past decision of mine, read **my own
recorded clause evidence** before accepting the mechanism:

```bash
python3 -c "import json;d=json.load(open('work/<pr>-<sha12>/tmp/record-payload.json'));
print(d['decision'], d['reason_code']);
[print(c['name'], c['status'], '|', c['evidence']) for c in d['clauses']['clauses']]"
grep -o '\"require_ci_green\": [a-z]*' work/<pr>-<sha12>/policy/APPROVAL_POLICY.json
```

Falsifier: clause evidence naming a **policy waiver** rather than a measurement ⇒
the surface was never consulted, and any argument about which API it read is moot.

Also: my `1090` workspace has **two** decided heads (`5c384a20b11b` mode `live`,
`bb870c1750cc` mode `live_late`). A one-head citation about a multi-head PR may be
about a head I didn't decide, or one of several. Enumerate the workspaces.

## Fix

- Split the token. `ci_green_on_sha` must emit **three** outcomes: `pass` (checked,
  green, verdicts compared), `unevaluable` (checked, incomplete/red/wrong surface),
  and `not_applicable` (policy waived — *never* `pass`). A clause that cannot
  distinguish "not asked" from "verified" will launder every waiver into evidence.
- Note the interaction that makes this urgent: with `require_ci_green: false` in
  `v0-shadow-wide`, **every** decision in shadow mode passes this clause via
  `:184`. So the instrument fix (check-run conclusions) is *unreachable* until the
  policy requires CI at all — fixing only the API would have changed nothing on
  any decision I've made. Priority order: split the token first, then the surface.
- The decision itself was right for an unrelated reason (BLOCK,
  `VERIFIED_BUG:vulkan_import_undefined_state`), which is exactly the pattern to
  distrust: a correct outcome certifies nothing about the clause that fed it.
- Method: **check whether an offered instance is on the code path being indicted**
  — the orchestrator's own correction, applied one level further. It caught that
  `slang#12359` was a draft (off the wake path) and substituted #1090; the same
  check applied to *mechanism* rather than *population* shows #1090 indicts a
  different branch than the one under discussion. Valid instance, wrong defect.

Siblings: `ci_green_on_sha` reads the legacy combined-status API (the `:190`
defect); the measured `n=1` false-safe on `slang#12359`/`slangpy#1090`; "a correct
result certifies nothing about the method that produced it."

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785943474723-approver-clause-gap-the-closest-instance-was-mine-.md`_
