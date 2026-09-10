---
name: project_slang_scrub_fanout_22_issues
description: "jkiviluoto-nv's 2026-08-05 mkeshavaNV-departure scrub fanned out to 22 shader-slang/slang issues in 25s; I received 1 webhook; 2 chains (#7672, #6578) were DROPPED AT BIRTH by orchestrator 429s and dispatched by me at 20:2xZ — RESUME to verify their verdicts land"
metadata:
  node_type: memory
  type: project
  originSessionId: 28c13999-0f66-44db-958c-f36d72509bee
---

# The 08-05 scrub was a 22-issue FAN-OUT. I received ONE webhook and my success on it masked two stranded chains.

**Source burst:** `jkiviluoto-nv` (MEMBER) posted the identical body — *"Mukund (mkeshavaNV) won't be
returning to this work for a while. Please scrub this issue and assess whether it is still relevant,
needs reassignment, or should be closed."* — on **22 slang issues in 25 seconds**
(18:40:15Z→18:40:40Z): **10181 9872 9736 9661 9004 8527 7672 7670 7462 7209 6607 6578 6572 6542 6540
6524 6520 6519 6518 6471 6434 4846**. I got **#6542 only**.

⛔**THIS IS THE SECOND FAN-OUT OF THE SAME ASK IN ONE DAY.** The slangpy one (6 issues, 18:41:25-32Z,
#844 structurally unrouted) is [[feedback_a_fanned_out_webhook_delivers_per_issue_verify_the_set]] —
**written from the slangpy incident, and it predicted this one exactly.** The rule fired because a peer
mentioned siblings; I would not have looked otherwise.

## Coverage measured 20:2xZ (`ncl sessions list --limit 10000`, exact thread match + GitHub reply count)

⛔**TWO CHAINS DROPPED AT BIRTH — orchestrator session took the webhook, died on 429 BEFORE dispatching,
so NO triager session ever existed:**

| issue | orch session | fate |
|---|---|---|
| **#7672** | `sess-1785955223061-13kbb2` | 429 @18:48Z + 19:08Z, **zero dispatch**, 1 session total |
| **#6578** | `sess-1785955230323-p261v4` | 429 @18:48Z + 19:08Z, **zero dispatch**, 1 session total |

⇒ **Dispatched by me 20:2xZ** on canonical threads (`gh-issue-shader-slang/slang-7672` / `-6578`),
after ~1h40m of nobody owning them. **`sessions=1` was the whole tell** — every healthy chain has 2
(orch + triager); a `1` means the dispatch never happened. ⭐⭐⭐**A count of sessions per chain is a
cheap, non-circular coverage probe — unlike anything inside a session, my own writes can't move it.**

**Others with no bot reply yet, but a live triager working them (do NOT re-dispatch):** #9872 (holding,
told to), #6607 (2 chains complete per its report), #6540 (self-redriven 19:13Z), #4846 (was
"idle — nothing owed", re-dispatched by a sibling 20:15Z). **#9736 already got a verdict 08-04**
(`cmt 5176126183`) — the new ask is a *fresh* inbound on a closed chain and re-opens it.

## Why the batch looked healthy

#6542 ran end-to-end (verdict `cmt 5196535395`, [[project_6542_nested_parameterblock_precompile_ice]]),
and a completed chain plus a born-orphan chain are **indistinguishable from inside the one that
worked.** ⭐⭐⭐**Success on the delivered member is the strongest false-coverage signal there is: it
supplies a vivid, true story about the batch being handled.** The 429 storm (18:48Z-20:10Z, ~25
sessions across slang+slangpy triagers) was the *cause*; the fan-out was the *amplifier*.

⚠️**A 429 that lands BEFORE dispatch is categorically worse than one after.** #6542's second 429
(20:08Z) cost nothing — work was done, artifact public. #7672's cost the entire chain, silently. **Same
error string, opposite consequence ⇒ when triaging a 429, ask WHERE IN THE CHAIN it landed, never just
whether one occurred.**

## RESUME triggers
- **#7672** (`Explore compute subdir`, 4 comments, milestone Q3 2025, label `cuda`) — verdict posted? It
  is an **explore/scoping task, not a bug**: warned the triager not to force it into the repro shape.
- ✅**#6578 ANSWERED** (cmts 5197101225 + 5197133805) ⇒ full record now at [[project_6578_dup_entrypoint_silent_exit0]]. Original dispatch note —
  **#6542's sibling from sweep #6521**, "duplicate entrypoint" cohort. Cluster argument transfers;
  **repro method does NOT** (gfx-unit-test = GPU, unrunnable here). Verdict must name that boundary.
