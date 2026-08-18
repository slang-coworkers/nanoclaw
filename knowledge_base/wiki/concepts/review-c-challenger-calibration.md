---
title: "Challenger calibration & approver self-correction — addressee, exonerations, two-artifacts, availability"
type: concept
group: review
tags: [approver, challenger-miss, self-correction, two-artifacts-trap, addressee, exoneration, durability]
source_count: 8
---

## TL;DR

The approver's *challenger* / self-correction discipline: how to audit your own claims,
retractions, and the corrections others hand you — and the recurring traps that survive
careful reasoning.

- **Audit exonerations like accusations.** A correction that *lowers* your fault gets audited
  even less than a retreat, and the incentive gradient runs the wrong way — verify it against
  the primary artifact.
- **An inbox is not an addressee.** Before answering any question, resolve the envelope:
  *whose question is this?* A well-supported answer to a question you weren't asked reads as
  helpfulness — strong content masks the routing error. Supply input; leave the decision
  where it was addressed.
- **The two-artifacts trap wears many disguises:** two policy files at one path fragment, two
  decided heads on one PR, a `file:line` valid in two parallel trees, a control read vs an
  authoritative read of the same *kind* of file, two actors sharing the word "away." When an
  inference chains across a shared attribute, substitute the concrete identities.
- **A `file:line` citation needs its PATH verified, not just its lines** — a right number in
  the wrong file reads as *precision* and fails silently in both directions.
- **Verify durability before editing.** Writability is not durability; the skill "sync" may
  be a one-shot image-build snapshot, not a recurring cycle — edits survive only until the
  next image rebuild.
- **A conclusion propped by a bad reason plus a good one is exposed** — the bad reason is what
  gets quoted. State the load-bearing reason alone.
- **Measure the party who performs the action** (maintainer availability from their event
  stream), never your own side's presence.
- **Every catch in this chain was mechanical, not argumentative** — open the artifact and
  print the value, don't reason about whether a framing is coherent.

---

## Audit exonerations like accusations

When a peer re-diagnosed a "21→4 over-call" as "not wrong, just mislabelled — 21 is correct
for the re-derivation pre-flight," the framing was generous, elegant, and **wrong**. Reading
the *exact sentences* originally attached to the number showed the claim was "every one of
those decisions was made under a policy that is not in force" plus a blocker on their
calibration figures — false for all 17 era-correct pins. The count 21 does answer a real
question, but **that question arose three rounds later**; a later-arising question cannot
retroactively validate an earlier answer.

The asymmetry that makes this dangerous: criticisms *cost* something, so they get audited;
an *absolution* is nearly waved through, because nothing internal flags it — this is the
"a retraction is not self-verifying" rule with the sign flipped. The mechanical check: (1)
retrieve the exact sentences attached to the number, not your memory of them; (2) is the
proposition those sentences assert true of the items the number covers? (3) was the question
the number answers the one on the table? **A number is only "mislabelled" if the claim it
carried was true of its referents under some reading available at the time**
[[approver/critique-mustfix] Declining an exoneration: my 21 was NOT a mislabelled-but-valid count — the claim attached to it ("made under a policy not in force", contaminated calibration) is false for all 17, and a later question that 21 happens to answer cannot retroactively make the original claim right](../learnings/1785945708506-approver-critique-mustfix-declining-an-exoneration.md).

## An inbox is not an addressee

