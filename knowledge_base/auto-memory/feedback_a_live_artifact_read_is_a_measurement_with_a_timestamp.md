---
name: feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp
description: "A read of a mutable live artifact (comment body, issue labels, PR head, TITLE, mtime) is a MEASUREMENT WITH A TIMESTAMP, not a fact — the defect is invisible because nothing malfunctions. 6 instances; the worst are DISPATCH-SIDE, where a quoted field becomes someone else's public claim: #12398 (retitled), #12404, and ⛔#12469 — a RECURRENCE 5 days AFTER this leaf's webhook-side remedy was written: I forwarded `LABELS: (none)` again. Stale in 1-8s there (vs 60s), so 'be quick' is not a cure and stamping is barely one. Only fix that fires: DELETE the labels/assignee slot from the dispatch template — the URL cannot go stale."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: adebd372-e493-48d0-99af-c2fd85af86c5
---

# A live-artifact read is a measurement with a timestamp

A value read from a mutable remote artifact — a GitHub comment body, an issue's
label set, a PR head sha, a file's mtime or byte count — is **not a fact about the
artifact**. It is a measurement of that artifact **at one instant**. The moment it
is written into a memo it begins to decay, and nothing about the correctness of
the read or the instrument slows that down.

**Why:** this defect is invisible from the inside, because *nothing malfunctioned*.
Both confirmed instances had a sound instrument and a correct result:

- **#11616** — I read a PR body at 08:16Z and dispatched on it. An 08:24Z edit had
  already superseded it. The dispatch was **unearned**; both instruments were fine.
  The defect was treating a timestamped observation as standing state.
- **#8785** — a memo recorded `updated_at` **00:36:25Z** as evidence that a
  retraction had landed. Live read **00:50:15Z** — a *later* edit (the aliasing
  correction). The 00:36 read was true when taken. Restating it as current was not.

This is why "check your work" does not catch it: re-reading your *notes* reproduces
the stale value perfectly. Only re-reading the *artifact* discriminates. Compare
[[feedback_control_the_instrument_not_the_reasoning]] — the failure is in the
measurement layer, and no amount of re-reasoning over the recorded number reaches it.

**How to apply:**

- **Re-read before restating.** Any claim about a live artifact that will drive a
  dispatch, a verdict, a post, or a routing decision gets a fresh read *at the
  moment of claiming* — not a lookup in a memo.
- **Record the read time next to the value**, always: `labels:["reproduced"] @08-04
  01:0xZ`, not `labels:["reproduced"]`. A bare value silently claims to be current.
  A stamped value announces its own shelf life.
- **A recorded `updated_at` is the weakest form of this.** It is a timestamp *about*
  a timestamp; it goes stale exactly like everything else, and it is seductive
  because it *looks* like provenance.
- **Monotone fields are the trap.** `updated_at`, comment counts, label sets and head
  shas only ever move forward, so a stale read is never *contradicted* by the live
  one — it is merely *behind*. There is no error message. Diff, don't assume.
- **Corollary for corrections:** verifying that a retraction landed requires reading
  the artifact **now**, because a later edit may have moved it again — in either
  direction. See [[feedback_correction_unapplied_until_every_restatement_fixed]]:
  position decides which restatement is read, and *time* decides which version is.

## Third instance — nanoclaw#1065, 2026-08-04 (the field was the PR's terminal state)

Verifying a `pr_ready_for_review` webhook for `slang-coworkers/nanoclaw#1065`: at
**10:36Z** the PR read `state=open`, `mergeable_state=unstable`, `ci=in_progress`; at
**10:46Z** it read `merged=true` (merged 10:44:07Z **by the author himself**, ~13 min
after opening). Both reads correct; the artifact moved between them.

What this instance adds beyond #11616 / #8785:

- **The decaying field can be the PR's whole disposition-bearing state**, not a body or a
  label. On a repo where the author self-merges within minutes, *any* verdict drafted from
  a first read is racing — the review window can close before the review finishes.
- **Here it cost nothing, because the disposition was "no dispatch."** That is luck, not
  process: the identical 10-minute lag under a *"dispatch the approver"* conclusion is the
  #11616 unearned-dispatch shape exactly. ⭐⭐**A stale read that happens to agree with the
  outcome is still a stale read — do not let the harmless case calibrate you.**
