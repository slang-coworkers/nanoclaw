---
name: project_nanoclaw_1125_wiki_fold_lineage
description: "nanoclaw#1125 (szihs, OPEN 08-06) is the follow-up PR #1066 left OWED — implements the fix I recommended. Body's 12-pass + 5-failure negative control BOTH reproduced. 2 🟠 of my own: retirement is one-way with the only un-retire path an undocumented dotfile; a typo'd successor stem is accepted and invisible (dangling count identical in control/valid/typo). Comment 5205656251."
metadata: 
  node_type: memory
  type: project
  originSessionId: ae7da19e-8579-46f6-9860-2f27b4c38de3
---

# nanoclaw#1125 — keep supersession lineage across a rebuild

PR: https://github.com/slang-coworkers/nanoclaw/pull/1125 (author **szihs**, base `nv-main`,
head `fix/nv-main/wiki-fold-lineage`, 2 files, +272/-4). My review comment **`5205656251`**.

## STATE — OPEN, reviewed, nothing owed by me

**This is the follow-up [[project_nanoclaw_1066_kb_fold_bounded]] recorded as OWED**, and it
implements the option I recommended there (persist lineage OUTSIDE the regenerated tree —
`.lineage.json` at KB root, harvested before the delete sweep, merged forward). Body says
"Not merging"; merge is szihs's (`fix/nv-main/*` → `nv-main` is outside the `nv-coworkers`
auto-merge grant). RESUME = szihs replies or pushes.

## Routing — ~26th instance of the standing rule

`pr_ready_for_review` carried the generic *"route to the project's `*-pr-approver`"* string.
`slang-coworkers/nanoclaw` has **no** approver; `slang-pr-approver`/`slangpy-pr-approver` are
repo-scoped compiler approvers that would `ABSTAIN_POLICY`. Handled INLINE.
See [[project_nanoclaw_pr874_webhook_route_approver]].

A second `synchronize` webhook arrived mid-review for the push I had **already re-verified at**
(`650800f3`) — head unchanged ⇒ no second review. ⭐**A `synchronize` event is not evidence of an
unreviewed head; compare the oid to what you reviewed.**

## Verified BY EXECUTION, both directions

- 12/12 `OK RC=0` at both heads.
- ✅**Negative control reproduced**: head tests × **base** builder → **5 failures**
  (3 fail + 2 error), incl. the headline `test_a_retired_atom_stays_retired_across_a_second_build`.
  ⇒ the tests genuinely pin the fix; they do not pass vacuously.
- ✅**Complement the PR does NOT test**: no KB dotfile is git-tracked (`git ls-tree` on the
  mirror ⇒ `.lineage.json` never reaches it), but `build()` re-emits `superseded_by:` onto the
  tracked pages, so deleting `.lineage.json` + rebuilding **recovers the full record from pages
  alone**. Fresh clone self-heals; the dotfile is a cache, not a single point of truth.

⚠️**Head moved mid-review `236055d3` → `650800f3`** (one-line unused-import drop in the test).
I did NOT assume the findings carried: `SKILL.md` **sha256 identical** across both
(`4bc55525…`) ⇒ builder untouched, findings hold, and I said so in the comment.
Cf. the 26-second merge race in #1066 — re-check head/state **immediately before posting**.

## My two findings (both fail-green, same family as the defect being fixed)

🟠**1. Retirement is one-way; the only un-retire path is an artifact `SKILL.md` never mentions.**
Measured: retire via L3 page → remove the marker from that page → build → **STILL RETIRED**;
only *also* deleting `.lineage.json` clears it. Removing the marker from the one artifact the
skill tells the agent to edit has **no effect**, and `.lineage.json` appears in prose only as an
implementation aside (line 112). A retirement is an LLM synthesis judgment and is occasionally
wrong ⇒ today a wrong one is unfixable by documented means, failing green (coverage just shows
one fewer live atom). Suggested prose fix, or explicit `superseded_by: ""` = retract riding the
existing precedence rule.

🟠**2. A typo'd successor stem is accepted and unobservable.** `superseded_by:
99999-DOES-NOT-EXIST` is harvested, carried forward, re-emitted; the atom is excluded from `live`
exactly as with a real successor. ⭐⭐**The `dangling` count does NOT cover this field — I proved
it with a 3-way control: `dangling 1` in CONTROL (no marker) / VALID / TYPO, byte-identical.**
Without that control I would have mis-read the `1` as the typo being caught. `finalize()` already
holds both sets; report alongside `dangling`.

Both are **new surface this PR creates**, not regressions — unreachable before it, because
retirement didn't survive a rebuild at all. Neither blocks the core fix.

## Confirmed clean

`.lineage.json` at KB root follows live precedent (`.themes.json`, `.kb-health.json` already
there); temp+fsync+rename + merge-forward is the right shape; corrupt→empty is right for advisory
data and is tested; `test_a_live_atom_is_still_reported_as_uncovered` is a real guard-the-guard.
The #1066 L1-immutability tension is now **explicit prose** (line 112) not an accidental `re.M`
match — but `learnings/ … (immutable; never edit)` still stands at lines 22 and 174 (flagged).

Fix is inert until `data/shared/.learnings_wiki.py` is re-materialised; `kb-doctor` DRIFT is the
intended signal. Diff before overwriting — prod has held fixes git did not.

⚠️`/workspace/extra/ephemeral` is a **read-only filesystem** for `git worktree add` (leading-dir
create fails); used `/tmp`, which a container restart wipes (the #1066 trap).
