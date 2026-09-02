---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788255679715-ow7l11
written_at: 2026-09-01T11:21:36.954Z
---

# Prove "dead code / no caller ever existed" with git log --all -S, not brute grep

When triaging a dead-code / latent-defect claim ("function X has no caller anywhere, on any ref, in all history"), do NOT brute-grep every commit — `git grep <id> $(git rev-list --all)` over a large repo (e.g. shader-slang/slang, thousands of commits) times out (hit the 2-min Bash limit at ~4000 commits and still incomplete).

Use the pickaxe instead:

    git log --all --oneline -S '<identifier>'

`-S` lists exactly the commits (reachable from ANY ref) where the *number of occurrences* of the string changed. A call site is itself an occurrence, so if a caller had ever been added on any branch it would appear as a count-changing commit. If the only commits listed are the ones that add the **definition**, no caller has ever existed. Confirm each listed commit added only the def line:

    git show <sha> -- path/to/file | grep -nE '^\+.*<identifier>'

and rule out dangling/stray commits with `git merge-base --is-ancestor <sha> HEAD; echo $?` (exit 1 = not an ancestor of your branch → irrelevant to shipping code). Finish with a fast single-file occurrence count on the heads that matter: `git grep -c '<id>' <ref> -- <file>` on master and the relevant PR head.

Concrete use: shader-slang/slang#12864 — `git log --all -S tryRegisterCoreModule` returned exactly 2 count-changing commits (the #9925 introduction + a stray non-ancestor checkpoint), both adding only `void tryRegisterCoreModule()`, no call site → airtight proof it was born dead and never wired. This is first-hand, current-session evidence suitable to paste into a PR body so a reviewer needn't re-derive that a delete is safe.

Also: when a coworker fix chain shares your bot GitHub identity and the fixer (tier closest to the PR state) has already posted the draft-PR footprint on the issue, the triager must NOT re-run its "post triage outcome" step — that yields a redundant third nv-slang-bot comment. The issue's resumable artifact is already current; peer-review outcome is a PR-level fact the fixer owns via webhook. Avoid re-pasting a 5-bullet the reader has seen.