- Any of the 22 acquiring a fresh substantive human comment.
- ⭐**If a third scrub fan-out appears: enumerate FIRST** — `gh api "search/issues?q=repo:<r>+commenter:<u>+updated:<date>"` then per-issue comment check. ⚠️The phrase search (`q=repo:...+"won't be returning"`) returned **0** — GitHub does not index comment bodies that way; **enumerate by commenter+date, never by phrase.**


---

# ⛔ THE RESCUE PRODUCED A DOUBLE-POST. Measured 20:4xZ — I was not the only orchestrator rescuing.

I dispatched #6578 at 20:25Z as "dropped at birth, no triager session ever existed." **True when
measured.** But another orchestrator rescued the same chain in the same window, and #6578 now carries
**two bot comments 3 minutes apart** under one identity:

| cmt | time | bytes | content |
|---|---|---|---|
| `5197101225` | 20:41:41Z | 5642 | sibling's full verdict (retitle+reassign; also applied `reproduced`+Type=Bug) |
| `5197133805` | 20:45:04Z | 3441 | my triager's **delta** — caught the collision by a pre-post drift check |

⭐⭐**The triager handled it correctly and better than I set it up to:** it re-read the last commenter
**immediately before posting**, saw 1→2 under itself, and published only the measured gap rather than a
second full verdict. That is the [[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]]
remedy working — but note **it fired on the triager's discipline, not on mine.** My dispatch never told
it a sibling might be rescuing the same issue, because I did not know.

⛔**BATCH CENSUS (the only probe that sees this) — 22 issues, count bot comments after 18:40Z:
2 doubles, #10181 (`5196891201` 6406B 20:19:39Z + `5196892695` 3168B 20:19:49Z, **10 SECONDS apart**,
independent verdicts) and #6578.** Per-chain hygiene is structurally blind to both: each session
correctly answered *"have I posted?"* = no.

⚠️**What my born-orphan probe could NOT tell me: WHY `sessions=1`.** A chain with one session might be
(a) never dispatched, or (b) *about to be* dispatched by another rescuer. **Both render identically.**
`sessions=1` remains a correct *detector* of missing coverage and is **not** a licence to dispatch
without checking for a concurrent rescuer. ⇒ **Before rescuing a stranded chain in a batch that other
orchestrators can see, re-read the issue's comments IMMEDIATELY before dispatching, and tell the
delegate a sibling may be racing it** so its pre-post drift check is armed deliberately rather than
by luck.

⚠️**#7672 came out clean** (0 bot comments, 2 sessions) — so my two rescues produced one collision and
one genuine recovery. The rescue was still right: 1h40m unowned beats a 3-minute-late delta. But
"my dispatch was correct" and "my dispatch caused no waste" are different claims and only the first
holds.

⭐**Verified the triager's source claims myself rather than relaying:** `slang-emit.cpp:3419-3421` is
`if (linkresult != SLANG_OK) { return SLANG_FAIL;` with **no `diagnose()`**; the validation path at
`:3431-3436` **does** `diagnose(Diagnostics::SpirvValidationFailed{})`; and
`grep -icE 'spirv.?link|link.?fail' source/slang/slang-diagnostics.lua` = **0** — no link-failure
diagnostic exists at all. The silent-exit-0 mechanism is real and is the more dangerous half of #6578.


---

# ⛔ MY OWN "#7672 clean / 0 bot comments" WENT FALSE 26 SECONDS BEFORE I PUBLISHED IT. 21:00Z.

I reported **"#7672 came out clean (0 bot comments)"** as the reassuring half of the double-post census.
A sibling posted the #7672 verdict (`5197243220`, **20:56:31Z**, 4340 B, `created==updated`) — my read
was at **20:57Z**, so **the claim was already false when written.** The peer caught it and held its own
post; it published a delta rather than a duplicate.

⇒ ⭐⭐⭐**THE CENSUS IS DRAINING WHILE YOU READ IT.** With ~20 sibling sessions live on one batch, a
per-issue count is a snapshot of a moving population. **A `0` means "not yet", never "never".** Any
coverage figure over a live fan-out carries an implicit *as-of* that decays in seconds — and mine
decayed inside the same minute.

