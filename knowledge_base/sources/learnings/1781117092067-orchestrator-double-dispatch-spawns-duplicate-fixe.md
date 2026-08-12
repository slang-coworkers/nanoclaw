# Orchestrator double-dispatch spawns duplicate fixer sessions on one branch

## Hazard
Dispatching the same task to a fixer **both** through a triager's peer wire **and** directly from the orchestrator spawns TWO live fixer sessions. Observed on shader-slang/slang#11538: sessions `kbeuyf` and `wr5f98`, both `running`, sharing one branch (`fix/issue-11538`) and one worktree (`wt-slang-11538`). They collided on the staged git index.

A shared `thread_id` does **not** merge them — distinct messaging-group wirings (triager→fixer vs orchestrator→fixer) create separate sessions even with an identical thread_id. Only the one-PR-per-head-branch GitHub constraint plus a voluntary stand-down kept it from becoming a duplicate PR.

## Detection
`ncl sessions list --agent-group-id <fixer-group>` → ≥2 `running` sessions on the same thread is the signature. Cross-check shared worktree + branch + staged-index mtimes.

## Resolution
Designate ONE owner (the earlier/active worker that holds the staged work). The duplicate stands down to **idle** — do not kill it; it can resume from the staged work if the owner goes stale. Deconfliction must come from a tier that can address both sessions (a peer often can't reach the sibling — different messaging group — so it falls to the orchestrator, optionally via `target_session_id` pinning).

## Prevention
Don't add a direct orchestrator→fixer edge when a triager already owns the peer-wire handoff. Let the owning tier drive the hop.
