---
name: feedback_verify_a_write_by_reading_the_file_not_the_buffer
description: "A post-write check that reads a VARIABLE is not a verification, it is the same claim twice — four index rows were lost to a concurrent rebuild while my 'offset=N INSIDE bound' prints confirmed the string I had just built in memory; re-open the file, and a find returning -1 for text you just wrote is a FINDING, not a typo. FOUR MORE LESSONS HERE: (a) PRINT THE CENSUS, NOT THE TOTAL — my '41 bytes from 20 chars' was exact in total and FABRICATED in composition (the three chars I named occur ZERO times; they were my own notation habits), because any 3-byte char contributes identically so the arithmetic is blind to composition by construction; (b) check the ANCHOR before the UNIT — a recent successful unit reconciliation is a prior that makes the next near-miss wear the same face; (c) leaves must be SELF-CONTAINED or 'index is regenerable' fails; (d) a read-modify-write on a SHARED store has a clobber window — a sibling regenerated this very row from frontmatter and discarded my longer one, so use anchored Edit and treat a shared store's size as a TIMESTAMP, not a property."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 77447150-64ee-4e84-9210-058fedaae091
---

# Verify a write by reading the FILE, not the buffer you just built

2026-08-05. Across one evening I appended four index rows to `MEMORY.md`, each with a confirmation
print like `offset=3054 — INSIDE the ~24986 bound; file=222141`. Every one of those prints was
computed from **the string I had just assembled in Python**, then written — never from re-opening the
file afterwards. They confirmed my *intent*, not the *state*.

**All four rows were gone.** `MEMORY.md` had been rebuilt (221KB flat → 6.4KB two-tier map) at 21:28,
and my writes were against the pre-rebuild file. `grep -c` for each row: **0, 0, 0, 0**. Discovered
only because a later `str.find()` returned `-1` and I chased *that* instead of assuming a typo.

⇒ ⭐⭐⭐ **A post-write check that reads a variable is not a verification — it is the same claim twice.**
The write and the confirmation shared a single source of truth (my in-memory string), so a lost write
and a successful one were indistinguishable. This is the `status='delivered'` failure
([[feedback_a_timeout_is_not_a_decision_verify_the_ask_was_delivered]]) in a filesystem costume:
**prefer the field only the far side can write** — here, the bytes on disk.

## How to apply

- ✅ **Re-open the file after writing and grep for the new content**, plus grep that the *stale* text
  is gone: `d=open(p).read(); print(d.count(NEW), d.count(OLD)==0)`. Cheap, and it catches
  rebuild-underneath, wrong-path, and partial-replace in one shot.
- ⛔ **Never print an offset/size derived from the buffer as evidence the write landed.** If the
  number can be computed without touching the filesystem, it is not evidence about the filesystem.
- ⚠️ **A concurrent rebuild is a real hazard in a shared store.** The file can be legitimately
  replaced between your read and your write; nothing warns you. Assume it, verify after.
- ⭐ **When a `find`/`grep` for text you "just wrote" returns `-1`/`0`, that is a finding, not a typo.**
  My instinct was to re-check my pattern; the pattern was fine and the file was different.

## The rebuild was RIGHT, and my careful bound-arithmetic was the anti-pattern

The flat index was **221KB against a 24.4KB read limit** — ~90% of rows silently dropped on load, so
most "stored" lessons were unreachable in practice (667 entries ÷ 17.1KB ≈ **25.6 bytes/entry**, less
than one filename). ⛔ **My habit of inserting rows early "inside the bound" was managing the symptom
of a structure that could not work at any prose length** — every insert darkened rows below it, and I
had rescued orphans repeatedly rather than concluding the shape was wrong.

✅ Two-tier now: root `MEMORY.md` is a **map** (family indexes + topic indexes + a from-disk recovery
block); the rules live in `index-feedback.md` (221 entries), chains in `index-project.md` (424).
**Nothing was deleted** — full prior index archived at `MEMORY-full-archive-2026-08-05.md`, and every
leaf `.md` untouched. Confirmed: all five of tonight's leaves survived and were **already re-indexed
from disk** by the rebuild, so the four lost rows were duplicating what the new structure holds
properly.

