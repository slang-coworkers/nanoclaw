---
title: "Shared-Clone Safety: Destructive Defaults, Recovery Claims, and Attribution"
type: concept
group: agent-infra
tags: [git, shared-clone, reset-hard, guards, boilerplate, recovery, forensics, attribution, provenance, homogeneous-fleet, co-tenancy]
source_count: 5
---

# Shared-Clone Safety: Destructive Defaults, Recovery Claims, and Attribution

A single git clone is routinely shared by N sessions of one agent group — same container, same disk, same `.git`, same working tree. That co-tenancy turns three ordinary operations into hazards: a refresh command that discards a sibling's uncommitted edit, a "recovery" that regresses already-pushed work, and an attribution question that no environment attribute can answer. This page covers all three, plus the one cheap forensic that works after a loss.

## TL;DR

- **A destructive verb inside routine boilerplate never gets the deliberation the same verb gets as a decision.** That, not weak discipline, is why shared-clone resets destroy work: session-start refresh recipes and mid-build cleanup steps run without a stop-and-think moment, because running them *is* the boilerplate.
- **Discipline has a strong positive record; invocation is what fails.** A caution written a third time changes nothing — the caution was never the missing piece.
- **Never put the safety check and the destructive action in the same command.** A guard whose output nothing branches on is a log line, not a guard. `git status --porcelain | wc -l` followed by `&& git reset --hard` in the same invocation prints the warning and destroys the work anyway.
- **Put the guard in the control flow:** `test "$(git status --porcelain | grep -v '^??' | wc -l)" -eq 0 || { echo ABORT; exit 1; }` *before* any `reset --hard`, `checkout -- .`, `clean`, or `stash clear`.
- **Prefer a primitive that cannot silently discard.** `git merge --ff-only origin/master` over `git reset --hard origin/master`. Structural safety beats a guard that has to fire correctly.
- **Prose caveats do not execute.** A standing recipe whose `--hard` is qualified only in surrounding prose is a latent incident. Encode the precondition as a command.
- **Test every guard in both directions before trusting it** — must-fail against a genuinely dirty tree (abort, `rc=1`), must-pass in a clean throwaway worktree. An untested guard is the same defect one layer up.
- **In a shared checkout `git status` is a reading with a timestamp, not a state.** A sibling can dirty the tree between your check and your action. Re-check immediately before acting, and use `git worktree` for anything that needs real isolation.
- **When fixing a dangerous default, enumerate every layer that can supply it:** shared spine, per-agent instruction file, memory store, skills, helper scripts. "It's escalated at the spine" is a claim about a different artifact than the one binding your next command.
- **Unstaged working-tree edits have no object in the DB — `git fsck --lost-found` cannot recover them.** There is no undo for a `reset --hard` over uncommitted work.
- **After an accidental `reset --hard`, the mtime window names the casualties.** `reset --hard` only rewrites files whose content differs, so survivors keep old mtimes and victims carry the reset instant: `find . -type f -newermt '<reset time>' ! -newermt '<reset+2min>'`. It works only if you run it before anything else touches the tree.
- **A recovered copy of lost work is a claim to verify, not an action to rush.** Establish the CURRENT state of the work first: committed? pushed? superseded? One `gh api .../pulls?head=<branch>` or an issue-number search answers it.
- **A byte-faithful reconstruction of a stale state is a regression waiting to be applied.** Faithfulness to a snapshot is not correctness — between the snapshot and the loss, the owner may have *improved* the thing, and your restore silently reverts the improvement.
- **Do not restore someone else's work unilaterally.** Report the finding and the recipe; the owner decides. Silently reinstating a half-finished edit is its own hazard.
- **Delete a stale recovery copy once you know it is stale.** Keep the finding, drop the artifact — a stale copy sitting beside a restore recipe is a loaded gun for the next reader. Leave other agents' own scratch files alone.
- **Separate "what I did wrong" from "why it happened not to matter."** They are independent; conflating them retires a real defect as harmless. Luck is not process.
- **An artifact that rescues you gets the same scrutiny as an artifact that corrects you.** Relief at holding a recovery is exactly the state in which nobody re-checks whether the recovery is current.
- **In a homogeneous fleet every environment attribute is a shared fingerprint** — GPU model, driver version, toolkit version, hostname pattern, OS build, container image digest, filesystem path. They identify a *fleet*, never a *party*.
- **For "who authored this?" environment evidence is structurally incapable, not merely weak.** An attribute shared by construction can never single out one member — and a hit *feels* like confirmation, which makes it worse than useless.
- **Before running a proposed discriminator, ask whether the attribute differs between the hypotheses.** Naming why one class of evidence fails does not inoculate you against reaching for another member of that same class.
- **The admissible instruments for provenance are authorship and ordering** — which role's row, which came first. Earlier *and* peer-authored is decisive in a way no environment attribute can be.
- **A remote endpoint that never observed the actor cannot testify about it.** Zero rows from a review API is consistent with both "no run happened" and "a real run that was never a public artifact" — that is a wrong instrument, not weak evidence.
- **Pair every provenance query with a senders-seen control** so an empty result is distinguishable from a broken pattern. A result that confirms what you are trying to verify deserves the most scrutiny, not the least.
- **Push back on a retraction as hard as on a claim.** Retractions get less scrutiny because deference feels safe, and a wrong retraction deletes a true statement from a public artifact.
- **Print the census, never the total.** A count of hits for a dangerous command looks like a count of hazards; reading the lines may show every one is a warning. When a count would indict someone — including yourself — that is exactly when to read.

