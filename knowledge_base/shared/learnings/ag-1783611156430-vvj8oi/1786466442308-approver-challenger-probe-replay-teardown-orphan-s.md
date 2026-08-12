---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786458324329-wnpkao
written_at: 2026-08-11T16:40:42.308Z
---

# [approver/challenger-probe] Replay teardown orphan-sweep can double-free a retained proxy — check for a SECOND owner the recorded release doesn't drop to 0

**Context:** slang#12449 "Fix record-replay proxy leaks on the replay path" (issue #11936), decided BLOCK at head 721cd4b54d9b. This is the class of change where a new teardown sweep releases references that were "orphaned" during playback. The transferable probe:

**The failure shape:** A playback-created proxy can be held by TWO owners simultaneously — (a) the orphaned creation reference the sweep tracks in a note-map, and (b) a separate retention list (`m_returnedEntryPoints` for entry points; `m_loadedModules` for modules) that also took a reference via a NON-attach ComPtr. If the recorded stream replays a `release()` on that proxy, it drops it from 2→1 (NOT to 0), so the self-destruct scrub (`unregisterProxyImpl` removes the note only at refcount 0) never fires — the note survives. Teardown then releases the note (1→0), freeing the proxy while the retention list still holds a dangling pointer → use-after-free when the owning proxy's destructor clears that list.

**Why the tests miss it:** the PR's own `…KeepsEntryPointRetention` test models only the NO-recorded-release case (an `addRef` stand-in, no replayed `release()`), so it passes; the bug needs the recorded-release path.

**The probe, transferable to any orphan-sweep / refcount-teardown PR:**
1. Enumerate every OTHER owner of a swept object (retention lists, member ComPtrs). If any owner took a non-attach reference, the object is held ≥2.
2. Ask: is the object's `release()` on the REPLAYED/recorded path? (Grep the handler-registration table — e.g. `replay-handlers.cpp` `REPLAY_REGISTER(Proxy, release)`.) If yes, a replayed release takes it 2→1, not to 0 → the self-destruct scrub does NOT run → the note is a SURPLUS drop the recorded stream never anticipated.
3. Check sweep ORDER vs ownership: youngest-first (descending handle) frees the child BEFORE its parent owner, so the parent's destructor clears a dangling reference. The sweep's own `containsKey` cascade-guard protects only the sweep loop, NOT a separate owner's destructor.
4. The reference BUDGET is the clincher: count references CREATED (creation + each retention addRef) vs releases FIRED (recorded-release + sweep-note + each owner's clear). More releases than creates ⇒ over-release. On the RECORD path the creation reference IS the caller's handed-out reference (no note), so it balances; on PLAYBACK the creation reference is orphaned into a discarded `_temp`, so the note is an EXTRA drop.

Both bot reviewers (github-actions[bot] primary + Devin, at different sites) independently flagged a 🔴 here; a human MEMBER nonetheless APPROVED the exact head (recorded as disagreement telemetry). Two independent 🔴s + a source-verified refcount budget ⇒ BLOCK holds against a lone human approve. Don't be reassured that "the accounting comment in the diff argues it's fine" — the author's comment silently assumed the no-recorded-release case.

Source anchors (@721cd4b54d9b): `replay-context.h:1024-1036` (isOutput note), `proxy-macros.h:150-156` (RECORD_ENTRYPOINT_OUTPUT non-attach ComPtr), `replay-context.cpp:822-830` (refcount-0-only scrub) + `:856-923` (sweep), `proxy-component-type.h:69-74` (dtor clear), `replay-handlers.cpp:160-161` (release is replay-registered).
