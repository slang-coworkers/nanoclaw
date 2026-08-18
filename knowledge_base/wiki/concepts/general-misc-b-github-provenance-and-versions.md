---
title: GitHub provenance, release containment, and reading state at the right revision
type: concept
group: general
tags: [github, git, release, provenance, versions, assignees, sub-issues, timestamps]
source_count: 11
---

## TL;DR

Reading GitHub and git state correctly means keying on the right revision, the right endpoint,
and the right field — most "obvious" reads answer an adjacent question:

- **GitHub REST `compare` has FOUR statuses** — `ahead`, `behind`, `identical`, `diverged`.
  For "does tag T contain commit C" use `compare/<C>...<T>`: `behind`/`identical` = present,
  `ahead`/`diverged` = absent. Prefer merge-base identity; test the shipped *binary*, not just
  tag ancestry.
- **Publish date does not order fix containment.** A patch cut off an old branch can be
  published *later* yet contain *none* of the fixes; its assets resolve cleanly and build.
- **A `(#N)` in a commit subject is untrusted provenance**, and `gh api /pulls/N` resolving
  proves nothing — use `/pulls/N/files` or cite the commit SHA.
- **Read the artifact at the revision the reporter ran**, not the PR head; a claim about "what
  the reporter saw" is a claim about an artifact *at a timestamp*.
- **A silently-fixed issue** may have stayed open only because the closing PR never named it —
  check with `git log -S` before any "is it still broken?" analysis.
- **GitHub sub-issues are the tracking surface; parent checkboxes are a stale mirror.**
- **A set assignee may be a nomination, not ownership** — check the assigned actor
  (self-assignment = acceptance; third-party = nomination).
- **A verification is bound to the tag/revision it ran against** — diff the tested identifier
  against the shipped one; re-run rather than reason about whether it "probably still holds."

## Release containment: four statuses, merge-base, and the binary

`gh api …/compare/<tag>...<sha> --jq .status` returns `ahead`, `behind`, `identical`, or
`diverged`. For "does this release contain commit X": `behind`/`identical` = PRESENT;
`ahead`/`diverged` = ABSENT. A two-value (`ahead`/`behind`) mental model silently mishandles
`diverged` — the tag that shares history but contains neither side. Concrete trap:
`v2026.12.0.1` was published later than `v2026.13.1` but is `v2026.12` +1 commit (a patch off
the old 2026.12 branch); vs the fix it is `ahead_by=134 behind_by=1` → `diverged`, and its
assets are named `slang-2026.12.0.1-<platform>` so it configures and downloads cleanly while
lacking the fix. A green build on it would prove nothing. Rules: enumerate releases, don't guess
a tag list; sort by publish date, not version order; map all statuses with a catch-all that
shouts; positive-control with `compare/<sha>...<sha>` → `identical`. [GitHub compare status has THREE values — `diverged` also means absent, and a guessed tag list misses the trap tag](../learnings/1785953532233-github-compare-status-has-three-values-diverged-al.md)

That correction itself introduced two errors, sharpened in a follow-up: (1) it is *four* REST
compare statuses reported for HEAD relative to BASE, not three; (2) prefer the unambiguous form
— T contains C **iff merge base == C** (`compare/<C>...<TAG> --jq .merge_base_commit.sha`, or
locally `git merge-base --is-ancestor`); (3) `ahead_by`/`behind_by` describe *opposite* sides
— a published "`ahead_by=1, behind_by=1`" was actually `ahead_by=134`; always name which
comparison a number came from. (4) **Ancestry proves containment of a SHA; it does NOT prove how
the shipped binary behaves** — a release could carry a cherry-pick under another SHA. When the
claim is "release X lacks the fix," download the asset and run the repro with controls (a
`slangc -v` + behavior table turned an inference into a cheap measurement). Meta: a *correction*
carries the same overclaim risk as what it replaces, wearing the credibility of "already
reviewed." [Release-containment checks: prefer merge-base identity, don't cross ahead_by/behind_by, and test the shipped binary — tag ancestry isn't behavior](../learnings/1785954095027-release-containment-checks-prefer-merge-base-ident.md)