A peer coworker asked the **operator** a go/no-go ("investigate and file, or leave as a known
quirk? — I'd rather you choose"). The message landed in the approver's inbox; having the
decisive measurement, it answered "Yes — investigate and file it." The correction: *"the
go/no-go wasn't yours to answer. Your input changes what I recommend, not who decides."*

This exposed a rule held in one direction only. The outbound form — *"a passive rule will not
fire; write rules with an ADDRESSEE, name who must act"* — had never been turned around. The
inbound mirror is the same variable: **READ WHO WAS ASKED.** A message *mentioning* you is not
a message *asking* you.

| direction | illusion |
|---|---|
| outbound | a well-formed ask *feels finished* — the form supplies felt authority |
| inbound | a well-formed answer to a question you weren't asked *reads as helpfulness* |

**When your answer is unusually well-supported, that is precisely when to check you are the
one being asked** — strong content masks a routing error, because nothing about the content is
wrong; the defect is entirely in the envelope. The cheaper correct move: supply the
measurement, name the recommendation, leave the decision where addressed ("here's the 83-byte
margin; it argues for filing; your call / the operator's"). **INPUT ≠ DECISION** — conflating
them silently removes a human from a loop they were placed in
[[approver/critique-mustfix] READ WHO WAS ASKED — the addressee rule has an inbound mirror; I answered a go/no-go put to the operator, holding the outbound half of that exact rule](../learnings/1785944075516-approver-critique-mustfix-read-who-was-asked-the-a.md).

## Auditing your own store: two ways a post-hoc audit lies

Having claimed a new failure class (a rule with an unvisited half), the approver owed the same
store audit the peer had done. It produced two distinct lies:

1. **Probe strings coined from the rule's NAME, not the text on disk.** Four candidate pairs
   read zero — all four false, because a label invented during the audit ("attribute a delta")
   has no reason to appear in prose written weeks earlier. **A matcher you invent tests your
   phrasing; only a matcher drawn from the target's own vocabulary tests the target.** Derive
   probes from a distinctive substring already on disk; treat any audit zero as provisional
   until a synonym retry.
2. **The audit cannot detect the class on anything you already fixed.** The one genuinely
   one-directional pair was excluded from the clean result — because its mirror now existed as
   a result of the peer's correction minutes earlier. **A post-hoc audit measures what you
   have already repaired.** Three compounding biases: you choose the sample (right after
   thinking about the defect); cross-store counts aren't comparable ("0 of 6 vs 3 of 4" is not
   a ranking); the motivating instance is excluded by construction. **Never report a
   self-audit's clean result as evidence of health** — report it as "these specific pairs,
   chosen by me, after the fix" and state what it structurally cannot see
   [[approver/challenger-miss] A post-hoc audit measures what you already repaired — and my audit's probe strings came from the rule's NAME, not the text on disk (4 of 6 zeros false)](../learnings/1785944319263-approver-challenger-miss-a-post-hoc-audit-measures.md).

## The two-artifacts trap and its disguises

The recurring structural error across the chain: two distinct objects sharing one identifier,
so the wrong one is read while feeling like the right one.

**As a citation.** A reviewer finding cited `src/slangpy_ext/utils/tensor.cpp:458-468`. That
path 404s, but the basename `tensor.cpp` matches **five** files across the parallel `src/sgl/`
(native core) and `src/slangpy_ext/` (nanobind) trees, and *two* carry the cited range with
**opposite verdicts**. Reading `sgl/func/tensor.cpp` first would have refuted a finding that
is in fact correct. **A `file:line` reads like a unique address, but across mirrored trees a
bare filename plus a range is not one** — a right number in the wrong file reads as precision
and fails silently in both directions. Resolve the *path* first (treat a 404 as a real
answer), count basename matches, and identify the enclosing **function** by name
(`Tensor::with_grads` ≠ `tensor_zeros_like`). Quote path + function + lines, never `file:line`
alone [[approver/challenger-miss] A file:line citation needs its PATH verified, not just its lines — parallel sgl/ and slangpy_ext/ trees mean the same range exists in two real files with OPPOSITE verdicts, and a right number in the wrong file reads as precision](../learnings/1785945259081-approver-challenger-miss-a-file-line-citation-need.md).

**As a control-vs-authoritative read.** Reporting a re-derivation, the approver named three
policy versions and wrote the *control's* name (`v0-shadow-relaxed`, read as a comparison
point) into the "loaded" slot. A control read and an authoritative read look identical at the
command level — both are `json.load` of a policy file; only the labels keep them apart, and
labels drift. **Label control reads as controls in the same breath as performing them**; if a
report names ≥2 versions, state each one's role (recorded / in-force / loaded / control). The
live hazard this surfaced: the poisoned pin was still on disk, so a naive re-run would
reproduce the original defect — requiring provenance in the record is not bureaucracy, it is a
*detector*: naming the policy is what exposed the mismatch
[[approver/critique-mustfix] Naming the policy exposed that I'd written my CONTROL's version into the "loaded" slot — reporting error not reproduced defect, but the workspaces still hold the poisoned pin, so any naive re-run of eval-clauses.py WOULD reproduce it](../learnings/1785945343617-approver-critique-mustfix-naming-the-policy-expose.md).

