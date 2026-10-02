---
name: feedback_the_rule_installing_edit_is_least_likely_to_follow_the_rule
description: "Writing a rule feels like discharging it, so the edit that installs a rule is the one least likely to have it applied — re-run the new rule on its own file (headings, frontmatter, index row); stale-count disposition: update if acted on, DELETE if decoration, SCOPE (never rewrite) a true historical claim · a rule held is not a rule fired: key rules to the ACTION, not the topic · open problem: an action-keyed trigger doesn't fire while reading/writing ABOUT the action"
metadata: 
  node_type: memory
  type: feedback
  tags: 
    - rules
    - memory-hygiene
    - corrections
  originSessionId: 68b2a50a-31d8-4902-bb23-826127e1e4a6
---

# The rule-installing edit is the one least likely to follow the rule

**2026-08-04, three tiers, one session.** Every instance was committed inside or next to the artifact
installing the rule:

| who | rule being installed | violation, same breath |
|---|---|---|
| triager | *a correction isn't applied until every RESTATEMENT is fixed* | stale text below its new role table still named `kaizhangNV` as assignee, one turn later |
| me | same rule, in the lesson hosting it | evidence-index row said "seven" while the body said seventeen |
| fixer | *don't publish capability-negatives* | wrote *"that's the only oracle that proves…"* one sentence from its apology for one |
| me | *a read of a live artifact is a timestamped measurement* | filed an `updated_at` resolver for that defect that cannot detect it (`updated_at` collides with any PR activity) |

⛔⭐⭐⭐ **Treat the rule-installing edit as the highest-risk edit in the session.** The feeling of having
handled a class comes from *writing about* it, and that feeling suppresses the check. ⇒ **After installing
a rule, run it against the file you just wrote** — its headings, `description:` frontmatter, index row,
adjacent prose. First use found real defects in both tiers (my `description:` covered 2 of 8 sections;
the triager's file had no `description:`, a "six rules" header and an "(8)" index row for 14 rules).

## Stale-count disposition (three actions, not two)

| finding | test | action |
|---|---|---|
| present-tense count | does a reader **act** on it? | **update** |
| present-tense count | nobody acts on it | **DELETE** — decoration is pure decay surface |
| historical claim (*"were …"*) | true **as written**? | **SCOPE, never rewrite** |

⭐⭐⭐ A count correct today and load-bearing to nobody is a **liability**. Prefer an invariant ("this
child holds the complete set") to any tally. ⛔⭐⭐ Overwriting a true historical statement to make a
number current **retroactively falsifies a correct record** — no positional sweep flags it, because the
sweep's instinct is to make every number match. Classify each hit's tense before editing. Cf.
[[feedback_correction_unapplied_until_every_restatement_fixed]] (find every restatement; this file says
how to dispose of each).

## A rule held is not a rule fired

⭐⭐⭐ The fixer hit a trap from a memory it wrote earlier that session; the triager hit the same one
hours after discussing it; I made two role-identity errors of the same family. Three tiers, rule in
hand, none fired ⇒ **the FORM is wrong, not the discipline.** Key a rule to the **action** that summons
it:

- *"Before writing 'X isn't there', name the scope you searched and run one command wider."*
- *"Before an @-mention, `gh api pulls/N --jq '.requested_reviewers,.assignees,.user.login'`."*
- ❌ *"Capability-negatives are self-sealing"* — true, and never fires.

## ⚠️ Open problem — an action-keyed trigger doesn't fire on prose ABOUT the action

- The fixer wrote a capability-negative **inside** the paragraph apologizing for one.
- A coworker reported *"my session is 0 of 202 rows in `ncl sessions list`"*. My store holds the fact
  command-keyed (`ncl sessions list` silently caps at 200; raise `--limit` until the count stops growing)
  — **and it did not fire**, because I read someone else's output instead of running the command. Two
  callers landing on the same near-200 figure is the signature of a shared cap, not similar populations.

No clean remedy identified; recorded as open rather than papered over. The tractable half is the
mechanical re-run above.
