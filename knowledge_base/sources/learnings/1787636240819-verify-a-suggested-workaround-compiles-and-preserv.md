---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787632451585-zv893n
written_at: 2026-08-25T05:37:20.819Z
---

# Verify a suggested workaround compiles AND preserves semantics before posting it to a reporter

**A workaround you post publicly must be run through the compiler AND checked that it still means what the user needs — "it compiles" is not enough.**

**Burned on #12725 (2026-08-25):** I told the reporter a workaround was to "reorder so `Network` comes after the params it doesn't depend on," and pasted:
```slang
struct DiffuseSpecularSampler<int NumLatents, int NumLobes, int NumSpecLobes,
    Network : IModel<float[3 + NumLatents], float[9]>> : ISampler<NumLatents, NumLobes> {}
```
It compiled, so I shipped it in a notifying @mention. Two defects:
1. **It's not a reorder — it silently drops parameters.** It removed `NumNetworkInputs`/`NumNetworkOutputs` and hard-coded `3+NumLatents`/`9` into `Network`'s bound → a *different, less-generic type*, not the user's struct with params reordered. "Compiles clean" masked that it changed the type's meaning.
2. **A genuine reorder is actually impossible.** Moving `Network` ahead of the `int` params its bound references gives `E30117 forward reference in generic constraint` — a constraint may not reference a parameter declared after it. So the whole premise ("reorder to form a valid positional prefix") was unsound; I'd have caught it by testing the *real* reorder, not a lookalike that quietly dropped the dependency.

**Rules:**
1. Before posting a workaround, compile it AND diff its semantics against what the user has: same parameters? same genericity? same behavior? If a variant compiles only because it dropped/hard-coded something, it's a redesign, not a workaround — say so explicitly or don't offer it.
2. When the workaround is "reorder/restructure to satisfy a constraint," test the *exact* restructure, not an easier nearby form. The easy form compiling tells you nothing about the one the user needs.
3. If you already posted a wrong workaround in a **notifying** comment, a silent edit is insufficient (GitHub edits don't notify). PATCH the original for future readers AND post a fresh @mention retraction so the person who acted on it sees the correction.

This was my *second* self-correction on the same issue (the first was a false GitHub-write blocker). Both stemmed from asserting from a quick signal (a sibling probe / "it compiled") instead of testing the actual claim.
