---
name: feedback_a_negation_arm_reads_a_failed_probe_as_the_event
description: "A gate arm written as a NEGATION (\"last commenter is not the bot\") fires on a FAILED probe, because empty != expected. Measured: gate woke me with reason \"human_reply_\" — empty login, no such comment. The emitted string's missing suffix was the proof."
metadata:
  node_type: memory
  type: feedback
  originSessionId: d5953db7-c37f-41d6-9915-53abce38ba90
---

# ⛔ A NEGATION ARM CANNOT TELL "THE EVENT HAPPENED" FROM "MY PROBE DIED"

Measured 2026-08-10T12:00Z, my own gate script for shader-slang/slang#12440. It woke me with:

```json
{"reason":"human_reply_","issue_state":"OPEN","last_commenter":"","hours_since_verdict":15,...}
```

The instruction I was handed says a `human_reply_<login>` reason means *"a non-bot comment landed;
a substantive reply RE-OPENS the chain: forward it to slang-triager."* Issue 12440 had **exactly 1
comment** (nv-slang-bot, `2026-08-09T20:43:58Z`) and `updated_at` still `2026-08-09T20:44:58Z`.
**Nobody replied.** Had I acted on the reason string I would have dispatched a peer to read a
comment that does not exist, on a chain that is correctly parked.

## The defect, in one line of shell

```bash
last=$(gh issue view $N --repo $R --json comments --jq '[.comments[]]|last|.author.login' 2>/dev/null)
...
elif [ "$last" != "nv-slang-bot" ]; then wake=true; reason="human_reply_${last}"
```

`2>/dev/null` with no failure branch ⇒ a transient query failure sets `last=""`, and `"" !=
"nv-slang-bot"` is **true**. The arm is a negation, so *every* way of not-getting-the-bot — a real
human, an API blip, a `--jq` parse change, a renamed field — collapses into the one branch that
means "the human replied". Line 9 of the same script already treats a failed *state* probe as its
own outcome (`probe: gh_failed`); the comments probe was never given the same courtesy.

⭐⭐⭐ **THE EMITTED ROW CARRIED ITS OWN REFUTATION AND I ALMOST READ PAST IT.** The reason is built
as `"human_reply_${last}"`. A real reply produces `human_reply_jvepsalainen`. What arrived was
`human_reply_` with **nothing after the underscore** — so the payload itself proves the variable was
empty, i.e. that the probe returned nothing, i.e. that no login was ever read. ⇒ **When a gate hands
you an interpolated reason string, check whether the interpolation is EMPTY before believing the
prefix.** A truncated template is an instrument failure wearing an event's name.

## Coordinates matched, which is what made it diagnosable

The same fire reported `hours_since_verdict: 15`, which is **correct** — that figure comes from a
*different* call (`gh api repos/$R/issues/comments/$OURCMT`). So exactly one query failed, not `gh`
generally. Reproducing with a shim that fails only `*comments*` and passes everything else through
returned the observed row byte-for-byte:

```
OLD: {"wakeAgent":true,"data":{"reason":"human_reply_","issue_state":"OPEN","last_commenter":"","hours_since_verdict":0,...}}
```

⭐⭐ **A partially-correct payload localizes the break.** Had every field been zero/empty I would have
suspected a dead `gh` and a dead credential; because 15h survived, the aperture was narrowed to one
query in one arm. ⇒ **When a suspect row has some right figures and some empty ones, the right ones
are the discriminator — ask which call produced each.**

## The fix and its four controls

Read the **count and the login together**, require the login non-empty, and give a broken probe its
own non-waking outcome. Installed and verified `installed == tested` by sha256.

| control | shim | required | got |
|---|---|---|---|
| 1 · probe fails | fail `*comments*` only | `wakeAgent:false`, `probe:gh_failed_comments` | ✅ (OLD script: `human_reply_` ⇒ mechanism confirmed) |
| 2 · genuine reply | inject `ncmt=2`, login `jvepsalainen` | fires `human_reply_jvepsalainen` | ✅ |
| 3 · nonzero comments, empty login | `ncmt=1`, login `""` | must NOT fire | ✅ `probe:empty_login_on_nonzero_comments` |
| 4 · aperture blind to our own bot comment | `any(==bot)` ⇒ false | `CONTROL_VOID_COMMENTS` | ✅ |

⭐⭐⭐ **Control 2 is the one that keeps this a fix rather than a new blind spot.** Hardening a
false-positive arm is trivially "achieved" by making it never fire; only the injected *real* reply
proves the arm still has an aperture. **Every tightening of a trigger needs a positive control in the
same session, or you have traded a false wake for a missed event — and a missed event is silent.**

⭐⭐ Note the pre-existing `CONTROL_VOID` for the PR arm: the author (me) had already built
executable recall/must-miss controls for ARM B, and shipped ARM D with **no control at all**.
⇒ **Controls do not generalize across arms of the same script. Per-arm, or absent.**

## Trigger

Writing or reading *any* gate/watchdog arm of the form `[ "$x" != "<expected>" ]`, `if not seen`,
`grep -qv`, `!= HEAD`, `status != success`. Ask: **what does this arm do when the probe returns
nothing?** If the answer is "the same thing as when the event happened", it is not an arm, it is a
coin flip biased toward work. Give the failure its own branch and name it in the payload.

Related: [[feedback_exit_zero_empty_is_not_a_measured_zero]] (success-shaped emptiness),
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] (this very gate's reason for
existing), [[feedback_a_negative_control_must_vary_exactly_one_thing]],
[[feedback_watchdog_ncl_tasks_list_empty_not_a_freeze]] (a byte-identical row meaning two states),
[[project_12440_getstringhash_nonliteral_crash]].
