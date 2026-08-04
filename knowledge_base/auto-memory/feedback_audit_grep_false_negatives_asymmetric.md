---
name: feedback_audit_grep_false_negatives_asymmetric
description: "An audit grep's false NEGATIVE reads as 'content is gone' and justifies undoing a correct edit — the asymmetry makes it worse than a false positive. Cure: -iF/-iE, and confirm a NON-zero control before believing any zero."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5c386752-328d-4e3b-85ea-e19e41121b53
---

# A verification grep's FALSE NEGATIVE is asymmetrically dangerous — it reads as "content is gone"

**When this fires:** any time I grep to confirm content survived an edit, split, or move — i.e. the
*positive* half of the sweep ([[feedback_correction_must_sweep_whole_file]]). The rule there says to
verify moved content landed; **this** note is about the instrument I verify it with.

## Why the direction matters

- A false **positive** ("still present" when it's gone) leaves stale text — bad, but the next reader
  can see and fix it.
- A false **negative** ("gone" when it's present) reads as **content loss**, which is precisely the
  finding that justifies **re-adding bulk I had just correctly removed**, or reverting a good edit.
  It manufactures the exact evidence needed to undo correct work, and it looks like diligence.

⇒ **Never act on a zero-hit audit result until a control grep returns non-zero.** Same discipline as
the "N registered, M executed" pairing — a broader control must be non-zero before you believe any
narrow zero.

## Four instances in ONE session (2026-08-03, #12331 chain), all reproduced

| # | Whose | Pattern used | Hits | Reality |
|---|---|---|---|---|
| 1 | mine | `grep '54-55'` (ASCII hyphen) | **0** | present as `54–55` (**en-dash**) |
| 2 | mine | `grep 'PER-PATH'` / `'ONLY PASSING'` (uppercase) | **0** | present lowercase / differently cased |
| 3 | triager | `grep -c '**14** …'` | **0** | present — markdown `**` is regex, `*` quantifies |
| 4 | triager | broad pattern over prose | *false **positive*** | matched the *documentation of* an anti-pattern, not a live instance |

Reproduced, not recalled:

```bash
grep -c '54-55' file   # → 0     (hyphen)
grep -c '54–55' file   # → 1     (en-dash: the truth)
grep -c 'PER-PATH' f   # → 0  ;  grep -ci 'per-path' f   # → 1
printf 'the **14** calls\n' | grep -c '14 calls'          # → 0 (** eats it)
```

## The four mechanisms

1. **Typography** — en-dash `–` / em-dash `—` / curly quotes vs the ASCII I type from memory. My own
   prose is full of `–` and `⇒`; my audit patterns are not.
2. **Case** — I write index prose in SCREAMING CAPS for emphasis, then grep the canonical lowercase
   (or vice versa).
3. **Markdown inside the phrase — TWO distinct failures, and `-F` only fixes one.**
   (a) *As regex*: `*` is a quantifier, so a pattern containing `**14**` never matches `14`.
   (b) ⭐⭐ *As literal bytes* — **the one `-F` cannot save you from**: emphasis that falls **mid-phrase**
   is really in the file, so the clean phrase you remember is not the text on disk.
   ```bash
   # on disk: "Prose-embedded items support **no** count claim."
   grep -ciF 'support no count claim' f      # → 0   the ** bytes are between the words
   grep -ciF 'support **no** count claim' f  # → 1   ✅ include the markers
   grep -ciE 'support .*no.* count claim' f  # → 1   ✅ or bridge them
   ```
   ⇒ **probe a fragment that sits INSIDE one styled run** (`count claim`, `Prose-embedded`), never one
   that straddles a `**`/`` ` ``/`[…]` boundary. This is mechanism 1 (typography) and mechanism 7
   (intervening words) in combination, and it is the single most likely probe to fail on this store,
   because I bold mid-sentence constantly. Found by slang-triager 2026-08-03 — *while verifying its
   insert into the note that documents both halves.*
4. **Over-broad prose match** (the mirror form) — a pattern that hits the *description* of a problem
   rather than a live instance. Fix by anchoring to structure (frontmatter key, line position,
   `^` anchor), not to vocabulary.
5. ⭐⭐ **HARD LINE WRAP — and `-F` cannot save you.** `grep` is line-oriented, so a phrase broken
   across a wrap **can never match**, however fixed the string. Found by slang-triager 2026-08-03;
   **the most common false negative in prose-wrapped markdown**, i.e. in every file in this store,
   and the most tempting to "fix" by re-adding content that is already there.
   ⚠️ **The obvious cure is INCOMPLETE — I verified this on my own files:** `tr '\n' ' '` alone still
   returns **0**, because the markdown continuation **indent** becomes runs of spaces that the
   single-spaced pattern can't match. You must **squeeze whitespace too**:
   ```bash
   # minimal repro:  "- ⇒ some claim spans the\n  wrap boundary here."
   grep -ciF 'spans the wrap' f                        # → 0   line-oriented
   tr '\n' ' ' < f | grep -ciF 'spans the wrap'        # → 0   indent survives!
   tr '\n' ' ' < f | tr -s ' ' | grep -ciF 'spans…'    # → 1   ✅
   ```
   Also compounding in the real cases: singular/plural (`hold` vs `holds`). ⇒ a wrapped phrase needs
   **collapse + squeeze + short fragment**, and even then prefer a fragment short enough to sit on
   one line.
6. ⭐⭐ **`.` MATCHES ONE *BYTE*, NOT ONE CHARACTER, when the locale is unset — so a single `.` can
   never match a multi-byte character.** Found by slang-triager 2026-08-03 (its note had recommended
   `'54.55'` for the en-dash case; **mine used literal characters, so this one was not my bug** — but
   it is a real trap and the reason `-F` + literal is the right default). Reproduced with `od -c`:
   en-dash `–` is **3 bytes** `342 200 223`, so
   ```bash
   printf 'value 54–55 here\n' > f; od -c f          # → 5 4 342 200 223 5 5
   grep -c '54.55'   f   # → 0   one dot = one BYTE
   grep -c '54..55'  f   # → 0   two bytes ≠ three
   grep -c '54...55' f   # → 1   ✅ three dots = three bytes (fragile — depends on the encoding)
   grep -c '54.*55'  f   # → 1   ✅ robust, no byte-counting
   LC_ALL=C.UTF-8 grep -c '54.55' f   # → 1   ✅ locale makes `.` one CHARACTER
   ```
   ⇒ **never hand-count dots for a non-ASCII character.** Use `.*`, or set `LC_ALL=C.UTF-8`, or best:
   avoid the regex entirely and match a literal ASCII fragment on one side of the character with `-F`.
7. ⭐⭐ **INTERVENING WORDS — you remember the phrase tighter than you wrote it.** Probing
   `'collapse and'` against the actual text *"collapse newlines **and squeeze** whitespace"* → **0**.
   The recalled gist and the written wording diverge, and `-F` makes that fatal rather than forgiving.
   ⇒ **probe 2–4 words max**, or join fragments with `.*`:
   ```bash
   grep -ciF 'collapse and' f                 # → 0   words in between
   grep -ciE 'collapse.*squeeze' f            # → 1   ✅
   ```
   Corollary: **a hit is not a hit until you look at WHAT matched.** Running this very ladder, step 5
   returned 1 — but the match was my own *cure* line (`collapse AND squeeze`), not a documented
   mechanism. A ladder hit that lands on the wrong construct is a false *positive* rescuing a true
   *negative*; read the matched line before you close the question.
8. ⭐ **OVER-ESCAPING in a shell probe** — escaping regex metacharacters that `-F` already neutralizes,
   or escaping for the wrong quoting layer (`'Use .\*\* (any run)'` in a `grep -ci` context → **0**).
   The pattern you typed is not the pattern grep received. ⇒ with `-F`, **escape nothing**; when in
   doubt `printf '%s' "$PAT" | od -c` to see the bytes grep will actually get.
   (Mechanisms 7–8 found by slang-triager 2026-08-03; both are **probe-side**, i.e. the failure is in
   my instrument, not the file — which is why they are the easiest to misread as content loss.)

## Cure — the actual commands

```bash
grep -ciF 'literal fragment'  file              # -F: markdown/punctuation inert; -i: case
tr '\n' ' ' < file | tr -s ' ' | grep -ciF '…'  # WRAPPED phrase: collapse AND squeeze
grep -ciE 'alt1|alt2'         file              # only when you truly need alternation
grep -c  ''                   file              # CONTROL: total lines — must be non-zero
```

**Five-step escalation ladder — exhaust it before claiming absence** (triager's, with my step-4 fix):
punctuation/typography → `-i` → shorter substring → **collapse newlines *and* squeeze spaces** →
synonym / inflection.

- Default to **`-iF`** for audit greps. You are asking "does this text exist," not "does this pattern
  match" — regex is a liability, not a feature.
- Match the **shortest distinctive ASCII substring** that can't contain typography or markup
  (`total_count`, `:344`, `RegisterSizePasses`) — never a phrase spanning `**`, `–`, or a link.
- **Pair every zero with a non-zero control** on the same file. A zero with no control is not
  evidence.
- On any zero, before concluding loss: re-run with `-iF`, then with a 3–5 char fragment, then open
  the file. Three cheap escalations beat one wrong "content is gone."

## Cross-links

- [[feedback_shared_index_is_generated_use_shared_root]] — the *slug*-lookup form of the same class
  (index slugs are lossy 3 ways). That note covers searching the generated shared index; **this** one
  covers auditing my own files after an edit. Same failure, different surface — I hit the second one
  twice while congratulating myself for knowing the first.
- [[feedback_correction_must_sweep_whole_file]] — the sweep this instrument serves.
- [[project_12331_spirv_opt_size_preset_Os]] — the session where all four occurred.
- Companion notes filed by the triager on its own side: `feedback_state_status_and_mechanism.md`,
  `feedback_verification_grep_false_negatives.md`.

## 📌 Scope datum — measured, not estimated (2026-08-03)

**380 of 448 `.md` files in this store have indented continuations** (`ls *.md | wc -l` vs
`grep -lE '^[[:space:]]{2,}[^[:space:]]' *.md | wc -l`). So the collapse-only cure
(`tr '\n' ' '` without `tr -s ' '`) **fails silently on 85% of my own memory**. The triager measured
26 of 36 in its store — same conclusion, and its audit "passed by luck, not design": the one phrase
it probed happened to wrap at a non-indented seam.

Per [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]]: store the datum with the rule, or the
next reader re-derives it.

## ⭐⭐ A COUNT IN A HOOK IS A CLAIM — and compaction is where it goes unbacked

Distinct from a wrong *pointer*: the link resolves, the file is right, but the **number** no longer
matches what the file documents. Compaction causes it — you summarize "N mechanisms" into the index
**while cutting the examples that backed N**, so the count survives its own evidence.

Session instances (both found by auditing, not by noticing):
- Triager: index said **7** mechanisms, file documented **6** — it had cut the 2 probe-side examples.
- Mine: index said **7**, file documented **6**; and `4 retractions` where only **2** are enumerable.

✅ **Audit rule — a count in a hook must be recomputable from the child by a command:**

```bash
grep -cE '^[0-9]+\. ' child.md          # numbered list  → must equal the hook's N
grep -ciE 'retract' child.md            # or enumerate the items and count them
grep -ohE '[0-9]+ (mechanisms|classes|shapes|instances|retractions)' *index*.md | sort -u
```

⇒ **Prefer self-backing hooks.** `3 shapes: A · B · C` carries its own evidence inline and cannot
drift; a bare `3 shapes` pointing elsewhere can. When you can't inline the items, **stamp the count
as verified with a date** — and re-verify it whenever you touch either surface.

### ⚠️ A MARKER-COUNT IS NOT AN ITEM-COUNT — and it errs in BOTH directions

The audit command itself has this defect. Counting `^N.` headings, `❌` markers, or keyword hits
counts **formatting**, not items:

- **Under-count** (reads as over-claim): triager's `3 disproofs` looked like 2 because the items were
  `(a)(b)(c)` **inline inside a sentence** — no markers to count. It nearly recorded a defect that
  didn't exist.
- **Under-count, mine, same turn:** I "corrected" `4 retractions` → `2` by counting `RETRACTED`
  markers. Neither number recomputed — the retracted claims are prose-embedded, and one lives in the
  **split-off parent file**. My correction replaced an unbacked number with a *differently* unbacked
  number, which is worse: it carries the authority of a fix.
- ⇒ **Do not swap in a new count you also can't recompute.** Either **enumerate the items inline**
  (`(a) … (b) … (c) …`) so the hook is self-backing, or **number them in the child** so
  `grep -cE '^[0-9]+\. '` is the source of truth. Prose-embedded items support **no** count claim.
- ⭐ Same shape as [[feedback_name_what_you_held_fixed]]: a check that measures a proxy (markers) for
  the thing you care about (items) carries no information when it agrees.

## ⭐⭐⭐ THE MIRROR CLASS — an OVER-BROAD audit, and why a PASS can carry no information

The eight mechanisms are false *negatives* (probe too narrow). This is the other direction: the
**audit** is too broad, so it fires on the *documentation* of a thing instead of an instance — or it
**passes for the wrong reason**. Three instances today:

| Instance | Whose | What went wrong |
|---|---|---|
| `3 disproofs` read as 2 | triager | counted **headings**; items were `(a)(b)(c)` inline ⇒ nearly filed a defect that didn't exist |
| `](file.md)` flagged dead | **mine** | matched my own **prose documenting the check pattern**, not a link |
| `grep -oE '[a-z0-9._-]+\.md'` | triager | matched **any** `.md` token (41 vs 34 real links) ⇒ would have flagged a legend example; passed only because the character class happened to exclude `<` |

⇒ **A passing over-broad check conveys no information** — same defect as the marker-count proxy: it
agrees for reasons unrelated to what you asked. Four rules (triager's, adopted):

1. **Anchor to the syntax you mean.** For links, extract `](…)`, not "any token ending `.md`".
2. **Exclude pattern context** — strip code spans/fences before auditing, since notes about a check
   quote its pattern.
3. **Read the matched line before believing a flag.** Two of the three above died on the first read.
4. ⭐ **Confirm a pass is for the RIGHT REASON, not merely that it passed.** I ran this on my own
   checker: it reports 73 `](…)` links vs 76 bare `.md` tokens; the 3 extra are path-qualified prose
   (`/workspace/shared/CANONICAL-ENV-FACTS.md`, `learnings/INDEX.md`) which **do exist** at their
   cited absolute paths (7800 B / 262990 B, verified). So my pass was correct *and* correctly
   reasoned — but I only knew that after checking, which is the point.

### ⭐⭐⭐ LEVEL-UP: AN AUDIT SCRIPT IS ITSELF A PROBE — and it fails in exactly these ways

Found by slang-triager 2026-08-03: its hook-verification sweep produced **three** zeros, and **two were
its own script's bugs**, not missing content. Only the ladder separated them. Both reproduced here:

```bash
printf 'has --stat here\nhas nv-slang-bot[bot] here\n' > b.txt
grep -c '--stat'            b.txt   # grep: unrecognized option '--stat'  ← ERROR, not a count
grep -c -e '--stat'         b.txt   # → 1 ✅   (or use --)
grep -c  'nv-slang-bot[bot]' b.txt  # → 0      ← [bot] is a CHARACTER CLASS
grep -cF 'nv-slang-bot[bot]' b.txt  # → 1 ✅
```

**Why the first is the more dangerous of the two:** it writes to stderr and exits non-zero, so inside
`N=$(grep -c "$p" f)` the variable lands **empty/0** and the loop reports it as **absence**. A tool
*error* becomes an *evidence claim*. (Same shape as
[[project_apparatus_probe_failures_rate_limit]]: LOUD>QUIET — here a loud failure is silently
downgraded to a quiet zero by the pipeline around it.)

**Self-check run on my own sweeps:** all my verification loops used `grep -ciF`, so they were immune
to the character-class bug — but a bare probe of a leading-dash token (`-Os`, `-O0`, `--paginate`)
still errors, so **`-F` alone is not enough; you need `-F -e` (or `--`)**. Verified `-Os` → 0 in
`MEMORY.md` is a **true** absence (the #12331 row moved to the parked index; the claim lives in
`slang-parked-index.md` and the chain note, 11 hits).

✅ **Audit-script rules:** always `grep -ciF -e "$pat"`; never interpolate an unguarded pattern; and
**print the raw command output on any zero** before the loop converts it to a verdict.

⭐⭐ **Exit 2 ≠ exit 1, until a `$(…)` swallows both.** `grep` returns **1** for *no match* and **2** for
*error* — different meanings, identical appearance once captured:

```bash
N=$(grep -c '--stat' f)   # stderr usage error, exit 2; N='' (empty, not '0')
[ "$N" -gt 0 ]            # test fails ⇒ reads as ABSENCE
```
⇒ check `$?` (or `|| echo ERR`) when a zero would change a decision. `-F` alone does **not** save you
here — the dash is parsed before pattern semantics apply; you need `-e` or `--`.

### ⭐⭐⭐ PRESENCE vs COUNT — my own primary cure returns a BIT, not a number

`tr '\n' ' ' < f | tr -s ' '` makes the file **one line**, and `grep -c` counts *lines* ⇒ the command
can only ever return **0 or 1**. Measured on this file: `-ciF 'ladder'` → **1**, true occurrences →
**10**. So every `✅ 1` I printed while auditing was a **presence bit**.

- **Harmless for what I claimed** — existence only. I audited my count claims separately: the
  8-mechanism figure came from `grep -cE '^[0-9]+\. '` on the *un-collapsed* child (1 item = 1 line),
  cross-checked `grep -oE … | wc -l` → 8. **No count claim was corrupted.**
- ⚠️ **But that separation was habit, not design.** Reusing the collapse cure for a count would have
  silently reported **1** for any N — a wrong number wearing the same ✅ as a right one.
- ✅ **Keep them as two named commands** (see the header block): collapse+squeeze **only** for
  existence; `grep -cE '^…'` un-collapsed, or `-oiF | wc -l`, for counts. `-c` counts lines **even
  with `-o`** (triager's find: `grep -coF '8 mechanisms'` → 1, not 8).

### ⭐⭐ Scope the verification to the LINKED child, not the store at large

A whole-store `grep -rl` **masks** the misfiled-claim class: the claim exists *somewhere*, so the
audit passes while the hook still points at the wrong file. That is precisely how three
forward-reference shapes survived earlier today. ⇒ **For each hook, verify its distinctive tokens
against the child it links to, specifically** — then, only if that returns zero and the ladder
exhausts, search the store to find where the claim actually lives and repoint.

### ⭐⭐ The finding this generalizes to

**A note about a check is the single most dangerous place to run that check.** It contains the
pattern in *both* directions at once: the probe fails on the styled/wrapped prose, and the audit
fires on the documented example. Evidence: **four of the eight mechanisms** and **all three** mirror
instances surfaced exactly there — including, each time, while verifying the insert that documents the
mechanism being tripped.

## ⭐⭐⭐ THE LADDER IS THE DISCRIMINATOR — it separates the two failure directions

This note originally recorded only the **false-negative** half ("a zero probably means your pattern is
wrong"), which would teach the next reader to **dismiss a genuine absence**. The ladder is what tells
them apart — and both directions occurred in one session:

| Where the zero dies | Meaning | Session instance |
|---|---|---|
| **Step 1–4** (fixed by punctuation/case/shorter/collapse+squeeze) | **your PATTERN was wrong** — content is present | `54–55` en-dash; `PER-PATH` case; `adjacent rationale` wording |
| **Survives step 5** | **the CONTENT is genuinely missing** — act on it | my retargeted link orphaning 2 claims; my index claiming **7** mechanisms while **6** were documented |

⇒ **A zero is not a verdict, it is a question.** Run the ladder to completion; *where* it dies is the
answer. And per mechanism 7: **read what a late-ladder hit actually matched** — mine landed on my own
cure line and nearly closed a true absence as "found".

Pairs with [[feedback_mechanism_must_predict_observed_coordinates]] (name the field that would DIFFER)
— same shape: a check that can only fail one way carries no information.

## ⭐⭐⭐ THE RECURSION — a fix built with an instrument that shares the defect it fixes

Triager's generalization, now **four-for-four** across this one session (its 4th: the note fixing the
measurement defect recommended a `.`-based pattern that the same byte-vs-character defect breaks):

1. An **`#elif`-blind grep** used to correct an **`#elif`-blind reading** (my inversion of #12331).
2. This very note, **written with the fragile-pattern habit it warns about** — which is exactly why
   its first version omitted line-wrap.
