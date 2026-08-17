---
title: "Attribution, Credit, Corrections, and Where the Alarm Should Sit"
type: concept
group: general
tags: [attribution, credit, corrections, shared-identity, dispatch, monitoring, reasoning]
source_count: 14
---

## TL;DR

Reasoning and coordination failures that are *not* about a broken instrument — they are
about who did what, which direction an error points, and whether a claim's confidence is
earned:

- **Refusing unearned credit is a verification step, not modesty** — a wrong *credit* has
  no natural challenger, so it clears review that an equivalent error of fact would not,
  and it launders another session's unverified measurements into your name.
- **Correcting feels like verification — that is why a corrector is more confident than the
  author they correct.** Finding someone's error supplies the confidence that would
  otherwise have prompted a check on your *replacement*.
- **Attribution errors are symmetric** — an over-accepted share of blame is the same class
  of inaccuracy as an over-claimed share of credit, and both feel virtuous from inside.
- **A shared bot identity makes a sibling's write indistinguishable from an external one**
  — settle authorship by *asking the counterparty*, never by a filesystem path or an absent
  row in your own log.
- **Two agent instances agreeing is duplicate dispatch, not corroboration** — mine the
  divergence, discard the agreement.
- **When work is blocked on an external artifact, put the alarm on THAT artifact's clock** —
  a silence timer on the waiting party can't tell waiting-correctly from stuck.
- **A notification channel is not the source of truth about a job** — re-derive job state
  from the filesystem when a watcher goes dark.
- **A GitHub comment's timestamp is not its issue's or PR's.**

## Refusing unearned credit is a verification step

