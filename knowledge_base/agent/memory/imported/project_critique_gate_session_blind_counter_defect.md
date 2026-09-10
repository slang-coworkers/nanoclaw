---
name: project_critique_gate_session_blind_counter_defect
description: "INFRA, escalated to operator 2026-08-06, unfixed: the critique gate's precise per-artifact check is OPT-IN on the codex reply (### Attested), so when it is absent the only fallback is the session-blind edits_since_critique counter — a peer session's edits then deny your approve. Plus two BASH_PATTERNS false positives. Verified in /app/hooks on my own edge."
metadata: 
  node_type: memory
  type: project
  originSessionId: 9f9f7b0e-e9ed-4eb0-8ecf-7cff86871b38
---

# Critique-gate defects — escalated to the operator, NOT patched

**Reported by `slang-fixer` during slang#12367 (PR #12378); every leg re-verified by me in `/app/hooks`
on my own edge.** Not patched: hooks affect every coworker container, so it is a durable change and the
operator's call — same class as deleting another session's memory rows.

## The mechanism (verbatim, my container)

- `track-critique.sh:185` and `:197`:
  `| if ($att | length) > 0 then .critique_attested = ((.critique_attested // {}) + {($s): $att}) else . end`
  ⇒ **`critique_attested` is written ONLY when the codex reply carries an `### Attested` section**
  (`:100` documents it: *"Reviewer-attested artifact hashes: the '### Attested' section lists…"*).
- `gate-critique-on-deliver.sh:166`: *"Opportunistic: no attestation → no check."* **By design.**
- `gate-critique-on-deliver.sh:149`/`:155`: the fallback is
  `EDITS=$(jq -r '.edits_since_critique // 0' "$STATE")` — **the session-blind counter.**

⇒ ⛔⭐⭐⭐ **The gate has exactly ONE instrument that can distinguish *my* edits from a peer's — the
attested-hash re-check — and it is opt-in on the reviewer's output. When codex omits `### Attested`, the
only remaining check is session-blind, so false-positive denials are STRUCTURAL, not incidental.**
Observed by the fixer: `edits_since_critique` climbing 1→3→7→2→4 while nothing under review changed,
costing several rounds. **Fix has a natural shape: key the counter per session, OR make attestation
mandatory so the precise check always runs.**

## Two `BASH_PATTERNS` false positives (verbatim-reproducible)

1. **Cannot distinguish a read from a write** — a read-only `gh api …/pulls/<n>` body fetch is blocked as
   PR creation.
2. **Matches the literal TEXT of a command** — so saving a note that *quotes* a pattern trips the gate.

## ⚠️ The workaround is narrower than first stated

The fixer initially advised *"re-hash `.critique_attested.<STAGE>`"* as if always available. It is not —
availability is **a property of the reply, not of the container**. Honest form:
**if `critique_attested.<STAGE>` is non-empty, re-hash it; if empty, you have NO instrument and the
denial cannot be adjudicated.**
⭐⭐⭐ **An empty `critique_attested` reads exactly like "nothing changed"** — the night's recurring trap:
a probe returning a clean, well-formed answer *about nothing*.

## ⛔ My own error here, worth more than the finding

I measured `/workspace/.claude/workflow-state.json` on my edge — **101 B, 3 keys, no
`critique_attested`** — and nearly filed *"the counter has no per-session key; the sharing IS the schema,
it cannot be otherwise."* The fixer's file is **2,558 B, 11 keys**, `critique_attested` present with 5
attested paths, `edits_since_critique: 1`. `find /workspace -name workflow-state.json` on my edge returns
only mine ⇒ **a different object at the same absolute path (`/workspace/**` is per-container), not a
stale copy.** My 3 keys were the same schema with the optional section never populated, because *my*
container's reviews never emitted `### Attested`.
⇒ ⭐⭐⭐ **NEVER infer a schema — least of all "cannot be otherwise" — from one container's copy of a
per-container file.** The real schema *is* keyed per artifact (`critique_attested.<STAGE>.<path>`) and per
codex thread, so a fix has somewhere to hang. Cf. the anchored per-container row in `MEMORY.md`.

## Resume

**No action unless the operator authorizes a hook change.** If they do, the two candidate fixes are above.
`slang-fixer`'s durable copy: `/workspace/agent/memory/fix-12367.md` (its container).
