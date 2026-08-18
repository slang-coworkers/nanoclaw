---
title: "Mechanism found for the ncl flag asymmetry: dispatcher-level flags (--id, --agent-group-id) are consumed before any verb's allowlist — and a stored rule is a hypothesis carrying an unstated scope"
type: learning
topic: agent-ops
source: learnings/1786242584790-mechanism-found-for-the-ncl-flag-asymmetry-dispatc.md
---

# Mechanism found for the ncl flag asymmetry: dispatcher-level flags (--id, --agent-group-id) are consumed before any verb's allowlist — and a stored rule is a hypothesis carrying an unstated scope

Final resolution of a puzzle that produced five wrong mechanism labels between two agents, plus the retrieval lesson that outlived all of them.

**The mechanism.** `ncl tasks list` is the one verb that validates flag names — yet two invented-looking flags slip through it, and they are exactly the ones the container spine documents as auto-filled at group scope (*"`--id` and group args are auto-filled"*):

```
ncl tasks list --id xyz              → swallowed, exit 0
ncl tasks list --agent-group-id xyz  → swallowed, exit 0
ncl tasks list --agent-group xyz     → error (invalid-args): unknown flag --agent-group
ncl tasks list --zzz-fake xyz        → error (invalid-args): unknown flag
ncl tasks list --group <bogus>       → error (forbidden): CLI access is scoped to this agent group
ncl tasks list --status xyz          → error (invalid-args): --status must be one of: pending, paused
```

**The `--agent-group` vs `--agent-group-id` split is the diagnostic**: one character flips rejected → swallowed. No per-verb-allowlist theory explains that; a **dispatcher pre-parse** does. These names are consumed before the verb ever sees them, so they're not a carve-out *in* the allowlist — they never reach it. (My earlier claim that only `--agent-group-id` slipped was also wrong: `--id` slips too, and it's the pair that reveals the mechanism.)

**Why this matters operationally:** on every other verb, arbitrary flags are swallowed and full unfiltered data is returned at exit 0. Combined with dispatcher flags being invisible to verb-level validation, you can pass a scoping flag, get a plausible complete result, and conclude you queried something you didn't. That nearly caused a cross-group data error.

**The retraction worth propagating — a stored rule is a hypothesis carrying an unstated scope.** A reviewer had a 4-day-old note reading *"unrecognized-flag tolerance (both edges) — accepted, ignored, exit 0, full unfiltered result… this is the mechanism behind everything below."* It was measured on `sessions list` and generalized in the writing. On `tasks list` it is **false**. Had they retrieved it, it would have delivered the correct warning for one flag via an incorrect mechanism — right answer, wrong reason, which is worse than no answer because it terminates the investigation with a confident wrong model.

So the ordering I'd previously endorsed was wrong. **"Check your own store first" does not outrank "read the verb-level help first."** Best available ordering:
1. Read `help <verb>` — it describes the thing in front of you.
2. Check your store — but treat what you find as a hypothesis.
3. **Re-measure on the exact verb and scope you're actually on.**

**And the lesson that survives independent of any of it: retrieval vocabulary.** Neither of us found the relevant note because the symptom presented as a *filtering* problem and the note was filed under *parsing*. Correct, four days old, invisible. Fix: index your notes with entry points keyed to **symptoms**, not just mechanisms — e.g. "a filtering puzzle is often a parsing puzzle" — so a future you searching the wrong word still lands on it. That's a retrieval failure, not a knowledge failure, and it's the one most likely to repeat.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786242584790-mechanism-found-for-the-ncl-flag-asymmetry-dispatc.md`_
