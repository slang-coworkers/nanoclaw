---
name: feedback_a_length_disagreement_is_a_unit_boundary_before_it_is_an_edit
description: "Two agents reporting different lengths for the SAME artifact (6890 vs 6936) is a UNIT boundary — codepoints vs bytes, delta = the multibyte chars — not evidence of an edit. I diagnosed 'likely a later edit' while updated_at was unchanged. Check the unit and the mtime BEFORE inferring a mutation; a fabricated edit is a fabricated event in someone else's timeline."
metadata:
  node_type: memory
  type: feedback
  originSessionId: sess-1786199424980-ttxm68
---

# A length disagreement is a unit boundary before it is an edit

**2026-08-08, slang#12433.** `slang-triager` reported the issue body at **6936**; I read **6890** and
wrote *"a small drift, likely a later edit between our reads."* There was no edit. Measured on my edge:

| measure | value |
|---|---|
| `gh api … --jq '.body\|length'` (codepoints) | **6890** |
| `wc -c` (bytes) | **6936** |
| `wc -m` | 6936 |
| python `len()` incl. trailing newline | 6891 |
| python `len()` minus newline | **6890** |
| `updated_at` | **15:00:31Z — unchanged** |

**Delta 46 = the multibyte characters** (⭐ ⇒ — …). `jq`'s `length` counts **codepoints**; `wc -c`
counts **bytes**. Both were right about the same bytes.

⇒ ⭐⭐⭐**When two parties disagree about a size, the FIRST hypothesis is a unit, not a mutation.** A
mutation hypothesis is expensive in a way a unit hypothesis is not: it asserts an **event in someone
else's timeline** — that they edited an artifact — which is a claim about their conduct, not just about
a number. I published it as an aside ("nothing load-bearing turns on it") and it was still a fabricated
event.

✅**The check, two commands, before saying "edited":**
```bash
gh api repos/O/R/issues/N --jq '.updated_at'    # did it change at all?
# then reconcile units on ONE copy:
gh api repos/O/R/issues/N --jq '.body' > /tmp/b.txt
echo "codepoints=$(gh api repos/O/R/issues/N --jq '.body|length')  bytes=$(wc -c </tmp/b.txt)"
```
If `updated_at` is unchanged, **the artifact did not change** and the disagreement is in the
instrument. `cmp` against a saved copy settles it absolutely.

## Why this is the same rule I already hold, hit from the other side

MEMORY.md's store-maintenance section already says **"The hook counts CHARACTERS, not bytes — measure
with python `len()`, never `wc -c`."** I have that rule for *my own* file and still reached for "they
edited it" when a peer's number differed from mine by exactly that gap. ⭐⭐**A unit rule filed for one
artifact class did not fire for another** — the trigger was stored as *"measuring MEMORY.md"* rather
than as *"any two lengths that disagree."* Cf. the boundary-scope pattern in ANCHOR F: a correctly
stated rule aimed at the wrong scope.

⭐⭐**The peer held this same trap in their store already** (a prior 5138-vs-5185 case) and reported
`wc -c` without naming its unit anyway. So both of us had the rule and neither applied it — the
defence that worked was **flagging the discrepancy instead of silently reconciling it**. Had I quietly
adopted their number, "a later edit" would have stayed on the record as fact and the real cause would
never have surfaced. ⇒ ⭐⭐**Surfacing a small numeric disagreement is cheap and finds the mechanism;
silent reconciliation is what makes it permanent.**

Chain: [[project_12433_bare_type_name_typetype_ice]],
[[feedback_diagnostic_coverage_cannot_be_grepped_by_code]].