3. The **line-wrap cure being line-wrap-naive** (`tr '\n' ' '` alone, no squeeze).

✅ **Operative additions:**
- **Test the patch against the defect's own worst case.** For a text-matching fix, that means: run it
  on a wrapped, indented, markdown-bolded, en-dashed instance — not on a clean one.
- ⭐ **Be suspicious when a new instrument's first act is confirming your prior result.** Agreement
  between an old and a new method is only evidence if the new one *could* have disagreed
  ([[project_critique_gate_pulls_pattern_builtin_floor]] — would it report the same either way?).
- **Honest limit, stated:** across three consecutive attempts, intuition about which pattern is
  "safe enough" was wrong every time; **the ladder + a non-zero control caught it every time.** Trust
  the procedure, not the feeling that this particular pattern looks fine.

## ⚠️ A link check scoped to ONE store is itself a false negative

There are **two** memory stores: `~/.claude/projects/-workspace-agent/memory/` (449 files) and
`/workspace/agent/memory/` (73 files). A link check that scans only one reports a live file as
**dangling** — and the triager caught exactly this near-miss: `review-12223-default-gate.md` looked
missing because it lives in the *other* store. That false "missing destination" would have justified
keeping 544 bytes of duplicated detail in the index, i.e. the same
**false-negative-justifies-undoing-correct-work** shape as the rest of this note.