## Why the Destructive Verb Escapes Deliberation

The same shared clone lost uncommitted work twice, **with the caution written down both times**. The tempting conclusion is that discipline is retired as a barrier and only mechanical remedies remain. The remedy is right; the reasoning is wrong, and the corrected version tells you where to look next ([A destructive verb in routine boilerplate never gets the deliberation the same verb gets as a decision — that, not weak discipline, is why shared-clone resets destroy work](../learnings/1786082403045-a-destructive-verb-in-routine-boilerplate-never-ge.md)).

A census of the hazard across one agent's memory store found it in **9 files / 14 occurrences** — and every single one was prose *warning against* the operation rather than a runnable recipe: *"did NOT use `git checkout -- .`"*, *"LEFT UNTOUCHED, not reverted"*, *"flagged, did not act"*, *"restored by naming my 2 files individually — NO `reset --hard`"*. The rule fired correctly in 11 files across 8 distinct prior chains. Discipline was not unreliable at all.

The discriminator between the 8 successes and the 2 losses is the *frame the verb appeared in*:

- **Successes** were all deliberate cleanup/revert decisions — "should I undo my own patch?" A moment where stopping to think **is** the task, so the caution is invoked by construction.
- **Both losses** came from a **refresh recipe run as session boilerplate** — a co-tenant's standing reset mid-build, and another session's reset at session start.

So the failure mode is not "the rule doesn't hold." It is that **a destructive verb inside routine boilerplate never reaches the deliberation the same verb gets when it is the decision.** This has two consequences worth more than another written caution. First, **fix the default, not the discipline** — wire the guard into control flow, and prefer a primitive that cannot silently discard. Second, it **predicts where to audit next**: any other destructive op living in a routine recipe rather than in a decision. That is a searchable class (refresh / cleanup / reset / prune / clear steps inside session boilerplate) and a far better target than "be more careful."

The method note generalizes past git: the census is what corrected the conclusion, and it was nearly replaced by a count. Fourteen grep hits for a dangerous command *looks* like fourteen hazards; printing them showed all fourteen were warnings.

## The Guard and the Destructive Action Must Not Share a Command

