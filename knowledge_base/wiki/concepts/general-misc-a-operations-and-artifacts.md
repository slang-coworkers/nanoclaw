---
title: "Operations discipline: worktree GC, artifact repair, tooling instructions, and triggers"
type: concept
group: general
tags: [worktree-gc, artifact-repair, formatting, tooling-flags, resume-triggers, github-comments, plan-ordering, decay]
source_count: 12
---

## TL;DR

Operational tasks — cleaning worktrees, repairing public artifacts, running project tooling,
designing resume triggers — have their own confident-wrong-answer traps:

- **Never derive a worktree's branch from its directory name** — read it, or you reap live
  work; a GC dispatch's premise can be true about the PR and false about the worktree.
- **A correcting comment cannot correct a body** — sweep every artifact (body, each comment,
  labels, cross-references), and repair by *position* (what a reader who stops early believes).
- **A repair that only looks complete** — fix the compose *source* not the composed artifact;
  the prescription slot outranks the assertion slot; sweep the summaries.
- **`formatting.sh` / `prettier --stdin-filepath` exit 0 having formatted nothing** — match
  the flag to the *tense* of what you're doing; measure files-examined, not exit code.
- **Read `--help` for the flag name, but index the fact by the COMMAND** — a rule filed under
  the incident that produced it is invisible when you type the command.
- **A resume trigger scoped to "changes the ANSWER" is blind to "changes the OBLIGATION"** —
  keep a broad human-comment catch-all as the backstop.
- **A maintainer deleting our comments is a BOUNDARY, not a gap.**
- **Approving a plan restructure silently voids every positional instruction** — order by
  action, never by number.
- **A sentence can become misleading without becoming false** — decay needs a reading pass.

## Worktree GC: read the branch, verify content, own the premise

A GC recipe that resolves PR state from a *derived* branch name (`wt-slang-<num>` →
`fix/issue-<num>`) silently reaps live work — the failure is directional: the derived name
resolves to an already-MERGED PR while the real suffixed branch (`-batch2`, `-v2`, `-runtime`,
`dev/<agent>/<slug>`) has an OPEN one, so the tree looks terminal. Ground-truth the branch
(`git branch --show-current`), never reconstruct it. Two guards catch all cases: NO-PR *or* any
dir↔branch mismatch → ASSESS, never auto-reap; refuse to reap a tree with uncommitted *tracked*
changes. `git worktree remove --force` does NOT delete the branch ref, so a reap is recoverable;
"dirty" on a merged tree is usually throwaway. Reap is operator-gated — a `/supervise` auto-cron
re-deriving the set is not the authorization.
[Worktree GC: never derive a branch name from the worktree dir — read it, or you reap live work](wiki/learnings/1785846721927-worktree-gc-never-derive-a-branch-name-from-the-wo.md)

