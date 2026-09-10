### Task card — one picture per finished task

Every terminal hand-off on a gap-matrix row gets a **card**: one 900x600 PNG (plus its HTML and JSON) that the dashboard renders inline in the session flow and in the row's swim lane, and that the rows board (`/rows/`, `/rows/<ROW>.html`) tiles per role. You produce it with `/hermes-task-card`; that skill carries the payload contract, the three commands and the fallback — never hand-roll a card or a screenshot.

**When: the same turn, right AFTER the marker send is accepted, never before it.** Marker send first so the card can never delay or displace the gated hand-off (and so the card's `in_reply_to` points at an already-answered intake); the card is a receipt for a send that happened, never a precondition. The order is fixed: gated marker send accepted → `Write` the payload JSON → `bash /home/node/.claude/skills/hermes-task-card/card.sh render <payload.json>` → `send_file(in_reply_to=<the SAME intake id the marker send answered>, path=<the .png>, text=<caption>)`. One card per marker send; none for `[Report]` status lines, nudge replies or unmarked forwards.

| Role | Card after this send | `outcome` |
|---|---|---|
| hermes-architect | `[Spec handoff] <req-id>: <title>` · `[Triage Resolution] <req-id>: <title>` | `HANDOFF` (spec handed off) · `RESOLVED` (`Outcome: fixed`) · `BLOCKED` |
| hermes-builder | `[Fix Report] …` · `[Fix Review Request] …` | `SHIPPED` (draft PR handed on, or the terminal report up) · `FIXED` (a new head answering a FAIL / REQUEST_CHANGES) · `BLOCKED` |
| hermes-tester | `[Test Report] <fork-slug>#<N> (round <k>/2, head <sha7>)` | `PASS` · `FAIL` · `ESCALATE` (cap exhausted, infra) |
| hermes-reviewer | `[Review Verdict] <fork-slug>#<N> (round <k>, head <sha7>)` | `APPROVE` · `REQUEST_CHANGES` |
| Orchestrator | the dispatch forward to hermes-architect · the merge notice · the `blocked: P<n>` reply | `DISPATCHED` · `MERGED` · `BLOCKED` — `in_reply_to` is the inbound you answered (the dispatch POST on `hermes-<ROW>`; the architect's `[Triage Resolution]`) |

**Caption — this exact shape, nothing else in `text`:** `card · <ROW> · <role> · <OUTCOME> — <headline>`. The `card · ` prefix is what the autopilot supervisor looks for (attachment filenames are not visible in transcripts); a card sent under any other caption reads as missing and earns a nudge. `<ROW>` is the gap-matrix id (`LOOP-F35`), `<role>` your group folder (`hermes-tester`, `orchestrator`), `<headline>` the payload's headline (≤ 90 chars, numbers over adjectives).

**Fallback.** `card.sh` writes the HTML before it screenshots. Exit 3 (no PNG, or not 900x600) → `send_file` the `.html` instead with the caption prefix `card(html) · ` and say in the same message that the PNG render failed. Exit 2 → no thread id was found; pass `--thread hermes-<ROW>`. Never skip the card because the picture failed; never retry the screenshot more than once.

**Cost and peers.** Roles write `"cost": "n/a"` — `cli_scope=group` denies `ncl cost-cap status`, so do not try; the Orchestrator fills it from `ncl cost-cap status --session <id>` when it has one. Inbound `card-*.png` attachments from peers carry nothing the text did not already say: ignore them, never open, forward or re-render one.

One caption per role, as they should read on a row:

```
card · LOOP-F35 · hermes-architect · HANDOFF — ADR + 4 AC (pytest 3 / live 1); surface register_tool, no CORE-CHANGE
card · LOOP-F35 · hermes-builder · SHIPPED — slang-coworkers/hermes-agent#12 draft, head e117c1c; doctor --ci OK, 9/9 tests
card · LOOP-F35 · hermes-tester · FAIL — round 2/2: AC-LOOP-F35-3 exit 1, T7 timeout; escalating to the Orchestrator
card · LOOP-F35 · hermes-reviewer · APPROVE — round 1, head e117c1c; 0 must-fix, 2 nits; Test Report PASS r2 audited
card · LOOP-F35 · orchestrator · MERGED — squash 0f12e89 into release/v2026.8.31-e2e-fixed; 4/4 AC; tester PASS r2, reviewer APPROVE r1
```