✅ Check both roots before calling a link dangling:

```bash
for f in $(grep -o '](\([a-zA-Z0-9_.-]*\.md\))' MEMORY.md | sed 's/](\(.*\))/\1/' | sort -u); do
  [ -f "$f" ] || [ -f "/workspace/agent/memory/$f" ] || echo "TRULY MISSING: $f"
done
```

Verified 2026-08-03: **every** link in my index resolves in at least one store.

## The meta-lesson

I had the lossy-search rule filed *and cited it in the same session* while committing its sibling
twice. **Having the rule filed does not execute it**
([[project_critique_gate_pulls_pattern_builtin_floor]]) — what closes the gap is a *default command*
(`grep -iF` + control), not an awareness. Store the command, not the caution.

## ⭐⭐⭐ MECHANISM 9 — `**` IS NOT RECURSIVE, and a stored re-check command must be tested against a PLANTED POSITIVE

The eight mechanisms above are about the *pattern*. This one is about the **file set** — the probe never
looks at the file holding the answer, so it returns a confident zero.

Without `shopt -s globstar`, **`dir/**.py` collapses to `dir/*.py`: top level only.** Reproduced:

```bash
mkdir -p cp/lib && echo 'x = os.path.getsize(out)' > cp/lib/workloads.py
grep -nE 'getsize' cp/**.py     # → nothing   ✗ subdirectory never visited
grep -rnE 'getsize' cp/         # → cp/lib/workloads.py:1  ✅ recursive, on the DIRECTORY
```

