# [approver/challenger-miss] A merge-born defect has TWO birthdays — date it from the merge that created the interaction, not the PR's first commit

## Symptom

On slangpy#925 I told the maintainer *"`ccummingsNV`'s 2026-07-29 approval
predates the regression, so no human has seen this."* Exactly backwards. The
defect was born **2026-06-23**; the approval postdates it by ~5 weeks. The
correct framing was the inverse: *"you already approved a tree containing this."*

That error changes the ask from "look at something new" to "re-examine something
you signed off on" — a different request to a different person's attention.

## Root cause

The defect was an **interaction between two halves that arrived separately**:

| ref | date | `CIBW_ENVIRONMENT_LINUX` (PR side) | step-level `SLANGPY_VERSION_OVERRIDE` (main side) |
|---|---|---|---|
| `6286baba0908` | 04-09 | **present (day one)** | absent |
| `6cfb1df2149f` | 04-30 | present | absent |
| `e5f2299b2b63` | 06-23 | present | **arrived from main** |
| `4743d90ff367` | 08-05 | present | present |

Neither half is a defect alone. `CIBW_ENVIRONMENT_LINUX` replacing the generic
value is harmless while nothing else needs passing through; the step-level
override is harmless while no platform-specific replacement exists. The bug is
born the moment both are true — which happened on a **merge from main**, not in
any commit the PR author wrote.

I dated it from "the PR introduced `CIBW_ENVIRONMENT_LINUX`, so the defect starts
where the PR starts." For a merge-born defect that reasoning is invalid: the PR's
first commit dates only the PR's *half*.

## How to catch it

When a finding is an interaction of two conditions, date **each** condition
independently across the ref history, and take the **later** as the birthday.
Walk every ref with a positive control per fetch, so a zero is a real zero and
not a failed fetch:

```bash
for ref in $(gh pr view $P --repo $R --json commits --jq '.commits[].oid'); do
  body=$(gh api "repos/$R/contents/$FILE?ref=$ref" --jq '.content' | base64 -d)
  ctrl=$(printf '%s' "$body" | grep -c '<STRING CERTAIN TO BE PRESENT>')   # control
  a=$(printf '%s' "$body" | grep -c '<CONDITION A>')
  b=$(printf '%s' "$body" | grep -c '<CONDITION B>')
  echo "$ref ctrl=$ctrl A=$a B=$b"
done
```

`ctrl=0` means the fetch failed — discard that row rather than reading its zeros
as absence. (Without the control, a 404 or a renamed file looks identical to "the
condition isn't there yet," which silently fabricates a birthday.)

Then compare the birthday against every human approval's `submitted_at` before
claiming who has or hasn't seen it — and note that on a PR with merges from the
base branch, "the author introduced this" may be false even when the PR is where
it becomes reachable.

## Fix

- **Two conditions ⇒ two birthdays ⇒ the defect is born at the later one.** Never
  date an interaction bug from the PR's first commit.
- Before writing "no human has seen this," compute the birthday and diff it
  against approval timestamps. Getting the direction wrong inverts the ask.
- A merge commit from the base branch is a **defect-introduction site**, and it
  belongs to nobody's diff — no reviewer of either half ever saw the
  combination. That is precisely why it survives to the approver.

See also `[approver/clause-gap]` on `commit_id` re-pointing (same PR) — both are
failures to ask *when* a fact became true rather than *whether* it is true now.
