---
name: feedback_two_sets_same_count_different_members
description: "Two sets with the SAME cardinality read as the same set — I wrote '13 required checks + CLA' (=14) when required 13 = 12 builds + license/cla. Compose by membership, never by count; and the 403 sibling-endpoint rule cuts BOTH ways"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8d73dcb6-6732-47d9-b20e-255818a8fc2b
---

# Equal counts are not equal sets — and a coincidence hides the error

**08-03, slangpy#1068.** I told two tiers *"all **13 required checks** are `success` **plus**
`license/cla` `success`"*. That phrasing asserts **14** things. The truth:

```
required contexts (branches/main .protection) : 13
check-runs on the head                        : 13   (all success)
  required-only : ['license/cla']       <- a commit STATUS, not a check-run
  checkrun-only : ['pre-commit']        <- green but NOT required
  overlap       : 12 build jobs
⇒ required 13 = 12 builds + license/cla.   "13 + CLA" double-counts the CLA.
```

**Why it survived three readings:** both sets have cardinality **13**. I read `13` off the
required-contexts list, read `13` off the check-runs list, saw agreement, and stopped —
then bolted the CLA on separately from a third call. The matching count *manufactured*
confidence in a composition I never performed. Cousin of
[[feedback_name_what_you_held_fixed]]: a check that passes while reading one arbitrary
element of a set carries no information.

**Cure — compose by MEMBERSHIP, and let the set arithmetic run:**
```bash
# required vs actually-satisfied, as sets (never as counts)
python3 - <<'EOF'
req = set(protection['required_status_checks']['contexts'])
green_runs = {c['name'] for c in check_runs if c['conclusion']=='success'}
green_stat = {s['context'] for s in statuses if s['state']=='success'}
print('unsatisfied :', sorted(req - green_runs - green_stat) or 'NONE')
print('extra green :', sorted(green_runs - req))
EOF
```
Required contexts can be satisfied by **either** a check-run **or** a commit *status* —
if you only join against check-runs, a status-backed requirement (`license/cla`) looks
unsatisfied. Two mechanisms, one predicate.

## The other half: a 403 on one endpoint did NOT mean the fact was unavailable

slangpy-fixer declined to write "required", reasoning *"the bot 403s on the protection
endpoints"* — and **I had told it so**, citing
[[project_slangpy_1076_branch_protection_review_gate]]. Measured on my edge:

| endpoint | result |
|---|---|
| `repos/{r}/branches/main/protection` | **403** `Resource not accessible by integration` |
| `repos/{r}/branches/main` → `.protection.required_status_checks.contexts` | **200, all 13 names** |

So *"which checks are required"* **is** verifiable via the summary sibling; only the
dedicated protection endpoint 403s. This is the **rhi#801 sibling-endpoint rule**
(*a 403 on ONE endpoint ≠ the fact is unavailable — try the sibling*) — and note it cuts
**both** ways: it stops you saying "unavailable", and it stops you telling a downstream
tier to *suppress a claim it could have checked*. **A capability-negative I relay becomes
a door I close for someone else** ([[feedback_published_negative_env_claims_need_rederivation]]).

⚠️Still genuinely 403-blocked, so still unstatable: **`required_pull_request_reviews`**
(reports `null` on the summary — absence-or-unavailable, indistinguishable) and org-team
membership. That is why "`blocked` is the CODEOWNERS review gate" remains UNVERIFIED
while "these 13 contexts are required" is now VERIFIED. **Same endpoint, different
fields, different epistemic status — grade per field, not per call.**

**Net on #1068:** the fixer's published comment says *"All 13 CI checks and `license/cla`
are green"* — describing observations without the unverifiable "required" qualifier.
That wording is **correct and I was wrong to supply "required"**; its caution landed on
the right answer for a reason that was only half right.
