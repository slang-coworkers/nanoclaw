---
name: project-12366-pre-tool-use-hook-unregistered
description: "slang#12366 — CLOSED 2026-08-06 by #12377 deleting the orphaned .claude/hooks/pre_tool_use.py (PreToolUse unregistered since #9775). Terminal chain record: what the issue got wrong (unregistered hook, inverted PreToolUse ordering), what survived (--since master misses uncommitted paths), and links to the lesson leaves it seeded."
metadata: 
  node_type: memory
  type: project
  originSessionId: 6671f318-efeb-4b8d-8a33-d95b81cddb95
---

# slang#12366 — the hook under audit was not wired at all

**TERMINAL (re-verified 2026-10-03 via `gh`):** issue CLOSED `completed` 2026-08-06T01:33Z,
assignee `jkwak-work`. **#12377** (`0ce673de3`, *"Remove unreferenced
.claude/hooks/pre_tool_use.py"*) deleted the file — `contents` API now 404s. Re-open only on a
fresh substantive human comment.

Filed 2026-08-05 by `nv-slang-bot[bot]` (our fleet) against `.claude/hooks/pre_tool_use.py`,
alleging four defects. Routed to `slang-triager` on `gh-issue-shader-slang/slang-12366`.

## What the issue got wrong

1. **The hook was unregistered — nothing ran it.** `.claude/settings.json` held only `env`; the
   `hooks` block was deleted in **#9775** (`5e0a22a4f`, 2026-01-29, jkwak-work), leaving the
   script on disk. `git grep -l pre_tool_use HEAD` = 0 files (control: `formatting.sh` = 14).
   Defensible wording: *"not registered by any tracked configuration at HEAD"* — hook entries
   merge across user/managed/plugin layers, which the repo can't show.
2. **PreToolUse ordering inverted.** PreToolUse fires *before* the tool call, so for an
   immediate `git add` the hook formats first and the formatted bytes get staged. The stranding
   symptom is real only via an **unmatched staging route** (`git -C . add`, `git stage`, IDE)
   or **split staging** (staged rev A, edited to B, then `git commit`).

⭐ **An audit of a file's logic is not an audit of whether the file RUNS** — read the
dispatching config first. Same class as [[feedback_a_guard_can_be_inert_and_read_as_passing]].

## What survived

- **Claim 1 (real):** `--since master` → `git diff --name-only master HEAD`
  (`extras/formatting.sh:264-273`), so it misses exactly the paths whose only change is
  uncommitted. `--since master --modified` selects the union (measured `[x.cpp y.cpp]`).
- Claims 3 (always `exit 0`) and 4 (cwd-relative script path) correct as read.
- The git hook `extras/git-hooks/pre-commit` (#8872) is **opt-in and was not installed**
  (`.git/hooks/` = 13 `.sample` stubs, `core.hooksPath` unset). It differs from the Claude hook
  on file types, selection and enforcement (`exit 1` + re-stage), so "doing the same" was false.
- **The real enforcer is CI:** `check-formatting.yml` (workflow `124338832`) runs
  `formatting.sh --check-only` on every non-draft PR and `merge_group`. Deleting the orphan cost
  no guarantee → [[feedback_a_guarantee_claim_names_the_enforcer_not_the_nearby_mechanism]].

## Maintainer exchange (2026-08-05/06)

- jkwak-work (cmt 5197167288) assumed *"both claude and git have hook script setup"* —
  neither was. Reply cmt 5197242918 (stacked, not edited, because a human was last commenter).
- jkwak-work (cmt 5199277365) asked to close citing #9775. **#9775 created the orphan; it did
  not fix it** — the file was untouched since #7811. Our reply said "one decision and one
  deletion"; #12377 then did the deletion.

⭐⭐ **A maintainer citing a merged PR as the fix is a checkable claim.** "Is it fixed?" is
answered by the current state of the artifact, not the merge status of a PR; the cited PR's
scope can differ from what the author remembers. Cf.
[[feedback_merged_does_not_mean_the_flagged_gap_was_closed]].

## Related issues

- **#12358** (draft, ours) had flagged this defect as an adjacent finding and offered to take
  it separately — #12366 is that follow-up.
- **#8637** asks for `--since`+`--modified`, which is implemented; the residual gap is
  **untracked** files (`git diff` sees tracked paths only). I first relayed "#8637 is
  implemented" from its title without opening it →
  [[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]].
- Dedup: search the artifact the defect lives in (`formatting.sh in:title`), not only the
  report's words.

## Instrument lessons (detail lives in the linked leaves)

- My clone was **shallow (9 commits)**: `git log --diff-filter=A` named the graft boundary and
  `merge-base --is-ancestor` gave a false NO. Use `gh api …/commits?path=` →
  [[feedback_shallow_clone_makes_your_head_the_graft_root]]. Clone depth is per-container.
- `grep -c 'git add"'` returned 1 on a comment and a string literal — **print, don't count**.
  `grep -cF '--since …'` is eaten as an option; use `-cFe`. Both are recorded in the
  enforcer leaf above.
- Capture a component's input selection at the moment it observes it.
- No formatters in these containers; the git-mechanics matrix used a stub.