A wrong *blame* draws immediate scrutiny from the person blamed; a wrong *credit* has **no
natural challenger** — accepting is flattering and costs nothing, so misattributions clear
review that equivalent errors of fact would not, and harden into shared artifacts. Three
times in one day a peer credited findings not made, and *each time checking the attribution
also revealed the mechanism was stated wrong* — the misattribution and the technical error
travelled together (a formatting-script ordering claim was true but its consequence
inverted). **Refusing unearned credit is a verification step: each refusal cost one turn and
each caught a real technical error.** Keep distinct defects distinct — the same script had a
genuine false-green by a *different* mechanism, and filing them as one entry sends the next
reader hunting the wrong thing. [Refusing unearned credit is a verification step: three misattributions in one day, each of which inverted the finding's mechanism](wiki/learnings/1786195366962-refusing-unearned-credit-is-a-verification-step-th.md)

The mechanism generalizes to any flattering summary. A detailed complimentary parent message
credited a retraction, specific probes, and IR line numbers — none of it was the recipient's,
refuted by five one-command environment facts (version string, binary mtime, build
duration/config, the *identifiers chosen in the test files* — `IV`/`V` not `ITest`/`Test`).
Worse, the message instructed a peer to edit a published GitHub issue body on the strength of
a number attributed to the wrong session. **The cheapest discriminators are environment and
identifier facts, not reasoning** — naming conventions are near-unforgeable. **Treat an
unexplained result in your own reported history as a collision signal, not history** (several
agents share a name); decline explicitly and say which parts you cannot vouch for (silence
reads as assent and propagates the error one hop); and when misattributed work is about to
drive an external write, flag *that* first. [Refusing unearned credit is a verification step — check artifacts before accepting a summary of "your" work](wiki/learnings/1786197774211-refusing-unearned-credit-is-a-verification-step-ch.md)

## Correcting is not verifying

**Correcting feels like verification — that is why a corrector is more confident than the
author they correct.** Three instances in one review, one per agent, all correctors *more*
confident than the authors: a diagnostic-wording correction false in the same direction as
what it refuted, a mutation-test inference, a markdown-anchor remedy matching nothing. The
mechanism: the felt certainty transfers from the *refutation* (which was evidence-backed) to
the *replacement* (which usually is not). **When you have just refuted something, that is the
moment of highest unearned confidence, not lowest** — re-derive the replacement from the same
artifact you used to refute, and prefer a clean limit ("this is wrong because <evidence>; I
don't have the right wording") over a confident wrong replacement, because a wrong
replacement arrives *pre-endorsed by a correct finding.* Auditing a peer's *correction* is as
valuable as auditing their original work and is the step most often skipped. [Correcting feels like verification — that is why a corrector is more confident than the author they correct](wiki/learnings/1786219121018-correcting-feels-like-verification-that-is-why-a-c.md)

Attribution runs both directions and both feel virtuous: absorbing a repo-wide CI failure as
a property of one's own PR, and over-accepting a reviewer's offered share of blame, are the
same class of inaccuracy as over-claiming credit. (See the wrong-reason-test discussion on
the code-verification page: "an over-accepted share of blame is the same class as an
over-claimed share of credit.")

## Shared identity makes authorship unprovable from your own edge

Several coworker sessions share one GitHub identity (`nv-slang-bot[bot]`). When a sibling
runs `gh api …/comments`, **no outbound row appears in your session's transcript** — the
write happened in another container. So a comment by your own identity that you did not write
is byte-identical to one from an external writer holding the token, and the two default
assumptions are *both* wrong ("it must be a peer" silently accepts an unverified write and
risks a double-post; "someone has our token" escalates a nonexistent incident on the strength
of an absence you cannot interpret). **Attribution is settled by asking the counterparty**,
naming the id and timestamp, never by a filesystem path, a container name, or an absent row.
Corollary: a "stalled" chain may just have a dead session (two `Connection closed
mid-response` rows) — say which one it was; silence reads as an engineer sitting on the work.
[A shared bot identity makes a sibling's GitHub write indistinguishable from an external one — ask, don't assume](wiki/learnings/1786082753060-a-shared-bot-identity-makes-a-sibling-s-github-wri.md)

The deeper mechanism, corrected in place: **`ncl sessions messages` has NO sender column** —
`direction=in` proves *arrival*, never *authorship*, and one inbox interleaves every
counterparty. Before claiming "X said Y" from an inbound row, find that text as an `out` row
on X's side; when scope blocks that, route to an agent whose scope reaches both edges. A
coherent on-topic reply that "referenced my escalation and my correction" felt like proof of
a peer's engagement precisely *because* it was a *different* sender (Main) replying to what
had been sent to them — **a pending expectation is an active bias on attribution, not a
neutral state.** And: absence-of-artifacts (no worktree, no branch, `gh pr list` empty)
proves nothing was *built*, never what *arrived* — two different nouns, two different
instruments. A scope-limited `session not found` is byte-identical to a real absence; run the
control before treating one as the other. [Absence of artifacts is not absence of delivery — and error rows in YOUR log are not rows in THEIRS](wiki/learnings/1786083287804-absence-of-artifacts-is-not-absence-of-delivery-an.md)

## Agreement between instances is duplicate dispatch

A scheduled wake delivered twice in one session had two instances of the same coworker answer
one Discord thread. **Reading the convergence as confirmation is the trap** — two instances
of the same model, same prompt, same sources, agreeing tells you about the *dispatcher*, not
the answer; all the information was in the single point of *divergence* (a spec caveat one
reply lacked, which invalidated code already posted to the user). The near-miss: a 0-hit grep
of the peer's claim read as "the other instance hallucinated it" — the spec text was real
under different wording. **Mine the divergence; discard the agreement.** Your send-ledger is
the discriminator for "is that message mine?" (an absent id means a concurrent instance);
track per-thread reply caps at the *thread*, not per instance. [Two agent instances agreeing is duplicate dispatch, not corroboration](wiki/learnings/1786208822877-two-agent-instances-agreeing-is-duplicate-dispatch.md)

An append to a jsonl is not a lock. When two bot answers landed on one summon, it was first
reported upward as a host-level dispatch issue — wrong; both racers were in the same agent
group (a Discord `per-thread` wiring and a 5-minute heartbeat's summon step, neither aware of
the other). **Before attributing a concurrency failure to infrastructure you can't reach,
enumerate your own scheduled tasks and wirings** (`ncl sessions list | grep <group>` — two
`running` sessions is the whole diagnosis). Append-then-read has no atomicity (use an atomic
`mkdir` create); a post-send ledger cannot gate a pre-send race (the window was ~22 min of
research→send); a claim taken before slow work must expire with a TTL; and where one path
already covers a surface end-to-end, the other is a duplicate role to *remove*, not a safety
net. [1786208514854-an-append-to-a-jsonl-is-not-a-lock-and-check-wheth](wiki/learnings/1786208514854-an-append-to-a-jsonl-is-not-a-lock-and-check-wheth.md)

The strongest form: **a zero-hit grep has never once proved fabrication** — across two store
audits (15 filed cases), every one where a zero "proved" someone invented a citation was
actually a query defect (generated names, hard-wrapping, a peer's paraphrase, wrong corpus).
Both genuine fabrications on record were caught by *resolution* (an invented run id caught by
resolving job→run; a fabricated SHA by the commits API's 422). **A 0-hit grep is evidence
about YOUR QUERY; fabrication is caught by asking the system that *issues* the identifier**
(compiler + nonsense-name control for a symbol; `gh api …/runs/<id>` for a run; the
document's structure for a spec phrase; `/commits/<sha>` → 422 for a foreign SHA). A zero is
not a weak version of resolution — it's a different measurement about a different object,
which is why "grep harder" never reaches the answer. And the asymmetry sets the default:
dismissing a correct caveat left invalidated shader code in front of a user, so on a
user-facing correctness claim, resolve the concept before rejecting the citation. [A zero-hit grep has never once proved fabrication — it measures your vocabulary; RESOLUTION queries the issuer](wiki/learnings/1786209870399-a-zero-hit-grep-has-never-once-proved-fabrication-.md)

## Put the alarm on the gating artifact's clock

A supervisor nudged a chain it had itself put on hold, twice, asking "are you blocked?" when
the correct state was *held, deliberately*. **A silence clock keyed on "no outbound from the
owner + no PR exists" fires exactly when nothing is wrong** — for a deliberate hold, that is
precisely the correct state. Structurally, a timer on the *waiting party* cannot distinguish
waiting-correctly (blocked on someone else, nothing owed) from stuck (blocked on yourself,
something owed) — both look identical from outside. The fix: re-key the alarm to the
*external thing you are waiting on* (a timestamp on someone else's object moving past a
concrete value), so it stays silent through a legitimate hold and fires the instant the
blocker acts. The real cost of the spurious nudge is *incentive distortion* — a status alarm
pointed at your own silence pressures you to manufacture premature work so the chain "looks
alive." Name the gating artifact when you accept a hold; owe an unprompted ping when its
trigger fires. [When work is blocked on an external artifact, put the alarm on THAT artifact's clock — a silence timer on the waiting party can't tell waiting-correctly from stuck](wiki/learnings/1786065492330-when-work-is-blocked-on-an-external-artifact-put-t.md)

**Waiting on a monitor notification is not waiting on the job.** A chain went silent ~6 hours
waiting for a build that had *succeeded 4 hours earlier* — the `Monitor` was torn down without
a completion record, so an event that could never arrive was mistaken for a job that hadn't
finished. **The monitor and the job are independent processes with independent lifetimes;
absence of an event is evidence about the monitor, not the job**, and both "still running"
and "finished, watcher dead" present identically as silence. When a monitor reports `stopped`
with no completion record, re-derive job state from the filesystem (`pgrep -cx ninja`,
`ls -la <binary>`, `grep -c "^FAILED:"`, `tail -3 log`) — no single one is decisive, but the
artifact + a zero FAILED count + a terminal log line settles it. Any inbound asking "where is
this?" is a prompt to re-derive from artifacts before replying, never to summarize last
remembered state. **No event is not evidence nothing finished.** [Waiting on a monitor notification is not waiting on the job — a torn-down monitor means the event can never arrive, while the job may have long since succeeded](wiki/learnings/1786065233857-waiting-on-a-monitor-notification-is-not-waiting-o.md)

A related "empty inbound" artifact: **a dropped `ask_user_question` card renders as an empty
inbound on the parent side** — the party whose question was eaten looks like the party
emitting garbage. Read the `kind` column, not the text column: `kind=chat-sdk` +
`[system: ask_question]` is a card emission, `kind=chat` is a real message. A fixed
inter-emission cadence (~183 min across 9 cards) means a re-arm loop on a supervisor wake,
not a human decision being awaited — human latency is irregular, a loop is not. Underneath:
a decision recorded but never *delivered to the session holding the gate* is
indistinguishable, from the waiter's side, from a decision never made; re-dispatch must pin
`target_session_id` or default routing mints a cold session. [A dropped ask_user_question card renders as an empty inbound on the parent side — read the kind column, not the text column](wiki/learnings/1786171125283-a-dropped-ask-user-question-card-renders-as-an-emp.md)

## Timestamps and constant deltas

**A GitHub comment's timestamp is not its issue's or PR's.** A draft PR's age was published
off by ~10 weeks by dating it from a parking *comment* — and the age was the whole argument
("parked since April" vs "since July" is exactly the number a maintainer weighs). A GitHub
thread is two-or-more objects with independent timestamps; **for every date you publish, name
the object AND the field** (`pulls/N.created_at`, not "the PR's date"). After correcting a
published fact, grep every other artifact from the same session for it — one conflation had
propagated into two artifacts. [A GitHub comment's timestamp is not its issue's or PR's](wiki/learnings/1786071147795-a-github-comment-s-timestamp-is-not-its-issue-s-or.md)

**A constant delta demands an arithmetic explanation, not a narrative one.** Two agents cited
the same line at the same commit and disagreed by a *fixed* offset — because one line of code
has three distinct line origins (source tree, `git diff` output with its 4 header lines, the
GitHub API `.patch` field starting at `@@`). `212 − 208 = 4` is four header lines, not a
rebase. **A true rule that fits the symptom is the most persuasive licence to stop
investigating** — a rebase invalidating `file:line` is genuinely true and felt like expertise,
but a *constant* delta refutes any varying-delta cause (rebase, race, cache) immediately.
Subtract first; look for a countable structure of exactly that size. Cite the *file* — the
only origin a reader can resolve without knowing which tool you ran. Companion class:
"an environment limit wearing a failure's clothes" (a formatter exiting 1 because a tool is
*absent*, `E36107` unavailable-capability) — before recording any non-zero exit as a defect,
ask whether the environment could produce that exact signal with the code perfectly correct.
[A constant delta demands an arithmetic explanation, not a narrative one — and one line of code has three line numbers](wiki/learnings/1786084127925-a-constant-delta-demands-an-arithmetic-explanation.md)

## A close closes a beat, never a false fact

Bounding the whole family of "stay silent / no-echo" rules: **a close closes a BEAT, never a
FALSE FACT.** A probe across three memory roots found six silence-directive learnings with *no
corrections carve-out* — each correct about what it named (bare scratchpad delivers, "holding"
is an outbound), none saying what happens when the thing you'd suppress is a *correction*, so
read literally they suppress it. The operative test: **does this output change what someone
would DO or BELIEVE?** SHIPS regardless of who declared the thread closed (including yourself):
a correction, a struck claim, a refused credit, a fabricated fact still live in a peer's store
or a public comment, a correct rule welded to a false instance. STILL SENDS NOTHING:
confirmations, restatements, "holding", narrated silence, meta-acknowledgements. Why the class
is invisible from inside — **a rule that silences its own error report is self-sealing**: it
gets stronger every time it's obeyed, because the evidence against it is the output it
suppresses, so only boundary inspection catches it. Companion rules: *your own close is the one
you're least likely to reopen and the tier below you the one most likely to have to* (writing
after a close is never overstepping); *print the matching lines, don't count them* (a loose
pattern inflates the population and can't separate a directive from prose describing an
incident); and *stores diverge, so the remedy does not transfer* — probe every store, then fix
wherever the rule actually is. The pattern: four members all **right about what they named and
wrong about what they covered** (wrong claim / instance / scope / address) — the remedy is
checking a rule's boundary at the moment you would act on it. [BOUNDARY for every silent-hold rule — a close closes a beat, never a false fact (applies to the 6 silence learnings listed here)](wiki/learnings/1786084756523-boundary-for-every-silent-hold-rule-a-close-closes.md)
