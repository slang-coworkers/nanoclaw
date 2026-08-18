---
title: "critique gate denial counter never persists so escalation cap is dead code when state dir missing"
type: learning
topic: agent-ops
source: learnings/1785820482825-critique-gate-denial-counter-never-persists-so-esc.md
---

# critique gate denial counter never persists so escalation cap is dead code when state dir missing

## Symptom

On an edge where `/workspace/.claude/` does not exist, `gate-critique-on-deliver.sh`
denies a gated operation **forever**: no escalation card is ever filed, the
3-denial soft-fail never fires, and the timeout backstop never arms. From the
agent's side it looks like a normal repeated denial, so it reads as "the gate is
working", not "the anti-wedge machinery is unreachable".

Live stderr that names it (from a real `PreToolUse` denial, not a simulation):

```
line 272: /workspace/.claude/workflow-state.json.tmp: No such file or directory
CRITIQUE REQUIRED before PR creation.
Reason: missing critique stages: DECISION_REVIEW, OUTPUT_REVIEW.
```

## Root cause

`gate-critique-on-deliver.sh` is the **only** state-touching hook that does not
create its state directory. Measured:

| hook | `mkdir -p "$(dirname "$STATE")"` |
|---|---|
| `gate-critique-on-deliver.sh` | **0** |
| `track-critique.sh` | 1 (`:42`) |
| `track-edits.sh` | 1 (`:56`) |
| `workflow-state-reset.sh` | 1 (`:30`) |

So at `:272`:

```bash
jq '.critique_gate_denials = ((.critique_gate_denials // 0) + 1)' "$STATE" > "$STATE.tmp" 2>/dev/null && mv ... || true
```

the redirect fails because the parent dir is absent, and the trailing `|| true`
**masks** it. `critique_gate_denials` stays `0`, so `:208`'s
`[ "$DENIALS" -ge 3 ]` is never true and all three anti-wedge exits at `:208-270`
(admin-bypass card, `CRITIQUE_ESCALATION=0` soft-fail, escalation timeout) are
**dead code**. The dir is created by whichever *other* hook runs first, so
presence is ordering-dependent and transient.

## How to catch it

Re-run the production hook against temp paths — do not reason about it from the
source. Control that isolates the missing `mkdir` from the escalation logic:

```bash
TD=$(mktemp -d); mkdir -p "$TD/o" "$TD/s"
cp /workspace/agent/.critique-delivery-markers /workspace/agent/.critique-required-stages "$TD/o/"
jq -n '{}' > "$TD/s/ws.json"
for i in 1 2 3 4; do
  CRITIQUE_GATE_ACTIVE=1 CRITIQUE_REQUIRED_STAGES='["DECISION_REVIEW","OUTPUT_REVIEW"]' \
  OVERLAY_MARKER_DIR="$TD/o" WORKFLOW_STATE_FILE="$TD/s/ws.json" \
  CRITIQUE_ESCALATION_FILE="$TD/s/esc.json" \
  bash /app/hooks/gate-critique-on-deliver.sh \
    <<< '{"tool_name":"mcp__nanoclaw__send_message","tool_input":{"text":"[Approval Decision] WOULD_APPROVE"}}' >/dev/null 2>&1
  echo "run$i denials=$(jq -r '.critique_gate_denials // 0' "$TD/s/ws.json") esc=$([ -f "$TD/s/esc.json" ] && echo YES || echo no)"
done
```

**Dir present** → `denials` climbs 1,2,3 and run3 writes `esc.json` (machinery
fine). **Dir absent** (`WORKFLOW_STATE_FILE=$TD/NOPE/ws.json`) → `denials`
stays 0 forever, no `esc.json`. That contrast is the proof; the difference is
solely the missing `mkdir`.

## Fix

One line, in `gate-critique-on-deliver.sh` next to `STATE=` (`:105`), matching
what the other three hooks already do:

```bash
mkdir -p "$(dirname "$STATE")"
```

Needs operator sign-off (it's a `/app/hooks/` file, not agent-writable).

## Two adjacent facts measured in the same session

- **Size the gate's blast radius from the ENV VAR, not the marker file.**
  `:33-37` gives host-injected `CRITIQUE_GATE_ACTIVE` **precedence** over
  `.overlay-critique-gate`, precisely so an agent can't `rm` its way out. An edge
  with the env var and no marker file **is gated** — counting marker files
  under-counts affected edges. Do not conclude "not gated" from the file alone.

- **The `pulls\b` pattern at `:52` matches read-only GETs, confirmed in
  production.** Two of my own `gh api repos/<org>/<repo>/pulls/<n>` **read** calls
  were denied by the live hook; `issues/<n>/comments` and a marker-less
  `send_message` passed as controls. It cannot be narrowed locally: a coworker's
  `.critique-delivery-markers` is **additive only** (`:57-58`) on top of the
  built-in floor, so `"bash_patterns": []` still inherits the broad match. The
  documented consequence is real — a **read-only join check on an already-merged
  PR can generate an admin approval card** on a chain where nothing was ever
  posted.

- **The ABSTAIN fast-path (`:98-103`) exits 0 with zero critique stages
  recorded**; the same message with `WOULD_APPROVE` exits 2. So an approver whose
  decisions are all ABSTAIN never exercises the message side of the gate — and
  therefore learns nothing about the Bash side. A gate that never fired on the
  surface you used tells you nothing about the surface you didn't.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785820482825-critique-gate-denial-counter-never-persists-so-esc.md`_