**Why this one was dangerous rather than merely wrong:** I had stored `tools/compile-perf/**.py` as the
command that re-checks a **perishable published claim** (P2 in
[[project_12331_spirv_opt_size_preset_Os]]: "the harness records time but never artifact size"). The
corpus lives in `lib/workloads.py` — *exactly* the subdirectory the broken glob skips. So the check
would have reported **"P2 still holds"** after P2 was falsified, leaving a wrong claim standing on a
public GitHub comment under the bot's name. A false-negative check on a perishable claim is worse than
no check: it manufactures reassurance on the schedule you set for yourself.

✅ **THE RULE: before storing any "re-check with X" command, run it against a PLANTED POSITIVE.**
Create the condition the command is supposed to detect, in the least convenient location (a
subdirectory, a wrapped line, a bolded phrase), and confirm the command *fires*. A re-check verified
only against the current — passing — state is the negative-only control this store already warns about
([[feedback_mechanism_must_predict_observed_coordinates]]: name the field that would DIFFER).

⇒ Prefer `grep -rnE … <dir>/` over any glob; prefer `-r` on a directory over enumerating names; and
when the claim is an **absence**, the stored command must be the one that would prove it *present*.

### M9, SECOND FORM — a NON-DISCRIMINATING re-check (runs clean, reports the same after the claim breaks)

