### Slack is the operator's surface

The operator reads and steers this port from Slack. Two destinations, both resolved from
`ncl destinations list --json` (`local_name` is the `to`) — never guess a name; one that does not
resolve means the dashboard chat alone, and you say so once.

**`harsh-slack-dm` — the operator console.** Every operator-facing line this spine already produces
goes there FIRST, then to the dashboard chat as before: the one-line merge notice (merge-gate.md
§ All green, step 5), a `blocked: P<n> — …` outcome (the same line you put in the ledger — the reply
on the architect's edge is unchanged and stays a chain message), autopilot alerts and escalations,
any decision-needed line (delegated-decisions.md), and the 6-hourly a | b | t | r summary. UNMARKED
plain text, one line each: a fresh send has no inbound to answer and the always-on chain-routing gate
denies a marker-prefixed send without `in_reply_to`. Telegram is a backup, not a second copy — post
there only when the Slack send fails. A DM arriving on `harsh-slack-dm` is the same operator console
as the dashboard chat; treat it exactly as you treat that chat.

**`hermes-port` (#hermes-port) — one thread per row, the swim lane.** The host-side mirror
`ops/nemoclaw-coworkers/slack-rows.py` (run by `refresh-viewers.sh`, cron every 15 min) creates and maintains
it from the same cards and ledger the rows board reads: the root `hermes-<ROW> · <name> · batch <b> ·
dispatched <date>` (its first segment is the row's chain thread id, verbatim), every role card PNG as a threaded reply (caption `<ROW> · <role> · <OUTCOME> —
<headline>`), then the `✅ merged` / `⛔ blocked` line. You post none of that yourself — no cards,
no roots, no merge lines to `hermes-port` (the mirror would double them) — and no marker-prefixed
chain message (`[Spec handoff]`, `[Test Report]`, `[Review Verdict]`, …) ever goes to Slack.

**A human message inside a `hermes-port` thread is an operator instruction about that row.** The
row ↔ thread map is `/workspace/shared/hermes/slack-threads.json` (read-only for you:
`rows.<ROW>.thread_ts`; the inbound's thread id ends in that `ts`). When nothing matches, read the row
id off the thread's root or card captions; still ambiguous → ask in the thread which row. Answer in
the same thread, briefly (one line: what you understood, what you will do), then act through the
normal chain — dispatch, nudge, ruling, ledger edit — never through Slack. Acting means the row's
own chain thread: every `send_message` you make for that row carries `thread_id: hermes-<ROW>` —
the thread its role sessions and dashboard lane already live in (row-sessions.md) — never the
Slack thread id, so a command from Slack and one from the dashboard land in the same sessions. Slack carries no chain
message and no evidence: a "ship it" in a thread starts the six merge-gate checks, never a shortcut.

**Format for Slack, every time.** Anything bound for Slack — a reply inside a Slack session, or a
send to `harsh-slack-dm` / `hermes-port` — is written in Slack mrkdwn exactly as the `slack-formatting`
skill specifies (invoke `/slack-formatting`, or read `~/.claude/skills/slack-formatting/SKILL.md`,
before composing): `*bold*` with single asterisks, `_italic_`, `•` bullets (no `1.` lists), links as
`<url|text>`, inline code and code blocks as usual; NO `#` headings, NO `**double asterisks**`, NO
`[text](url)`, NO tables (one line per item, or a code block for anything columnar), NO `---` rules.
The skill's own "folder starts with `slack_`" heuristic is the old single-channel install; here the
signal is the inbound's channel (`slack`) or the destination name. Short beats complete: a status is
a bold one-line headline plus at most a handful of bullets; anything longer is linked, not pasted.

**Never in Slack:** tokens or secrets of any kind, `.env` contents, hostnames or paths of other
machines (box paths, Mac paths, ssh/brev addresses), transcripts, pasted diffs or test-report tables.
Card PNGs and one-line statuses only; anything longer lives on the viewer or the dashboard and is
linked, not pasted.
