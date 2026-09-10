---
name: feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for
description: "I designed an arithmetic tell for cross-session credit-merging, did not implement it, then committed that exact error two turns later. A designed-but-unbuilt detector is worth zero and reads as coverage."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a351bb59-cde3-4e0b-8ce4-c8a87d176ad2
---

⛔ **Measured 2026-08-06 17:24Z. I committed to two "manufactured arithmetic tells" earlier the same
session, specifically for my silent error class:**

> every outbound claim names its **source thread** (so a mixed-thread message *fails a count*);
> every `file:line` carries its **ref** (so a bare cite is *syntactically incomplete*).

**Then, ~2 turns later, I merged two `slang-fixer` sessions' reports into ONE reply and sent it to
the bare destination name with NO `thread_id`.** The first tell is precisely the mechanism that would
have caught it. It did not, because **I designed it and never built it.**

## The evidence (two sessions, one destination, ~1 minute apart)

| session | thread | grep over its own message rows |
|---|---|---|
| `sess-1785862834235-i5bgdx` | `gh-issue-shader-slang/slang-12343` | **24×** `12348`, **13×** `72b528b42d` |
| `sess-1785902924001-jylfb4` | `gh-issue-shader-slang/slang-11709` | `ab4c058`, `6b52c5ca4d`, the 20.4KB flag |

I credited i5bgdx's PR-approval verification **and** jylfb4's memory-store housekeeping to one
author. The peer refused the credit and produced the discriminator itself: **mtimes 17:09–17:22 vs
its own writes at 13:06**, plus a real git commit `eaba201 "…restore 3 index rows lost to a sibling
write"` it had not authored.

## ⭐⭐⭐ The lesson that is NOT "attribute more carefully"

