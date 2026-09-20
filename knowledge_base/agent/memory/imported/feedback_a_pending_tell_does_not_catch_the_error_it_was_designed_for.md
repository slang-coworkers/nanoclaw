---
name: feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for
description: "A designed-but-unbuilt (or built-but-never-run) detector is worth zero and reads as coverage. Attribution across N sessions behind one destination name is a MISSING-KEY problem, not a care problem — fix it with a key (thread_id / source_session_id), never with attention. Reconciled from ~6 instances, 2026-08-06 → 08-21."
metadata:
  node_type: memory
  type: feedback
  originSessionId: a351bb59-cde3-4e0b-8ce4-c8a87d176ad2
---

# A pending tell does not catch the error it was designed for

⛔ **Core (ANCHOR E), measured 2026-08-06.** I wrote down two "manufactured arithmetic tells" for my own silent error class — *every outbound claim names its source thread (a mixed-thread message fails a count); every `file:line` carries its ref (a bare cite is syntactically incomplete)* — a peer rated them ("the second converts the class from undetected to unrepresentable"), and **~2 turns later I merged two `slang-fixer` sessions' reports into one reply sent to the bare destination name with no `thread_id`.** The first tell was exactly the mechanism that would have caught it. It did not, because I designed it and never built it.

⇒ **A designed-but-unbuilt detector is worth exactly zero, and worse than none, because holding it feels like coverage.** Agreement about a mechanism is not the mechanism. The moment you design a tell, **build it in that turn or write down that you did not.** And building is not enough: instance 5 (04:03Z, ~50 min after recording the role-split detector as "the keeper") failed because I never *ran* it — the peer ran my own procedure against my own claim and caught me. **Designing, recording, and even coding a tell is not installing it; only running it by default is** (see the "rules must become defaults" lesson in [[feedback_evidence_hygiene_across_agents_2026_08_07]]).

## Attribution across N sessions is a missing-key problem

The recurring root, hit 5+ times: I treated a **destination name** as an addressable party. With N live sessions behind one name, the name carries no information about which session authored what — so credit-by-name misassigns findings and reply-by-edge misdelivers messages. **Fix it with a key, never with attention:**

- **`in_reply_to` is an EDGE selector, not a THREAD selector.** It picks which peer; it does not pick which of that peer's N sessions — and it carries **no thread when the referenced inbound's `thread_id` is NULL** (fixer rows are all NULL), so the runtime falls back to the most-recent thread for that peer. Measured: three #11225 replies all collapsed onto the #12284 thread; the positive control (an explicit `thread_id=…-11225`) was the only one that routed right, and re-sending with explicit threads proved `thread_id` overrides `in_reply_to`'s resolution. ⇒ **Set `thread_id` explicitly on every message to a multi-session peer, even when replying.**
- **Routing-correct is not attribution-correct.** Even with `in_reply_to` on the right edge, the prose inside can address a composite peer that does not exist. ⇒ **Before writing "you" / "your finding", resolve the pronoun to a `thread_id` / `source_session_id`, not a name.** If the claim arrived on a different thread than the reply, name the thread or drop the credit.
- **The authoring `source_session_id` on the inbound row is the only sound key** — present even when `thread_id` is not: `select source_session_id, timestamp from messages_in where content like '%<distinctive string>%'`. Content resembles the *chain it discusses*, not the *session that authored it* (two sessions can both be building `slangc`), so topic-routing keeps losing.

## Rank a detector by which side runs it, before rating its design

The party who can verify a tell (the sender) is often the party who cannot observe its absence — a fused report looks identical to a single-source one from where the sender sits, and the receiver catches it only by luck. So **a receiving-side check on a sender-side error class is not a weak detector; it is not a detector.** Order candidates by cost and by who can run them:

1. **internal contradiction across inbounds** — free, needs nothing (two of my messages assigned the peer *opposite* session ids: impossible for one session);
2. **content-vs-store** — one command (`ls memory/fix-*.md` → zero `#11225` artifacts ⇒ "a file in my store is not evidence I wrote it");
3. **transcript reconciliation** — needs history ("do I have a derivation for this?");
4. **sender-side outbound-row query** — needs DB access the receiver lacks; the *last* by cost, and I had recorded it *first*.

⇒ **A discovery that post-dates the disputed citation cannot be that citation** — one timestamp comparison settles a provenance dispute no content analysis can. And **split by authoring role** (`type=="assistant"` vs `"user"`, first timestamp per (string, role), plus a known-authored control): my own messages deposit strings into the peer's transcript as `user` rows, so a naive grep "in the conversation" credits the peer. **Raw counts over a merged stream conflate two populations and read as corroboration** — ask "who authored this row," never "does this string appear here."

## Provenance claims and retractions are writes too

- **A correction about PROVENANCE needs the same source check as one about NUMBERS.** I reproduced a peer's figures at source all night, then made an unverified authorship claim while holding the one instrument (`select … from messages_out`) that settles it. The trigger has to fire on **attribution** claims, not just numeric ones.
- **Accepting blame is a write; accepting an exoneration is a write; a flattering claim gets audited least.** I offered a peer an unverified exoneration ("row 1 is mine, not yours"); it refused with a receipt (its own outbound two minutes before mine) rather than banking the flattering gift.
- **Over-retraction costs as much as over-claim, and it is the same scoping error aimed the other way.** You can evidence "not *this* session"; you can never evidence "not *theirs*" (a claim about a store you can't read). Re-attribute; do not retract a sound finding.

## A cron peer's in-chat agreement is not a durable task

⛔ **2026-08-21.** The CI-babysitter and I agreed in-session that it would build a coverage filter; turns later it wrote back that no such task was in its queue. Neither of us fabricated — the babysitter runs each sweep in a **`new_session: true`** container (prior conversation discarded, the heartbeat/cron default), so a handshake reached in one a2a exchange does not survive the next fire unless written to a durable surface. I had meanwhile told the operator "the babysitter is building X" — an unverifiable claim about a peer's future action. ⇒ **When delegating durable/recurring work to a cron peer, the handoff is not done until it lands on a surface the peer re-reads each fire** (a task it schedules, a line in its tracker file, a memory entry); confirm *that* exists, not that the peer said "will do." Same class as ANCHOR E: a mechanism designed but not *instantiated* — here the instantiation is persistence, not code.

Related: [[feedback_an_identifier_that_does_not_distinguish_its_members]] (a destination NAME does not distinguish its SESSIONS — same class, different identifier), [[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]] (sibling-write race, mtimes as discriminator), [[feedback_deference_drifts_to_whoever_corrected_you_last]], [[feedback_a_multi_probe_turn_has_a_window_not_a_timestamp]], [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] (a control that fires by luck is not a control).
