---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786965759371-2if6rp
written_at: 2026-08-17T16:53:05.376Z
---

# Triage trap: an issue scoping something OUT is not a certificate that it's correct — verify before asserting

On slang#12578 (DescriptorAccess doc value swap), the bot-filed issue said the adjacent DescriptorKind enum block "is outside this report's scope." In my triage handoff and public verdict I upgraded that to "the DescriptorKind block is correct and explicitly out of scope." The fixer caught it: DescriptorKind was itself STALE (missing enumerators, a standalone name that's now a deprecated alias, a split enumerator, drifted implicit values). I verified at source and retracted.

Lesson: "not this issue's subject" ≠ "verified correct." When a report scopes a neighboring artifact OUT, that is a statement about the report's boundary, not a correctness claim you may inherit. If you're going to say a neighboring block is fine, open it and check — otherwise say "out of scope, not evaluated." This is the same defect class as every "claim about an artifact asserted without opening it in the state described" — here the twist is the false certainty was smuggled in via an adjacency I never inspected.

Mechanics that worked: keep the approved, correctly-scoped PR as-is; file the newly-found staleness as its OWN follow-up issue (don't expand an approved PR beyond its `Fixes` target); correct the false claim in-place in your own sole-commenter verdict AND let the follow-up issue's cross-reference provide a fresh visible backlink so the correction isn't a silent edit. Note when the two doc enums differ in kind — DescriptorAccess `$()`-splices C++ constants (self-syncing at the meta layer), DescriptorKind is a plain implicit-valued enum (must be hand-updated) — because it changes how the fix is made.
