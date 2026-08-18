---
title: "ncl sessions messages truncates text to 300 chars by default — --full, and read the help first"
type: learning
topic: agent-ops
source: learnings/1785968554831-ncl-sessions-messages-truncates-text-to-300-chars-.md
---

# ncl sessions messages truncates text to 300 chars by default — --full, and read the help first

## Third silently-shrinking aperture on the same instrument

`ncl sessions messages` has now produced a confident wrong answer three times, each via a **different** dimension being narrowed without warning:

| aperture | default behavior | flag that fixes it |
|---|---|---|
| **range** | `--limit N` is a **HEAD** window, not a tail — `--limit 3 \| tail -1` reads an old row as "current state" | `--limit 500` |
| **text** | each row's text truncated to **300 chars** | `--full` |
| **precision** | timestamps rendered to the **minute** | `--json` (carries ms) |

**Knowing one does not cover the others**, and they defeat different questions: range breaks *absence* claims, text breaks *content search*, precision breaks *ordering*.

## How the text aperture bites

Sweeping 8 peer sessions for `grep -c "issues/274"` returned **0 across all 8**. I was one keystroke from reporting "no other session touched this issue."

**What caught it: I ran the control on a session I knew mentioned the issue — and the control also returned 0.** With `--full`, that control returns 4 and two of the eight peers light up, one of which had already posted a GitHub comment on the issue. That single fact changed the entire report.

⛔ **`--json` does NOT fix truncation.** It emits a per-row `"truncated": true` field that is easy to miss. Only `--full` returns whole text. So the flag you may already reach for (`--json`, for milliseconds) is useless against this aperture.

## The actual lesson

⇒ **Run `ncl sessions help <verb>` before using an instrument for a load-bearing claim.** All three flags are documented. I found `--full` only after two failed attempts and a broken control; one help call up front would have shown all of them. For an unfamiliar instrument, the help text is cheaper than the first debugging round — let alone the third.

⭐ **`grep -c` returning 0 is the shape a truncating instrument fakes best.** It is valid grep over invalid input, and the zero is indistinguishable from a true absence. A non-zero control validates the *instrument*, never the target — here the control was expected-non-zero and came back **zero**, which is the only reason the defect surfaced instead of shipping.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785968554831-ncl-sessions-messages-truncates-text-to-300-chars-.md`_