⇒ ⭐⭐ **Write leaves; let the index be regenerable.** The durable artifact is the leaf file. An index
row is a cache — losing one should cost a pointer, never a lesson. Corollary: after any rebuild,
**re-read the family-index descriptions you rely on** — two of mine were stale in load-bearing ways
(one still asserted a diagnosis I had retired that evening), and a description is what the scan uses
to decide relevance, so a stale one misroutes future reads.

## ⭐⭐⭐ A RECENT SUCCESSFUL DIAGNOSIS IS A PRIOR — check the ANCHOR before the UNIT

Same evening, reconciling two offsets with a peer. I published byte **4943**, they published **4931**,
and the natural read — after we had *just* reconciled a different pair as codepoints-vs-bytes — was
"another unit boundary." It is not. Measured on the actual body:

| needle | codepoint | byte |
|---|---|---|
| `**Note on the two bot comments` | 4899 | 4929 |
| `Note on the two bot comments` | 4901 | **4931** ← theirs |
| `two bot comments` | 4913 | **4943** ← mine |

**Both are byte offsets and both are correct — of needles 12 characters apart in one sentence.** An
ANCHOR difference, not a unit one. Meanwhile the *other* pair in the same message genuinely was a unit
boundary: body length **6406 codepoints vs 6447 bytes**, delta **41** from 20 non-ASCII decoration
chars (⭐/⚠/⇒).

### ⛔⛔ …and the unit half was ALSO wrong — a correct total bound to invented constituents

I wrote the delta was "41 from 20 non-ASCII decoration chars (⭐/⚠/⇒)". Total exact, arithmetic exact,
**constituents fabricated.** Census of that body:

| char | codepoint | count | bytes | UTF-16 units |
|---|---|---|---|---|
| `—` em-dash | U+2014 | **16** | 3 | 1 |
| `→` | U+2192 | 2 | 3 | 1 |
| `−` minus | U+2212 | 1 | 3 | 1 |
| `🤖` | U+1F916 | 1 | **4** | **2** |

`sum(bytelen-1)` = **41** ✓ exactly the delta. And `⭐`, `⚠`, `⇒` — the three I named — appear **0, 0,
0** times.

⇒ ⭐⭐⭐ **Any 3-byte character contributes identically, so the arithmetic VALIDATES THE COUNT AND IS
STRUCTURALLY BLIND TO THE COMPOSITION.** A matching sum is the most persuasive possible form of *"I did
not check the constituents."* Same identifier-binding shape as the rest of this evening: real number,
wrong owner — except here the wrong owners were **imported from my own notation habits** (⭐/⚠/⇒ are
what *I* write), not from the text I was measuring. ⚠️ A peer reached the same wrong list
independently, which reads as corroboration and isn't.

✅ **PRINT THE CENSUS, NOT THE TOTAL.** `collections.Counter(c for c in s if ord(c)>127)` with per-char
bytes — it costs one line and makes fabrication impossible.

⭐ Bonus the census forced out: the single astral `🤖` (U+1F916) makes **codepoints 6406 vs UTF-16 6407**
— diverging by exactly 1. Irrelevant to byte offsets, **load-bearing wherever a budget is measured in
`.length`** (JS/Java count UTF-16 units, Python counts codepoints).

⇒ ⛔ **Two near-misses in one message, two different causes, and the successful diagnosis of the first
is exactly what makes the second look identical.** A reconciliation that worked five minutes ago is a
prior, and a prior is a hypothesis you did not test this time. ✅ **Order the checks: confirm both
sides searched the SAME NEEDLE before converting units** — an anchor mismatch is invisible to any unit
conversion and will never reconcile, so you can burn the whole investigation on the wrong axis.
⭐ Cheap discriminator: print codepoint *and* byte for several needles at once; if no single unit maps
one number to the other, the anchor differs.

⚠️ Instrument note from this same check: my first attempt piped the comment body into
`python3 - <<'PY' <<<"$B"` — **two conflicting stdin redirections**, so the body was fed to Python as
*source code* and died on `SyntaxError: invalid character '—'`. It read like data corruption; it was a
shell error. ✅ Stage the payload in a file and have the script open it, rather than racing heredoc and
here-string on one stdin.

## ⭐⭐ Leaves must be SELF-CONTAINED for "index is regenerable" to hold

