---
name: feedback_last_active_tracks_inbound_not_agent_work
description: "`ncl sessions get` last_active advances on HOST INBOUND deliveries, not on agent work or outbound rows — so your own nudge refreshes it (circular), and a 20-min build looks byte-identical to a dead session; plus: an error-grep over a fixed-size message tail fires forever once a stale error row is in the window"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 28c13999-0f66-44db-958c-f36d72509bee
---

# ⛔ `last_active` IS NOT A LIVENESS SIGNAL — it tracks INBOUND delivery. MEASURED 2026-08-05, slang#6542.

I armed a `Monitor` to catch a second silent death on a triager session after a 429. It fired
**`STALLED … no activity for ~6min`**. Both of its liveness predicates were wrong *by construction*.

**Observation 1 — the 429 outbound did NOT advance `last_active`; my inbound DID.**

```
19:11  container writes seq 5 (out): "API Error … 429"
19:12  ncl sessions get → last_active 18:42     ← the 19:11 outbound did NOT move it
19:13  I send a nudge      → seq 4 (in)
19:22  ncl sessions get → last_active 19:13     ← MY OWN message moved it
19:25  ncl sessions get → last_active 19:13, container_status running
```

⇒ ⭐⭐⭐**`last_active` answers "when did the host last deliver INTO this session", never "when did the
agent last do anything."** Two consequences, both severe:

- **It is CIRCULAR as a health probe.** Nudging a session to check on it *refreshes the very field
  you would read to judge it*. A dead session I just messaged looks freshly active.
- **A long tool call is INVISIBLE.** An agent 12 min into a 20-min `slangc` build writes no message
  rows, so `last_active` sits frozen at the last inbound — **byte-identical to a container that
  picked up nothing.** This is the [[feedback_watchdog_ncl_tasks_list_empty_not_a_freeze]] shape
  again: a row that cannot say *"I am working."*

**Observation 2 — an error-grep over a FIXED-SIZE tail window latches ON FOREVER.**
My predicate was `ncl sessions messages --limit 3 | grep -ciE '429|error|rejected'`. The 429 at
seq 5 is *historic* — already redriven — but it stays inside the last-3 window until three new rows
push it out. So the guard re-reported a failure I had **already handled**, every tick, and would have
kept doing so. ⇒ ⭐⭐**A tail window is not a time window. Gate on `seq > <the seq you already saw>`,
or on a timestamp newer than your intervention — never on "an error appears in the last N rows."**

⛔**What "no new messages" actually licenses:** nothing about the agent. It is the *absence of a
report*, and per [[feedback_in_session_monitors_dont_survive_teardown]] correction 2, absence of a
report is evidence about NOTIFICATION ONLY.

## How to apply

- **Never build a stall predicate on `last_active`.** For "is this agent working?", the honest answer
  from `ncl` alone is *unknown*; `container_status: running` is necessary, not sufficient (it was
  `running` at the moment of the 429 too).
- **Discriminate with a NEW row, not a stale one:** record max seq at arm time, then alert only on
  `seq > max_at_arm`. A monitor that cannot distinguish "the failure I already fixed" from "a new
  failure" is worse than none — it manufactures redrives.
- **Give slow work a floor before calling it stalled.** A Slang build is 5–20+ min; a 6-min quiet
  threshold cannot separate building from dead. Set the timeout from the *work's* duration.
- **Prefer the external artifact as ground truth.** On #6542 the only non-circular signal was the
  GitHub comment count (`gh api …/issues/6542 --jq '.comments'`) — it moves only when real work
  lands, and no probe of mine can perturb it. ⭐**Watch the deliverable, not the worker.**

⚠️**EVIDENCE BASE: one incident (08-05), but two independent clean observations inside it** (outbound
did not advance the field; inbound did). Per the replication rule, that guards against measurement
error only — the *mechanism* (last_active is written on host delivery) is readable and should hold,
the generalization to every `ncl` deployment is unmeasured. Re-derive when it next fires.

---

# ⛔ THE FIX FAILED ON ITS FIRST USE — SAME CIRCULARITY, RELOCATED. Measured 2026-08-05, ~15 min later.

Above I replaced the `last_active` gate with **`seq > max-at-arm`** and called it the remedy. It fired
in **1 minute**, on **my own message**:

```
seq 5  out  19:11   "API Error … 429"          ← ARM_SEQ=5
seq 6  in   19:27   <my status report>         ← MY OWN write tripped "NEW ROW from triager"
```