**As two events masquerading as a control.** Two PRs armed 2.5 minutes apart by one actor
looked like a matched pair; reading #1078's timeline showed it was brought up to date by hand
**10 seconds before arming**, so it was never `BEHIND` and never tested whether `BEHIND`
self-clears. Worse, #925 is behind by *exactly* #1078's merge commit — the first PR's merge
stalled the second. **Near-simultaneous events invite treating one as a control for the
other**; a precedent must differ from the case in exactly the variable under test. Reason from
*what clears the specific block* (a human Update click, which fires auto-merge immediately —
zero window for a warning comment), not from how long a sibling took
[[approver/challenger-miss] Two PRs armed 2.5 min apart is not a precedent pair — #1078 was manually brought up to date 10s before arming, so it never tested whether BEHIND self-clears; and #925 is behind by exactly #1078's merge commit](../learnings/1785946244053-approver-challenger-miss-two-prs-armed-2-5-min-apa.md).

**As two actors sharing one word.** An `ask_user_question` to the operator timed out, and the
approver reasoned "if the operator is away, the *Update branch* click is also unlikely." But
the operator and the person who clears the PR (`ccummingsNV`) are **different people** —
operator silence is evidence about *our* side and says nothing about maintainer availability
(which *is* measurable, from `gh api users/<login>/events/public`). Two independent variables
shared the English word "away." **Name the parties**: "dashboard-user away ⇒ ccummingsNV won't
click" is an obvious non-sequitur. And the load-bearing point: the decision it propped up
(don't post) was already correct on its own grounds, so a bad timing-reason added to it made
the whole thing refutable by attacking the timing — **a conclusion supported by a bad reason
and a good reason is still exposed, because the bad reason is the one that gets quoted. State
the load-bearing reason alone** [[approver/challenger-miss] I inferred maintainer availability from OPERATOR absence — two different parties, and only the one that doesn't matter is measurable from here; also: a conclusion propped up by a bad reason plus a good one is exposed, because the bad reason is what gets quoted](../learnings/1785950168336-approver-challenger-miss-i-inferred-maintainer-ava.md).

## Verify durability before editing

Planning code fixes for the approver skill, the approver checked durability before editing.
The assumption "a local edit will be re-synced away" presumed a sync cycle that hadn't run in
9 days. A natural experiment on disk settled it: every skill's `SKILL.md` shares one mtime to
the nanosecond (`2026-07-27 10:51:13`) — the signature of a **single extraction event**, not
per-item sync — and an upstream skill added 07-31 is absent locally 5 days later. **The "sync"
is a one-shot snapshot at container-image build time.** So the accurate rule is not
"ephemeral" but **"survives until the next image rebuild"** — durable for a work session, lost
silently on rebuild (`install_packages`, etc.). Record the fix rebuild-proof under
`/workspace/agent/`. Three consecutive corrections on one question ("ephemeral" → "maybe
durable" → "durable-until-rebuild"), each from opening one more artifact, none from reasoning
— the word "external" carried an unexamined assumption about *frequency*. And when several
artifacts share a timestamp to the second, they came from one event: that fact alone
characterizes the mechanism. (Writability is not durability — a demand for a control on a
test can invalidate the test's *premise*, not just its interpretation.)
[[approver/clause-gap] The sync is a one-shot image-build snapshot, not a recurring cycle — natural experiment: upstream added skills/human-names on 07-31, it is ABSENT locally 5 days later, and all 30 local skills share one mtime to the second (2026-07-27 10:51:13)](../learnings/1785946731545-approver-clause-gap-the-sync-is-a-one-shot-image-b.md).

## The durable half: every catch was mechanical

The method that worked across this entire chain was not more careful reasoning — it was
opening the artifact and printing the value. Endorsement by a peer is not verification (it is
the same claim repeated, not re-measured). *Requesting a specific value* ("which one, by name
and path?") repeatedly produced findings neither party would have reasoned to. **Proximity to
a standing rule does nothing** — the rules being violated were often already filed; the fix is
a mechanical check at the moment of acting, not a resolution to be careful.

> A correct conclusion reached through a wrong mechanism will be defended with the wrong
> evidence when it is challenged. Quantify with the same discipline used to detect; a
> retraction, an exoneration, and a re-derivation are each their own unverified claim until an
> artifact confirms them.

## See also

The clause-machinery, policy-staging, and ledger-recording side of the approver procedure is on
[[wiki/concepts/review-c-approver-decision-procedure.md]]. The instrument-failure taxonomy
(false zeros, controls, census/partition) referenced throughout this chain is on
[[wiki/concepts/review-c-instrument-controls.md]].
