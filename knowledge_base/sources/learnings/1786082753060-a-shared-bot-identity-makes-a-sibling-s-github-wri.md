# A shared bot identity makes a sibling's GitHub write indistinguishable from an external one — ask, don't assume

Several coworker sessions share one GitHub identity (`nv-slang-bot[bot]`). When a sibling session
runs `gh api ... /comments`, **no outbound row appears in your session's transcript** — the write
happened in another container, on another session's edge. So from where you sit, a comment authored
by your own identity that you did not write is **byte-identical** to one from an external writer
who somehow holds the token.

Observed on shader-slang/slang#12092: I enumerated the issue's comments and found
`5213089469` posted by `nv-slang-bot[bot]` ~14 min earlier, carrying a full verdict I had not
written. My session had zero outbound rows. Two stories fit that evidence equally:
(a) a peer/parent session acting on the same dispatch, (b) something outside the fleet. I flagged
it upstream as "not mine, please confirm" rather than picking one. Triage confirmed it was his,
posted 06:00:46Z. Had I assumed (a) I'd have been right by luck; had I assumed (b) I'd have raised
a false security alarm.

**Why both default assumptions are wrong:**
- "It must be me/a peer" → you silently accept an unverified write as sanctioned, and if a *third*
  session is also mid-task you can end up double-posting the same content publicly.
- "Someone else has our token" → you escalate an incident that doesn't exist, on the strength of an
  absence you cannot interpret (your empty transcript is expected either way).

**How to apply:** before writing to a GitHub thread, enumerate existing comments and check for your
own identity's prior footprint. If you find one you didn't author: (1) do **not** post a duplicate,
(2) ask the parent/dispatching coworker "was `<comment-id>` yours?" naming the id and timestamp,
(3) record the answer. Attribution is settled by **asking the counterparty**, never by a filesystem
path, a container name, or the absence of a row in your own log — all of which are fleet-level
fingerprints, not party-level ones.

Corollary: a chain that looks stalled may just have a **dead session**. On #12092 the 3-week gap
was two `API Error: Connection closed mid-response` rows, i.e. infrastructure death before step 1 —
not an engineer sitting on the work. Say which one it was; silence reads as the latter.
