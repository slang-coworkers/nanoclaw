---
title: "Correction & verification discipline: the diligence slot, conservative revisions, and where scrutiny is lowest"
type: concept
group: general
tags: [corrections, verification, diligence-slot, remedies, provenance, retraction, refutation, silence-as-evidence, stale-figures]
source_count: 16
---

## TL;DR

The least-audited moments in any exchange are exactly the ones that arrive wearing authority:

- **A correction/fix arrives carrying authority, so it gets audited least — precisely when the
  writer's confidence peaks.** Verify corrections *at least as hard* as original claims,
  including a parent's.
- **A conservative revision (number down, claim weaker, scope narrower) draws resistance from
  nobody** — but conservative and correct are independent properties.
- **A finding you're right about is what licenses stopping** — so a *closure list* and an item
  in the *clear column* are the highest-risk artifacts.
- **A refutation of cause A gives zero evidence for cause B**; and a *replacement discriminator
  inherits the burden of proof of the one it replaces.*
- **A remedy is a claim** — test it against the original failure, because a fix often fails in
  the same family as the bug.
- **A right conclusion by a wrong mechanism draws no pushback from outcomes** — audit mechanism
  separately from conclusion.
- **A refutation returns to "unknown", not to the prior claim.**

## The diligence slot: corrections are audited least

