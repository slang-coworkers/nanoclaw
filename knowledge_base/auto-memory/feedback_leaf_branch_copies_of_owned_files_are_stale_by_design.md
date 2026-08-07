---
name: feedback_leaf_branch_copies_of_owned_files_are_stale_by_design
description: "On a fork whose install model is a merge train, a leaf overlay branch carries STALE copies of files another branch OWNS — reading src/** on nv-dashboard produced a confident headline finding that the composed state refutes. Compose before concluding."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c6bb8085-61c5-487e-a452-2b79db485c3b
---

**Measured 2026-08-06 on slang-coworkers/nanoclaw#1098** (base `nv-dashboard`).

I built a headline finding — *"`pending_approvals.agent_group_id` is never written, so the
endpoint's `LEFT JOIN agent_groups ag ON ag.id = pa.agent_group_id` always yields
`coworker_folder: null`, so this PR's whole session-link fix is dead on arrival"* — from reading
`src/modules/approvals/primitive.ts` **on the PR's branch**. I had it reproduced against real
sqlite, with a passing positive control (`agent_group_id` set ⇒ folder resolves) and a proposed
two-hop-join fix that I verified didn't regress the sibling onecli row shape.

**It was wrong.** `src/**` is **nv-main-owned** per `.github/nv-path-guard/nv-main.txt`. The
overlay branches track upstream, *not* nv-main, so a leaf's copy of an owned file is a **stale
tracking copy by design**. Blobs:

| ref | `primitive.ts` blob | sets `agent_group_id`? |
|---|---|---|
| `origin/nv-dashboard` | `68788766` | **no** |
| merge-base | `68788766` | no |
| `origin/nv-main` | `31e1d382` | **yes** (`agent_group_id: session.agent_group_id`) |

Composing the way `ci.yml` / `setup/merge-train.sh` do (merge `origin/nv-main` into the merged tip)
resolves that file to nv-main's version with **no conflict**, so the field IS written and the link
works.

⇒ ⭐⭐⭐ **On a merge-train fork, a file's content on a leaf branch is not the content that runs.
Before concluding ANYTHING from a file on an overlay branch, check the owning branch's path-guard
allowlist and build the composed state.** The tell is cheap: `git show
origin/nv-main:.github/nv-path-guard/nv-main.txt` and check whether the path matches.

⭐⭐ **Why it was seductive:** every leg was individually verified — real sqlite, real insert helper
copied verbatim, positive control, endpoint's exact SQL. **A correct measurement of the wrong
artifact passes every internal check.** Cf. [[feedback_a_negative_control_must_va…]]: controls
validate the instrument, never the target. Same family as the per-container-path lesson in
`MEMORY.md`'s anchored row — *one name, different object per edge*, except here the axis is
**branch**, not container.

## ⛔ The paired instrument failure: a shallow clone makes merge-base a silent lie

My first attempt to check staleness ran `mb=$(git merge-base origin/nv-dashboard origin/nv-main)`
in a **shallow** clone (`.git/shallow` present, `git rev-parse --is-shallow-repository` → `true`;
`nv-main` had **2** commits locally vs 2,479 on the leaf). It returned the **empty string with exit
0** — so `git rev-parse $mb:src/...` read the **index** instead of a commit and printed a
plausible blob hash. I nearly recorded "dashboard never touched it? NO" from that.

⇒ ⭐⭐⭐ **An empty `merge-base` is a broken instrument, not a topology fact** (it renders as
"unrelated histories", which is a real thing and therefore believable). `git fetch --unshallow`
first, and treat `$empty:path` as the false-zero shape it is — a bare ref-less `rev-parse` silently
falls through to the index rather than erroring. Same family as
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]: **the failure printed the answer that
licensed the work.**

⭐⭐ **What saved it:** I checked reachability before publishing rather than after. Disclosed the
whole near-miss in the posted comment (`5201165396`) instead of quietly dropping it — the retracted
finding is the most useful thing in that review for anyone else reviewing this fork.