**FULL RE-CENSUS 21:00Z (22 issues, bot comments after 18:40Z):** 20 issues at **1**, two at **2**
(#10181, #6578), **one at 0 (#9872)** ⇒ the batch is now fully answered except #9872. Compare my
20:2xZ reading: #7672 0→1, and several 0s filled in. **Every change was in the same direction (0→1)**,
which is why a stale census reads as *worse* than reality and invites redundant dispatch — the exact
error that produced the #6578 double.

⇒ ⭐⭐**Two rules, both learned the expensive way in one hour:**
1. **Re-check the artifact IMMEDIATELY before acting on a census figure**, not at report time. The gap
   between measuring and dispatching is where the duplicate is born.
2. **Never publish a coverage zero without a timestamp**, and treat "0 posted" as "no post *yet*".

## #9872 — the one real gap, and it is NOT like its cohort

Held on my instruction 19:43Z, silent since, `container_status: running`, no verdict. Released 21:01Z
after a pre-dispatch race check (`comments=1`, bot=0).

⭐**Verified on a SINGLE-SUBJECT fetch with a peer control, because this is precisely the field I once
got wrong via parallel-fetch bleed** ([[feedback_a_parallel_fetch_lets_a_fact_land_on_the_wrong_subject]]):
**#9872 assignee = `kaizhangNV`, author = `mkeshavaNV`** (control: #9736 alone → `mkeshavaNV`).
⇒ **The departing person is the REPORTER here, not the assignee** — so the reassignment framing that
fits the other 21 does **not** transfer. The live questions become "is the perf problem still real"
and "is there enough information to act without the reporter". Also: a **performance** issue has no
exit-255 to reproduce; "cannot assess as written, reporter unavailable" is a legitimate verdict and
must not be dressed up as a measurement.

⚠️**Note the near-inversion:** last time I met this field I asserted `kaizhangNV` for #9736 when it was
#9872's — **the same two issue numbers, the same field.** This time the value is genuinely #9872's and
the per-subject re-read is what makes it assertable.


---

# ⛔ THIRD DECAY, ON THE ISSUE WHERE I HAD JUST WRITTEN THE RULE. 21:0xZ.

I ran a **pre-dispatch race check** on #9872 at **21:01:05Z** — `comments=1`, `bot=0` — released the
hold, and told the triager to re-check before posting. A sibling posted the #9872 verdict
(`5197300384`, 4794 B) at **21:01:33Z**: **28 seconds after my check.** I then told the triager to
stand down to a delta or to nothing.

**Three decays in one hour, all mine, all in the same direction (0→1):**
| claim | measured | went false | gap |
|---|---|---|---|
| "#6578 dropped at birth, dispatch it" | 20:25Z | sibling rescuing concurrently | → duplicate post |
| "#7672 came out clean, 0 bot comments" | 20:57Z | sibling posted 20:56:31Z | **−26 s (already false)** |
| "#9872 bot=0, clear to work" | 21:01:05Z | sibling posted 21:01:33Z | **+28 s** |

⇒ ⭐⭐⭐**A PRE-ACTION CHECK NARROWS THE WINDOW; IT DOES NOT CLOSE IT.** I invented the race check to
fix the #6578 duplicate, then the very next use of it failed the same way — [[feedback_a_remedy_that_can_reproduce_its_own_bug]]
in its purest form. **The durable defence is not a fresher read; it is the DELEGATE's pre-post drift
check plus a standing willingness to downgrade to a delta or to silence.** Verification belongs at the
moment of *writing*, which only the writer holds — a parent's clearance is stale by construction.

⛔**And the batch outcome inverts my framing entirely: 21/22 issues were answered by siblings I never
dispatched.** My contribution was #6542 (the one delivered webhook) and one clean rescue (#7672 —
which a sibling then answered anyway). ⇒ ⭐⭐**I was not the coverage mechanism for this batch; I was
one of ~20 concurrent ones. Every "gap" I found was a gap in MY VIEW, not in the fleet's coverage** —
and dispatching into another rescuer's window cost a duplicate public comment. **Before rescuing on a
batch other orchestrators can see, the question is not "is this uncovered?" but "am I the one who
should cover it?"**

⭐**A void cell that contradicts a peer's confirmed result — the peer's discipline, worth keeping:** its
Release slangc gave exit 255 / dup-message 0 against my Release exit 0. It controlled instead of
publishing: stderr showed `E00100 failed to load 'spirv-opt'` + missing `slang-glslang`, and **the same
binary failed identically on a plain shader with no embedded IR** ⇒ nothing to do with #6578. ⇒ **A cell
that contradicts an already-confirmed peer result is the LAST to publish and the FIRST to control.**

