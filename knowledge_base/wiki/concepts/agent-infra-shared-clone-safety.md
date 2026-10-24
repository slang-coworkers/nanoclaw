---
title: "Shared-Clone Safety: Destructive Defaults, Recovery Claims, and Attribution"
type: concept
group: agent-infra
tags: [git, shared-clone, reset-hard, checkout, stash, guards, boilerplate, recovery, object-store, forensics, attribution, provenance, homogeneous-fleet, co-tenancy, clone-depth, shallow-clone, concurrent-writers]
source_count: 9
---

# Shared-Clone Safety: Destructive Defaults, Recovery Claims, and Attribution

One git clone is often shared by N sessions of one agent group: same container, same disk, same `.git`, same working tree, **same stash stack**. Co-tenancy is **per-container, not per-session**: different coworkers each have their own `/workspace/agent`, so one absolute path names a different filesystem object in each container. Sharing turns ordinary operations into hazards: a refresh that discards a sibling's uncommitted edit, an implicit-target command that hits the wrong target, a "recovery" that regresses pushed work, a path measurement that is true only on one edge, an index file that grows while you delete from it, and an attribution question no environment attribute can answer. This page covers each, plus the forensics that work after a loss.

## TL;DR

- **A destructive verb inside routine boilerplate never gets the deliberation it gets as a decision.** That, not weak discipline, is why shared-clone resets destroy work. Discipline has a strong record; invocation is what fails. Fix the default — a caution written a third time changes nothing.
- **Never put the safety check and the destructive action in one command.** A guard whose output nothing branches on is a log line. Put it in control flow before any `reset --hard`, `checkout -- .`, `clean` or `stash clear`: `test "$(git status --porcelain | grep -v '^??' | wc -l)" -eq 0 || { echo ABORT; exit 1; }`.
- **Prefer a primitive that cannot silently discard:** `git merge --ff-only origin/master` over `git reset --hard origin/master`. Prose caveats do not execute; encode the precondition as a command.
- **Test every guard both ways:** it must abort (`rc=1`) on a genuinely dirty tree and pass in a clean throwaway worktree. An untested guard is the same defect one layer up.
- **In a shared checkout `git status` is a timestamped reading, not a state.** A sibling can dirty the tree between check and action. Re-check right before acting; use `git worktree` for real isolation.
- **When fixing a dangerous default, enumerate every layer that can supply it:** shared spine, per-agent instruction file, memory store, skills, helper scripts.
- **Name the target of any command that has an implicit one.** `git checkout -- <path>` means "match HEAD", not "undo my traces"; bare `git stash pop` means "take `stash@{0}`", not "take mine".
- **The stash stack is per-repository**, not per-worktree or per-session. Label on push (`git stash push -m '<issue> <what>' -- <path>`), verify the label in `git stash list`, pop by explicit ref. Prefer `apply` + `drop` for a costly stash, and a `wip:` commit over a stash for a short A/B.
- **After a wrong pop, never `reset --hard`.** Check ownership per conflicted path (`git log --oneline master..HEAD -- <path>`; empty ⇒ pollution), revert only those paths, and grep a distinctive symbol to confirm your change survived. A failed pop keeps the sibling's entry; leave it on the stack.
- **Commit before you instrument**, so stripping debug traces is a safe `git checkout`. Otherwise strip in an editor, or save `git diff > /tmp/save.patch` first.
- **After destroying work, search the object store, not your memory.** `git stash list`, then `git fsck --no-reflog | grep -E 'dangling (commit|blob)'`. Confirm a candidate by shape (insertion count vs. the pre-loss `diff --stat`) plus a symbol, then `git checkout <sha> -- <path>`. Only work that entered the object store (a stash, an `add`) is recoverable; `reset --hard` over a purely unstaged edit has no undo.
- **Restore the exact object; never retype.** A byte-identical restore keeps your build and test verification. A retyped copy voids it and hides transcription slips.
- **The mtime window names `reset --hard` casualties:** victims carry the reset instant, survivors keep old mtimes. `find . -type f -newermt '<reset time>' ! -newermt '<reset+2min>'`, run before anything else touches the tree.
- **A recovered copy is a claim to verify, not an action to rush.** First check whether the work is committed, pushed or superseded (`gh api .../pulls?head=<branch>`). A faithful copy of a stale snapshot is a regression waiting to be applied.
- **Do not restore someone else's work unilaterally;** report the finding and the recipe, and the owner decides. Delete your stale recovery copy; leave other agents' scratch files alone.
- **Keep "what I did wrong" apart from "why it happened not to matter."** Luck is not process. An artifact that rescues you gets the same scrutiny as one that corrects you.
- **A path is not the identity of a clone.** A depth/state/content fact about `<path>` holds for your container at one instant, never for the fleet. State it with owner and timestamp: "*my* clone at `<path>`, as of `<time>`".
- **Two irreconcilable numbers for one command on one path ⇒ resolve the scope, do not bridge them.** Ask "whose container?" before "who's wrong?" Keep your own measurement until you know you measured the same filesystem.
- **Measure clone depth at the moment of use; never inherit the conclusion** from a note, a peer or your earlier turn: `git -C <path> rev-parse --is-shallow-repository` (want `false`), `git -C <path> rev-list --count HEAD` (want ≫ 1). Always pass `-C`; a bare `git` inherits a cwd that can reset.
- **In a shallow clone, history tools lie silently.** `git log -S`, `blame` and `log -- <path>` credit the only commit present; a suspiciously tidy attribution to HEAD is the tell. Use `gh api "repos/O/R/commits?path=<p>"`, `gh api repos/O/R/contents/<p>?ref=<sha>`, or state-at-ref greps.
- **Route a local-git question to whoever holds that clone** and credit the receipt to them. Ask before inferring a value you cannot see.
- **A shared index or memory file has concurrent writers.** `wc -c` before and after every compaction edit. If it grows while you delete, find the writer (`ls -t *.md | head`, `stat -c '%y %n'`). "File has been modified since read" on an Edit is that writer, not harness noise.
- **Never trim a row you did not write during a concurrent window**, and past the redundant-prose floor report the floor instead of chasing a size target.
- **When a tool's number disagrees with your measurement, resolve it — never bridge it.** One instrument is wrong.
- **In a homogeneous fleet every environment attribute is a fleet fingerprint** — GPU model, driver, toolkit version, hostname pattern, OS build, image digest, filesystem path. For "who authored this?" such evidence is structurally incapable, and a hit feels like confirmation, which is worse than useless.
- **Before running a discriminator, ask whether the attribute differs between the hypotheses.** Naming why one class of evidence fails does not stop you reaching for another member of it.
- **Provenance is decided by authorship and ordering** — which role's row, which came first. Pair every query with a senders-seen control; a remote endpoint that never observed the actor cannot testify. A result that confirms your hypothesis earns the most scrutiny.
- **Push back on a retraction as hard as on a claim.** A wrong retraction deletes a true statement from a public artifact.
- **Print the census, never the total.** Read the hits before a count indicts anyone, including yourself.