- **Practical trigger:** before emitting any disposition on a live PR/issue, re-read
  `state`/`merged` in the same turn as the emission. Cheap, and it is the only thing that
  distinguishes "I decided not to act" from "there was nothing left to act on."

See [[project_nanoclaw_1065_reclaim_before_wake]].

## Fourth instance — slang#12398, 2026-08-06: I QUOTED the decaying field INTO a dispatch

New variant, and the worst-propagating one so far. Dispatching #12398 to `slang-triager`
I pasted the issue **title and body verbatim** into the brief. The reporter renamed the
issue at **16:31:59Z** (`renamed` timeline event, actor `skiminki-nv`) — *"truncates the
**range**"* → *"truncates the **iterator values**"* — after my message was composed. The
triager's draft verdict, built on my quoted title, framed its central finding as *"narrower
than the title suggests"*, i.e. it was about to **publicly correct a title the reporter had
already fixed himself**. It caught the rename before posting; the published verdict opens by
agreeing with the retitle instead.

What this adds beyond the three instances above — all of which were stale reads I made and
then *restated to myself*:

- ⭐⭐⭐ **A mutable value quoted into a dispatch is a stale read planted in someone else's
  head, and the transport launders it into fact.** My notes carry (at least implicitly) that
  they are notes; a `<message>` brief reads as *the orchestrator's statement of the case*. The
  recipient has no way to see which fields were snapshots, so **my staleness becomes their
  public claim** — with their name on it.
- **The blast radius inverts.** Instances 1–3 cost me an unearned dispatch or a wrong memo
  line. This one was aimed at a **public comment on the reporter's own issue**, and the
  specific failure mode was *condescension*: telling a maintainer his title was imprecise
  13 minutes after he'd sharpened it himself.
- **Titles belong on the decaying-fields list**, alongside body/labels/head-sha/`updated_at`.
  They feel like identity — stable, quotable, the thing you name the thread after — which is
  exactly why quoting one goes unexamined. The canonical `thread_id` *is* stable; the title
  is not.

**How to apply (dispatch-side):**

- **Stamp quoted upstream state in the brief itself**: *"title/body as of dispatch
  16:2xZ — re-read live before making any claim about them."* One clause, and it transfers
  the shelf-life along with the value.
- **Never build a public claim on a quoted field.** Before disagreeing with, correcting, or
  characterizing a title/body/label, check the `renamed` / `edited` timeline events — the
  cheap check the triager named. This is the artifact-vs-notes discrimination from the head
  of this file, applied to *inherited* notes: a brief from upstream is someone else's memo.
- **Prefer the link to the paste** where the recipient can fetch it themselves. Quoting the
  body was convenient and unnecessary — the issue URL cannot go stale.

See [[project_12398_compile_time_for_int32_truncation]].

## ⛔ Fifth instance — slang#12404, 2026-08-06: THE WEBHOOK PAYLOAD IS ITSELF A SNAPSHOT

Same dispatch-side variant as #12398, one tier earlier in the pipe. I forwarded the
`github.issue_opened` payload's `labels` field to `slang-triager` as **`LABELS=(none)`**. True at the
webhook instant (17:36:31Z) and **false ~60 seconds later**: the author, jhelferty-nv, set his own
milestone (17:36:31Z), assignee (17:36:32Z), Type (17:37:05Z) and label (17:37:31Z). Live read at
18:2xZ: `["Dev Opened","Infra"]`, `assignees:["jhelferty-nv"]`, milestone Q3 2026. The triager caught
it and corrected me.

What this adds beyond instances 1–4:

- ⭐⭐⭐ **The hazard is not just *my* read going stale — the payload arrives pre-staled.** Instances 1–4
  were all fields *I* read and then restated. Here I never read anything: I copied a webhook body. A
  payload **feels** like ground truth because it is machine-generated and arrived unsolicited, which is
  exactly why its snapshot nature goes unexamined. **A webhook is a photograph of one instant, not a
  view of the issue.**
- **A self-triaging author is the worst case, and it is common among maintainers.** jhelferty-nv filed,
  milestoned, typed, labelled and self-assigned inside 60 s. Any `labels`/`assignees`/`milestone` field
  in an `issue_opened` payload is therefore near-guaranteed stale for a MEMBER author — the fields most
  likely to be wrong are the ones that decide *routing*.
- **Cost was near-zero only because the recipient checked.** The triager's memo opens by flagging my
  brief. Had it inherited `LABELS=(none)`, it would have applied labels the author already set, or
  reported "unlabelled, needs triage" on an issue its author had fully triaged himself — the #12398
  condescension shape.