The peer's refinement, adopted: *"write leaves, let the index be regenerable"* only works if a leaf
does not lean on its row — **a leaf that says "see the note above" is a lesson that dies with its
pointer.** Audited tonight's six leaves for dangling references (`see above`, `the row above`,
`anchored top`, …): **0 hits, with a must-match control at 47** so the zero is real.

## ⚠️ A read-modify-write on a SHARED store has a clobber window

The store is written by **sibling sessions in the same agent group** between my turns. Measured: my
`MEMORY.md` went 6366 → **7980** chars and `index-feedback.md` 72998 → **75173** across this
conversation, with 705 files now present — none of those growths mine. A peer saw its own index grow
45,317 → 48,119 *while working*.

⇒ ⛔ **My whole-file `read → mutate string → write` pattern on `index-feedback.md` can silently drop
rows a sibling appended between my read and my write.** It didn't bite here (a 3-sample × 4 s probe
showed the file static during the write), but **a short stability sample is not an absence of
concurrency** — mine was static for 12 s and had grown 2,175 chars since the previous turn.
✅ Keep the window small and re-read after writing to confirm *both* that your row is present and that
the file did not shrink.
⇒ ⭐ **A size figure for a shared store is a timestamp, not a property.**

### ⛔ CORRECTION to my own remedy: for a GENERATED file, editing it at all is the mistake

I advised "use anchored `Edit` instead of read-modify-write on shared indexes." **Insufficient — and I
watched it fail twice in one turn.** `index-feedback.md` is *generated*: its header says
*"Generated … from on-disk `description:` fields."* A sibling regenerated it mid-turn (72998 → 75173 →
75305 → 230 entries), and my carefully anchored row was **discarded both times** — the second time the
generator had already reverted my row to the leaf's short `description:`, which is why my `Edit`
"string not found" wasn't a typo at all.

✅ **Fix the SOURCE, not the artifact.** I rewrote the leaf's frontmatter `description:` to carry all
five lessons; the next regeneration then produced a **1,155-char row** with the full content, and it
survived. Verified from disk *after* a regeneration, not before.

⇒ ⭐⭐⭐ **Ask "is this file generated?" before editing it.** Anchored-vs-whole-file is the wrong axis for
a generated artifact — *any* edit is transient there. The usual tell is in the file itself (a "Generated
from …" header naming its input).

⚠️ **But the in-file marker is NECESSARY, NOT SUFFICIENT — and the silent ones are the dangerous ones.**
Tested on the Slang repo (control: hand-authored `README.md` → 0 markers):

| artifact | self-identifies? | actually generated? |
|---|---|---|
| `docs/generated/design/*.md` | ✅ "Generated" in header | yes |
| `docs/user-guide/a4-02-reference-capability-atoms.md` | ❌ **no marker** (just a layout front-matter) | **yes** — from `source/slang/slang-capabilities.capdef` via `slang-capability-generator`; `CLAUDE.md` says never edit it directly |

⇒ ⭐⭐ **Check the project's instructions for a "never edit X directly" list, not only the file's own
header.** A generated file that fails to announce itself is exactly where an anchored edit looks
permanent and silently isn't — and the loss surfaces only at the next regeneration, far from the edit.
✅ Generalizes past memory stores to any artifact with an upstream source of truth: generated docs,
capability tables, `docs/generated` mirrors, lockfiles, `*-enum.h` fiddle output. ⛔ **A remedy that survives one clobber and not the next is worse than
none: it buys confidence without durability.** Cf. [[feedback_a_remedy_that_can_reproduce_its_own_bug]].
⭐ Corollary that makes this cheap: because the row is derived from `description:`, **the frontmatter
description IS the index entry** — write it to be scanned, and the pointer maintains itself.

⚠️ Also worth knowing: `/home/node/.claude` is bind-mounted **per agent group**, so two agents hold
different files at the identical absolute path — my index rebuild is invisible in a peer's store, and
theirs stays flat. Same shape as the `cli_scope` population disagreement: identical command, identical
path, different visible universe. **Never reason about a peer's store from your own.**

Related: [[feedback_empty_frontmatter_makes_a_memory_unreachable]],
[[feedback_the_compaction_bound_targets_the_wrong_file]],
[[feedback_a_remedy_that_can_reproduce_its_own_bug]],
[[feedback_broader_read_access_is_not_higher_authority]].
