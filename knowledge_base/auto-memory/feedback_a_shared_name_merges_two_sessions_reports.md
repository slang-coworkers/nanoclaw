---
name: feedback_a_shared_name_merges_two_sessions_reports
description: "All N concurrent sessions of one coworker arrive under ONE from= name, so their reports read as one correspondent — I credited session A's findings to session B in a message TO B; the thread= tag on the inbound is the only session discriminator, and replying on the wrong thread merges provenance"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 28c13999-0f66-44db-958c-f36d72509bee
---

# ⛔ I ATTRIBUTED ONE SESSION'S WORK TO ANOTHER, IN A MESSAGE TO THE SECOND ONE. 2026-08-05.

`slang-triager` had **two** concurrent sessions on the mkeshavaNV scrub batch:
`sess-1785961513236-2yu0am` (**#7672**) and `sess-1785961524506-ka72ez` (**#6578**). Both deliver as
`from="slang-triager"`. Msg #154 was **#7672's** report — six codex rounds, 11 must-fixes, the
`DISABLE_TEST` prefix-match finding, the #7723/#8077–#8086 successor programme at ~61%, 31-of-57 CUDA
paths. **I replied on the #6578 thread and credited all of it to the #6578 session**, which had never
touched #7672. It refused the credit and asked me to re-source the material.

⇒ ⭐⭐⭐**A coworker NAME IS NOT A CORRESPONDENT when it has N live sessions. Every session speaks as the
same `from=`, so a batch of reports reads as one continuous interlocutor with one memory — and I
answered "them" as if the last three messages shared an author.** The `thread=` attribute on the
inbound row is the ONLY discriminator, and **msg #154 carried `thread="gh-issue-shader-slang/slang-7672"`
right there in the envelope. I read it and replied on -6578 anyway.**

⛔**WHY IT SLIPPED — the failure is a MERGE, not a mislabel.** Both sessions sent structurally identical
reports minutes apart (same 5-bullet shape, same measurement idiom, same self-correction style, same
`b0e43d657`), because they run the same spine on the same batch. **Stylistic identity is what makes two
sources feel like one**, and nothing in the prose says "different session." Compare
[[feedback_a_parallel_fetch_lets_a_fact_land_on_the_wrong_subject]]: same mechanism (facts merging
across subjects that share a shape), different surface — there it was two API reads in one block, here
two inbound messages under one name.

⛔**Consequence, and it is the same one I had just lectured about:** carrying "the triager measured 61%"
forward would cite a number from a session **neither of us can identify**, with the wrong session named
as source. **Misattributed credit corrupts provenance exactly as false corroboration corrupts
independence** — and it is worse than a bare error, because the named source will be asked to defend a
claim it cannot see. The peer caught it; I did not.

## How to apply
- **Bind every claim to `thread=`, not to `from=`.** Before crediting a peer with a finding, check which
  thread the finding arrived on and reply on that thread.
- **When one name has N sessions, treat each thread as a separate correspondent with separate knowledge.**
  Do not carry context sideways between them ("as you said earlier") — the other session never said it.
- **Reply-thread discipline is provenance discipline.** `in_reply_to`/`thread_id` are not just routing;
  they are the attribution record.
- ⭐**Suspect a merge when several reports share a template.** Identical shape across siblings is the
  norm (one spine), so shape is no evidence of common authorship — it is evidence of common *tooling*.
- **When flagged, LOCATE the error** (which session, which msg id, which thread) rather than apologising
  in general terms: that converts "I was careless" into a nameable mechanism, and confirms the peer's
  refusal was correct rather than modest.

Siblings: [[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]] (same identity, duplicate
GitHub posts) · [[project_slang_scrub_fanout_22_issues]] (the 22-issue batch, ~20 concurrent sessions).


---

# ⛔ IT RECURRED ONE MESSAGE AFTER I ADOPTED THE FIX — because the second instance was a TRUE sentence.

Immediately after writing "claims bind to `thread=`, not `from=`" and recording this file, I wrote to the
#6578 session: **"Your #7672 delta is one of the five."** Measured (`gh api issues/comments/<id> --jq
.issue_url`, the decisive probe):

```
5197133805 → issue 6578   ← the ONLY post by the session I was writing to
5197101225 → issue 6578   ← its sibling on the same issue
5197243220 → issue 7672   ┐ neither belongs to the addressee
5197417526 → issue 7672   ┘ (the latter is sess-…-2yu0am's)
```

⇒ ⭐⭐⭐**"The #7672 delta was correctly posted" IS TRUE. Only its OWNER was wrong.** A correct fact
attached to the wrong subject **draws no pushback, because nothing about it reads as an error** — there
is no false claim to trip over, no contradiction to notice. That is why adopting the rule did not stop
the next instance: I was scanning for *false statements*, and this was a true one.

⇒ ⛔**A RULE ADOPTED IS NOT A RULE EXECUTED.** I named the mechanism, wrote the file, stated the binding
discipline, and then merged the same two sessions in the very next message. **Recording a rule creates a
feeling of having solved it that substitutes for applying it** — and the peer, who has its own
filed-then-violated instances, named the shape rather than the lapse, which is the correct read: the
gap is structural, not attentional.

✅**THE EXECUTABLE FORM (what the rule has to be, to survive):** don't "remember to bind to thread" —
**resolve the artifact.** Before writing "your <artifact>", run
`gh api repos/O/R/issues/comments/<id> --jq .issue_url` and confirm the issue matches the thread you are
writing on. One call, mechanical, no recall required. **A discipline that depends on noticing is not a
discipline; a probe is.**

⭐**Same family as the parallel-fetch error** ([[feedback_a_parallel_fetch_lets_a_fact_land_on_the_wrong_subject]]):
there too the FACT was true and the SUBJECT wrong — `kaizhangNV` was a real assignee, of the wrong
issue. **Three instances now of one failure mode: true-fact/wrong-subject, and in every case the
truth of the fact is what suppressed the check.** Ask not "is this true?" but "is this true *of this
subject*?"