⇒ ⭐⭐⭐**I moved the circularity from one field to another instead of removing it.** `last_active`
advanced on my inbound; `max(seq)` advances on my inbound too — **because `seq` counts BOTH
directions.** The label on my alert even said *"NEW ROW **from triager**"* while the row was
`direction=in`, i.e. from *me*. **The predicate never mentioned direction, so the alert's own wording
asserted a provenance it had not checked.**

⛔**The generalized defect: ANY probe over a channel I also WRITE TO is self-perturbing.** The cure is
not a different field — it is **filtering to rows the other party could have authored**
(`grep -E '^[0-9]+ +out'`) or watching an artifact **outside** the channel entirely (the GitHub
comment count). ⭐⭐**Ask of every health probe: "can my own action move this number?" If yes, it
cannot measure the other party.**

⚠️**Second, smaller defect in the same script: the alert body was EMPTY.** My detail-grep selected
`out` rows, but the tripping row was `in`, so it matched nothing — producing a bare headline
`NEW ROW from triager (seq 6 > 5) after 1min:` with no content. ⇒ **A confident headline with an empty
body is the report shape to distrust most: the summary line is hand-written and always renders, while
the evidence line is computed and can silently come back blank.** Print the row you actually matched,
and if the body is empty, say *"matched 0 rows"* rather than emitting the headline alone.

⚠️**Third: an `echo` diagnostic is indistinguishable from an event.** My `armed: seq>5, comments=1 …`
line was stdout, so it arrived as a notification identical in shape to a real alert. **Send arming and
progress diagnostics to stderr; stdout is the event stream, reserved for things worth waking for.**

⇒ **EVIDENCE BASE now 3 clean observations of ONE mechanism** (inbound moves `last_active`; inbound
moves `seq`; a tail window retains a handled error). Per the replication rule these are not three
cases of a general law — they are one law (*a channel I write to cannot measure its other end*) seen
from three angles, which is exactly the kind of structural, readable mechanism that licenses more than
a single anecdote. The **frequency** across other instruments remains unmeasured.

---

# ⛔ 4th ANGLE, 5 HOURS LATER — I READ A THROTTLED-BUT-HEALTHY FLEET AS STALLED, TWICE. Measured 2026-08-05 19:44–20:12.

jkiviluoto-nv posted an identical *"scrub this issue…"* comment on **22 slang issues in ~1 minute**,
waking 22 chains at once. That saturated the provider: **17 of 25 sampled triager sessions carried
`API Error: Request rejected (429)`**. My two readings, both from session-level instruments, both wrong:

1. ⛔**"The burst self-clears."** A *second* 429 landed 29 min later (19:08 → 19:37 redrive backoff) —
   the host was retrying **and failing**, not draining.
2. ⛔**"Not draining / the fleet is stalled."** Inferred from **session mint counts per 10-min bucket**
   (71 → 8 → 14 → 23). That metric counts **inbound webhook arrivals** — a fact about jkiviluoto's
   comment fan-out, *not* about whether any scrub completed. Same defect as `last_active`: I measured
   traffic into the system and called it progress by the system.

**The deliverable told the true story.** Counting posted `nv-slang-bot[bot]` comments across the 22
issues: **9 answered by 19:44, 12 by 20:12, mean ~6.2 min/reply, zero idle gap.** The fleet was
completing steadily *the entire time every session-level signal read dead*, because a 429'd turn is
retried and the next attempt succeeds — **the error row persists in the session while the work moves
on.** ⭐⭐⭐**A 429 row records that one ATTEMPT failed, never that the WORK failed.**

⭐⭐**The right instrument, and it is outside the messaging system entirely:**
`gh api repos/<o>/<r>/issues/comments?since=<T>` filtered to the bot login, sorted by `created_at`.
No probe, nudge, or status check of mine can move it — which is exactly the property `last_active`
lacks. **Deadline from observed throughput, and alert on BOTH terminal states** (complete *and*
still-incomplete-at-deadline); a watcher that only fires on success is silent through a stall.

⛔⭐⭐⭐**5th ANGLE, 20:35Z — THE DELIVERABLE PROBE ITSELF BECAME THE PERTURBATION, and it failed CLOSED.**
Having correctly switched to the posted comment as ground truth, I then ran ~6 census sweeps × 22 issues
(~130+ `gh api` calls) **and armed a Monitor polling 10 of them every 7 min.** The census then flipped
from a steady `16/22 answered` to **`0/22` in one sweep.** Nothing regressed — **I had exhausted the
installation's GitHub API rate limit**, and:

```
gh api ".../issues/6434/comments"                        → {"message":"API rate limit exceeded ..."}  EXIT 0
  | jq 'sort_by(.created_at)|last|.user.login'  2>/dev/null   → jq EXIT 5, stderr SWALLOWED, stdout EMPTY
  → last="" → [ "" != "nv-slang-bot[bot]" ] true → scored UNANSWERED
```

⚠️**CORRECTED MECHANISM (I first wrote "jq on an error object yields null" — that is FALSE and a peer
refuted it offline at zero quota cost; I then reproduced their refutation against my own code).** jq
does **not** silently yield null: it **errors with exit 5** (`Cannot index string with string
"created_at"`). The real failure is **my `2>/dev/null` swallowing that error while the exit code went
unchecked**, leaving the variable **empty** — and an empty string compares unequal to the bot login, so
the issue fails **closed** to "no reply posted." ⭐⭐**Two very different defects with an identical
outcome; recording the wrong one would have taught a fix that doesn't apply** (guarding for `null`
catches nothing here — the value is `""`). ⇒ **When you publish a mechanism, run it: `jq <predicate>
synthetic_error.json` is free and offline.**

**`gh api` EXITS 0 on a rate-limit error body**, so `2>/dev/null || echo 0` catches nothing and every
issue fails closed to "no reply posted." Caught only by a **positive control on a known-answered issue**
(#6434), which returned the error body instead of the bot login. ⇒ **A 22-of-22 reversal in three minutes
is physically impossible for posted comments — an impossible-MAGNITUDE flip is an instrument failure,
never a finding.**

⭐⭐⭐**AND THE LUCK WAS IN THE MAGNITUDE, NOT THE CATCH** (the peer's sharpening, and it is the most
useful sentence here): `0 of 22` is *physically impossible*, which is why it survived six uncontrolled
sweeps and still got caught. **A merely PLAUSIBLE wrong number — `12 of 22` — would have shipped
silently and become the stall signal.** ⇒ A control is not insurance against implausible failures; it
is the *only* defense against plausible ones. Never conclude "my instrument is fine, I'd have noticed" —
you notice absurdity, not error.

**Fix, validated both directions offline:** `jq -e 'type=="array"'` fails on the error body and passes
on a real payload ⇒ assert shape and **abort the sweep**, never score it. I stopped the Monitor: it shared the exhausted quota and would have fired
`SCRUB PROGRESS at deadline — 10 of 22 unanswered` as a confident false stall.

⭐⭐⭐**"My probing cannot move this number" was true of the VALUE and false of the READABILITY.** A
non-perturbing surface stops being one once your polling cost is the perturbation. **Rules:** (1) every
sweep carries a **positive control on a known-good member** — six of mine had none; (2) **assert the
response SHAPE** (payload is an array) and abort rather than score, for any CLI that exits 0 on HTTP
errors; (3) **budget the probe** — one `issues/comments?since=` call covers all 22, versus 22 per-issue
calls; (4) **a watcher sharing a quota with the work it watches can starve the work.**

### ⛔⭐⭐⭐ I REPRODUCED THIS EXACT FAILURE THE SAME DAY, WITH THIS FILE ALREADY READ (20:36Z)

**Same installation ID (`122982130`), same exit-0-on-403, same batch.** Reconciling the 18-issue scrub I
ran **~40 per-issue `gh api …/comments` calls across five sweeps** (18 + 7 + 6 + 18 + spot checks) —
precisely the budget defect rule (3) forbids — and exhausted the quota again. The peer hit it first and
its loop printed **`covered: 0 / 18`**: the 403 JSON fed `[ "$b" -gt 0 ]` → `integer expression
expected` → every issue scored uncovered. Against a **15/18** truth.

⛔**Rule (3) existed, in a file loaded at session start, and I violated it while USING rules (1) and
(2) from the same list.** I carried controls and checked shapes; I did not budget. ⇒ ⭐⭐⭐**A
multi-part rule fails part-wise: satisfying the memorable parts (controls, shape-asserts) creates the
felt sense of having complied, and the unglamorous part — call budget — is the one that bites.** When a
rule has N clauses, check them by *enumeration*, not by recalling whether you were careful.

✅**One collection call, not N:** `gh api "repos/<o>/<r>/issues/comments?since=<ts>&per_page=100"
--paginate` returns every comment on the repo since a timestamp — one paginated request covers an
entire batch, and each item's `issue_url` gives the issue number. Per-issue loops are for ≤3 issues.

⚠️**And a second, INDEPENDENT limit was live at the same moment** — the model-API 429 wave (cleared
20:08) versus this GitHub App REST quota (live 20:36). ⭐⭐**Two edges, neither informative about the
other**: `gh` green says nothing about model quota, and model-clear says nothing about `gh`. I declared
"the wave has cleared" at 20:15 and dispatched writes that would have 403'd, because I had checked the
edge that recovered rather than the edge the *write* traverses. ⇒ **Name the resource a queued action
consumes, and probe THAT one — per-path (`gh api -i … | grep -i x-ratelimit`), single call, never a
poll loop.**

⛔**A 403'd write is the worst outcome available here:** it leaves work done-and-undelivered, the third
state in [[feedback_a_batch_census_needs_the_owner_column_not_the_reply_column]] that is invisible from
both the owner and reply columns — so attempting a post under a live limit doesn't fail loudly, it
manufactures the exact silent gap you were trying to close.
⚠️`gh api rate_limit` itself returned `app_not_connected` / **HTTP 401** here, so the limit was
undiagnosable directly — do **not** read that as the credential outage of
[[project_github_actions_graphql_401_outage]]; different endpoint's auth path, and the comment reads had
worked seconds earlier.

#### ⛔⭐⭐⭐ CORRECTION TO MY OWN "gh api EXITS 0 ON A 403" — the exit code is 1; STDOUT is the defect

**I broadcast "exit 0 on HTTP error" to two peers and a dashboard escalation. It is WRONG. Measured
unpiped, 20:40Z:**

```
gh api …/issues/999999999/comments --jq 'length'
  exit=1  stdout={"message":"Not Found",…,"status":"404"}  stderr=gh: Not Found (HTTP 404)
gh api …/issues/999999999/comments            # bare form
  exit=1  stdout=<125 B error JSON>                        stderr=gh: Not Found (HTTP 404)
```

**`gh` exits 1 on HTTP errors in BOTH forms.** My "EXIT 0" came from a **pipeline** — I ran
`gh api … | head` and read `$?`, which reports **`head`**. Reproduced: `false | head -1; echo $?` → **0**;
`PIPESTATUS` → `1 0`. ⇒ ⭐⭐⭐**`$?` after a pipeline measures the LAST stage, so any exit-code claim about
a piped command is really a claim about the pipe's tail.** Use `PIPESTATUS[0]`, `set -o pipefail`, or
redirect to a file and test the bare command.

⭐⭐**The real mechanism survives the correction:** with `--jq`, `gh` writes the error JSON to **stdout**
as well as a message to stderr. So `b=$(gh api … --jq 'length')` captures `{"message":"Not Found",…}`
into `$b`, and `[ "$b" -gt 0 ]` throws `integer expression expected` — or silently scores 0 inside a `||`
chain. **The poison is the stdout payload, not the exit status** — which is why the peer's loop printed
`covered: 0/18` while the exit code was non-zero throughout.

✅**The peer's guard is correct and needs no answer to the exit-code question: validate the VALUE SHAPE,
not `$?`** — require `^[0-9]+$` before arithmetic; anything else is **VOID**, never 0. Holds under either
semantics. ⇒ ⭐⭐**Guard the thing your logic CONSUMES, not the status you infer it from.**

⚠️**Provenance — the peer caught this by refusing to adopt my framing.** Its two failing cells disagreed
(one error to stdout, one to stderr) and it said so rather than confirming; it also correctly discounted
its own later `EXIT CODE = 0` cell because the limit had cleared by then, so that cell measured a
*success*. ⭐⭐⭐**A cell run under different conditions cannot confirm the claim even when its number
matches.** ⇒ ⭐⭐**Publishing a mechanism to peers is precisely when to re-derive it** — I had it in two
messages and an escalation before ever testing it without a pipe.

⚠️**Enumerate the fan-out from source and dedupe on the REQUEST BODY, not search metadata.**
`search/issues?q=commenter:<user>+updated:<date>` returned **25** candidates; only **22** carried the
actual scrub comment (`.body|test("scrub this issue")`). The 3 extras (#11754, #12363, +1) matched on
assignee/update activity and had **no comment from that user at all** — filing them as dropped work
would have manufactured a phantom incident. ⭐⭐**A search-API hit is a claim about indexed metadata,
never about the content you care about.**

⛔**ESCALATION RULE: a 429 is THROTTLING, not a credential fault** — not the 401/403 shape that means
"operator must re-auth" ([[project_github_actions_graphql_401_outage]]). **Never escalate a 429 as an
outage.** Escalate only when the *deliverable* stops advancing, which requires measuring the
deliverable. And I was a **contributor** to the saturation — 35 of the 61 sessions minted in one
window were mine — so check your own fan-out rate before blaming the provider
([[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]], [[feedback_a_fanned_out_webhook_delivers_per_issue_verify_the_set]]).
