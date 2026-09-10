---
name: hermes-task-card
license: MIT
description: One 900x600 PNG task card (plus its HTML + JSON) per finished role task on the Hermes port — rendered by card.sh right AFTER the gated terminal marker send ([Spec handoff]/[Triage Resolution]/[Fix Report]/[Fix Review Request]/[Test Report]/[Review Verdict], or the Orchestrator's MERGED/BLOCKED/DISPATCHED row decision) is accepted, in the same turn, then attached with send_file as a reply to the same intake id under the caption "card · <ROW> · <role> · <OUTCOME> — <headline>". Triggers on "task card", "send the card", "/hermes-task-card", and automatically after every terminal marker send.
allowed-tools: Bash(bash:*), Bash(python3:*), Bash(agent-browser:*), Bash(mkdir:*), Bash(cp:*), Write, Read, mcp__nanoclaw__send_file
---

# /hermes-task-card — the one-screen card for a finished task

Every finished role task ends with a **gated marker send** (`mcp__nanoclaw__send_message`).
The card is the visual receipt for that send: one 900x600 PNG the human and the autopilot
supervisor can read in five seconds from the session flow, the swim lane, or the rows board.

## When (and the ordering rule)

1. Your terminal marker send is **accepted** — architect `[Spec handoff]` / `[Triage Resolution]`;
   builder `[Fix Report]` / `[Fix Review Request]`; tester `[Test Report] PASS|FAIL`; reviewer
   `[Review Verdict] APPROVE|REQUEST_CHANGES`; Orchestrator's row decision MERGED / BLOCKED / DISPATCHED.
2. **Then, in the same turn**, produce and send the card. Never before the marker send: the
   critique gate's `edits_since_critique` / attested-hash checks must not see card writes.
3. One card per marker send. No card for intermediate chatter, questions, or nudges.

## Outcome tokens (per role) and colour

| role | outcomes | colour |
|------|----------|--------|
| hermes-architect | HANDOFF · RESOLVED · BLOCKED | ok · ok · bad |
| hermes-builder | SHIPPED · FIXED · BLOCKED | ok · ok · bad |
| hermes-tester | PASS · FAIL · ESCALATE | ok · bad · run |
| hermes-reviewer | APPROVE · REQUEST_CHANGES | ok · bad |
| orchestrator | MERGED · BLOCKED · DISPATCHED | ok · bad · run |

`card.sh` rejects an outcome that is not in your role's row (exit 1). Fix the payload, not the table.

## Payload contract

Over-long strings are truncated with an ellipsis, never rejected. `row`, `role`, `outcome` are required.

```json
{"row": "LOOP-F35", "role": "hermes-tester", "outcome": "FAIL", "round": 2,
 "headline": "<=90 chars — the one sentence the human reads first",
 "what":     ["<=4 strings, <=90 chars each: what you did / changed"],
 "evidence": ["<=4 strings: PR/report/artifact refs, test rows, line numbers"],
 "next":     ["<=2 strings: who does what next"],
 "meta": {"elapsed": "2h04m", "cost": "n/a",
          "pr_url": "https://github.com/<org>/<repo>/pull/<n>",
          "report": "reports/hermes-LOOP-F35/test-report-e117c1c.md", "sha": "e117c1c"}}
```

- `row` = the gap-matrix row id (`LOOP-F35`); your thread id is `hermes-<ROW>` (`$NANOCLAW_SESSION_THREAD_ID`).
- `round` = the chain round you just closed (1 if unsure). It lands in the file name.
- **`cost` is always `"n/a"`** for roles: `cli_scope=group` denies `ncl cost-cap status`. Do not probe it.
- Example: `examples/tester-fail.json` in this skill dir.

## The exact three commands

```bash
# 1. Write the payload (Write tool) — the card dir is per thread:
#    /workspace/agent/reports/$NANOCLAW_SESSION_THREAD_ID/cards/payload.json
# 2. Render JSON + HTML + PNG (thread id defaults to $NANOCLAW_SESSION_THREAD_ID):
bash /home/node/.claude/skills/hermes-task-card/card.sh render \
  /workspace/agent/reports/$NANOCLAW_SESSION_THREAD_ID/cards/payload.json
# prints PNG=<path> and HTML=<path>; files: card-<role>-<outcome>-r<N>.{json,html,png}
#                                       + card-<role>-latest.{html,png}
```

3. Attach the PNG as a **reply to the same intake id** as your marker send, with the caption contract
   text exactly (the `card · ` prefix is what the supervisor detects; filenames are not visible):

```
mcp__nanoclaw__send_file(in_reply_to=<intake id>, path=<PNG path>,
  text="card · LOOP-F35 · hermes-tester · FAIL — T7 loop-detection row fails on e117c1c")
```

Optional flags: `--thread <id>` (when the env var is unset — otherwise exit 2),
`--out-dir <dir>` (default `/workspace/agent/reports/<thread-id>/cards/`).

## Fallback (exit 3)

The HTML and JSON are always written first. If `card.sh` exits 3 (chromium/agent-browser
failed, PNG missing, < 8 KB, or not 900x600 — its stderr echoes the browser output), send the
`.html` instead with the prefix **`card(html) · `** and say the PNG failed in the same message:

```
send_file(in_reply_to=<intake id>, path=<HTML path>,
  text="card(html) · LOOP-F35 · hermes-tester · FAIL — <headline> (PNG render failed)")
```

Do not retry the screenshot more than once. Do not hand-write HTML — the layout is frozen in
`render_card.py` + the vendored `render_status.py`.

## How it renders (for the curious, not for editing)

`render_card.py` maps the payload onto the vendored status renderer: title `<ROW> · <role>`,
subtitle `round N · <thread-id> · <sha or PR>`, the headline, exactly four cards — **Verdict**
(big outcome token + one coloured dot row), **What changed**, **Evidence**, **Next + meta**
(elapsed / cost / PR) — and pins the body to 900x600 with a role chip, row id and verdict badge
in the header. `card.sh` serves the out-dir over a loopback `python3 -m http.server` (no
`file://`), proxy env unset, each `agent-browser` call under `timeout 90`: open → set viewport
900 600 1 → wait --load networkidle → screenshot (no `--full`) → close; then checks the PNG's
IHDR with `struct`. `bash card.sh selftest` exercises validation, HTML, and the PNG checker.

## Inbound cards

Peers' `card-*.png` attachments arriving in your inbox are receipts for the human and the
supervisor — **ignore them**. Act on the marker text, never on a card.

## Exit codes

`0` PNG verified · `1` payload invalid (stderr says which field) · `2` no thread id · `3` PNG failed, HTML written.