**A verification is bound to the tag it ran against.** A fixer verified every version-interpolated
download path resolved in the **2026.14.1** archives, then pinned **2026.13.1** — Slang asset
filenames embed the version, so the check covered nothing that shipped (re-running against
`v2026.13.1` passed by luck, not inheritance). When reviewing evidence, diff the identifier that
was *tested* against the identifier in the *diff*; if they differ, re-run rather than reason. Same
shape for benchmark-on-commit-A-merge-B and positive-control-on-main-ship-a-branch. "Earliest
release containing the fix" ≠ "latest release" — verify containment of *every* commit you claim,
per tag. [A verification is bound to the tag it ran against](../learnings/1785960675828-a-verification-is-bound-to-the-tag-it-ran-against.md)

## Commit and PR provenance

**A `(#N)` in a commit subject is untrusted provenance.** In a repo whose history was imported
from another, `(#N)` may name a PR in the *source* repo (slangpy `842f6a93` says `slangpy merge
(#263)`, but slangpy's own #263 touches 0 of its 19 files — the `(#263)` is an upstream *sgl* PR
number that collided on bare digits). The trap that caught a reviewer checking the error: `gh api
/pulls/N` *always resolves if any PR N exists*, returning a real title and `mergedAt`, so "I
looked it up, it's real" feels like verification while checking nothing about the connection to
the file. The discriminating query is `/pulls/N/files` — or cite the commit SHA. Check for bulk
imports before writing a supersession story (`842f6a93` changed 534 files and introduced two
paths *simultaneously*, so "one superseded the other" was never true). The commits API caps its
`files` array at 300 with no truncation flag — get real totals from `git show --shortstat` on a
full clone. [A (#N) in a commit subject is untrusted provenance — and /pulls/N resolving proves nothing](../learnings/1785960862161-a-n-in-a-commit-subject-is-untrusted-provenance-an.md)

**Silently-fixed issues: check whether the closing PR ever named the issue.** Scrubbing 7 stale
issues, two were fixed months ago and stayed open purely because the closing PR didn't reference
them (`Fixes #570, #769`, never #510; an empty PR description with no issue reference). Cheap
first move: `git log -S "<distinctive identifier>" --oneline -- <likely file>` finds the
implementing commit even when no metadata connects them — absence of a timeline cross-reference is
*not* evidence the work didn't happen. Traps: a naming-convention mismatch (camelCase discussion,
snake_case shipped library) makes a name grep a *convention* test, not an existence test; a
user-space workaround file is evidence the library *lacks* the feature; and "co-authored" needs
verifying (`git log --format=%B` for the trailer; `gh pr view --json reviews` distinguishes a
reviewer from an author). [Silently-fixed issues: check whether the closing PR ever named the issue](../learnings/1785962249242-silently-fixed-issues-check-whether-the-closing-pr.md)

**Read the artifact at the revision the reporter ran, not the PR head.** When an issue cites an
open PR or branch, the config the reporter exercised is the branch state *at the issue's
`created_at`* — these diverge whenever the PR keeps moving. An issue filed 02-04 cited a PR that
merged 03-06 with 8 commits between; at PR head a `--vector-type` selector suggested the
accelerated path, at the filing-time commit the file hardcoded `vulkan` with no selector — same
file, opposite conclusion about which code path was covered. A path that exists today may have
been added after the report (a `static_assert` landing 4 months later would be an anachronism to
cite), and a path they used may since have been deleted. Get the `created_at`, list the PR's
commits with dates, pick the newest at or before it. [Read the artifact at the revision the reporter ran, not the PR head](../learnings/1785964896079-read-the-artifact-at-the-revision-the-reporter-ran.md)

## Sub-issues, assignees, and ownership

**GitHub sub-issues are the tracking surface; parent checkboxes are a stale mirror.** On one
parent, all 4 body checkboxes were unchecked but `/sub_issues` returned 7 entries with item 1
already *closed as completed* — because the PR that did the work said `Fixes #819` and never
referenced the parent, so nothing propagated. Two things only the sub-issue query surfaces:
per-item assignees (items already reassigned to an active engineer — reporting "needs
reassignment" from the parent body would send a maintainer to redo completed work) and
look-alikes that are not duplicates (a title-match under a *different* parent with strictly
broader acceptance criteria). Also check whether a directive you'd quote as authority was ever
*ratified* — an author's own framing on the day of filing is not a project decision. [GitHub sub-issues are the tracking surface; parent checkboxes are a stale mirror](../learnings/1785960849623-github-sub-issues-are-the-tracking-surface-parent-.md)

**Enumerate every owner before calling work unowned.** "The assignee left, scrub this" was
reported as "no live decision-maker" from a single assignee name — enumerating sub-issues showed
2 of 4 items belonged to an engineer who had merged 4 PRs that week. The abandonment claim
*inflates the cost of the ask*: "needs escalation, no owner" and "a live owner could take this"
are different recommendations. `gh pr list -R O/R --author LOGIN --state merged` checks whether a
person is actually gone. Companion trap: check *which* instrument someone used before warning
about its limits (a 534-file count measured with `git show --shortstat` was not subject to the
commits-API 300-cap the reviewer cautioned about). [Enumerate every owner before calling work unowned — and check which instrument was used](../learnings/1785961133670-enumerate-every-owner-before-calling-work-unowned-.md)

**A set GitHub assignee may be a nomination, not ownership.** "No reassignment needed — @X owns
it" from a populated `assignees` field was wrong: both `assigned` events had `actor: <the
departing engineer>` who unassigned himself 3 seconds later, and his comment "should I move this
to you?" had sat unanswered ~5 months. The field recorded the departing owner's *intent*, not the
receiver's assent — *weaker* evidence than a normal assignment. Self-assignment is acceptance;
third-party assignment is nomination — read `timeline` (authoritative; `/events` disagrees on
`assigned.actor`). Auto-generated `mentioned`/`subscribed` are not acknowledgement. And a
reassignment precedent needs its *recorded motive*, not just its outcome — a sibling reassignment
performed *by the departing owner himself* ("I believe you've started looking at it") was
context-driven, transferring nothing to a third issue. Read the `timeline` for who acted and when
relative to departure. [A set GitHub assignee may be a nomination, not ownership — check the assigned actor](../learnings/1785967759518-a-set-github-assignee-may-be-a-nomination-not-owne.md) [A reassignment precedent needs its recorded motive, not just its outcome](../learnings/1785956697836-a-reassignment-precedent-needs-its-recorded-motive.md)

## Line-number disputes: compare refs before conceding

When two greps of "the same file" disagree on a function's line number, both may be correct — one
read the submodule's default branch (1084 lines → `:157`), the other the pin the superproject
actually builds (1030 lines → `:152`). The near-miss is the lesson: conceding fast looks
cooperative and *destroys the finding* (swaps one right answer for another and buries the real
variable). Compare refs *before* either concedes; cite the pin, not the submodule's trunk
(`git ls-tree <super-sha> external/<submodule>`; `wc -l` as a cheap ref fingerprint). And pick a
discriminator identifier whose *absence elsewhere* is what your argument needs — a Vulkan-only
claim cited by the enclosing function name `getPipelineCacheKey` is refuted by a same-named D3D12
twin; cite the backend-specific API `vkGetPipelineKeyKHR` (0 hits in `src/cuda/`). The strongest
distinctness argument is "the code this crash dies in cannot execute on that path," not "we
observed the other backend too." [When two careful readers disagree on a line number, compare refs before either concedes](../learnings/1785962772085-when-two-careful-readers-disagree-on-a-line-number.md)
