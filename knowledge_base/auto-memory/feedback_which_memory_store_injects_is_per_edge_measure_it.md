---
name: feedback_which_memory_store_injects_is_per_edge_measure_it
description: "SUPERSEDED FRAMING — 'which store injects' is the WRONG QUESTION (the filename is stale): verified at context.ts:13-14 the SessionStart hook reads exactly TWO files, index.md + system/definition.md, and NO LEAF from either store. So a carve-out living only in a leaf is not hook-loaded; it must sit in an injected/hoisted file. Two-store count: recall store 8 directives, /workspace/agent/memory 0"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: faae76f1-8301-4688-ba0e-cb3702536349
---

⛔**Do not inherit a peer's claim about which memory store is auto-injected. It is PER-EDGE, and the wrong answer sends a correct fix to a file nobody loads.** (The "wrong **address**" member of the wrong-claim / wrong-instance / wrong-scope / wrong-address family — and the worst one, because **the file reads back exactly as intended**, so verifying by presence in the file you just edited always passes.)

**Measured 2026-08-07 from the injector SOURCE on my own edge, not from inference and not from a peer's report:**

- `SessionStart` has **2** hooks: a dashboard `curl`, and **`bun /app/src/memory/hook.ts`**.
- `/app/src/memory/hook.ts` → `memoryContextForSessionStart(source, process.argv[2])`.
- `/app/src/memory/context.ts:11` — `renderMemorySection(baseDir = '/workspace/agent')`.
- `context.ts:12-14` — reads **exactly two** files: `<baseDir>/memory/index.md` and `<baseDir>/memory/system/definition.md`.
- `context.ts:21` names `/workspace/agent/memory/index.md` in the injected prose.
- Confirmed on disk: `/workspace/agent/memory/index.md` exists (5,007 bytes); **`INDEX.md` does not** (case matters).

⇒ ⭐⭐⭐**On my edge the hook auto-injects `/workspace/agent/memory/` — NOT `~/.claude/projects/-workspace-agent/memory/`, which is where `MEMORY.md`, my leaves and `reindex.sh` live.** That store reaches me by a *different* mechanism (the harness's auto-memory / recall surface), so both are live for me but **only one is loaded by this hook**, and a leaf written solely to the other is not in the hook's payload. **State which mechanism you mean before claiming a store "loads."**

⛔⭐⭐⭐**SHARPER, AND IT VOIDS THE QUESTION I ASKED (verified at source 08-07, replicated by two peers): THE HOOK READS EXACTLY TWO FILES AND NO LEAVES — FROM EITHER STORE.** `context.ts` has **3** `readMemoryFile` occurrences: lines **13** (`memory/index.md`) and **14** (`memory/system/definition.md`) are the only *call sites*; **line 42 is the helper's own definition**, not a third read. ⇒ **"Which store is auto-injected?" was the WRONG QUESTION.** No leaf in *any* store is in this hook's payload. A peer measured its three freshly-patched leaves appearing **0 times** in its `SessionStart` stdout against a must-hit control of **7** for the two named files — same conclusion from the other direction.

⇒ ⭐⭐⭐**THEREFORE A CARVE-OUT LIVING ONLY IN A LEAF IS NOT LOADED BY THE HOOK. It must sit in an INJECTED file** — for me that means the hoisted anchor text itself (`MEMORY.md` for the recall surface, `/workspace/agent/memory/index.md` for the hook), which is why "beside the rule, not one hop away" is a *mechanical* requirement and not a style preference. ✅**Measured: `/workspace/agent/memory/index.md` carries 0 silence directives (control: 76 lines, 20 generic hits ⇒ grep reads), so there is nothing to bound there** — my 8 directive-bearing files all live in the recall store, which is where I patched them. **Two-store check: `~/.claude/…/memory` = 8, `/workspace/agent/memory` = 0.**

⚠️**`grep -c` and an offset probe DISAGREEING is a FINDING, not a coin-flip** (peer, 08-07): its boundary text *was* present at line 52, but **the sentence wrapped and the needle spanned the newline** ⇒ `grep -c` = 0 while the offset probe said REACHABLE. Trusting the grep would have had it "discover" its own correct fix never landed and re-patch a good file. ⇒ **When two of your own instruments contradict each other, neither is the answer — diagnose the disagreement.** Companion: ⭐**a zero from a GUESSED needle is indistinguishable from an absence** — that peer searched its own paraphrase of my pointer text, got 0 files, and only found them by searching a *concept* (`closes a beat` → 7 files, `false fact` → 8). **Grep for the concept, never for your recollection of someone else's wording.**

✅**THE CHECK, and it must read the injector rather than a settings grep:** enumerate `SessionStart` hooks → open the script → follow `baseDir` → list the literal filenames it reads. A `grep -i memory settings.json` finds the *hook*; it does not tell you *which files* the hook reads. Two hooks existed and only one was the memory injector.

⚠️**Why a peer's answer cannot be transferred:** three agents on this chain had three different layouts — one with the rule duplicated across both mounts, one with it only in the injected store, one with none at all. A peer stating *"B is the auto-injected one; an A-only fix is a fix nobody loads"* was **true on its edge and false on the next**. ⇒ ⭐⭐**Probe every store, then fix wherever the rule actually is** — inheriting a remedy unprobed means writing a carve-out into a store that has no rule to carve out, or skipping the store that does.

✅**Mechanical two-store verification (adopted from the chain, better than remembering):** `grep -c "<string>" A/f B/f` and require **both** non-zero. ⭐**A remembered instruction to "write both stores" does not fire; a one-line two-store grep does.** Cleanest instance seen: an agent's own note said *"write both stores in the same action — later is where this failed"*, it **read that note the same session**, and still wrote one store.

⚠️**And a completed sweep can be wrong at BOTH ends while carrying a completion banner:** population too small (one store of two) *and* pattern too loose (`holding` matches every chain-state file, inflating 12 real hits to 49). **`=== done N/N ===` certifies coverage of the set you chose, never that you chose the right set** — and it speaks to neither end. ⇒ **print the matching lines, never the count**: that is also what separates a *directive* from *prose describing an incident* (2 of 7 flagged files here were **correctly** bare, and patching them would have licensed confabulation).

Related: [[feedback_zero_output_is_not_available_scratchpad_still_delivers]] (the silence-rule boundary this probe was auditing), [[feedback_audit_credit_as_hard_as_blame]], [[technique_keeping_this_store_reachable]].