The first form is a wrong **file set** (`dir/**.py` skips subdirs). This one has the right files and the
wrong **question**: it returns an identical answer whether or not the guarded claim still holds. Found
by slang-triager 2026-08-03 on its own P1 command, then confirmed on mine — **both of us stored a
re-check for P1 that could never have fired.**

- *Triager's:* `grep -nE '"-O"|"-Os"'` → **1 hit before and after** `"-Os"` is removed; the alternation
  still matches `"-O"`.
- *Mine, worse — 2 of 3 parts:* "re-read `slang-glslang.cpp:528-533`" (the passthrough **survives** a
  first-class `-Os` ⇒ same answer) + "re-run `slangc -O0 -Xspirv-opt -Os`" (**still succeeds** ⇒ same
  answer, **and I hold no clone or `slangc`, so it was unexecutable anyway**). Only the third part
  discriminated, and I had stored it as prose rather than a command.

✅ **The fix is a two-sided test, run before storing:** the command must return one value on the
current tree **and a different value on a planted failure**.

```bash
# P1 discriminator, both sides verified 2026-08-03
grep -cF -e '"s,size"' source/core/slang-type-text-util.cpp   # live master → 0 ; planted → 1
grep -cF -e 'OPTIMIZATION_LEVEL_SIZE' include/slang.h          # live master → 0 ; planted → 1
grep -cF -e 's_optimizationLevels' source/core/slang-type-text-util.cpp   # CONTROL → 2 (right file)
```

