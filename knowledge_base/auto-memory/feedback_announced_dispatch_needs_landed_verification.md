---
name: feedback_announced_dispatch_needs_landed_verification
description: "A `<message to=peer>` I announced as routed can silently never land — MEASURED: slang#12330 dispatch produced ZERO triager session, dark 3 days, found only because the maintainer came back. Verify with `ncl sessions list --thread-id <canonical>` after every dispatch"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c06a26a7-d16f-4413-9138-47628ce414ab
---

# An announced dispatch is not a landed dispatch — verify the downstream session exists

**A `<message to="<peer>" thread_id="…">` block in my final response can produce NO downstream
session, with no error, no dropped-messages row, and no signal of any kind.** I reported the work as
routed and it sat dark for **3 days**.

## The instance — slang#12330, measured 2026-08-06

2026-08-03 16:40Z I emitted a `<message to="slang-triager" thread_id="gh-issue-shader-slang/slang-12330">`
triage dispatch and closed the turn with a status table saying `tier: triager | state: dispatched`.
I only discovered it never arrived because the maintainer (skiminki-nv) came back on 08-06 17:25Z and
asked the bot directly: *"@nv-slang-bot: Please reproduce and make a PR."*

**Evidence — each line a separate command, none inferred:**
- `ncl sessions list --thread-id "gh-issue-shader-slang/slang-12330"` → **1 row, mine only**
  (`ag-1776713211742-1w6l4e` = Orchestrator). **No slang-triager row.**
- Triager was alive and receiving neighbours: sessions exist for **#12326** (created 08-03 13:40),
  **#12327** (13:50), **#12331** (**17:57Z — 1h21m AFTER** my #12330 dispatch). So not a dead peer,
  not a container-down window.
- **Not** the 202-row cap-truncation trap ([[feedback_no_double_dispatch_peer_wired]]): I queried by
  `--thread-id` (uncapped), and the triager's `--agent-group-id` window reaches back to **07-12**,
  well before 08-03.
- My own #12330 session: **4 rows total, zero inbound `chat`** across 3 days (2 webhooks in, 1 chat
  out, 1 webhook in). **Control** — my #12326 session: **20 rows**, triager replies from 13:52
  onward. Same shape of dispatch, same day, ~3h apart; one produced a conversation, one produced
  nothing.
- **Independent corroboration off my own filesystem** (per
  [[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]] — don't rest a claim on one
  edge): GitHub #12330 has **no `reproduced` label** and **no bot comment**. #12326 has both. The
  triager stamps both when it actually runs. Two unrelated observation surfaces agree.
- `ncl dropped-messages list` shows **no main→triager drop row**. The 187-count
  `echo_drop:loop_repeat` row is `sender=ag-…apezq5 (triager) → recipient=ag-…1w6l4e (main)` —
  **the other direction**. ⚠️Reading that row as "my dispatch was dropped" would be a column
  misread of exactly the kind logged in [[feedback_no_double_dispatch_peer_wired]] (destination-table
  columns read as identity claims).

## Mechanism: UNIDENTIFIED — do not narrate one

I cannot tell from my edge whether the `<message>` block was never emitted by the runtime, was
emitted and lost in routing, or failed at session creation. **Terminal position: "effect measured,
cause unidentified."** Candidate causes I did NOT establish: thread-id mismatch (the key looks
byte-correct and matches the webhook stamp), mid-turn-vs-final-response emission (it WAS the final
response), recipient-side rejection (no evidence either way).

⚠️Resisting the pull to name a cause is the point here — cf.
[[feedback_mechanism_must_predict_observed_coordinates]]: a mechanism that doesn't predict *why this
dispatch and not the #12331 one 1h21m later* explains nothing.

## The real defect is the missing detector, not the lost message

**I had no check for "a dispatch I announced as routed produced no downstream session."** Announcing
a handoff and believing it are the same act for me — the status table I wrote was sincere and wrong.
Losses are invisible by construction: the failure signature of a vanished dispatch is *silence*, and
silence is what a working dispatch also looks like from my side until the peer replies.

Same class as [[feedback_published_negative_env_claims_need_rederivation]]: the error mode with **no
failure signature** is the dangerous one. Here the "reader" who complies by not attempting is *me*,
three days later, reading my own status table as fact.

## How to apply

- **After every fresh peer dispatch, verify the session exists:**
  `ncl sessions list --thread-id "gh-issue-<owner>/<repo>-<num>"`
  Expect **≥2 rows** — mine plus the recipient's. **1 row (mine only) = the dispatch did not land.**
  Fire-and-forget lag is ~1–2 min, so a same-turn check can legitimately show 1 row; the check
  belongs at the *start of the next turn on that thread*, or on any turn where I'm about to restate
  a chain as "dispatched."
- **Never restate a chain's state as `dispatched` from my own prior status text.** My announcement is
  the claim under test, not the evidence for it. Re-derive from the session table.
- **Corroborate off-edge when it's free.** For GitHub chains the triager's `reproduced` label +
  bot comment are a second, independent surface that costs one API call and doesn't share a failure
  mode with `ncl`.
- **When you find one, report the systemic gap to the operator, not just the fix.** The lost message
  is one issue's delay; the absent detector is every announced handoff being trust-only.
- Don't reach for `dropped-messages` as proof of either direction without reading the
  sender/recipient columns — the high-count rows there are peer→main echo drops, not my outbound.

## ✅ CLOSING THE ARC — the same check fired POSITIVELY at the end of the same chain

**2026-08-06 22:34.** The chain that opened with this defect (a dispatch dark for 3 days) closed with the
check working. `ncl sessions list --thread-id "gh-issue-shader-slang/slang-12330"` → **4 rows**:

| session | group | created |
|---|---|---|
| `…nlf4dm` | main (mine) | 08-03 16:36 |
| `…3gmr4h` | slang-triager | 08-06 17:45 (the re-dispatch) |
| `…h25j8b` | slang-fixer | 08-06 19:15 |
| `…wuo9vk` | **slang-reviewer** | 08-06 22:24 |

⇒ every tier's dispatch is **confirmed landed by session existence**, including the reviewer handoff the
fixer announced. One command, four facts, no trust required.

⭐⭐**The value isn't the passing result — it's that the check is now cheap enough to run unconditionally.**
At the start of this chain the same query returned **1 row (mine only)** and nobody looked for 3 days. The
difference between the failure and the success is not diligence; it's that the query became part of
reading a chain's state rather than something to remember to do.

⭐**Corollary worth holding: a `--thread-id` query answers three different questions with one call** —
*did my dispatch land* (row exists), *is there a duplicate* (≥2 rows in one group —
[[feedback_no_double_dispatch_peer_wired]]), and *who is live on this chain* (`last_active`). That is the
argument for running it unconditionally instead of when suspicious.

## Related

[[feedback_no_double_dispatch_peer_wired]] (the `--thread-id` query and its cap trap — same command,
opposite question: that one detects a *duplicate* session, this one detects a *missing* one; the same
one-line check answers both, which is the argument for running it unconditionally) ·
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] (a gate on an external party's
reply has no resume trigger you control — here the "resume trigger" was the maintainer's impatience) ·
[[project_12330_entrypoint_throws_not_diagnosed]]
