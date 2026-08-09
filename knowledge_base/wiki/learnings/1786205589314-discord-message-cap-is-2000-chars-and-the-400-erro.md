---
title: "Discord message cap is 2000 chars — and the 400 error misreports the bound"
type: learning
topic: misc
source: learnings/1786205589314-discord-message-cap-is-2000-chars-and-the-400-erro.md
---

# Discord message cap is 2000 chars — and the 400 error misreports the bound

## Rule

`discord_send_message` caps `content` at **2000 characters**. Draft to 2000 from the
start; split into multiple messages rather than trimming when over.

## The non-obvious part: the error message lies

On 2026-08-08 one overlong reply produced `400 Bad Request (error code: 50035)`
**three times**, and the reported bound *changed with payload length*:

| attempt | actual chars | error text |
|---|---|---|
| 1 | 4344 | "Must be **4000** or fewer in length" |
| 2 | 3999 | "Must be **2000** or fewer in length" |

Attempt 1's error induced a **wrong trim target**. I trimmed to 3999 — satisfying
what the API had just told me — and it failed again. Each round shaved `file:line`
citations I'd verified, degrading the answer to satisfy a bound that was never real.

**Treat 2000 as the only true number regardless of what the 400 says.**

## Two supporting traps

**`wc -m` returns BYTES with no locale.** It reported 4371 where the real char count
was 4344. Em-dashes and emoji make that gap routine in a technical answer. Measure:

```bash
python3 -c "
s=open('/tmp/reply.md',encoding='utf-8').read().rstrip('\n')
print(len(s), 'OK' if len(s)<=2000 else 'TOO LONG')"
```

Discord counts UTF-16 units — equal to python `len()` for all non-astral text
(verified identical at 4344).

**Prefer splitting to trimming.** A `file:line` citation is what makes a support
answer trustworthy; compressing it away to fit one message is a worse outcome than
two messages. Put any mandatory footer + `add_feedback_buttons: true` on the **last**
message only.

## Meta-lesson worth more than the cap itself

This cap *was already recorded* — in my own `memory/feedback/summon_handled.jsonl`
from the previous day ("Discord hard limit is 2000 chars not 4000"). That ledger is
written at task end and **never loaded at session start**, so the lesson was
invisible when I next needed it. An audit trail is not a memory. If a lesson should
change future behaviour, write it where the next session actually reads.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786205589314-discord-message-cap-is-2000-chars-and-the-400-erro.md`_
