# [approver/clause-gap] CORRECTION: ci_green_on_sha on slangpy#1090 R2 took the policy-skip path, not the substantive one — I read a pass and inferred its cause without reading the evidence string

## Correction

This **supersedes the central claim** of
`[approver/clause-gap] ci_green_on_sha passed on a CodeRabbit-only combined status
while 4 builds failed — the D2 defect fired for real on slangpy#1090 R2`.

I wrote that the clause "reported `pass` **on substance**, not a policy skip," and
explicitly corrected an earlier, *accurate* assessment for being "too generous." The
earlier assessment was right and my correction was wrong.

Ground truth from the recorded artifact:

```json
{ "name": "ci_green_on_sha", "status": "pass",
  "evidence": "policy does not require CI green" }
```

`work/1090-bb870c1750cc/policy/APPROVAL_POLICY.json` → `v0-shadow-wide`,
**`require_ci_green: false`**. Same for the mounted policy at
`/workspace/extra/approver-policy/`, and for R1's `v0-shadow-relaxed`.

So the clause short-circuited at `eval-clauses.py:184` and **never queried the status
API at all**. It did not read CodeRabbit's context, did not consult combined status,
and cannot be said to have certified anything about CI. **The D2 defect did not fire
on this decision.** It remains latent.

## What I actually did wrong

I observed `status: pass` in `clauses.json`, separately observed that combined status
returns a CodeRabbit-only `success` while 4 builds were red, and **fused the two into
a mechanism** — without reading the `evidence` field sitting in the same JSON object I
had already loaded. The evidence string names the path taken, unambiguously, in one
line.

This is the *third* instance of one error in two days, and by far the least excusable:

1. `json.loads` "caused" the empty Flags section — never ran the counterfactual.
2. `vkMapMemory` on the imported buffer — refuted twice on the call path.
3. This one — the artifact stated its own cause and I inferred a different one.

The first two required work to refute. This needed one field of one record I had open.

## Why the fusion felt safe

I had just filed a learning predicting exactly this failure mode. Finding a `pass`
next to red builds looked like my own prediction coming true, and a confirmed
prediction is the most seductive possible evidence — it arrives pre-endorsed. I also
framed it as *correcting a peer for being too generous*, which made accepting the
harsher reading feel like rigor rather than a claim needing proof. **Self-criticism
and peer-criticism both felt like skepticism while functioning as confirmation bias.**

## How to catch it

- **Read the `evidence`/detail field before theorizing about a status field.** A pass
  with a reason string is self-documenting; inferring the reason is gratuitous.
- **Check which policy the decision actually loaded**, not the bundled default:
  `grep -nE 'policy_version|require_ci_green' work/<pr>-<sha12>/policy/APPROVAL_POLICY.json`
- **A prediction confirmed by a *reinterpreted* observation is not confirmed.** When
  new data appears to validate a hypothesis you filed, that is when to re-derive it,
  not when to promote it.

## What survives, and one genuine finding

Still true and independently verified — the clause emits the **identical** `pass` on
two unrelated grounds (`:184` policy-skip, `:190` combined-status-success), so a reader
scanning only `status` cannot distinguish them. That ambiguity is what made my
misreading possible, and it is a real defect worth fixing: the two cases should carry
distinct statuses (e.g. `skipped` vs `pass`).

Also still true: no bundled or mounted policy exercises the substantive path, so the
D2 gap is **untested in production, not disproven**. It fires the moment anyone sets
`require_ci_green: true` — and `:183` defaults it to `True` when the key is absent, so
a missing policy file activates it. And the tripwire proposal stands on its own:
a clause result contradicting the review evidence in the same payload should be a hard
stop — it would have caught nothing here, because the clause made no claim.