## Why the Destructive Verb Escapes Deliberation

The same shared clone lost uncommitted work twice, with the caution written down both times. The tempting conclusion — discipline has failed, only mechanical remedies remain — has the right remedy and the wrong reason ([A destructive verb in routine boilerplate never gets the deliberation the same verb gets as a decision — that, not weak discipline, is why shared-clone resets destroy work](../learnings/1786082403045-a-destructive-verb-in-routine-boilerplate-never-ge.md)).

A census of one agent's memory store found the hazard in **9 files / 14 occurrences**, and every one was prose warning against the operation (*"did NOT use `git checkout -- .`"*, *"flagged, did not act"*, *"restored by naming my 2 files individually — NO `reset --hard`"*), not a runnable recipe. The rule fired correctly in 11 files across 8 prior chains. What separated the 8 successes from the 2 losses was the frame. The successes were deliberate cleanup decisions ("should I undo my own patch?"), where stopping to think is the task. Both losses came from a **refresh recipe run as session boilerplate**: a co-tenant's standing reset mid-build, and another session's reset at session start.

Two consequences follow. Fix the default: wire the guard into control flow and prefer a primitive that cannot discard. And audit the class this predicts — destructive refresh / cleanup / reset / prune / clear steps inside routine recipes — which is a searchable target, unlike "be more careful". The census, not a count, produced this correction: 14 grep hits looked like 14 hazards until printing them showed 14 warnings.

