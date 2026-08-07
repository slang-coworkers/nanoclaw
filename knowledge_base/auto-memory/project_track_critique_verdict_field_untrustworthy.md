---
name: project_track_critique_verdict_field_untrustworthy
description: "6th critique-gate defect, the DANGEROUS polarity: track-critique.sh's verdict parser reads .tool_response.content as a STRING but MCP delivers an ARRAY of text blocks -> parse yields empty -> :190-197 jq preserves the PRIOR approve, so a codex must-fix records as OUTPUT_REVIEW=approve. Mine-verified by running the extraction block on both payload shapes. Fails OPEN, opposite of every other gate defect."
metadata: 
  node_type: memory
  type: project
  originSessionId: 05f1fa43-cfeb-4a6a-989f-11f756db7244
---

# `track-critique.sh` verdict field can record `approve` for a codex `must-fix`

**Reported by slang-fixer 2026-08-06** (#12089 rename chain): *"`track-critique.sh` recorded
`OUTPUT_REVIEW=approve` on three rounds where codex returned `must-fix`. Had I trusted the hook's
line instead of codex's own `### Verdict`, I'd have shipped the draft containing the false 'patch
below the fold' claim."* **MINE-VERIFIED at the source** — mechanism below, measured, not inferred.

## Mechanism — a payload-shape mismatch, then a jq clause that preserves staleness

Two independent halves, both required:

**(1) `:68-72` extracts `.content` assuming string-or-object; MCP delivers an ARRAY of text blocks.**
```
CONTENT=$(… | jq -r '.tool_response as $r
  | (if ($r|type)=="string" then ($r|(try fromjson catch {content:$r})) else ($r // {}) end)
  | if type=="object" then (.content // empty) else empty end')
```
When `content` is `[{type:"text",text:"### Verdict\nmust-fix…"}]`, `jq -r` renders the **array as
JSON text**, so `CONTENT` begins `[ { "type": "text", "text": "#…`. The `:80-91` awk then looks for
a line matching `^###[ \t]*verdict` — the verdict text is now embedded inside a quoted JSON string
with escaped `\n`, so **no line matches** and `RAW_VERDICT` is empty.

**MEASURED** by running the exact `:68-97` block on both shapes from a disarmed edge:
| `tool_response` shape | `CONTENT` starts | `RAW_VERDICT` | `VERDICT` |
|---|---|---|---|
| `{content: [{type:"text",text:"### Verdict\nmust-fix…"}]}` | `[~  {~    "type": "text",~    "text": "#` | *(empty)* | **`""`** |
| `{threadId:…, content:"### Verdict\nmust-fix…"} \| tojson` (the shape the hook's own comment describes) | `### Verdict~must-fix~~###…` | `must-fix` | `must-fix` |

⇒ The parser is **correct for the shape its comment documents** and blind to the array shape.

**(2) `:183` / `:196` / `:205` guard every write with `if $v != "" then … else . end`.** So an empty
verdict is not recorded as unknown — it **leaves the previous value in place**. Measured:
```
state: {critique_verdicts:{OUTPUT_REVIEW:"approve"}}   # from an earlier genuinely-approved round
v=""        -> {"critique_verdicts":{"OUTPUT_REVIEW":"approve"}}   # STALE approve survives
v="must-fix"-> {"critique_verdicts":{"OUTPUT_REVIEW":"must-fix"}}
```
and the gate's own `:212` read of that state prints `OUTPUT_REVIEW=approve`.

⇒ **Empty parse + preserve-on-empty = a `must-fix` round that leaves a recorded `approve` standing.**
The `:96` `*) VERDICT="unparseable"` fail-closed arm — written precisely so the gate can fail closed
on a garbled verdict — is **never reached**, because the failure produces `""`, not garbage.

## ⭐⭐⭐ Why this is the dangerous polarity, and why it inverts this file family
Every other recorded critique-gate defect **fails CLOSED**: the `pulls\b` floor over-blocks reads
([[project_critique_gate_pulls_pattern_builtin_floor]]), the missing `mkdir` makes escalation
unreachable, stale workspace state denies a fresh session
([[project_critique_gate_stale_state_crosses_sessions]]). Those cost friction and operator
round-trips. **This one fails OPEN**: it silently converts "the reviewer told you to fix this" into
"you are cleared to deliver." The hook's own header comment shows the author knew this class matters
— *"45% of June must-fix verdicts were lost that way, and a lost must-fix downgrades the delivery
gate to count-only"* — i.e. this is a **recurrence of a defect already fixed once**, on a different
input shape.

⇒ ⭐⭐ **A verdict field that can only be wrong in the permissive direction is worse than no field.**
Absent, the agent reads codex's `### Verdict` itself; present-and-wrong, it authorizes.

⇒ ⭐⭐ **Operating rule until patched: read codex's own `### Verdict` section; treat
`critique_verdicts[STAGE]` as advisory only.** The fixer did exactly this and it is the only reason
the false "patch is below the fold" claim didn't ship. Do **not** infer approval from the hook's
`Critique round N recorded (… verdicts: OUTPUT_REVIEW=approve)` notice.

## Proposed fix (one clause each, both needed)
1. `:68-72` — handle the array shape: `… | if type=="array" then (map(.text? // .content? // "") | join("\n")) elif type=="object" then (.content // empty) else empty end`. Same treatment the string branch already gets.
2. `:183`/`:196`/`:205` — distinguish *absent* from *unchanged*. When the response had content but no verdict parsed, record `"unparseable"` (the `:96` vocabulary already exists) rather than preserving the prior value; only a no-content response should leave state untouched.

⭐ **Same argument shape that worked for the `:81` unanchored-match filing: the fix already exists in
the file.** `:96` defines `unparseable` for exactly this purpose and the header comment states the
intent (*"fail closed … instead of silently passing count-only"*); the empty-string path routes
around it. *"Make the empty parse reach the `unparseable` arm you already wrote"* is a stronger ask
than *"handle MCP arrays."*

## Provenance / scope caveats
- The extraction block was run **from a disarmed edge** (`CRITIQUE_GATE_ACTIVE=0`) against the
  production `/app/hooks/track-critique.sh` (11,732 B, Jul 26 11:22, shared image path). That
  establishes **reachability + mechanism**; the fixer's 3 rounds are the **occurrence**. Per the
  standing division of labour, both are needed and neither substitutes
  ([[project_critique_gate_pulls_pattern_builtin_floor]] §disarmed/armed).
- I did **not** observe the fixer's actual `tool_response` bytes, so "MCP delivers an array here" is
  the array shape being *unparseable-by-construction* plus its report of the symptom — not a captured
  production payload. If someone can dump one, that closes the last link.
