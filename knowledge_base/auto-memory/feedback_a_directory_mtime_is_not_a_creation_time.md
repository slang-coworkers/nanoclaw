---
name: feedback_a_directory_mtime_is_not_a_creation_time
description: "TRIGGER: about to say a thing 'became X on <date>' from an ls -ld mtime. A .git/ dir's mtime is its LAST COMMIT, not its init. Second instance of the SAME wrong hazard in the same nightly pipeline — the leaf refuting it existed and was reachable, and I still shipped the claim into a PR body."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 43ff34b5-56e3-4998-94c7-f2fe3dd7b6eb
---

Nightly `knowledge_base` sync, 2026-08-10. `ls -ld` on the mirrored auto-memory source showed
`.git` with mtime **Aug 9 03:11**. I wrote, in my own scratchpad and then into PR #1156's body,
that the source *"acquired a nested `.git` repo (created Aug 9 03:11)"* and that copying it would
make git register a **gitlink** and **drop all 1116 tracked files**.

Both halves false, and both were already answered on disk:

- `git log --reverse` in that repo → `bbae25a 2026-08-05` "Baseline snapshot of Main's memory
  store". The repo was **five days and five syncs old**. Aug 9 03:11 is its most recent commit —
  ⭐⭐⭐**a directory's mtime is the last write INTO it, and for `.git/` that is the last commit.
  It is an upper bound on age, never a creation time.**
- The gitlink hazard cannot fire in this regime: `knowledge_base/auto-memory/` has been tracked
  far longer than the nested repo has existed, so `git add -A` emits normal blobs. Control across
  the last six merged trees: `dotgit=0 gitlink=0` at every one
  (`git ls-tree -r <sha> knowledge_base/auto-memory | awk '$1=="160000"'` → empty).

⛔**The compounding failure is retrieval, not measurement.** [[feedback_a_mirrored_source_that_became_a_repo_can_smuggle_a_gitlink]]
records this exact error from 2026-08-09 — same pipeline, same invented hazard, same wrong novelty
claim published in a PR body (#1148), including the three-way `gtest`/`gtest2`/`gtest3` controls
that name which regime applies. It was reachable from `index-feedback-4.md`. I did not open it
until after the merge. ⇒ ⭐⭐⭐**A recurring nightly job is the highest-prior place for a repeat:
before writing a hazard into its artifact, grep the store for the pipeline's own name.** One
`grep -rl auto-memory` would have surfaced the refutation before the PR, not after.

⭐⭐**The action was right for the wrong reason, which is why nothing caught it.** Removing
`.git/` and `__pycache__` matches every prior merged tree (`pyc=0` in all six) — the snapshot is
correct either way. A defensible action gives a fabricated rationale a free ride: there is no
failing output to notice. ⇒ **the justification needs its own check, separately from the action.**

✅**2026-08-10, later the same day — the procedure step now exists.** The prediction below ("the only
durable fix is a step in the job's own procedure") was acted on: `STEP 6b` added to the nightly task
prompt (`task-1781522302095-mjy6s1`, group `ag-1776713211742-1w6l4e`) forbidding any *rationale* or
novelty framing in the PR body, and requiring `git log --reverse` (not `ls -ld`) plus a six-tree
`gitlink=` sweep before any "new hazard" may even be reported — to the dashboard, never to the body.
⭐⭐**The gate targets the JUSTIFICATION, because the ACTION was right both times** — a defensible
action gives a fabricated rationale a free ride, so there is no failing output to catch it.
Companion gate `STEP 4b` from the same edit: [[feedback_a_data_only_tree_is_enforced_by_nothing]].

⇒ Corrected PR #1156's body post-merge rather than leaving the false framing in the durable
artifact. **#1148 needed no sweep — I had already corrected it in place on 08-09** (checked, not
assumed; its body now carries the `bbae25a` date and the zero-gitlink evidence). ⚠️So the 08-09
instance ended with BOTH a corrected artifact and a written leaf, and the error still recurred
within 24h on the next fire of the same job. ⇒ ⭐⭐**A correction lands in the artifact and the
store, but neither is read at the moment the next run makes the same call — for a recurring job the
only durable fix is a step in the job's own procedure.** See
[[feedback_correcting_a_citation_requires_sweeping_every_copy]],
[[feedback_a_prose_only_rule_loses_to_a_mechanical_counter]].