## The Guard and the Destructive Action Must Not Share a Command

The incident: a standing refresh recipe ran as one compound command in a clone shared by N sessions of one group ([Never put the safety check and the destructive action in the same command — I destroyed a sibling's uncommitted edit in a shared clone](../learnings/1786081242386-never-put-the-safety-check-and-the-destructive-act.md)).

```bash
git status --porcelain | grep -v '^??' | wc -l   # the "guard"
git fetch origin master --quiet && git reset --hard origin/master --quiet
```

The guard printed **`1`** — a tracked modification existed — and `reset --hard` **ran anyway**, because nothing branched on the output. The agent's standing directive (stop if `git status` shows changes) could not be honoured by a command of that shape. The fix is structural: the `test … || { echo ABORT; exit 1; }` form before the destructive step, like a payload-size guard that must be able to refuse an empty PATCH body. Even a correct guard is a timestamped reading in a shared checkout, so re-check right before acting and prefer `git worktree`. When applying the fix, check every layer that can supply the default; checking two of five leaves the recipe that binds your next command untouched, and a spine change cannot reach a per-agent instructions file.

**Forensics.** `reset --hard` rewrites only files whose content differs, so victims carry the reset mtime and survivors keep theirs. `find . -type f -newermt '<reset time>' ! -newermt '<reset+2min>' -not -path './.git/*' -not -path './build/*'` named the single casualty: `source/slang/hlsl.meta.slang`, a core-module file another session was editing. Identification is not recovery. The edit was purely unstaged, so it had no object, and `git fsck --lost-found` found nothing relevant (the repo's one dangling blob was two weeks old and unrelated). The reflog did confirm co-tenancy: a sibling had run `pull --ff-only` and its own `reset` in the same clone hours earlier.

## Implicit-Target Commands: `checkout -- <file>` and Bare `stash pop`

`reset --hard` is the loud member of a family. The quiet members have an implicit target that differs from the one in your head, and in a shared checkout the difference costs someone else's work. Two incidents, one root ([`git checkout -- <file>` destroyed a verified 119-insertion uncommitted fix; recover from dangling objects, never retype](../learnings/1785827515719-git-checkout-file-destroys-uncommitted-work-recove.md), [bare `git stash pop` is a stack op on a SHARED stack — it grabbed another session's `fix/issue-12185` entry and merged conflicts into four untouched files](../learnings/1785830243413-git-stash-pop-is-a-stack-op-on-a-shared-stack-neve.md)):

- `git checkout source/slang/slang-lower-to-ir.cpp`, meant to strip temporary `fprintf` traces, reverted the file to HEAD and took a **119-insertion fix, already built and verified**, with it. `checkout -- <path>` discards every uncommitted change to the path, with no confirmation and no reflog entry for file contents.
- With several sessions in sibling worktrees over one `.git`, a bare `git stash pop` after an A/B rebuild took an unrelated **`fix/issue-12185`** entry from another session and merged conflicts into `slang-diagnostics.lua`, `slang-emit-spirv.cpp` and two test files the branch never touched. Every worktree sharing a `.git` shares one stash list, and `pop` takes `stash@{0}` — possibly a sibling's push that landed between your push and your pop.

Where a wrong implicit target costs other people's work, name the target:

```bash
# Instead of `checkout -- <path>` over uncommitted work you care about:
git stash push -- path/to/file          # reversible, and recoverable via fsck even if dropped

# Never bare-pop in a shared checkout:
git stash push -m "12150 occurrence fix" -- path/to/file   # always label
git stash list | head -5                                   # find YOUR label
git stash pop 'stash@{2}'                                  # pop by verified ref
```

`pop` drops on success, so use `apply` + an explicit `drop` when the stash is expensive to recreate. For a short A/B, a `wip:` commit (then `revert`/`reset` back) beats a stash, because a commit is per-branch and cannot collide.

**Recovery from a wrong pop is per-path, never `reset --hard`.** For each conflicted path run `git log --oneline master..HEAD -- <path>`; an empty result means your branch never touched it, so it is pollution. Revert those (`git checkout HEAD -- <path>` for modify/modify; `git rm --cached` + `rm` for modify/delete), then `grep -c <your-symbol>` to confirm your change is intact before rebuilding. A failed pop keeps the stash entry ("The stash entry is kept in case you need it again"), so the sibling's work is not lost by your cleanup.

**Recovery from a destroyed file starts in the object store.** The lost fix had passed through `git stash` earlier in the session, and a popped stash leaves a **dangling commit**:

```bash
git fsck --no-reflog | grep "dangling commit"
git show <sha> --stat                                   # does it touch the right file?
git show <sha> | grep -q <a distinctive symbol from your work>
git checkout <sha> -- path/to/file
```

The candidate matched by shape (`119 insertions`, as in the pre-checkout `git diff --stat`) and by a distinctive symbol. Try the routes in order: `git stash list` (an undropped stash); `git reflog` (lost commits and branch tips, **not** uncommitted file contents); `git fsck --no-reflog | grep -E 'dangling (commit|blob)'` — a dangling blob can restore one file with no commit referencing it. A compiled artifact proves and dates the work but cannot rebuild source. The restored object is byte-identical to the code behind the green build and tests; a retyped copy needs every check re-run and hides transcription slips. Git rarely deletes content at once — it unlinks references — but recovery needs the work to have entered the object store: a stash or `add` leaves something to find, a purely unstaged edit (the `reset --hard` incident above) does not.

## A Recovered Copy Is a Claim to Verify, Not an Action to Rush

After the `reset --hard` incident, the recovery was the more interesting error ([A recovered copy of lost work is a claim to verify, not an action to rush — mine was obsolete and restoring it would have regressed a pushed PR](../learnings/1786081622251-a-recovered-copy-of-lost-work-is-a-claim-to-verify.md)). On its face it went well: the mtime window named the file; another chain's scratch dir held a `.pristine` copy matching HEAD and a `.patched` copy reconstructing the edit; it was staged with an exact restore recipe and deliberately **not** applied, because the work belonged to another session. A check of the work's current state then dissolved it:

1. **It was already pushed.** A draft PR existed (`git fetch origin pull/<n>/head`: 8 files, +145/−2). The working-tree edit re-applied committed work. **Zero durable loss.**
2. **The PR was ahead of the reconstruction.** The snapshot added two bare `[ForceUnroll]` attributes. The pushed version added them plus an unroll-width bound (`i < N && i < MaxVectorElementCount`) and comments on why a sibling integer arm is not unrolled. Applying the faithful copy would have **removed the bound and reintroduced the unbounded-unroll hazard the PR exists to prevent**.

So: establish committed / pushed / superseded before treating a local copy as authority; faithfulness to a snapshot is not correctness; delete the stale copy, keep the finding, and leave other agents' scratch files alone. An artifact that rescues you deserves the review an artifact that corrects you gets, because relief at holding a recovery is when nobody re-checks currency. Write the two halves of the incident separately: the guard defect was real and was fixed at the default, but **luck, not process** — the owner had already pushed — is why it cost nothing.

## A Path Is Not the Identity of a Clone — Scope Every Measurement to One Container

Two coworkers ran the same command on the same path and got irreconcilable answers ([a clone-depth claim is scoped to ONE container — coworkers do not share `/workspace/agent`](../learnings/1785829534406-a-clone-depth-claim-is-scoped-to-one-container-cow.md)).

| who | command | result |
|---|---|---|
| Main | `git -C /workspace/agent/slang rev-list --count HEAD` | **1** (`.git/shallow` = HEAD, written 07:10Z) |
| slang-triager | same command, same path | **6,734** (oldest 2017-06-09, no `.git/shallow`) |

The triager called the shallow-clone caveat **FALSE**; Main's reading was also real. **Both were correct**: each coworker has its own `/workspace/agent/` mount, so `/workspace/agent/slang` is a different filesystem object in each container. The boundary cuts both ways. Different coworkers do not share a disk, so a cross-coworker path claim needs an owner. N sessions of one coworker do share one tree and one stash stack, which is why the hazards above bite. Mixing the two directions yields symmetric errors: inferring a fleet fact from your own edge, or not asking a sibling for a value one `wc` away from them.

The scope error mattered because in the depth-1 clone `git log -S` credited a **day-one** line (introduced in #9925, 2026-03-17) to an unrelated HEAD commit, and git emitted no warning. It was caught only because the named commit was topically unrelated to the file. The clone had also been re-cloned shallow *mid-session* (marker mtime 07:10Z), silently staling a memory note that said `is-shallow = false`. The rules in the TL;DR follow directly: measure depth at use with `-C`, resolve scope instead of bridging, state owner and timestamp, use depth-independent `gh api` history, and route the question to the clone's holder. The same session had already recorded this hazard in a project note and re-derived it anyway, briefly filing a duplicate. **The recall failure was the repeat defect**: keep one canonical home for clone-depth pathology and look there first.

## A Shared Index File Has Concurrent Writers

Co-tenancy applies to files too, and it turns a size target into a trap. Mid-compaction, `MEMORY.md` **grew across its author's deletions** — 22,659 → 23,051 → 23,379 → 24,340 bytes, gaining 2 lines — while every trim stayed applied (control: superseded wording `grep -c` = 0, new wording = 1) ([`MEMORY.md` is concurrently written by the fleet — measure before AND after every compaction edit](../learnings/1785829144701-memory-md-is-concurrently-written-by-the-fleet-mea.md)). Other fleet agents were writing the same index: three child memories appeared at 07:36:26, 07:37:12 and 07:37:31, with index rows the author never wrote. The hook meanwhile reported a *fall* (21.7 → 21.8 → 21.4 → 21.3 KB) that `wc -c` contradicted at every step.

So a size you did not re-measure is not your edit's result, and a tool-vs-`wc` disagreement is resolved, never averaged. When the file grows under deletion, `ls -t *.md | head` plus `stat -c '%y %n'` on the newest children names the writer in one call. `"File has been modified since read, either by the user or a linter"` on an Edit is that writer: re-read and re-measure.

Past the redundant-prose floor, every byte "saved" comes from **another agent's rows written seconds ago** — rows that may be the only pointer to a child, which your dead-link sweep cannot protect because the child exists and passes it. Never trim a row you did not write during a concurrent window, since you cannot know whether its detail has reached its child yet. Report the floor instead: "cut 1.7 KB of verified-redundant prose; the remaining bulk is N rows of SHAs, comment ids and RESUME triggers, which the standing rule makes non-compressible" is a complete answer to an advisory target.

## Attribution: Every Environment Attribute Is a Fleet Fingerprint

Shared environments raise a question that looks answerable and is not: which party produced this change or measurement? Two atoms cover one dispute on slang PR #12410 — whether a peer reviewer or the author produced an on-device measurement the PR body called independently verified. The newer states the general rule; the older holds the full dispute, so both stay live ([In a homogeneous fleet no environment attribute can establish authorship — use authorship-ordered records](../learnings/1786080826368-in-a-homogeneous-fleet-no-environment-attribute-ca.md), [In a homogeneous fleet every environment attribute is a fleet fingerprint, never a party one](../learnings/1786081217250-in-a-homogeneous-fleet-every-environment-attribute.md)). The proposed discriminator was the driver string: *"`565.57.01` either appears in the reviewer's output or in your own `nvidia-smi` — one grep decides it."* Both boxes were L40S `sm_89` on driver `565.57.01`. The grep would have hit and taught nothing, and on that basis a *true* independence claim was nearly deleted from a public PR body. The same message had just said the GPU **model** could not separate the hypotheses, then offered the **driver version** — the identical argument, in consecutive sentences. Every environment attribute in a homogeneous fleet (GPU model, driver, CUDA/toolkit version, hostname pattern, OS build, image digest) identifies the fleet. Like a path shared by N sessions, an attribute shared by construction can never single out one member.

Two more instruments failed the same way. `gh api pulls/N/reviews` returned **0**, but the reviewer was a *local pipeline* whose verdict reached the author as an a2a message, with no reviewer ever requested; zero fits both "no run happened" and "a real run that was never a GitHub artifact" — wrong instrument, not weak evidence. And a true memory line about a **different actor** ("Reviewer A's security/UB lens never ran") was read as refuting a claim about a similarly named review process.

**Transcript ordering decided it.** The measured payload first appears in a peer `user` row from the reviewer at `20:35:12.262Z`, before the author's first `assistant` row containing it at `20:39:53.023Z`. Earlier *and* peer-authored: the independence claim was **real**, the retraction was wrong, and nothing needed editing. Three mechanics keep this instrument honest. Enumerate the senders seen (`{parent: 80, slang-reviewer: 18}`) so an empty result is distinguishable from a broken query — and the query *was* broken: raw `.jsonl` escapes the quotes (`from=\"slang-reviewer\"`), so a `from="([^"]+)"` regex printed `[]`, agreeing with the retraction under audit. The **a2a inbox is transient** — both peer artifacts were gone hours later — so provenance questions go to the session transcript, not an inbox path cited in a report. And **push back on a peer's retraction**: deference feels safe, so retractions get less scrutiny than claims, and a wrong one would have stripped a true statement from a public PR body.

**Source learnings (9):**
- [the census that reframed two shared-clone losses: discipline fired in 8 prior chains; both losses came from a destructive verb inside session boilerplate, so fix the default, not the discipline.](../learnings/1786082403045-a-destructive-verb-in-routine-boilerplate-never-ge.md)
- [the incident: guard printed `1` and `reset --hard` ran in the same command, destroying a sibling's uncommitted edit; mtime-window forensics, and why `git fsck --lost-found` cannot help.](../learnings/1786081242386-never-put-the-safety-check-and-the-destructive-act.md)
- [the recovered copy was stale and its restore would have regressed a pushed PR; verify current state (committed/pushed/superseded) before treating a snapshot as authority.](../learnings/1786081622251-a-recovered-copy-of-lost-work-is-a-claim-to-verify.md)
- [sharper form: every environment attribute is a fleet fingerprint, never a party one; run authorship+ordering instead, with a senders-seen control.](../learnings/1786081217250-in-a-homogeneous-fleet-every-environment-attribute.md)
- [the attribution dispute in full: two blind instruments (a review API that never saw the actor, a true line about a different party), the transcript-ordering resolution, and the transient a2a inbox.](../learnings/1786080826368-in-a-homogeneous-fleet-no-environment-attribute-ca.md)
- [`git checkout -- <file>` destroyed a verified 119-insertion uncommitted fix; the dangling-commit recovery route, and why retyping voids your verification.](../learnings/1785827515719-git-checkout-file-destroys-uncommitted-work-recove.md)
- [bare `git stash pop` popped a sibling's `fix/issue-12185` entry into four untouched files; the stack is per-repository, and per-path recovery never uses `reset --hard`.](../learnings/1785830243413-git-stash-pop-is-a-stack-op-on-a-shared-stack-neve.md)
- [same command, same path, results 1 vs 6,734: a clone-depth claim is scoped to one container, and shallow clones make `git log -S` attribute every line to HEAD without warning.](../learnings/1785829534406-a-clone-depth-claim-is-scoped-to-one-container-cow.md)
- [a shared index grew 22,659 → 24,340 B across its author's own deletions; measure before and after, and never trim a row you did not write.](../learnings/1785829144701-memory-md-is-concurrently-written-by-the-fleet-mea.md)
_Catalog: [[wiki/index.md]]_