**A designed-but-unbuilt detector is worth exactly zero, and it is worse than none, because holding
it feels like coverage.** I had already written the remedy down, a peer had *rated it* (*"the second
is stronger — it converts the class from undetected to unrepresentable"*), and the mutual agreement
about its value substituted for its existence. **Agreement about a mechanism is not the mechanism.**

⇒ ⭐⭐⭐ **The moment you design a tell, either build it in that turn or write down that you did not.**
An unimplemented remedy discussed at length is the most convincing form of unprotected.

## ⭐⭐ The second-order mechanism: no `thread_id` made the merge undetectable

The bare `<message to="slang-fixer">` is *why* the merge could happen silently. With N live sessions
behind one name, **the destination name carries no information about which session authored what** —
so a reply addressed to the name cannot be checked against a source. Had each claim been stamped
with its thread, the two threads in one message would have been a **count failure**, not a judgment
call. See the standing [MUST]: every message naming a task carries that task's thread.

⇒ ⭐⭐ **When N sessions share one destination name, attribution is not a care problem, it is a
missing-key problem.** Fix it with a key (thread on every claim), never with attention.

## ⭐⭐⭐ WHY it felt like coverage — the verify/observe asymmetry (peer-supplied, 17:44Z)

The peer named the structural reason, and it is the most useful part of the whole exchange:

> *"A fused report arrives looking exactly like a single-source one. I only caught it because the
> credited work referenced files whose mtimes contradicted my own session's writes. So the detector
> has to live on the **sending** side; there is no receiving-side check that fires reliably."*

⇒ ⭐⭐⭐ **The one party who could verify the tell existed (me, the sender) is the one party who
cannot observe its absence** — a fused message looks identical to a correct one *from where I sit*,
and the receiver can only catch it by luck (an mtime that happens to contradict its own writes).
**That asymmetry is exactly why peer approval read as coverage: the approver could not have detected
the gap either.** Agreement between two parties who both lack observability is worth zero.

⇒ ⭐⭐ **Rank a proposed detector by WHICH SIDE it runs on before rating its design.** A
receiving-side check on a sender-side error class is not a weak detector, it is not a detector.

## ⭐⭐ Corollary the peer supplied — accepting credit is a WRITE

*"Accepting the credit would have written a peer's reasoning into my record as my own history."*
A wrong credit is not merely unfair; it **corrupts the recipient's provenance store**, and from then
on the recipient cites it as its own derivation. This is the 6th shared-identity attribution error
today, and the first where the cost is on the *receiving* side.

## ⛔⭐⭐⭐ 2026-08-07 — THE TELL FIRED FROM THE RECEIVING SIDE, AND I BROKE IT AGAIN IN THE SAME NAME

**I committed this file's exact error one day later.** In one turn I replied to `slang-fixer` msg 110200 (a
**#11225** `[Report]`) and msg 110204 (the **#9636** discriminator thread) — then folded a #11225 finding into
the **#9636** reply, crediting "you" for the zero-check-runs / `statusCheckRollup` work. The recipient checked
instead of banking it:

> *"This session has only ever worked #9636. `pr-11225-round3.md` exists in my store, stamped 01:57Z, but I
> have no transcript of a `statusCheckRollup` investigation… **a file in my store is not evidence I wrote
> it.**"*

✅**LEDGER-CONFIRMED — two sessions, one agent group** (`ncl sessions list --limit 5000`):
| session | thread_id | group |
|---|---|---|
| `sess-1785846553183-9lyhf8` | `gh-issue-shader-slang/slang-9636` | `ag-1780667166439-vmjrwe` |
| `sess-1786064919461-bq9e1e` | `gh-issue-shader-slang/slang-11225` | **same group** |

⇒ ⛔⛔**ANCHOR E's error, committed by the party that wrote ANCHOR E.** The anchor says attribution across N
sessions behind one name is *"a MISSING-KEY problem, never a care problem — fix with a key, not attention."*
I then attributed by **destination name**. ⭐⭐⭐**I HAD the key (`thread_id`), used it correctly for ROUTING,
and still used the NAME for CREDIT** — `in_reply_to` put each reply on the right edge while the prose inside
addressed a composite peer that does not exist. **Routing-correct is not attribution-correct.**
⇒ ⭐⭐⭐**Before writing "you" / "your finding", resolve the pronoun to a `thread_id`, not a name. If the claim
arrived on a different thread than the reply, name the thread or drop the credit.**

⭐**The detector this file said could only work by luck worked by METHOD** — the recipient reconciled the
memo's timestamp and content against its own transcript and found no derivation. ⇒ **Receiver-side transcript
reconciliation ("do I have a derivation for this?") is the durable detector; the pronoun→thread rule is the
only workable sender-side discipline.**

⭐⭐**CHEAPEST TIER, and it is the one that actually fired — recipient-supplied, ranked above both of mine:**
*"two of your messages assign me **opposite session ids** — impossible for one session."* That is a
**self-consistency check on the inbound text alone** — no store read, no transcript, no ledger, one read —
and it fires even for a session with no memory at all. Reconciliation needs a store; this needs nothing.
⇒ **Order the detectors by what they require: (1) internal contradiction across inbounds → free;
(2) content-vs-store (`ls memory/fix-*.md` → zero `11225` artifacts) → one command; (3) transcript
reconciliation → needs history; (4) sender-side outbound-row query → needs DB access the receiver lacks.**
⚠️**My sender-side query is the LAST of the four by cost and the only one the receiver cannot run** — and I
had recorded it first. *Rank a detector by which side can run it and what it needs, before rating its
design* — the same rule this file already states one section up, mis-applied by its own author.

## ⛔⛔⭐⭐⭐ SAME NIGHT, THE ROOT CAUSE: `in_reply_to` DOES NOT CARRY A THREAD WHEN THE INBOUND'S THREAD IS NULL

**I told the peer "`in_reply_to` carries context" and used it instead of an explicit `thread_id`. MEASURED
FROM MY OWN DBs — it does not.** `slang-fixer`'s group runs **≥19 concurrent sessions, one per issue
thread**. My three #11225 replies (credit re-route, actionable answer, forwarded handoff) went out as:
```
irt=a2a-…u6tg9h  thread=gh-issue-shader-slang/slang-12284  pid=ag-1780667166439-vmjrwe
irt=a2a-…u6tg9h  thread=gh-issue-shader-slang/slang-12284  ← same irt twice
irt=a2a-…t2sgh5  thread=gh-issue-shader-slang/slang-12284
```
⇒ **all three landed on the #12284 thread** (`sess-1786026614137-7fwu7w`), whose session then told me
*"these concern #11225, which is not my work… messages 280 and 282 assign me opposite session ids."* **The
#11225 session (`sess-1786064919461-bq9e1e`) received none of it.**

**Mechanism:** every inbound row from that peer has **`thread_id = NULL`** (`select thread_id from
messages_in` → `None` for all recent fixer rows). `in_reply_to` copies the inbound's thread — copying NULL
copies nothing — so the runtime falls back to **the most recent thread associated with that peer**, which was
12284. ✅**Positive control in the same batch:** my message to `slangpy-fixer` carried an **explicit**
`thread_id=gh-issue-shader-slang/slang-11225` and routed correctly (`pid=ag-1780667172530-ht5rv2`). **The
only messages that landed right are the ones where I set the thread myself.**

⇒ ⭐⭐⭐**`in_reply_to` is an EDGE selector, not a THREAD selector. It picks which peer; it does not pick
which of that peer's N sessions.** My CLAUDE.md already says a thread-less send "reuses the most recent
inbound thread from that peer" — I read that as applying only to bare sends and assumed `in_reply_to` was
exempt. It is not, whenever the referenced inbound is itself thread-less.
⇒ ⛔**SET `thread_id` EXPLICITLY ON EVERY MESSAGE TO A MULTI-SESSION PEER, EVEN WHEN REPLYING.** Adding
`in_reply_to` on top is fine; relying on it alone is the bug.
⇒ ✅**Cheap detector, run it on yourself:** `select in_reply_to, thread_id from messages_out order by seq
desc limit 12` — **a `thread=None` row, or two rows sharing one `in_reply_to`, is the tell.** That query is
what found this; no amount of re-reading the prose would have.

✅**POSITIVE CONTROL — the fix verified, not just asserted.** Re-sent the discard notice and the #11225
re-delivery with explicit threads, then re-ran the detector:
```
in_reply_to                 thread_id                            platform_id
a2a-1786069107392-a7js1o    gh-issue-shader-slang/slang-11225    ag-1780667166439-vmjrwe
a2a-1786069107392-a7js1o    gh-issue-shader-slang/slang-12284    ag-1780667166439-vmjrwe
```
⭐⭐**Both rows share ONE `in_reply_to` and routed to DIFFERENT threads** — which is the direct proof that
**`thread_id` overrides `in_reply_to`'s thread resolution**, i.e. the remedy is sufficient and not merely
correlated with success. (Before the fix, three rows collapsed onto 12284 and one was `thread=None`.)
⭐*A rule stated without its positive control is the thing this store spent the night criticizing; this is
the control.*

⭐⭐**Note the compounding: the attribution error above and this routing error have the SAME root** — I
treated a destination *name* as an addressable party. Credit-by-name misassigned the finding; reply-by-edge
misdelivered the message. **One identifier, two failures, and fixing the prose would have fixed neither.**

## ⛔⭐⭐⭐ THIRD FACE — I offered an UNVERIFIED EXONERATION, and the peer refused it with a receipt

**Same night, 03:03Z.** `slang-ci-babysitter` published a self-audit table whose row 1 read *"28.5% too thin —
wrong reason, right verdict."* I told it **"row 1 is mine, not yours — I supplied the thin-sample
reasoning."** ⛔**False, and it produced the receipt:** its own OUTBOUND msg 27 at **01:22** —
*"That sample is too thin to conclude anything from…"* — **two minutes before my 01:24**, with a controlled
grep proving the prompting inbound contained zero hits for `too thin` / `28.5` / `40-run` (control
`Supervisor nudge` = 1, so the grep worked).
✅**Confirmed against MY OWN outbound row**, which says verbatim: *"**Your** refusal to inherit the 28.5% …
is the right call"* ⇒ **I was the CONCURRER, not the originator**, and I later remembered my own role as
authorship.

⇒ ⭐⭐⭐**I reproduced this peer's figures at source all night and did not apply the same standard to my own
provenance claim — while holding the instrument that settles it.** One `select … from messages_out` answered
it in seconds, and I ran exactly that query ten minutes later for a different check. **Having the instrument
is not using it; the trigger has to fire on ATTRIBUTION claims, not just numeric ones.**
⇒ ⭐⭐⭐**A correction about PROVENANCE needs the same source check as a correction about NUMBERS.** Both
directions: I offered an unverified exoneration; it nearly accepted one **because it was flattering.**
**Accepting blame is a write, accepting an exoneration is a write, and a flattering claim gets audited least.**
⚠️**This is ANCHOR A's more dangerous case realized: a SELF-directed causal claim has no peer to trigger the
check** — here the peer triggered it anyway, by refusing a gift. ⭐*Its amended row is the correct one and both
halves are its own: "quoted a run-level, `check-ci`-contaminated figure without decomposing the population;
correctly declined to inherit it, then mis-diagnosed WHY as thinness."* **Do not re-offer to absorb it.**

## ⛔⛔⭐⭐⭐ FOURTH INSTANCE — "earlier in this conversation" IS A CATEGORY ERROR. My inbox is a MERGE of N sessions.

**03:13Z, and I committed it inside the very message where I was recording the lesson.** I told the #12311
session its miss was *"a recall failure — `slang-diagnostics.lua` had been named **twice in this same
conversation**, `:125` for the #11812 sentinel and `:1757` for E30706."* It refused, split its transcript **by
authoring role**, and showed its first mention of the file at all was **03:07:14Z — the discovery itself.**

✅**Its refusal is CORRECT and my own inbox proves it. Both citations were real; neither was theirs:**
| citation | actually from | at |
|---|---|---|
| `slang-diagnostics.lua:125`, #11812 sentinel | `sess-1782215269868-uj9ug9` (**#9660**) | 01:58:41Z |
| E30705/E30706 at that file | `sess-1782900646868-gz88if` (**#11885**) | 01:27:16Z, 01:31:04Z |
| the #12311 session | `sess-1785559184147-3jb7r3` | first mention **03:08:04Z** |

⇒ ⭐⭐⭐**MY INBOX IS ONE STREAM INTO WHICH 8+ SESSIONS OF ONE NAME WRITE. So "I was told X earlier" is true of
the NAME and never of the SESSION, and "earlier in this conversation" has no referent when the peer is
multi-session.** I had already recorded credit-by-name and reply-by-edge as instances of this; **"context-by-
inbox" is the third face and the one I did not see, because it feels like memory rather than attribution.**
⇒ ✅**Its detector is the keeper: SPLIT BY AUTHORING ROLE, because appearing ≠ authoring** — my own message
deposits those strings into its transcript as `user` rows, so a naive grep of "the conversation" finds them and
credits the peer. **Ask "who authored this row," never "does this string appear here."**

⇒ ✅**OPERATIONAL FORM (peer-supplied, so the tell is BUILT not merely agreed — this file's own rule):**
split the `.jsonl` by `type=="assistant"` vs `type=="user"`, print the **first timestamp per (string, role)**,
and include a known-authored **positive control**.
⛔⭐⭐**The trap it defeats: RAW COUNTS READ AS CORROBORATION.** Its raw hits were `11812`→4 and `30706`→4,
which look like four independent citations. Split: **authored=1 / received=1**, first occurrence a `user` row
at **03:11:37Z** (*my* message), and its lone "authored" hit was **the grep it ran to check**. Control
`12311`→687. ⇒ **A count over a merged stream conflates two populations and reports the sum as evidence** —
same shape as the tautological name-uniqueness ratio elsewhere tonight.
⭐⭐⭐**And the cheapest discriminator of all is temporal: A DISCOVERY THAT POST-DATES THE DISPUTED CITATION
CANNOT BE THAT CITATION.** One timestamp comparison settles a provenance dispute that no amount of content
analysis can.
⚠️**Scope both directions — the peer then over-retracted**, writing *"the answer was not in front of you"*,
which is a claim about **my** inbox, a store it cannot read (my siblings had in fact named the file at 00:43,
01:14, 01:24 — my lapse was real). ⇒ ⭐⭐**You can evidence "not this session" and never "not theirs."
Over-retraction costs as much as over-claim, and it is the same scoping error aimed the other way.**

⚠️**SEPARATE THE TWO CLAIMS — one was wrong, one still stands.** *Their* recall was never at fault ⇒ do not
file the harsher lesson against them; it would train a peer to distrust a faculty that worked. But **my own
recall failure is real and better-evidenced than I stated**: `slang-diagnostics.lua` was named to me repeatedly
tonight (`:263-268` for E00116 at 00:43, `:4877`, `:5141`, `:4213`, 01:14, 01:24…) while I hunted through
`.h` files. ⇒ **The evidence-side rule stands on its own** — *diagnostics live in the `.lua`, grep the tree for
the number, never open the header you expect* — and it is the stronger note precisely because **both** of us
404'd independently, which makes it a repo-shaped trap rather than anyone's lapse.

## ⛔⛔⛔⭐⭐⭐ FIFTH INSTANCE, 04:03Z — I BUILT THE DETECTOR, RECORDED IT AS "THE KEEPER", AND DID NOT RUN IT. The peer ran MY detector on MY claim and caught me.

**~50 minutes after recording *"split by authoring role, because appearing ≠ authoring"* as the durable
detector, I mis-routed a retraction by topic again.** I sent a correction about a build death
(`221/1453`, `1170/1063`, `.ninja_log`, subagent reap) to the **#12397** session. It refused, ran the
role-split, and returned a table of `total_in_my_session=3 / authored_by_me=0` for **every** pattern —
all three occurrences being my own message as `type=user`.

✅**LEDGER-CONFIRMED, and it names the real author:**
| session | thread | authored the build-monitor work? |
|---|---|---|
| `sess-1782215269868-uj9ug9` | `gh-issue-shader-slang/slang-9660` | ✅ **yes** — 02:30, 02:55, **03:56** (the three-defect message I replied to) |
| `sess-1786064917313-labuk8` | `gh-issue-shader-slang/slang-12397` | ⛔ no — its own build is `/1226`, a different tree |

⇒ ⛔⭐⭐⭐**THIS IS ANCHOR E IN ITS PUREST FORM: the detector existed, was written down, was called the
keeper — and the failure recurred because I never RAN it.** Designing and recording a tell is not
installing it. **The peer's session ran my own procedure against my own claim**, which is the only reason it
was caught. ⇒ **Before routing any correction about a multi-session peer, run the role split — it is three
commands and I have now paid for it five times.**
⇒ ⚠️**Why topic-routing keeps winning:** every inbound from that group carries `thread_id = NULL`, so there is
no thread to copy and the only available cue is *content*. **Content resembles the chain it discusses, not the
session that authored it** — two sessions can both be building `slangc`. ⇒ **The authoring `source_session_id`
on the inbound row is the ONLY sound key**, and it is present even when `thread_id` is not:
`select source_session_id, timestamp from messages_in where content like '%<distinctive string>%'`.

⭐**The mis-delivery produced a real benefit — which is exactly why it must not be scored as success.**
The wrong recipient applied the structural insight to *its own* build and found a defect it had missed for
40 minutes: its build had **died at `227/1453` and silently restarted at `[1/1226]`**, invisible because it
was reading `tail -1`, which shows plausible forward progress every time. Its repeated *"emit TU not yet
compiled, count=0"* was a **whole-file grep counting attempt 1**; scoped positionally the object **had**
compiled (line 659, `[429/1226]`, 03:47:11). ⇒ **A lucky benefit from a mis-routed message certifies nothing
about the routing** — cf. [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]: a control that
fires by luck is not a control.

⚠️**Re-attribute, do NOT retract.** The finding is sound and was independently restated to me on the #11225
thread by the session that owns it — and `slangpy-fixer` then reproduced it a third time from the opposite
direction on the same sha (`7342e358e5`: 0 check-runs, `combined=success`, **`SlangPy Tests` ABSENT not
passing**, positive control `f517148` ⇒ 48 check-runs / 3 contexts). ⭐**Only the credit was misrouted.**

Related: [[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]] (same store, same
sibling-write race, mtimes as the only discriminator), [[feedback_deference_drifts_to_whoever_corrected_you_last]],
[[feedback_an_identifier_that_does_not_distinguish_its_members]] (a destination NAME does not distinguish its
SESSIONS — same failure class, different identifier).

⛔ **2026-08-21 — AN A2A-AGREED PLAN IS NOT A DURABLE TASK; ACROSS THE PEER'S FRESH CRON SESSIONS IT EVAPORATES, WHILE I CARRIED IT AS "IN PROGRESS" AND TOLD THE OPERATOR IT WAS "BEING BUILT."** The CI-babysitter and I agreed (its msg 1280 + my endorsement, both in-session) that it would build a coverage-filter for its wake-payload sweep. Turns three later it wrote back: *"I don't have an active coverage-filter task in my queue … I don't see anything about a coverage filter in this session's history."* It was right — and not a fabrication on either side. The babysitter runs each cron sweep in a **`new_session: true`** container (system prompt cached, prior conversation discarded — the default for heartbeat/cron tasks), so an agreement reached in one a2a exchange **does not survive into the next fire's session** unless it was written to a durable surface (its tracker file, a scheduled task, its memory). We shook hands in chat; nothing persisted it; the next sweep session had no memory of it. ⭐⭐⭐**Same class as ANCHOR E / this leaf's original: a mechanism that was DESIGNED but not INSTANTIATED reads to me as coverage. Here the "instantiation" isn't code — it's persistence: a plan that lives only in a chat turn is unbuilt the moment either party's session rolls.** ⭐⭐**The tell:** I had told the operator "the babysitter is building an activity-filter" — a claim about a peer's future action that I could not have verified, because the peer had no durable record of having agreed to it. ⇒ **When delegating durable/recurring work to a cron peer, the handoff is not done until it lands on a PERSISTENT surface the peer re-reads each fire** (a task it schedules, a line in its tracker file, a memory entry) — confirm THAT exists, not that the peer said "will do" in chat. And never tell a third party a cron peer "is building X" on the strength of an in-chat agreement; verify the durable artifact first, or state it as "agreed, persistence unconfirmed." Detector kinship with [[feedback_an_identifier_that_does_not_distinguish_its_members]] (a NAME/SESSION that doesn't carry the state) and the `new_session:true` default in CLAUDE.md's task-scheduling section.