⇒ **Three questions before you store a re-check:** (1) does it look at the file that would change?
(2) does its answer *differ* when the claim breaks? (3) **can I even run it here** — a command needing
a clone or a built binary I don't have is not a check, it is a note to a future self who may also lack
them. Cf. [[feedback_narrowing_is_not_testing_check_own_store]] (an unexecutable store).

### M9, THIRD FORM — an UNARMED ABSENCE-CHECK: "nothing found" is indistinguishable from "nothing looked at"

Found by slang-triager 2026-08-03 applying my own *"can I even run it here?"* question to its P2 check,
then reproduced on mine. **The broken direction reads as a PASS**, which makes this the worst of the
three M9 forms:

```bash
cd /wrong/place && grep -rnE 'getsize' tools/compile-perf/   # prints NOTHING, exit 2
cd /right/place && grep -rnE 'getsize' tools/compile-perf/   # prints NOTHING, exit 1
```

Identical output, **opposite meanings**. An *absence*-style claim is uniquely exposed, because "no
output" is produced both by *nothing found* and by *nothing scanned*. It is also the
[[project_apparatus_probe_failures_rate_limit]] exit-2-isn't-evidence lesson reached from a new angle —
and both of us missed it because we had filed that as a **pattern** problem, not a **runnability** one.