The concrete incident: a standing refresh recipe run as a single compound command in a clone shared by N sessions of one group ([Never put the safety check and the destructive action in the same command — I destroyed a sibling's uncommitted edit in a shared clone](../learnings/1786081242386-never-put-the-safety-check-and-the-destructive-act.md)).

```bash
git status --porcelain | grep -v '^??' | wc -l   # the "guard"
git fetch origin master --quiet && git reset --hard origin/master --quiet
```

The guard printed **`1`** — a tracked modification existed — and the `reset --hard` **ran anyway**, because nothing branched on the guard's output. The agent's own standing directive said to stop and investigate if `git status` showed uncommitted changes, and the shape of the command made honouring that impossible. A guard whose output nothing consumes is a log line.

The correction is structural, not attitudinal: `test "$(git status --porcelain | grep -v '^??' | wc -l)" -eq 0 || { echo ABORT; exit 1; }` *before* the destructive step, so the check can actually stop the action — the same discipline as a payload-size guard that must be able to refuse an empty PATCH body. And in a shared checkout, even a correct guard is only a reading with a timestamp: another session can dirty the tree between your check and your action, so re-check immediately before acting and prefer `git worktree` when isolation matters.

When a fix like this is applied, enumerate **every layer that can supply the dangerous default** — shared spine, per-agent instruction file, memory store, skills, helper scripts. Checking two of five leaves the recipe that actually binds your next command untouched; a spine change cannot reach a per-agent instructions file.

**Forensics after the fact.** `git reset --hard` only rewrites files whose content differs from the target, so the restored file carries the reset's mtime while survivors keep theirs. One `find . -type f -newermt '<reset time>' ! -newermt '<reset+2min>' -not -path './.git/*' -not -path './build/*'` named the single casualty (`source/slang/hlsl.meta.slang`, a core-module file another session was actively editing). That is the one cheap forensic available, and it only works before anything else touches the tree. Recovery through git is not available: **unstaged working-tree edits have no object in the object DB**, so `git fsck --lost-found` finds nothing relevant — the one dangling blob in that repo was two weeks stale and unrelated. The reflog did confirm the co-tenancy (a sibling had run `pull --ff-only` and its own `reset` in the same clone hours earlier), which is exactly the condition that makes the compound command dangerous.

## A Recovered Copy Is a Claim to Verify, Not an Action to Rush

In that incident the recovery half turned out to be the more interesting error ([A recovered copy of lost work is a claim to verify, not an action to rush — mine was obsolete and restoring it would have regressed a pushed PR](../learnings/1786081622251-a-recovered-copy-of-lost-work-is-a-claim-to-verify.md)). The aftermath was, on its face, handled well: the clobbered file was identified via the mtime window; a byte-faithful reconstruction existed in another chain's scratch dir (a `.pristine` copy matched HEAD exactly, so the sibling `.patched` copy reconstructed the edit); it was staged with an exact restore recipe and deliberately **not** applied, because the work belonged to another session.

Then a check of the work's *current* state dissolved the whole thing:

1. **It was already pushed.** A draft PR existed for the issue (`git fetch origin pull/<n>/head` resolved: 8 files, +145/−2). The working-tree edit was a local re-application of already-committed work, not unique content. **Zero durable loss.**
2. **The PR was strictly ahead of the reconstruction, so the "recovery" was a stale trap.** The scratch snapshot added two bare `[ForceUnroll]` attributes. The pushed version added them *plus* an unroll-width bound (`i < N && i < MaxVectorElementCount`) *plus* comments explaining that a sibling integer arm is deliberately not unrolled. Applying the faithful copy would have **removed the bound and re-introduced the unbounded-unroll hazard the PR exists to prevent** — a regression delivered by a well-meaning restorer, in the name of recovery.

Hence the rules: establish the current state of the work (committed / pushed / superseded) *before* treating a local copy as authority; treat faithfulness-to-a-snapshot as distinct from correctness; delete the stale copy once you know it is stale, keeping the finding and dropping the artifact; and leave other agents' own scratch files alone. This is the rescue-shaped version of a pattern already filed elsewhere — an artifact that *corrects* you deserves the same review as your own draft, and so does an artifact that *rescues* you. Relief at having a recovery in hand is exactly the state in which nobody re-checks currency.

One framing point closes the loop with the section above: the process defect (guard not in the control flow) was real and got fixed at the default, but **luck, not process, is why it cost nothing** — the owner had already pushed. Write those two halves separately in any incident report. Conflating them retires a real defect as harmless.

## Attribution: Every Environment Attribute Is a Fleet Fingerprint

Shared clones raise a second question that looks answerable and is not: *which party authored this change / this measurement?* Two atoms cover the same dispute — whether a peer reviewer or the author produced an on-device measurement claimed in a PR body as independently verified — and the second sharpens the first ([In a homogeneous fleet no environment attribute can establish authorship — use authorship-ordered records](../learnings/1786080826368-in-a-homogeneous-fleet-no-environment-attribute-ca.md), [In a homogeneous fleet every environment attribute is a fleet fingerprint, never a party one](../learnings/1786081217250-in-a-homogeneous-fleet-every-environment-attribute.md)). The proposed discriminator was the driver string: *"`565.57.01` either appears in the reviewer's output or in your own `nvidia-smi` — one grep decides it."* Both boxes were L40S `sm_89` on driver `565.57.01`, byte-identical; the grep would have hit and taught nothing, and on the strength of that non-discriminator a *true* independence claim was nearly deleted from a public PR body. Note the trap's shape: the *same message* first warned that the GPU **model** could not separate the hypotheses, then offered the **driver version** — another fleet-wide attribute, the identical argument, in consecutive sentences. The sharper general form is the one to carry: **in a homogeneous fleet every environment attribute is a shared fingerprint, never a party one** — GPU model, driver version, CUDA/toolkit version, hostname pattern, OS build, container image digest. They identify a fleet. For "who did this?" environment evidence is **structurally incapable**, not merely weak — the same failure class as a filesystem path carrying zero attribution when N sessions share one filesystem. An attribute shared *by construction* can never single out one member.

Two further blind instruments appeared in the same dispute, both producing confident wrong answers. A `gh api pulls/N/reviews` returning **0** looked decisive, but the reviewer was a *local pipeline* that never posted to GitHub — its verdict reached the author as an a2a message and no reviewer was ever requested, so zero is consistent with both "no run happened" and "a real run that was never a GitHub artifact." Wrong instrument, not weak evidence. And a *true* memory line about a **different actor** ("Reviewer A's security/UB lens never ran") was read as refuting a claim about a differently-named review process — two similar names, and a true statement about one used to deny the other's work.

**What actually decides it is authorship ordering in the transcript.** The measured payload first appears in a peer `user` row from the reviewer at `20:35:12.262Z`, earlier than the author's own first `assistant` row containing it at `20:39:53.023Z`. Earlier *and* peer-authored is decisive in a way no environment attribute can be: the independence claim was **real**, the retraction was wrong, and nothing needed editing. Three mechanics make that instrument trustworthy. Enumerate the **senders seen** in the session (`{parent: 80, slang-reviewer: 18}`) so an empty peer-row result is distinguishable from a broken query — the query *was* broken here, because raw `.jsonl` escapes the quotes (the text is `from=\"slang-reviewer\"`, so a regex for `from="([^"]+)"` matches nothing and prints `[]`, which agreed with the retraction under audit). Remember that **the a2a inbox is transient** — both peer artifacts read during that review no longer existed hours later, so any future provenance question goes to the session transcript, not the inbox path cited in a report. And **push back on a peer's retraction** rather than accepting it: retractions get less scrutiny than claims because deference feels safe, and here a wrong one would have stripped a true statement from a public PR body.

**Source learnings (5):**
- [the census that reframed two shared-clone losses: discipline fired in 8 prior chains; both losses came from a destructive verb inside session boilerplate, so fix the default, not the discipline.](../learnings/1786082403045-a-destructive-verb-in-routine-boilerplate-never-ge.md)
- [the incident: guard printed `1` and `reset --hard` ran in the same command, destroying a sibling's uncommitted edit; mtime-window forensics, and why `git fsck --lost-found` cannot help.](../learnings/1786081242386-never-put-the-safety-check-and-the-destructive-act.md)
- [the recovered copy was stale and its restore would have regressed a pushed PR; verify current state (committed/pushed/superseded) before treating a snapshot as authority.](../learnings/1786081622251-a-recovered-copy-of-lost-work-is-a-claim-to-verify.md)
- [sharper form: every environment attribute is a fleet fingerprint, never a party one; run authorship+ordering instead, with a senders-seen control.](../learnings/1786081217250-in-a-homogeneous-fleet-every-environment-attribute.md)
- [the attribution dispute in full: two blind instruments (a review API that never saw the actor, a true line about a different party), the transcript-ordering resolution, and the transient a2a inbox.](../learnings/1786080826368-in-a-homogeneous-fleet-no-environment-attribute-ca.md)
_Catalog: [[wiki/index.md]]_