⛔**MY "MIRROR IMAGE" CLAIM WAS WRONG — I retracted it after measuring with a control.** I said its
Release lacks the lib while "MINE HAS IT and my Debug/lib does NOT", i.e. two symmetric half-built
trees. **Measured:** my `build/Release/lib` = 12 entries incl. `libslang-glslang-0.0.0.so`; my
`build/Debug/lib` = **0 entries**, and `build/Debug/bin` = **0** ⇒ **I have no Debug build at all.**
Not a mirror — one built config vs one absent one. ⭐**I inferred a symmetric structure from a single
`grep -i glslang` returning nothing for Debug, without asking WHY it was empty. "Absent lib" and
"absent build" are the same grep output and different facts** — the entry count is the control that
separates them, and I published before running it (the peer made the same class of error from the
`E00100` text and caught itself the same way).

⭐**Second axis the peer found, VERIFIED at source:** the lookup name is versioned —
`slang-glslang-compiler.cpp:554` `String("slang-glslang-") + SLANG_VERSION_NUMERIC` (Windows arm at
`:552` is unversioned). Its error wanted `slang-glslang-2026.13.1`; **my stamp is `0.0.0`**
(`build/Release/include/slang-tag-version.h:2`), and I have **0** `2026.13.1` artifacts anywhere. Root
cause of my `0.0.0`: **the clone is SHALLOW** (`is-shallow-repository: true`) so `git describe --tags`
fails (`No tags can describe b0e43d657`) despite 644 tags present ⇒ the build stamps a fallback. ⇒
**Two independent env axes (which config is built; which version is baked into the .so name), so a
downstream-compiler-loading divergence between edges needs BOTH checked.** Sibling of
[[feedback_shallow_clone_makes_your_head_the_graft_root]] — shallowness leaking into a build artifact,
not just into history queries.
Byte-count differences (29942/552 vs 30077/644) were shader + config, not conflict: **match a number to
its shader AND build config, never to its value.**


---

# ⛔ THE DOUBLE-POST COUNT IS ITSELF A DRAINING CENSUS: 2 → 3 → 5. Measured 21:31Z.

I published **"2 doubles in 22"** (#10181, #6578) at ~21:0xZ. A sibling's terminal memo
(`project_slang_scrub_batch_22_closed`) published **"3 issues carry two bot comments"**. **Re-measured
21:31Z: FIVE** — #10181, #9872, #9736, #7672, #6578.

```
#9872  5197300384 21:01:33Z + 5197469550 21:18:46Z   ← 2nd landed 17 min after my census
#9736  5197271885 20:59:00Z + 5197353299 21:06:25Z
#7672  5197243220 20:56:31Z + 5197417526 21:12:58Z   ← the delta I told the peer was correct to post
```

⇒ ⭐⭐⭐**Neither of us was wrong; both of us were STALE. Two honest observers of the same live system
published different totals minutes apart, and a third value was true by the time I reconciled them.**
The instinct on seeing 2-vs-3 is *"one of us miscounted"* — that framing is itself the error. **Check
the clock before checking the arithmetic.** ⚠️This is the fourth decay of the day and the first where
the disagreeing party was *another observer* rather than my own earlier self — the same mechanism wearing
a disguise that invites an accuracy dispute.

⇒ ⛔**A "TERMINAL"/closed-out memo about a live fan-out is a SNAPSHOT, not a terminal state.** The
sibling's row says `TERMINAL … 22/22 answered`; 21 minutes later three more comments had landed. **Any
count over a system with ~20 concurrent writers needs an as-of stamp, and "terminal" is a claim no
single session can make about a fleet-wide batch** — the same lesson as
[[feedback_last_active_tracks_inbound_not_agent_work]] one tier up: a per-session instrument cannot
measure a multi-session fact.

⚠️**And #7672's double is one I ENDORSED:** I told the peer its delta was correctly posted (it was —
measured gap, no duplication of content), which means **"2 comments exist" still does not equal "a
reader gets conflicting advice."** 5 doubles, and on the ones examined (#10181, #6578, #7672) the pairs
were complementary, not contradictory. ⇒ **Report doubles as a STRUCTURAL observation with a timestamp,
never as a defect count** — and do not chase reconciliation on pairs nobody has shown to conflict.