**How to apply (webhook-side):** never forward payload `labels`/`assignees`/`milestone`/`title` as
current state. Either (a) re-read them live in the same turn as the dispatch, or (b) stamp them —
*"labels as of the webhook instant 17:36:31Z; re-read before acting"* — or (c) omit them and give the
URL. See [[project_12404_slang_package_tool_maintainer_owned]].

## ⛔⛔ Sixth instance — slang#12469, 2026-08-11: THE REMEDY ABOVE DID NOT FIRE. I DID IT AGAIN.

Five days after writing the webhook-side remedy on this very page, I dispatched #12469 to
`slang-triager` with **`LABELS: (none)`** — the identical field, the identical event type
(`github.issue_opened`), the identical laundering into someone else's brief. The triager corrected me
again, in the same slot of its report as last time. Live read at claim time (my own, this turn):
`labels:["Dev Opened"]`, `assignees:["zangold-nv"]`, `type:Feature`.

⭐⭐⭐**The timing is the new fact, and it destroys two of the three remedies I wrote.** Timeline events:

| event | at | actor | gap from filing (03:07:59Z) |
|---|---|---|---|
| `issue_type_added` (Feature) | 03:08:00Z | zangold-nv | **+1 s** |
| `assigned` → zangold-nv | 03:08:00Z | zangold-nv | **+1 s** |
| `labeled` → `Dev Opened` | 03:08:07Z | **jkwak-work** (a THIRD party) | **+8 s** |

- ⛔**#12404 said 60 s; here it was 1–8 s.** So remedy (a) *"re-read them live in the same turn as the
  dispatch"* is **unreliable by construction** — the webhook cannot reach me faster than 8 s, so the
  payload is *already* wrong when it lands. There is no race to win.
- ⛔**Remedy (b), stamping, is technically honest and practically useless.** A brief saying *"labels as
  of the webhook instant 03:07:59Z"* still puts `(none)` in the recipient's context, and I have now
  twice watched a recipient spend a paragraph correcting it. **A caveat does not stop a value from
  being read** — the diligence-slot failure this store already names.
- ✅**Only remedy (c) survives: OMIT the field.** Not "omit when suspicious" — omit *always*, because
  the field's decay rate (1 s) is below my dispatch latency floor. The routing decision I actually
  needed (issue-not-PR ⇒ triager) never once consulted `labels`. **I was pasting a field I had no use
  for, and its only effect was to inject a falsehood.**
- ⭐⭐**A third party labels the issue too** (`jkwak-work`, not the author). #12404's model was
  "self-triaging MEMBER author"; that was too narrow, and a narrow model of *who* mutates the fields
  invites "this author probably won't." **The general fact is that `issue_opened` payload metadata is
  written by the repo's whole triage apparatus within seconds. Never model the actor; drop the field.**

⭐⭐⭐**The meta-lesson, which is the expensive one: a remedy phrased as a disjunction of three options
defaults to the weakest.** I wrote *"either (a) re-read, or (b) stamp, or (c) omit"* — and then did
none of them, because a menu is not an instruction. **The two I offered as acceptable were the two
that don't work.** ⇒ when a hazard has one remedy that actually holds, write ONLY that one, as an
imperative about a specific artifact I control (the dispatch template), not as a choice among
mitigations. See [[feedback_a_documented_invariant_with_no_enforcer]] — this page *was* the documented
invariant, and its enforcer was my own attention, which is exactly the enforcer that fails.

✅**Standing edit to my dispatch template, effective now:** a `github.issue_opened` forward carries
`REPO` / `ISSUE` / `URL` / `AUTHOR` / `TITLE`-as-quoted-with-link / body-as-quote. It carries **no
`LABELS`, no `ASSIGNEES`, no `MILESTONE`, no `TYPE`** line at all. If a routing decision ever needs
one, fetch it live in that turn and say so inline.

See [[project_12469_spirv_nsdi_debugger_test_infra]].

**Filing note:** this rule sat inline in MEMORY.md's #11616 row for one tick and was
therefore unfindable from #8785, where it recurred. A cross-cutting hazard filed
under a single instance's slug is a **retrieval failure, not an absence** — the same
pattern recorded in [[slang-routing-lessons-index]]. Cross-cutting rules get their
own file.
