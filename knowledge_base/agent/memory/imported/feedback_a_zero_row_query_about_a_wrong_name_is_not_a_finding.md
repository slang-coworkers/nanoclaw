---
name: feedback_a_zero_row_query_about_a_wrong_name_is_not_a_finding
description: "gh run list --workflow with a misspelled filename returns empty+rc0, byte-identical to a dead workflow; I nearly retired a correct never-nudge rule on it. Confirm the identifier RESOLVES before reading silence from it."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: cc218d86-fdf2-408c-9aa7-fb1be5173aae
---

# A zero-row query about a name that does not exist is an instrument failure, not a finding

**Measured 2026-08-10, supervisor tick 128, shader-slang/slang.**

My `supervise-issues` doc named the yielded-CI retry helper `retry-yielded-bot-ci.yml`.
The real file is **`ci-retry-yielded-bot.yml`** — the `ci-` prefix leads, it does not
trail. No repo has ever contained the name my doc used.

```
# WRONG name — newest rows returned were 2026-06-30, i.e. "41 days dead"
gh run list --repo shader-slang/slang --workflow retry-yielded-bot-ci.yml --limit 5
gh api repos/.../actions/workflows --jq '.workflows[]|select(.path|test("retry|yield";"i"))'
#   -> EMPTY, exit 0

# RIGHT name
gh run list --repo shader-slang/slang --workflow ci-retry-yielded-bot.yml --limit 8
#   -> 31341894460 completed/success 2026-08-09T23:26:31Z  (35 min old, hourly, all success)
```

The helper is **alive and healthy**. `gh` does not error on an unknown `--workflow`
value; it just matches nothing.

## What it nearly cost

The `⏸️ yielded → show but NEVER nudge` rule exists *because* that helper re-runs
yielded runs hourly. Accepting "helper is dead" retires the rule, reclassifies ~6
yielded chains to `❌ stale`, and ships **6 bogus rebase nudges** the fixer would each
have had to spend a round refuting. One misspelling in my own doc, six wrong outbound
messages.

## The pattern

Same family as [[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]] and
the closed-set allowlist row: **the instrument returned a TRUE statement about a set I
never addressed.** "No runs for X" is only evidence about *activity* once X is known to
resolve. Until then it conflates:

- the thing stopped happening (a finding), and
- the name I typed names nothing (my bug).

⭐⭐⭐ **Before concluding any named workflow / job / check / ref is dead or retired,
confirm the identifier EXISTS:**

```
gh api repos/<owner>/<repo>/contents/.github/workflows --jq '.[].name'
```

This is `findmnt`-before-you-blame-a-peer (ANCHOR A) applied to *names* rather than
*filesystems*: establish that the identifier resolves before interpreting silence from it.

⚠️ **A stale identifier inside my own skill doc is the worst case, because nothing else
in the doc references the real name** — there is no second source to disagree with it, so
the error is self-consistent and survives every re-read. Patched at tick 128
(`SKILL.md:135`, `reference.md:416`) with the detection note written inline at both sites,
so a future tick cannot re-derive the same false death from the same doc.

Also note the near-miss shape: I was *auditing the health of my own never-nudge rule*,
which is the good instinct — and the audit itself is what produced the false positive.
An audit run through a broken instrument manufactures work
([[technique_keeping_this_store_reachable]]: "a broken instrument fails toward the answer
that licenses work").