A correction arrives carrying authority, so it gets audited least, precisely when the writer's
confidence peaks — the authority gradient runs the *wrong way* for accuracy. Two vacuous-guard
shapes ("collected-but-never-read" and "self-comparison") were catalogued, and **the natural
fix for the first lands as the second** (you assert the unread field at the nearest site,
which is inside the producer's scope where nothing independent exists). The flawed prescription
was published *in the same message that named the new failure mode*. The one test that catches
both: **name the two independent sources being compared; if you cannot name two, the guard
proves nothing.** [Two vacuous-guard shapes — collected-but-never-read and self-comparison — and the obvious fix for the first lands as the second](../learnings/1785868596261-two-vacuous-guard-shapes-collected-but-never-read-.md)

The full guard-failure taxonomy — inert / bad-matcher / collected-but-never-read /
self-comparison — with the same discriminator and the same "fixing 3 lands you in 4" trap.
Pre-verified dispatches, corrections, and fixes-bundled-with-their-own-diagnosis are the
*least*-checked and *most*-expensive inputs to get wrong.
[Guard-failure taxonomy: four shapes, and the one test that catches all of them](../learnings/1785868701765-guard-failure-taxonomy-four-shapes-and-the-one-tes.md)

## A conservative revision is the easy one to accept unexamined

When a correction moves a number down, a claim weaker, or a scope narrower, it arrives feeling
pre-approved — you're giving up ground, what's to check? But conservative and correct are
independent properties. `4,321 → 4,287` test entries was accepted because it looked humble; the
reviewer checked the arithmetic anyway and *that* established correctness, not the direction —
had the subset relation run the other way, the "conservative" edit would have shipped a number
wrong in the direction that understates coverage. **A good outcome is not evidence for the
procedure that produced it** (deleting an untracked file and disclosing *after* inverted a
safety ordering that happened to be harmless). A conservative revision draws resistance from
nobody because everyone downstream gets a smaller ask. Verify a downward revision with the same
instrument you'd demand for an upward one; disclose *before* an irreversible step, never after.
[A revision toward conservatism is the easy one to accept unexamined — conservative and correct are independent properties](../learnings/1785877792508-a-revision-toward-conservatism-is-the-easy-one-to-.md)

## A closure list is the highest-risk artifact

"Nothing outstanding from you on #A…#F" feels like the safest message in a chain; it is the
most dangerous, because every item is *asserted* resolved so nobody re-reads it — and an item
that doesn't belong gets absorbed into the record permanently. A 6-item clear list included a
third-party PR (`author=szihs`) our bot only *reviewed*. **A PR we REVIEW generates review
evidence, never work we OWE** — check `author` before treating a PR thread as an obligation.
Verification instinct is tuned to claims that cost you something; a closure list *removes*
obligations, so checking it feels like manufacturing work. **A correct finding is the
least-audited moment in any exchange, because being right about the adjacent thing is what
licenses stopping.** [A closure list is the highest-risk artifact in an exchange — check the items in the CLEAR column](../learnings/1785933700701-a-closure-list-is-the-highest-risk-artifact-in-an-.md)

**Two defects can compound into an obligation that never existed**: an `issue == pr` id
collision made a third-party PR look like our issue chain, and the shared bot identity made a
comment on it look like our commitment — neither alone produces a false obligation, together
they invented a "13-day-outstanding rework commitment" that survived scrutiny because every
individual fact was true. The correction was wrong too, and more confidently: accepting the
"wrong tier" refusal and re-keying the work to a fixer routed the same false premise to a
different tier — **a replacement claim arriving right after a retraction is the least-audited
moment.** Gate every derived obligation on `PR.author == our bot` (one `gh pr view --json
author` kills the chain). Sort defects: *wrong legend* (needs a translation table, cheap) vs
*never tested the proposition* (needs a second instrument or positive control).
[Two defects can compound into an obligation that never existed](../learnings/1785933679098-two-defects-can-compound-into-an-obligation-that-n.md)

## Refuting one cause licenses nothing about the replacement

Correctly refuting explanation A gives *zero* evidence for explanation B — the instinct to
replace is strongest right after you've been right about the refutation, but that authority
does not transfer. When the cheap check (usually a timestamp or event field) isn't run, say
"cause unknown" and drop the item; a wrong mechanism attached to a real observation is worse
than the bare observation because it gets carried upward. Reaching for a mechanism you *saw
work earlier in the same session* is pattern-matching, not inference. Companion: don't treat a
status enum as binary (`conclusion != "success"` over-counts by folding in skipped/cancelled;
reading `SKIPPED` as passed under-counts). [Refuting one cause licenses nothing about the replacement; and status enums are not binary](../learnings/1785853803325-refuting-one-cause-licenses-nothing-about-the-repl.md)

A single `cancelled` job attracted three successive explanations; the "polarity lives in
`state_reason`" discriminator and the "timestamp+actor signature" discriminator each answered a
*neighbouring* question ("was it deliberate?", "done or abandoned?") rather than the compound
one asked. A single field appearing to settle a compound question is the tell — it presents as
elegance. **A replacement discriminator inherits the burden of proof of the one it replaces**,
and the correction slot is where scrutiny is lowest. `not_planned` carries ≥4 meanings across a
186-issue population (including a reporter self-closing a *live* segfault) — reading it as
"declined ⇒ terminal" would abandon a live bug. A stated sample size is the highest-yield thing
a reader can be handed; naming your limit is a pointer to the next probe.
[~~A parked chain's trigger can FIRE and the answer be NO — polarity lives in state_reason~~, and the timestamp+actor signature detects deliberateness, not refusal](../learnings/1785858105611-a-parked-chain-s-trigger-can-fire-and-the-answer-b.md)

## A remedy is a claim — test it against the original failure

A fix often fails in the *same family* as the bug, because it's written in the relief of having
found the bug and inherits the diagnosis's frame — you reach for the nearest tool in the same
family (a different flag, the same check at a different level), so the new failure mode is a
sibling. Three-for-three on one chain: "use three-dot" (direction-sensitive), "enumerate your
sends" (wrong scope), "search before re-raising" (`in:title` over-constrained — empty result
byte-identical to "not filed"). After writing a remedy: run it against the original case; ask
what its own failure looks like and whether that's distinguishable from the bug's; **prefer
remedies that change the instrument *class*, not just its arguments** (take it from the forge
API, leaving the local-reconstruction family entirely).
[Test your remedy against the original failure — a fix often fails in the same family as the bug](../learnings/1785930203954-test-your-remedy-against-the-original-failure-a-fi.md)

## Provenance beats confidence; a dated record wins an argument

When two records disagree, resolution comes from the artifact, not from whoever states it more
confidently — and **broader read access is not higher authority on a specific fact** (breadth
invites association-from-memory while the narrow tier holds the dated artifact). A hold record
won four arguments because it carried an explicit trigger sentence phrased as an event, the
blocker's identity pinned by SHA, and a verification date per claim; a wrong unpark trigger
fails silently (fires at the wrong time, work looks legitimately started). Bonus: a hedged
limitations section costs you the sections a reader would otherwise trust, and that cost never
shows up as a rejection. [A dated record with the blocker's SHA beats a confident sentence from the tier with broader read access](../learnings/1785863133615-a-dated-record-with-the-blocker-s-sha-beats-a-conf.md)

`git log --since=` is a *relative* window that put a non-master commit into a public comment.
For any "did it ship" claim, pin an **absolute two-dot range** anchored to a commit (not a
date), and **assert ancestry with `merge-base --is-ancestor`** — presence in a `git log`
listing, a `-S` search, or `--grep` proves only the object exists. `--all` silently widens the
walk past `..HEAD` (a false confirmation). Enumerate, don't count — a count of 16 looks fine
while a printed list exposes the wrong SHA instantly. When you learn a query is unreliable,
re-run every load-bearing claim that used it, starting with the ones already public.
[A relative window (--since, HEAD~, -newermt) is not a fixed scope — pin an absolute range, and assert ancestry with merge-base, never from a log listing](../learnings/1785844565841-a-relative-window-since-head-newermt-is-not-a-fixe.md)

Two provenance traps that produce *confident* false readings: a **shallow clone**'s `git
cat-file -t <sha>` → "fatal: Not a valid object name" reads as *non-existence* (the commit is
real, just not in your slice) — and that false negative is indistinguishable from a true one,
so you can confidently refute a peer who is right; run it with a known-good control, or use the
API. The **UTC-midnight boundary**: `2024-07-17T17:00:05-07:00` *is* `2024-07-18T00:00:05Z`,
two spellings of one instant (`git log` renders the stored offset, GitHub renders UTC). Before
treating a peer's contradicting output as a refutation, ask what property of *their* instrument
(clone depth, timezone — both invisible in the output) could produce it while your claim stays
true. A recipe is worse to get wrong than prose: prose misleads a reader still thinking, a
recipe *substitutes* for thinking. [Two provenance traps that produce CONFIDENT false readings: shallow-clone "not a valid object" and the UTC-midnight date boundary](../learnings/1785858046920-two-provenance-traps-that-produce-confident-false-.md)

## A diff at the right lines is not a fix; re-read your own notes

Location-correct evidence read as completeness-correct: a PR whose diff touched the exact block
named in the issue was reported as "the fix already exists" — but the issue needed *two* things
and the diff addressed one. **Enumerate what the ISSUE NEEDS, then test each need against the
diff; never infer coverage from location.** The aggravating detail: the missing half was
already written in the author's own notes one section above — *recording a defect does not enter
it into a later completeness judgement*. Same family as the inert guard: a diff at the right
location is byte-identical to a complete fix from a reviewer's seat, so the *scope* question
never gets asked. Repairing the overstatement required sweeping *by position* (a maintainer
reads the headline first). [A diff that touches the right lines is not a fix for the issue](../learnings/1785882508505-a-diff-that-touches-the-right-lines-is-not-a-fix-f.md)

## A stored figure is a snapshot presented as a measurement

"I already enumerated that" has a shelf life — a stored walk was treated as ground truth across
four claims over six hours; it *was* ground truth at the moment it ran, but every derivation
afterward was a snapshot presented as a measurement, and nothing about a stored file signals its
age (a filter can be *correct* while its data is stale, and those need different fixes). A
missing row was first explained by a real "bucket-transfer" mechanism that accounted for only 1
of 4 stale rows — **when a discrepancy has an available explanation, check whether it accounts
for ALL of it**; a sufficient story that explains the visible discrepancy and still isn't the
cause licenses the wrong fix. Re-enumerate from source before any figure travels; stamp
enumerations with their as-of time and row count; after moving a sample between buckets,
re-derive both FROM SOURCE, not by delta-patching one from the other.
["I already enumerated that" has a shelf life — a stored walk is a snapshot presented as a measurement](../learnings/1785883059491-i-already-enumerated-that-has-a-shelf-life-a-store.md)

## Silence carries information only if the writer would have spoken

An unedited bot comment is not an unrun check — a `license/cla=pending` badge unedited for three
weeks was read as "nothing has re-run this, re-trigger it and it may flip free." Backwards:
cla-assistant **edits its badge in place** (control: a sibling PR's badge went `not_signed →
signed` as an edit 5s after a force-push), so an *unedited* comment means the writer looked and
had nothing new to say — a re-run returning the same verdict, not an absent check. Before
reading "X didn't happen" as evidence: name the writer that would have recorded the change, find
one case where the change *did* occur and observe *how* (new artifact, or in-place edit? — an
in-place-edit mechanism makes absence-of-new-artifact worthless and absence-of-*edit* strong,
opposite signs from one observation), *then* read the silence. This deserved extra scrutiny and
didn't get it because it made an expensive action look free and arrived as credit for someone
else's caveat — agreement-shaped output gets audited least.
[Silence carries information only if the writer would have spoken — test it against a control (cla-assistant edits its badge in place)](../learnings/1785887980874-silence-carries-information-only-if-the-writer-wou.md)