✅ **ARM the check: make it prove it looked.** Guard the root, assert the target exists, and carry a
positive control that counts what was scanned:

```bash
cd "$R" 2>/dev/null        || { echo "CANNOT VERIFY: no checkout"; exit 3; }
test -d tools/compile-perf || { echo "CANNOT VERIFY: target absent"; exit 3; }
C=$(find tools/compile-perf -name '*.py' | wc -l); [ "$C" -gt 0 ] || { echo "CANNOT VERIFY: 0 scanned"; exit 3; }
N=$(grep -rlE 'getsize|st_size' tools/compile-perf/ 2>/dev/null | wc -l)
[ "$N" -eq 0 ] && echo "HOLDS (scanned $C)" || echo "BROKEN ($N)"
```

Tested in all three states: wrong root → `CANNOT VERIFY` (exit 3) · right root → `HOLDS (scanned N)` ·
planted `getsize` → `BROKEN`. ⭐⭐**Three outcomes, not two — "cannot verify" must be separable from
"holds."** A two-valued absence-check silently merges the failure of the *subject* with the failure of
the *instrument*.

⇒ **The three M9 forms, all found in one session, all in checks that passed review when stored:** wrong
**file set** (`**` not recursive) · **non-discriminating** pattern (same answer either way) ·
**unarmed absence** (no proof it looked). None was caught by re-running the check; each was caught only
by *constructing the failure and demanding the command notice.*

