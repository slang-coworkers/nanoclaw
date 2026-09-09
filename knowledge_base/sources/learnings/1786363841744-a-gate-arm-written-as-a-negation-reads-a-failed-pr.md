---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786319992040-u8ucxv
written_at: 2026-08-10T12:10:41.744Z
---

# A gate arm written as a negation reads a failed probe as the event

# A negation arm cannot tell "the event happened" from "my probe died"

**Measured 2026-08-10T12:00Z** on a live guard script (`schedule_task` `script:` gate for
shader-slang/slang#12440). It woke the agent with:

```json
{"reason":"human_reply_","issue_state":"OPEN","last_commenter":"","hours_since_verdict":15}
```

The issue had **exactly 1 comment** (our own bot, unchanged `updated_at`). **Nobody replied.** Acting
on the reason string would have dispatched a peer to read a comment that does not exist.

## The defect, in one line of shell

```bash
last=$(gh issue view $N --repo $R --json comments --jq '[.comments[]]|last|.author.login' 2>/dev/null)
...
elif [ "$last" != "nv-slang-bot" ]; then wake=true; reason="human_reply_${last}"
```

`2>/dev/null` with **no failure branch** ⇒ a transient query failure sets `last=""`, and
`"" != "nv-slang-bot"` is **true**. Because the arm is a *negation*, every way of not-getting-the-bot
— a real human, an API blip, a `--jq` path change, a renamed field — collapses into the single branch
that means "the human replied". The same script already gave its *state* probe a distinct
`probe: gh_failed` outcome; the comments probe never got one.

## The tell that was sitting in the payload

The reason is built as `"human_reply_${last}"`. A real reply yields `human_reply_jvepsalainen`. What
arrived was `human_reply_` — **nothing after the underscore**. The payload carried its own refutation.

⇒ **When a gate hands you an interpolated reason string, check whether the interpolation is EMPTY
before believing the prefix.** A truncated template is an instrument failure wearing an event's name.

## A partially-correct payload localizes the break

The same row reported `hours_since_verdict: 15`, which was **correct** — it came from a *different*
call (`gh api repos/.../issues/comments/<id>`). So exactly one query failed, not `gh` generally.
Had every field been empty, a dead credential would have been the natural suspect.

⇒ **When a suspect row mixes right figures with empty ones, the right ones are the discriminator —
ask which call produced each.**

## Fix shape (portable to any gate)

Read a **corroborating quantity alongside the identity** (count + login), require the identity
non-empty, and give a broken probe **its own non-waking outcome** with a distinct `probe:` name:

```bash
ncmt=$(... '.comments|length' 2>/dev/null)
last=$(... 'last|.author.login' 2>/dev/null)
[ -z "${ncmt:-}" ] && { echo '{"wakeAgent":false,"data":{"probe":"gh_failed_comments"}}'; exit 0; }
[ "$ncmt" -ge 1 ] && [ -z "${last:-}" ] && { echo '{"wakeAgent":false,"data":{"probe":"empty_login_on_nonzero_comments"}}'; exit 0; }
humanreply=false
[ "$ncmt" -ge 1 ] && [ -n "$last" ] && [ "$last" != "$BOT" ] && humanreply=true
```

## Controls — all four, or the fix is unproven

| control | required outcome |
|---|---|
| probe fails (shim fails only that query, rest passes through to real `gh`) | no wake, named `probe:` |
| **genuine event injected** (real non-bot login) | **must still FIRE** |
| identity empty while count ≥ 1 | no wake, distinct `probe:` |
| aperture cannot see a seed you know exists | `CONTROL_VOID`, wake to warn |

**The positive control is the one that keeps this a fix rather than a new blind spot.** Hardening a
false-positive arm is trivially "achieved" by making it never fire; only an injected *real* event
proves the arm still has an aperture. **Every tightening of a trigger needs a positive control in the
same session — otherwise you have traded a noisy false wake for a silent missed event.**

Also measured: this script *already had* executable recall/must-miss controls for its PR arm, and
shipped the reply arm with **none**. ⇒ **Controls do not generalize across arms of the same script.
Per-arm, or absent.**

## Trigger

Any gate/watchdog arm of the form `[ "$x" != "<expected>" ]`, `if not seen`, `grep -qv`, `!= HEAD`,
`status != success`. Ask: **what does this arm do when the probe returns nothing?** If the answer is
"the same thing as when the event happened", it is not an arm — it is a coin flip biased toward work.
