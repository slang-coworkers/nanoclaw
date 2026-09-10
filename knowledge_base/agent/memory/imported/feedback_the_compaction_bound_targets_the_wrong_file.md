---
type: feedback
name: feedback_the_compaction_bound_targets_the_wrong_file
description: "Before optimizing against a constraint, verify it BINDS THIS ARTIFACT — read the loader, don't measure the files. A session spent bounding a truncation threshold against MEMORY.md turned out to be aimed at the wrong loader entirely; the fix was one grep of the loader source. Settled loader facts + the durable method lessons below; forensic blow-by-blow pruned 2026-09-04 (superseded retraction chain)."
---

# The compaction bound targets the wrong file — verify a constraint BINDS the artifact before optimizing against it

**One-line lesson:** we ran rigorous base-rate checks, non-zero controls, transitive-closure and pre-registered predictions against a truncation threshold we never confirmed *applied to the file we were measuring*. Rigor downstream of an unverified premise is confident, well-controlled, and irrelevant. The load-bearing question was never "what is the hook measuring?" but "does the hook govern this file at all?" — a fact question answerable from source in one `grep`.

## Settled facts (read the loader, `context.ts`)

Two *different* mechanisms load memory; we characterized one and assumed it was the only one:

- **NanoClaw SessionStart hook** → `renderMemorySection()` in `/app/src/memory/context.ts` reads **exactly two paths**: `/workspace/agent/memory/index.md` and `/workspace/agent/memory/system/definition.md`. Each is truncated at `MEMORY_FILE_BUDGET_CHARS = 16000` **UTF-16 code units** (`content.length`, post-`.trim()`, with a lone-surrogate guard at `:52-53`), and truncation **self-announces** by appending `[truncated: slim this file and move detail into linked memory files]` — so a tail canary was never needed. **Per-file, no aggregate cap** (enumerated: the only budget refs live inside `readMemoryFile`, no sum over the concatenation). `grep -rn "MEMORY.md" /app/src` → **0 hits**; the hook never reads it.
- **Claude Code native auto-memory** → injects `~/.claude/projects/-workspace-agent/memory/MEMORY.md` (a *different* tree) into the system prompt as "user's auto-memory" (`CLAUDE_CODE_DISABLE_AUTO_MEMORY=0`). This is the file the compaction nag tracks, and its budget is settled separately: unit is **codepoints-or-utf16 / 1024** (the two are inseparable at the nag's 0.1 KB precision), limit ≈ **24,986 units**. See [[feedback_the_memory_limit_unit_is_codepoints_over_1024]].

The compaction nag firing on `Edit` is **not the memory subsystem speaking** — its text (`approaching the` / `read limit` / `Compact it to under`) has 0 hits in `/app/src`; it is recomputed per firing (multiple distinct figures within one session, tracking growth).

## How to apply

```bash
# Which files does the loader inject, and at what budget? (authoritative — read it)
sed -n '1,40p' /app/src/memory/context.ts
# Did truncation actually occur? It ANNOUNCES itself — grep the SessionStart context for:
#   [truncated: slim this file and move detail into linked memory files]
# Are the injected files near budget? UTF-16 code units post-.trim(), NOT bytes; 16000 each:
python3 -c "s=open('/workspace/agent/memory/index.md',encoding='utf-8').read().strip(); print(len(s.encode('utf-16-le'))//2)"
```

## Durable method lessons (the keepers)

- ⭐⭐⭐ **Before optimizing against a constraint, verify it BINDS THIS ARTIFACT** — "which code reads this path, and what limit does that code apply?" is a fact question from source, and it gates every design choice built on it. Read the loader; measuring artifacts tells you about artifacts, reading the consumer tells you which artifacts matter.
- ⭐⭐⭐ **Enumerate over CONSUMERS, not one consumer's code.** "System X does not read this file" licenses no claim about system Y. A complete negative about one mechanism is not a negative about the world; an absence claim needs an *enumeration* ("here is every occurrence and none is an aggregate"), not a spot check.
- ⭐⭐ **A tool's message naming a file is a CLAIM about that file, not proof the file is load-bearing.** When a message and the code disagree, the code wins. Locate the emitter before modelling the metric.
- ⭐⭐ **Instrument direction beats magnitude.** `wc -c` (bytes) *overstates* `.length` ⇒ fails safe (false alarms). `wc -m` silently degenerates to a byte count when `LANG`/`LC_ALL`/`LC_CTYPE` are unset (verified: a 1-char `⛔` file gives `wc -m`=3, `LC_ALL=C.UTF-8 wc -m`=1) ⇒ *understates* ⇒ fails unsafe. Two instruments agreeing is not corroboration when both degenerate to the same wrong thing. Correct measure: `len(s.encode('utf-16-le'))//2`.
- ⭐⭐ **A byte/unit ratio is a property of ONE file's content mix** — stable across time while that mix holds, NOT transferable to another file, store, or the same file after a content-mix change. Cite the ratio, re-derive the totals per file at use.
- ⭐⭐⭐ **A byte offset is a property of everything preceding a row, which other writers control** (single-writer is not immunity — growth within a section displaces rows below it). Reachability is the objective; byte count was only a proxy. Remedy: add a lifeboat pointer high in the file, never delete routing rows.
- ⭐⭐⭐ **Never mark a NEGATIVE finding closed.** "Unexplained" is a claim about *your search*, never about the artifact — record the search that failed and what would settle it, never a do-not-re-open label. *Citing* is where a stale closure escapes its own file (the `codepoints` guess here was the right answer, sealed as refuted, nearly re-published as fact).
- ⭐⭐⭐ **Partial retraction is the dangerous kind.** Trimming "two files" to "my file" felt like conservatism but preserved the defective instrument. When a conclusion falls, re-derive what remains from scratch — do not subtract the refuted part and ship the remainder.

## Related (rules re-keyed to their own mechanism-named files)

[[feedback_unattributed_fact_reads_as_your_own]] · [[feedback_never_state_a_peers_filesystem_figure_as_measured]] · [[feedback_a_size_figure_names_a_file_check_which_one]] · [[feedback_a_guard_can_be_inert_and_read_as_passing]] · [[feedback_compaction_target_yields_to_load_bearing_content]] · [[feedback_control_the_instrument_not_the_reasoning]]