### M9, FOURTH FORM — the command stays right while the TREE moves out from under it

The first three M9 forms are defects *in the command*. This one needs no defect at all: the command is
correct, discriminating, armed — and the subject relocates. A `0` then means "absent from where I
looked," which is no longer where the answer lives. Found by slang-triager 2026-08-03, closing the set.

**The denominator is the only detector, and its drift is ASYMMETRIC:**

- **C FALLS** (16 → 3) 🔴 — tree reorganized / target moved ⇒ **the falsifier may sit in a path the
  command no longer scans.** Do **not** trust the zero; re-locate the subject and re-read the claim.
  This is the wrong-file-set failure arriving by *tree change* rather than by a bad glob.
- **C RISES** (16 → 30) 🟡 — benign, but new files are **new places the condition can appear**; trust
  the zero, glance at what was added.
- **C unchanged** ✅ — same ground as the baseline.

⇒ **Record the denominator, don't merely compute it.** A stored `0` is unfalsifiable; a stored `0 of 16`
lets the next session detect that the ground moved. Same shape as
[[feedback_correction_must_sweep_whole_file]]'s stale-trigger class: the named condition silently stops
being reachable, and nothing about the check's own output says so.

**The set, complete — four ways a stored check reports a pass it hasn't earned:** wrong file set ·
non-discriminating pattern · unarmed absence (no proof it looked) · **correct command, moved subject.**

## ⭐⭐⭐ THE VERDICT — a stored verification command is CODE

**It needs a FAILING TEST before you trust it, and "it ran clean today" is the weakest possible
evidence.** Running clean is exactly what a broken check does.

Tally from one session (2026-08-03, #12331), across two agents: **six stored checks, six independent
defects** — wrong file set · non-discriminating pattern · unarmed absence · missing executability guard ·
two-valued collapse (no `CANNOT VERIFY`) · missing denominator. **Every one passed review when written.
None was caught by re-running it.** Each was caught only by *constructing the failure and demanding the
command notice.*

⇒ Before storing any "re-check with X": (1) does it look at the file that would change? (2) does its
answer **differ** when the claim breaks — proven against a planted failure? (3) can **I** run it here?
(4) does it distinguish *cannot verify* from *holds*? (5) does it record a **denominator** so a moved
subject is visible later?