A GC dispatch's premise can be **true about the PR and false about the worktree**: "issue OPEN,
PR MERGED, so work landed" checked out, but the worktree's branch was `fix/issue-11967-runtime`
(a follow-up with an unpushed test-only commit, no PR) while the merged PR was
`fix/issue-11967`. Run `git branch --show-current` and confirm it's the branch the dispatch
reasoned about; `state: OPEN` is underdetermined without `stateReason` (`REOPENED` + assignee
means live, someone else's). **Un-landed must be verified by CONTENT, not ancestry** — a shallow
clone lists 20 merged commits as "not in master", so check `gh api contents/<path>` → 404 with a
positive control on a file known to have merged. A GC dispatch arrives with its conclusion
pre-formed and a save-then-remove recipe attached, making the recipe feel like the task and the
premise feel already checked — treat the recipe as conditional on a premise you own.
[Worktree-GC dispatch: the premise can be true about the PR and false about the worktree](wiki/learnings/1785933070337-worktree-gc-dispatch-the-premise-can-be-true-about.md)

A reported size and your own byte count are comparable only if sampled at the **same edit
state** — on a file 3–8 siblings write continuously, a hook nag computed at one instant and
`wc -c` run later differ by sibling write volume, not encoding (one file swung 95k → 102k inside
a session on no writes of its own). Pair each reading with the state that produced it (a hook
firing on *your own* edit gives a tight pairing). A 1-decimal KB figure carries ±51 units — any
claim resting on a smaller gap is unsupported, and a mechanism must be checked for *size* not
just direction. **Partial retraction is the dangerous kind** — trimming a scope felt like
conservatism and preserved a defective instrument that then failed for a second reason; when a
conclusion falls, re-derive the remainder from scratch. After an in-place replacement, read the
whole edited region (an anchor matching the *start* of a stale block does not remove the block);
verify retractions positionally, never by count. [A reported size and your own byte count are comparable only if sampled at the SAME edit state — on a file siblings write, pair each reading with the state that produced it](wiki/learnings/1785933292303-a-reported-size-and-your-own-byte-count-are-compar.md)

## Repairing public artifacts: sweep by artifact and by position

A correcting comment cannot correct a body — on a multi-artifact surface (issue/PR) the body,
each comment, labels, and cross-referencing pages are *separately editable*, and appending
cannot fix what precedes it. **Test: if someone reads from the top and stops early, what do they
believe?** If the refuted version, the correction isn't done. Sweep: patch the body (prepend a
marked block, *annotate* stale sections rather than delete — deletion destroys the record);
patch stale comments with a scoped supersede note; check the label *exists* before revising a
severity in prose (slangpy has no P0–P3 — say so, don't invent one); route cross-references to
whoever owns that branch. No "not mine to edit" excuse for our own bot's text.
[A correcting comment cannot correct a body — sweep by artifact](wiki/learnings/1785896218013-a-correcting-comment-cannot-correct-a-body-sweep-b.md)

Repairs that only *look* complete, five forms: (1) **fix the compose SOURCE, not the composed
artifact** (`CLAUDE.md` is regenerated from `.instructions.md` — editing the composed file is a
time-delayed decoy undone by the next recompose); (2) a warning in a *path* is not a warning in
the *content* (a `.STALE-DECOY` rename leaves the body a clean runnable recipe); (3) the
**prescription slot outranks the assertion slot** (a banner above a code block doesn't stop the
block being copied — comment the offending line *inside*); (4) **sweep the summaries** —
`description:`/headings/index-rows are scanned first, and correcting an argument while leaving
its summary is how a superseded claim survives as a fresh citation; (5) don't launder a dated
backup. **Bound your zeros and publish the bound** — "zero copyable prescriptions remain" scoped
to one dir read as fleet-wide, and a closing verification is the worst slot for a scope error
because it tells the next reader not to look. Highest-value item, from the diagnosis: **a
hypothesis whose test is impossible should trigger a search for a cheaper explanation, not more
inference** — unfalsifiability *feels like depth*. [Repairs that only look complete — fix the compose source, the prescription slot, and the summary](wiki/learnings/1785930595909-repairs-that-only-look-complete-fix-the-compose-so.md)

## Tooling instructions: measure files-examined, index by the command

`extras/formatting.sh` exits **0 having formatted nothing** in several ways — bare invocation
(prints help), `--since master` (committed changes only, 0 on an in-progress branch), an empty
selected set past the gate (prints "Formatting…" having examined nothing — *progress output is
not evidence work happened*), `.slang` files matching no `case` arm. **Match the flag to the
TENSE**: pre-commit → `--modified`; repairing an already-committed failure → `--source .`;
brand-new untracked file → explicit `-- <path>`. "Quote the tool's help rather than invent a
flag" protects against *invention*, not against *the source being wrong for your use case* —
validate the quoted example against your precondition (check files-examined, not exit code) and
corroborate with a second artifact that had to work (a hook, a CI job).
[formatting.sh: three different right flags for three preconditions — and quoting the help gives you the wrong one](wiki/learnings/1785907156624-formatting-sh-three-different-right-flags-for-thre.md)

`prettier --stdin-filepath <path>` does NOT resolve the same config as a real file — it reported
CLEAN on bytes that `prettier --check <path>` calls DIRTY (`--stdin-filepath` is a *parser hint*,
not full config/`.editorconfig`/overrides resolution). It fails in the *reassuring* direction
(baseline looks clean, so your pre-existing hunks look like violations you introduced —
scope-creep caused by the instrument). Write committed bytes to the real in-repo path, measure,
restore (end with `git diff HEAD` to confirm the restore); **measure both sides with the
identical instrument** — mixed instruments across a before/after is the root cause. Count hunk
*positions*: a uniform +2 shift proves "same failure, not a new one."
[prettier --stdin-filepath does NOT resolve the same config as a real file — it reported CLEAN where the identical bytes on disk are DIRTY](wiki/learnings/1785906689398-prettier-stdin-filepath-does-not-resolve-the-same-.md)

Read `--help` for the flag name before writing an instrument rule — but the durable lesson is
**index the fact by the COMMAND, not the incident that produced it.** An author *had* run
`--help` and filed the correct flag fleet-wide, then reasoned off the broken spelling for
another full day, because a rule filed under the incident is invisible at the moment you type
the command. Also: `ncl` accepts an invented/typo'd flag, ignores it, exits 0, and returns the
**full unfiltered set** — a typo returns *data*, not an error (the mechanism behind an entire
retracted "filter is inert" finding). The load-bearing methods survive any flag spelling: the
BOUND TEST (raise `--limit` until the count stops changing; default caps at 200 silently), the
NONEXISTENT-ID control (the only probe that can prove inertness — filtered-vs-unfiltered counts
agree whenever scope already narrows the view), and per-edge `--limit` offset calibration.
[Read --help for the flag name before writing an instrument rule (and unrecognized flags return data)](wiki/learnings/1785907606297-read-help-for-the-flag-name-before-writing-an-inst.md)

## Triggers, boundaries, and plan ordering

A resume trigger scoped to "changes the ANSWER" is blind to "changes the OBLIGATION" — a third
failure mode beyond never-fires and always-fires: *correctly selective, correctly satisfiable,
and blind to an entire category*. A maintainer comment ("when resolved, revert this waiver in
another repo") answers no question and reverts nothing yet, but **changes the definition of
done**. Obligation-class inbounds to enumerate: a revert requirement, a follow-up PR, a
doc/mirror update, a tracking anchor. The mitigation that actually saved it: **keep a broad
human-comment catch-all as the backstop** — enumerated clauses encode only the categories you
thought of, so the catch-all is coverage for your own imagination's edge; don't optimize it away
for being imprecise. Surface a persist-vs-revert fork *before* it becomes an unmet expectation
— a maintainer waiting on a revert that never comes is worse than a disagreement on record.
[A resume trigger scoped to "changes the ANSWER" is blind to "changes the OBLIGATION" — a maintainer adding a cleanup requirement silently no-ops](wiki/learnings/1785945281592-a-resume-trigger-scoped-to-changes-the-answer-is-b.md)

A maintainer deleting our comments is a **BOUNDARY, not a gap**. The "post a verified 5-bullet
on EVERY triaged issue — silence is the bug" default assumes silence is a gap to fill; on a
maintainer-authored *process/meta* issue (empty body, no compiler content, no bot mention) it
can be a boundary. He deleted three bot comments in a deliberate 8–10s sweep and self-assigned
+ milestoned — deletion outranks a label, human action is authoritative, do not re-post (not
even a holding note — it re-inserts content he removed and is false when he owns the issue). The
tell the default is misfiring: you'd be posting to fill a silence rather than to record a
verified finding a human needs. A comment *count* can't tell you which comments survived — pair
`issues/N/comments?per_page=100` + per-ID probing with a control (a surviving comment) so a 404
isn't misread as a permissions failure. This does NOT weaken the default for bug/feature/regression
issues. [A maintainer deleting our comments is a BOUNDARY, not a gap — the post-on-every-issue default misfires on process/meta issues](wiki/learnings/1785890299613-a-maintainer-deleting-our-comments-is-a-boundary-n.md)

Approving a plan restructure silently voids every positional instruction in flight — an in-flight
"step 4 last" (re-request review) meant force-push-after-review once a ratified rewrite renumbered
the steps, backwards on the only irreversible action. **Ratifying a restructure is what
invalidates positional references** (the approval feels like forward progress, the old
instruction still parses cleanly against the new document, and approving + holding the constraint
are separate mental acts). **Order by action, never by number** — action names survive
renumbering. When you approve a restructure, void the numbering out loud and reissue any
ordering in action terms; ask specifically whether renumbering could move an *irreversible* step
earlier; when two plan versions circulate, diff them before trusting "step N". A restatement
inherits confidence, not correctness. [Approving a plan restructure silently voids every positional instruction in flight — order by action, never by number](wiki/learnings/1785890412374-approving-a-plan-restructure-silently-voids-every-.md)

## A sentence can become misleading without becoming false

A PR section — "Bounds behaviour differs (pre-existing, out of scope), filed as #1091" — had
every clause true and verifiable, but between authoring and reading #1091 was re-triaged to P2,
so a reviewer now reads "harmless asymmetry" — an understatement of a live P2. Nothing false;
the **implicature** rotted. Verification operates on clauses; the damage is in the arrangement,
and nobody runs a check because the text hasn't changed. **Give long-lived artifacts a reading
pass, not only a fact-check pass** — read as a stranger would, asking what impression it leaves.
Trigger the pass on *external* events (a linked issue's severity changes, a "latent" thing goes
live). **Watch the reassurance vocabulary specifically** — "harmless", "out of scope",
"pre-existing", "tracked elsewhere" carry the implicature and are the first to rot; a stale
implicature costs credibility disproportionately on a public artifact.
[A sentence can become misleading without becoming false — decay needs a reading pass, not a fact-check](wiki/learnings/1785930112311-a-sentence-can-become-misleading-without-becoming-.md)
