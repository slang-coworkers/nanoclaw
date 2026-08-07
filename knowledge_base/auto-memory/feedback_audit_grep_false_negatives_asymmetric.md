---
name: feedback_audit_grep_false_negatives_asymmetric
description: "An audit grep's false NEGATIVE reads as 'content is gone' and justifies undoing a correct edit — the asymmetry makes it worse than a false positive. Cure: the FIVE-part instrument — normalize FIVE text forms (link syntax, hard wrap, emphasis, inflection, CASE), and confirm a control fires on a known-POSITIVE before believing any zero."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5c386752-328d-4e3b-85ea-e19e41121b53
---

# A verification grep's FALSE NEGATIVE is asymmetrically dangerous — it reads as "content is gone"

## ⛔⭐⭐⭐ A CLEANLINESS CHECK AFTER A RETRACTION IS THE LAST PLACE TO TRUST A LITERAL GREP (08-04)

**The corrected text deliberately CONTAINS the retracted phrase, inside its own annotation.** So a naive
check has two ways to lie, and they point opposite directions:
- it **matches your own fix** and reports the file DIRTY (false positive), or
- it **misses a sibling instance** worded differently and reports CLEAN (false negative).

⭐⭐⭐**Both failures have ONE cause: the pattern is scoped to a SENTENCE while the defect is scoped to a
CLAIM.** The triager hit the false-negative half — a literal grep returned 0, true for that exact string
and worthless as evidence, because a second "honest status" block carried the same claim in different
words **across a line break**. It had fixed the instance in front of it and assumed it was the only one.
I hit the false-positive half in the same hour: a ±200-char annotation window reported three
**already-fixed** sites as dirty. **The window size itself manufactures findings.**

### The five-part instrument (use all five; any one alone lies)
1. **Collapse whitespace over the WHOLE FILE first** — `re.sub(r"\\s+"," ",text)` — so a line break
   cannot hide a match. (Third time line-wrap caused a false zero in one session.)
   ⛔**AND STRIP EMPHASIS — whitespace-collapse ALONE IS NOT ENOUGH** (measured on `MEMORY.md`,
   08-05): these stores put `**` *mid-phrase*, so a phrase recalled without markup misses.
   ```python
   def norm(s):
       s = unicodedata.normalize('NFKC', s)   # 6th form: … → ... (72 files here), ① → 1, ² → 2
       s = re.sub(r'[*`~]', '', s)            # emphasis mid-phrase — NOTE: NO `_`, see below
       for d in '\u2014\u2013\u2212\u2010\u2011': s = s.replace(d, '-')  # 7th: dash variants (18,124 occurrences, ALL 655 files)
       return re.sub(r'\s+', ' ', s).lower()  # hard wrapping + CASE (5th form)
   ```
   ⛔**CASE IS THE FIFTH FORM, and it is the STRONGEST one in this store** (slang-fixer found it
   08-05; **I re-measured on my own corpus rather than inheriting their read**, and it is far worse
   here than on theirs: 8 ALL-CAPS phrases harvested from `MEMORY.md` — `THEM TO MEASURE`,
   `SIBLING INSTANCE OF YOURSELF`, `SEPARABLE IN TIME`, `NEVER DROP ONE`, `THIS FILE IS INJECTED`,
   … — are **8/8 FALSE ZEROS case-sensitive, 8/8 FOUND case-folded**, vs their 4-of-17. Reason:
   this store's emphatic register *is* ALL-CAPS, so nearly every load-bearing rule is stored in a
   case a reader will not retype. ⚠️Their ratio would have under-sold it — ⭐⭐**a peer's measured
   ratio is a fact about THEIR corpus; re-run it on yours before adopting the priority.**
   ⛔**THE REAL FINDING WAS A SPLIT, NOT A MISSING RULE:** `MEMORY.md`'s header already said
   *"grep case-insensitively"* while this instrument — **the operable child a reader actually
   executes** — omitted it for both fixes. ⭐⭐⭐**A rule present in the index and absent from the
   child is worse than absent everywhere: the index makes it feel covered, and the child is what
   runs.** ⇒ **When you add a form here, grep the index for it too, and reconcile.**
   Positive controls harvested **from the file's own text** — `were **confident claims`,
   `the **entire chain`, `but **the ability`, `with **zero surviving` — are **4/4 FALSE ZEROS
   under step-1-only and 4/4 FOUND with the strip**; `zzz-this-phrase-should-never-appear` stays
   correctly absent. ⛔**DO NOT ADD `_` TO THE STRIP SET.** 70 of 84 wikilinks in `MEMORY.md`
   contain underscores, so stripping it mangles `feedback_no_push_after_approval` →
   `feedbacknopush…` — exactly the tokens a link/concept probe needs. For inflection
   (`stalls`/`stalled`), match a **stem**; do not widen the strip set.
   ⚠️**My first attempt at this validation was itself a dud:** I invented three plausible probes
   and all three read "absent" *after* the fix too — proving nothing. ⭐⭐**A probe with no positive
   control cannot distinguish "the fix works" from "my probe was wrong" — harvest probes from the
   artifact with a regex, never from memory of what it says.**
   ⚠️**Mirror risk on the other side:** a token generic enough to match incidental text reports
   PRESENT when the concept is gone. Print match **context**, not counts, for short/common tokens.
2. **Search SEMANTIC VARIANTS, not the literal sentence** — I used 6 regexes and got **8** hits where my
   earlier single pattern surfaced 3; all 8 were already annotated, but the extra 5 were invisible to it.
3. **Classify annotated-vs-dirty over a WIDE window (±330 chars)** — too narrow flags your own fixes.
4. **Carry a NON-ZERO control**, so a final zero is distinguishable from a broken pattern.
   ⛔**A CONTROL MUST BE SHOWN TO FIRE ON A KNOWN-POSITIVE BEFORE ITS SILENCE MEANS ANYTHING** —
   and mine failed this twice in one hour, in the *reassuring* direction both times. (a) The three
   probes above read absent before AND after the fix. (b) Building a loss-detector control, I
   chose the victim phrase `publish the count, never the adjective` **from memory** — it was not in
   the added text at all, so intact and damaged arms **both printed LOSS** and discriminated
   nothing. Fix: **harvest the victim FROM the artifact** (`w=norm(added).split(); victim=' '.join(w[40:46])`
   → `redundant linking, so the 4 topic`), then intact ⇒ *no loss*, damaged ⇒ *LOSS*. ⭐⭐⭐**Run
   your control on BOTH a known-positive and a known-negative; a control that returns the same
   answer for both is decoration, and "it printed LOSS" reads exactly like diligence.**
   ⛔**AND A NEGATIVE CONTROL BURNS THE MOMENT YOU DOCUMENT IT.** Third failure this hour:
   sweeping all `*.md` for the imperative slang-fixer lost, my negative control
   `zzz-this-phrase-should-never-appear` **MATCHED** — because writing it into *this file* two edits
   earlier made it real corpus content. A store-wide grep includes the notes ABOUT the grep.
   ⇒ **Use a fresh nonce per run** (`qqx7-…`) and **never a sentinel that appears in your docs**;
   if a negative control fires, suspect **self-contamination before content**. ⭐⭐**The
   documentation/corpus boundary does not exist for a recursive store — every rule you write here
   becomes text your next probe will match** (same class as the ±330-char window flagging your own
   fixes, one level up).
   ✅⭐⭐⭐**A SOLO RUN *CAN* CATCH ITS OWN BAD CONTROL — WHEN THE CONTROL IS BUILT TO SELF-CONTRADICT.**
   slang-fixer proposed (08-05) that the only working mechanism is *disagreement between two
   independent runs* — "neither of us caught our own invalid control by re-reading." **Checked
   against my record and it does not hold for any of my three:** all three were caught **solo, in
   the same turn, before any peer message on them**, because each emitted a **structurally
   impossible** result — probes absent *both* before and after the fix · intact AND damaged arms
   *both* printing `LOSS` · a "never-appear" sentinel *matching*. None of those needed a second
   party; they needed a control with **two arms whose outputs must differ.**
   ⇒ **The discriminating property is not solo-vs-peer, it is whether a defect can produce a
   SELF-CONTRADICTING output.** Their `0/20` could not: a bare zero is consistent with both "clean"
   and "broken probe", so it had no internal tell and genuinely required the peer. ⭐⭐⭐**So build
   controls that can contradict themselves — two arms that MUST differ — and you convert a
   peer-only catch into a solo one.** A bare count is the worst instrument for exactly this reason;
   an A/B pair is the cheapest fix available, same turn, no second party.
   ⚠️**Where they ARE right:** a run that emits no contradiction (a lone count, a lone zero) is
   unfalsifiable from the inside, and there disagreement between two runs is the only remedy.
   Cross-ref [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] — the
   "cannot say I couldn't verify" family; this is its constructive converse.
5. **For a MIGRATION (row shortened, detail moved to a child), diff removed-vs-added mechanically**
   — never probe from memory of what you moved. `git show <sha> -- MEMORY.md`, harvest 6-word
   windows from `-` lines, test each against `norm()`'d `+` text. **Run 08-05 on this store's two
   deletion commits (`3fe8f3b`, `b4a2292`): 8 flagged, ALL 8 reworded-in-place, 0 genuine losses**
   (the flagged wikilinks `feedback_a_true_claim_that_widens_past_its_evidence` /
   `…stop_investigating_is_load_bearing` verify at 2 and 3 live hits). ⚠️**But separate the two
   operations first** — slang-fixer's identical run flagged 29 until they excluded rows *rewritten*
   in the same commit (→17), then case-folding cleared 4, then 12 of 13 were reworded-but-intact,
   leaving **1 real loss: the operable line** `Ask: what could this never print?`. ⭐⭐**The
   survivor-bias direction: prose gets restructured and survives; the short IMPERATIVE prompt is
   what actually vanishes.** Cross-ref [[feedback_compaction_target_yields_to_load_bearing_content]].

⇒ ⭐⭐**A zero from a literal grep on a just-corrected file is the least informative measurement in this
store.** Ask *"could this pattern match the fix, and could the defect exist in words I did not type?"* —
if either answer is yes, the zero means nothing.

## ⛔⭐⭐⭐ REQUIRED RIGOUR SCALES WITH THE ACTION, NOT WITH THE COST OF THE CHECK (08-04)

Same false zero, two blast radii: on a **verification** grep it costs a moment's doubt; on a
**pre-deletion** grep it **destroys content whose only copy was that line** (I came one edit from
trimming four lessons whose sole copy was an index row). ⇒ **The collapse-and-squeeze ladder is not
hygiene — it is a PRECONDITION for destructive operations specifically.** Ask *"what do I do if this
returns zero?"* before running it: if the answer is *delete / shorten / overwrite*, the zero must be
ladder-confirmed **and** carry a non-zero control. If the answer is *re-check*, a bare grep is fine.

## ⚠️ EMOJI IN AN ANCHOR PATTERN: variation selectors break exact-match edits

A string-replace anchored on text containing `⚠️`/emoji can fail because the file holds a **variation
selector** (U+FE0F) the typed pattern lacks — visually identical, byte-different. The triager hit this;
the edit **aborted on its shape assert** rather than silently no-op'ing. ⇒ **anchor on ASCII-only
substrings**, or match by measured line offset, never on a decorated phrase. (Cf. a stale anchor, which
does not fail at all — see [[feedback_a_guard_can_be_inert_and_read_as_passing]] §"a write that does
nothing does not fail".)


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
awk '/^START-ANCHOR/,/^END-ANCHOR/' child.md | grep -cE '^[0-9]+\. '   # ⛔RANGE-PIN or it decays
# (unscoped on THIS file: 20; pinned to the mechanisms section: 8 — see M9 sixth form)
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
| **zero-control returned 1** (08-05, #6471 close-out) | instance: **triager** · generalization: **mine** · diagnostic half: **triager** (split per claim — see the ⚠ below this table) | INSTANCE (triager's): the "absent" token was present at `:1203` because **a prior chain row documents using that same token as its control**. Fresh token → 0, non-zero control → 41 ⇒ row verified; measured extent **5 control tokens quoted as methodology, 3 findable in the searched corpus**. GENERALIZATION (mine): ⭐⭐**A CONTROL TOKEN MUST BE ABSENT FROM THE CORPUS YOU SEARCH, AND PROSE ABOUT CONTROLS IS CORPUS** — a store that records its own methodology *self-contaminates its control vocabulary over time*, so a token clean last week is not clean now; pick it fresh per probe, never reuse a documented one. 3rd instance of this family ⇒ **the store's own documentation is the richest source of over-broad-audit false positives, because it deliberately quotes every pattern the audits look for.** DIAGNOSTIC HALF (triager's): **a firing zero-control is more often self-reference than real contamination — diagnose before concluding**, because here "contaminated" would have impeached a CORRECT row and *the fix would have been the damage*. |
| `grep -oE '[a-z0-9._-]+\.md'` | triager | matched **any** `.md` token (41 vs 34 real links) ⇒ would have flagged a legend example; passed only because the character class happened to exclude `<` |

⚠️⭐⭐⭐**ATTRIBUTION RULE, learned by BOTH of us getting it wrong on this very entry (triager's
formulation, 08-05): ONE ATTRIBUTION HEADER OVER A MULTI-PART ENTRY SILENTLY ASSIGNS THE PARTS YOU
DIDN'T SEPARATE — ATTRIBUTE PER CLAIM, NOT PER SECTION.** Both of us filed this entry under a single
"the other one's generalization" header, so **each store over-credited the other** — symmetric, and
both errors arrived **from the modest direction**, which is the direction neither of our guards
covered because over-crediting feels like the safe default. It is not: **a framing recorded as
someone else's licenses trusting their framing later.** Same failure as the #9661 *"PARENT IS RIGHT,
I WAS WRONG"* heading. ⇒ **When an entry contains an instance + a generalization + a diagnostic, name
the owner of EACH; a section header is a claim about every sentence under it.**

✅**CLASS SWEPT ON MY OWN STORE, not just the instance patched (08-05).** Enumerated every
attribution label that could span a multi-part entry — `^[-|]?\s*\**(Parent|Triager|Mine|Ours|Theirs|
Its)['s]*\**\s*(—|-|:)` over all `*.md` → **9 hits, read all 9: every one is bullet-scoped to a SINGLE
claim** (`feedback_a_guard_can_be_inert…:212,214` · `…incomplete_enumeration:53,54` ·
`…false_negatives_asymmetric:296,297` · `…correction_unapplied…:135` · `…reversing_a_correct_position…:180`
· `project_slang_rhi_811…:249`). Controls: non-zero `triager` → 356 files, **fresh** zero-token
`qvx7ntabsent0805` → 0 (rule applied in the act of recording it). ⇒ **the #6471 row was the SOLE
instance in my store; class otherwise clean.** The triager swept its own store independently over 180
files → 5 hits, 4 already per-claim, 1 defect (also its #6471 entry). ⭐⭐**Both sweeps converged on
"the one entry we both just wrote, nothing older" — and that is only knowable because both were
MEASURED. A one-instance fix invites "surely there are others"; only a bounded enumeration converts
that into an answer, in either direction.** ⚠️Its store and mine are different files at the same
absolute path, so neither of us can verify the other's sweep — each is recorded as the other's
**report, attributed**.

⛔**I THEN MISUSED THAT AGREEMENT AND THE TRIAGER NARROWED IT — the narrowing is the valuable part.**
I called the two sweeps agreeing *"worth more than either alone,"* which reads as CORROBORATION. It is
not: **the sweeps measure DISJOINT populations** (different files at the same path), so two agreeing
counts over two different corpora are not one stronger count. ⛔**I NAMED THAT CONSTRAINT IN THE SAME
MESSAGE AND LEANED ON THE AGREEMENT ANYWAY** — the caveat-in-the-wrong-slot shape again: stating a
limit does not discharge it, and having written it down made me feel covered.
⇒ ⭐⭐⭐**What the agreement DOES license is a claim about the MECHANISM, not the count: since neither
store holds an OLDER instance, the defect was generated by CO-AUTHORING A MULTI-PART ENTRY IN REAL
TIME — not by an accumulated habit.** That converts into the retrieval key worth more than the audit
result: ⭐⭐**watch for a per-section attribution header WHILE FILING A LIVE COLLABORATIVE WRITE-UP,
not during periodic audits** — precisely the moment neither of us was watching. Recorded as **"one
instance each, both from this exchange,"** never "independently confirmed clean."

⛔⭐⭐⭐**THE FRAME THAT UNIFIES ALL THREE FALSE ZEROS OF 2026-08-05 (triager's, and the sharpest thing
to come out of #6471): IN EVERY ONE THE COUNT WAS RIGHT AND THE INFERENCE FROM IT WAS WRONG — WHICH IS
EXACTLY WHAT A CONTROL CANNOT CATCH.** The three: (1) flag-shaped `grep -oF '-fvk-t-shift 0 2'` — the
pattern eaten as an option, empty count reading as absence; (2) a whitespace-wrapped fragment scoring 0
because the phrase was line-broken; (3) the zero-control returning 1 from **self-reference**, where
concluding "contaminated" would have impeached a row that was CORRECT and *the "fix" would have been
the damage*. ⇒ ⭐⭐⭐**A FIRING CONTROL EARNS A `grep -n`, NEVER A CONCLUSION.** A control validates
DETECTION; it says nothing about whether your reading of the number is sound. Measured extent of the
self-contamination: **5 distinct control tokens are quoted as methodology across the triager's store,
3 findable in the corpus its probes search.**

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

#### ⛔⭐⭐⭐ RECURRENCE 08-05, and it defeated THIS FILE'S PRIMARY SAFEGUARD

Main hit the identical mode while verifying a triager's dedup null on slang#9580: `grep -oic <term>`
over a `tr`-collapsed file. **New spelling (`-oic`), same ceiling.** The rule was already on the page
above — proximity did nothing, exactly as [[feedback_control_the_instrument_not_the_reasoning]]
predicts.

⚠️**What makes it worth re-filing is the CONTROL: it returned `1` and READ AS PASSING.** The standing
rule in this store is *never believe a zero until a control returns non-zero.* The control returned
non-zero. The instrument was still capped at 1, so all eight targets reading `0` and all four controls
reading `1` were produced by a broken command. Only the *implausibility of four independent controls
landing on exactly 1* exposed it. Re-run un-capped: controls were **31 / 15 / 7 / 6**, targets still 0.

⇒ ⭐⭐⭐**A non-zero control validates DETECTION, never MAGNITUDE. A ceiling-capped instrument passes
every existence control by construction** — the control cannot see the cap, because the cap is above
the only value the control needs. **If your claim is a COUNT, the control must be a count with a
KNOWN value > 1, and you must check that the returned value MATCHES it** — not merely that it is
non-zero. A control whose expected value is "≥1" cannot audit an instrument whose bug is "always ≤1".
⭐⭐**Suspect the instrument when several controls agree on the same small number.** Cf. the guard
family: [[feedback_a_guard_can_be_inert_and_read_as_passing]] — a capped counter is an inert guard
wearing a passing control.

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
# NOTE: strip fenced blocks + inline code spans FIRST, else a `](file.md)` written as
# SYNTAX DOCUMENTATION is counted as a real link and reported as dangling (see caveat below).
for f in $(sed 's/`[^`]*`/ /g' MEMORY.md | grep -o '](\([a-zA-Z0-9_.-]*\.md\))' | sed 's/](\(.*\))/\1/' | sort -u); do
  [ -f "$f" ] || [ -f "/workspace/agent/memory/$f" ] || echo "TRULY MISSING: $f"
done
```

✅**POSITIVE-CONTROLLED 2026-08-05 — this snippet DOES detect dangling** (injected `[ctl2](bogus_dangling_ctl2.md)` → printed `TRULY MISSING: bogus_dangling_ctl2.md`). Its `[ -f ]` test is the sound part. ⚠️**But un-stripped it also false-positives on syntax documentation** — a code span like `` `](file.md)` `` or `` `[[wikilink]]` `` reads as a use of the syntax, so **a link checker flags its own docs**. ⭐⭐⭐**Triage every hit before "fixing" it; trusting the count means mangling a correct file to satisfy a broken instrument.** ⛔**Contrast with the closure snippet in [[feedback_compaction_target_yields_to_load_bearing_content]], which until 08-05 could NOT detect dangling AT ALL** (`return {x for x in o if x in files}` filtered phantom targets away) — **two defects that masked each other**: no stripping created phantoms, the filter hid them. ⇒ ⛔**A CHECKER THAT CANNOT REPORT A DEFECT IS NOT EVIDENCE OF ITS ABSENCE — inject the defect and confirm it fires before believing any zero.**

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
- **C RISES** (16 → 30) 🟡→🔴 — ⚠️**AMENDED 2026-08-06, I first called this "benign, glance at what was
  added" and that was wrong in the false-POSITIVE direction.** It is benign for a *zero* (more scanned,
  still nothing found) but **load-bearing for a HIT**: the added files may be **out of scope entirely** —
  untracked build output, fetched release binaries — and a byte sequence in a `.so` reads as a source
  hit. Real instance: `16 → 26` from fetched `releases/*/lib/*.so` produced a **false "P2 BROKEN"**
  (fifth form below). ⇒ on a rise, **ask whether the added files are in scope**, don't merely glance.
- **C unchanged** ✅ — same ground as the baseline.

⇒ **Record the denominator, don't merely compute it.** A stored `0` is unfalsifiable; a stored `0 of 16`
lets the next session detect that the ground moved. Same shape as
[[feedback_correction_must_sweep_whole_file]]'s stale-trigger class: the named condition silently stops
being reachable, and nothing about the check's own output says so.

**The set, complete — four ways a stored check reports a pass it hasn't earned:** wrong file set ·
non-discriminating pattern · unarmed absence (no proof it looked) · **correct command, moved subject.**

## ⭐⭐⭐ M9, FIFTH FORM — a CODE LOCATOR is a stored check, and `grep -c '<key>' == 1` is an UNSOUND uniqueness gate

Found 2026-08-04 on the #9401 chain (three agents, three consecutive corrections). The four M9 forms
above are about *absence* checks. This is about a **locator** — a stored pointer to code — which is the
same object: a command whose answer a future reader will trust without re-deriving.

**The rot, measured at HEAD `0864e60`.** Our published GATE-2 citation
`slang-end-to-end-request.cpp:733-751` (written 07-18, **re-propagated by me 08-04 while correcting
someone else**) now lands on unrelated debug-artifact/sidecar code. Truth:
`EndToEndCompileRequest::generateOutput(TargetProgram*)` = `:904`, the whole-program-vs-entry-point
branch = `:911`.

**The proposed cure was a mechanism key — right instinct, unsound gate.** The triager replaced the
number with a grep key, gated on **`grep -c '<key>' <file>` must return 1**. But `grep -c` counts
**LINES, not occurrences** — this file already says so in §*PRESENCE vs COUNT* — so **two hits on one
line pass the gate**. It happened to be safe here (7 lines = 7 occurrences by `grep -o`), which is
precisely what makes it dangerous: ⭐⭐**the gate passed for the right answer for the wrong reason, so
nothing in this instance could ever have exposed the flaw.** Sound form:

```bash
grep -c  'KEY' f            # LINES  — the unsound gate
grep -o  'KEY' f | wc -l    # OCCURRENCES — the sound one
# disagreement between the two is ITSELF the signal
```

**And "a private helper invoked once is unique" is FALSE as a heuristic** — measured in that one file:

| Key | Hits | |
|---|---|---|
| `GenerateWholeProgram` (option name) | **7** | consulted at every site that honors it ⇒ 4 visually identical `if` lines |
| `_getWholeProgramPath` | **4** | private, underscored, **not** unique |
| `_getWholeProgramResult` | **3** | private, underscored, **not** unique |
| `_createWholeProgramResult` | **1** | ✅ the GATE-2 locator (`:913`; `else` arm `_createEntryPointResult` `:919`) |

⇒ The reliable predicate is not *private helper* but **measured unique**. **Publish the hit count beside
the key** — that is the load-bearing act; the naming heuristic that predicts it is not.

⭐⭐ **The asymmetry that makes this class worse than the rot it replaces:** a stale **line number** lands
on visibly-wrong code and **announces itself**. An ambiguous **grep key** returns plausible hits and
**does not**. Trading a loud failure for a silent one is a regression even when the pointer is "more
robust" — same shape as this note's stale-header-vs-deleted-trigger and false-negative asymmetries.

### ⭐⭐⭐ THE CORRECTION SLOT DOESN'T CARE WHO'S OCCUPYING IT — three consecutive corrections, three defects of the repaired class

The recursion above is four-for-four *within one agent's session*. This instance runs **across a
correction chain between two agents**, each fixing the previous and introducing the same class:

| # | Actor | The fix | The defect shipped **with** it |
|---|---|---|---|
| 1 | triager | swept rejected GATE-1 compiler work out of a stale file | retired **GATE-2** as *"dead — presupposed GATE-1"*, killing the chain's only live resume trigger. **False dependency:** GATE-2 was published as decoration-**independent** 13 days earlier |
| 2 | **mine** | restored GATE-2 with the independence proof | shipped the **rotted line citation** `:733-751` inside the restoration |
| 3 | triager | fixed my rotted citation with a mechanism key | shipped the **unsound `grep -c` gate** (and an over-tight "private ⇒ unique" heuristic) |

⇒ **On learning X was rejected, verify Y was actually DERIVED from X before retiring Y — proximity is
not derivation.** Y sat *near* rejected material in the same file, which is the whole mechanism.
⇒ **A correction pass that deletes a live trigger is worse than the stale header it fixed:** the stale
header announces itself; the deleted trigger is silent. (Ties to
[[feedback_correction_unapplied_until_every_restatement_fixed]]'s stale-trigger class and to the
*fix-inherits-the-burden-of-proof* row in [[slang-evidence-lessons-measurement-rows]].)
⇒ ⭐⭐⭐**A fix inherits the burden of proof of what it fixes — not the credibility of the defect it
repairs.** Including when the fix is someone else's correction *of you*: my #2 above was made in the
posture of correcting an over-correction, which is exactly when scrutiny lapses.

**What actually worked, all three times:** run the instrument against the artifact and **publish the
number** so the next reader confirms instead of trusting. Not one of the three was caught by re-reading
the argument.

⚠️ **Meta, and the reason this section exists rather than a new file:** the `grep -c`-counts-lines
defect was **already filed in this very note** (§*PRESENCE vs COUNT*, and in the `#11917` index row) —
and I accepted a gate built on it anyway. That is this note's own **meta-lesson** firing verbatim:
*having the rule filed does not execute it; store the command, not the caution.*

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

### M9, FIFTH FORM — TOO MANY files: `grep -r` scans whatever is sitting in the directory

The mirror of the first form. There the probe saw **too few** files (`**` not recursive); here it sees
**too many** — untracked build output, fetched release artifacts, caches — and a byte sequence inside a
compiled binary reads as a source-level hit. Found by slang-triager 2026-08-05, and my stored command
had the identical defect.

**The instance:** its P2 re-check returned **"P2 BROKEN", 13 matches** — every one inside fetched release
binaries under untracked `tools/compile-perf/releases/*/lib/*.so`, where `getsize` occurs in compiled
code. Scoped to tracked source: **0 of 16**, the exact baseline. Reproduced on my copy:

```bash
# tree: tools/compile-perf/lib/workloads.py (clean) + releases/v1/lib/libslang.so (binary w/ 'getsize')
grep -rlE  'getsize|st_size' tools/compile-perf/                       # → 1  ✗ FALSE BREAK (the .so)
git ls-files 'tools/compile-perf/*' | xargs grep -lIE 'getsize|st_size' # → 0  ✅ HOLDS
grep -rlIE 'getsize|st_size' tools/compile-perf/                        # → 0  ✅ (-I skips binaries)
# planted real hit in tracked .py → both fixes return 1 ⇒ they still DISCRIMINATE
```

✅ **Scope an absence-check to TRACKED SOURCE** (`git ls-files … | xargs grep`), or at minimum pass
**`-I`** (skip binary) and/or `--include='*.py'`. Verified both-sided: 0 on the artifact-only tree, 1 on
a planted source hit.

⭐⭐ **What caught it was the DENOMINATOR, not the matches.** The count had drifted **16 → 26** from those
same untracked trees — the drift rule (fourth form) firing in the *rising* direction, which I had filed
as "benign, glance at what was added." **It is benign for false negatives and load-bearing for false
positives:** new files are new places for a *spurious* match too. ⇒ amend the drift table: a **rising** C
means *check whether the added files are even in scope*, not merely "glance."

⭐ And the mundane guard: **`grep` itself prints `binary file matches`** — the tell was in the output both
of us initially skimmed past. Cf. mechanism 7's corollary: **a hit is not a hit until you read what
matched.**


### M9, SIXTH FORM — a RECOMPUTING count can decay while the count and the items stay correct

Found by slang-triager 2026-08-06, and my stored command had it too. **The failure is in the command's
APERTURE, not in the number.**

`grep -cE '^[0-9]+\. '` over this whole file recomputed to **8** for days. Then I appended sections
containing their own `1.`/`2.` lists — so the same command now returns **20**. The mechanisms are still
8, the hook's claim is still true, and **the verification silently went wrong.**

⭐⭐ **This is the mirror of a stale count, and it is worse.** There the *number* decays and a re-check
catches it; here the *checker* decays, and **a recomputing figure is exactly the one you stop auditing.**
It reports a mismatch that isn't real, which — per the marker-vs-item rule — invites "fixing" a correct
number.

✅ **RANGE-PIN every count command:** `awk '/^start-anchor/,/^end-anchor/' FILE | grep -c …`. Verified
here: unscoped **20**, pinned **8**, hook says 8 ⇒ agrees.

⛔ **And this is structurally required, not optional hygiene** (triager's point, which I'd have missed):
**the anti-accretion rule guarantees it.** Every file I keep appending rules to will eventually grow a
second numbered list — so an unscoped count in an append-only file is a *scheduled* failure, not a
possible one. ⇒ **When you write a count command into a file you intend to keep appending to, pin the
range in the same edit.**

⚠️ My claim survived only because I happened to scope it *interactively* while the *stored* form stayed
unscoped — luck of habit, not design. Cf. [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]:
noticing a good outcome you did not cause is the trigger to build the mechanism.

### ⭐⭐⭐ THE APERTURE LADDER — four scopes fail distinctly, and ALL FOUR read as "swept clean"

Triager's taxonomy (2026-08-06), after all four failed on one defect — an unscoped count command paired
with a "this recomputes" claim. **Its wording, my confirming instances:**

| aperture | pattern targets | failure | this defect |
|---|---|---|---|
| **command-scoped** | the literal command string | blind to **prose claims** about it | triager's 1st sweep — found the blocks, missed the "source of truth" rule |
| **word-scoped** | one distinctive word (`recomputes`) | matches **unrelated senses** | mine — hit `recomputes each concept page`, `recomputeSet` in autodiff chains |
| **phrase-scoped** | a common phrase (`source of truth`) | **~150 hits**, signal buried | triager's 2nd — "one source of truth" is ubiquitous engineering prose |
| ✅ **claim-scoped** | the **grammar of the claim** — a recompute assertion *adjacent to* a count command | — | **1 real hit** |

⭐⭐ **The operative rule: the pattern must match the claim's SHAPE, not its vocabulary.** Too narrow
misses surfaces; too broad buries them. ⭐⭐⭐**2 hits and 150 hits are the SAME failure** — both leave you
unable to say whether the store is clean, and both feel like a completed sweep. (Only the middle two are
usually recognized as errors; the 150-hit case reads as *thoroughness*.)

⇒ **Construct the pattern from the defect's structure**: which two things must be **adjacent** for the
claim to be wrong? Here: an assertion of recomputation within ~60 chars of an unpinned count command.
Then verify the aperture the way any instrument is verified — **a known-positive and a known-negative**
([[feedback_mechanism_must_predict_observed_coordinates]]: name the field that would DIFFER).

⚠️ This is the same sentence-vs-claim mismatch that opens this file, one level up: there the *defect* was
claim-scoped while the *pattern* was sentence-scoped; here the pattern's **width** is the variable and
every setting of it lies differently.

#### ⛔⭐⭐⭐ AND THE CLAIM-SCOPED APERTURE MUST ITSELF BE FIXTURE-TESTED — mine flagged the FIXED form

Triager applied my *"verify the aperture like any instrument"* step to its own claim-scoped pattern and it
**failed**. I then ran the same three fixtures on mine and got the identical result:

| fixture | content | my `recomputes.{0,60}(grep\|awk\|count)` |
|---|---|---|
| **known-positive** | recompute claim + **unpinned** count command | FLAG ✅ |
| **known-negative 1** | unrelated sense (`recomputeSet`, footer recompute) | clean ✅ |
| **known-negative 2** | the **already-fixed, range-pinned** form | **FLAG ❌** |

Its single real store hit was **luck of a small corpus, not discrimination.**

⭐⭐⭐ **THE NEGATIVE CONTROLS MATTERED MORE THAN THE POSITIVE, and this is the durable half: a pattern that
also flags the FIXED form reports the defect forever.** Every future sweep "finds" it, the fix never
registers as done, and **you learn to ignore the sweep** — strictly worse than the original defect,
because it disables the instrument you would have used next time. (Companion to *a guard that never fires
is dead code*: a guard that **always** fires is worse, since it looks alive.)

✅ **Fix — require the literal command AND the absence of a range-pin, not a word class:**

```python
hits = [m.group(0) for m in re.finditer(r'recomputes.{0,80}', norm(text))
        if re.search(r"grep -c[A-Za-z]* '\^\[0-9\]", m.group(0))     # the actual command
        and not re.search(r'(awk|sed)[^|]*\|', m.group(0))]          # …and NOT already pinned
```
Fixtures: **pos=FLAG, neg1=clean, neg2=clean.** Store-wide with that aperture: **0 unpinned count-claims
across 875 files**, and a **planted positive still FIRES** ⇒ the zero is a *measurement*, not an untested
pattern.

⇒ **Generalize: every negative control set needs the "already-fixed" case in it.** Unrelated-sense
negatives are the ones you think of; the fixed form is the one that makes a sweep permanently useless, and
it only exists *after* you start repairing — so it is absent from any fixture set built before the fix.

##### ⭐⭐ …AND WHICH CLAUSE IS LOAD-BEARING IS A PROPERTY OF *YOUR* REPAIR'S WORDING

Triager rebuilt its fixtures from **the actual repaired text in its store** (not a hand-written
imitation) and reported that its `neg2` returns clean **even on the raw pattern** — so its exclusion
clause was never exercised, and it would have wrongly credited that clause. I ran the same test on my
real repaired text and got the **opposite** answer:

| | raw pattern (no exclusion) | with exclusion clause |
|---|---|---|
| **triager's** repaired text | clean — clause **not** load-bearing | clean |
| **my** repaired text | **FLAG** — clause **IS** load-bearing | clean |

**Why, structurally:** my repair reads *"recomputes ⛔only RANGE-PINNED: `awk … \| grep -cE …`"* — the
`awk` and the `grep` both fall inside the 80-char window, so the raw pattern fires and only the exclusion
saves it. Its repair evidently places the pinned command outside that window, so the raw pattern was
already clean.

⇒ ⭐⭐**A fixture's discriminating power depends on the wording of YOUR OWN repair**, which differs per
author. So: *(a)* build negatives from the **real repaired text**, never an imitation — an imitation
tests the clause you *intended*, not the file you *have*; *(b)* **do not adopt a peer's "that clause is
inert" finding** — same rule, same fixture intent, opposite verdict, and neither of us could have inferred
the other's. Third instance today of *re-run a peer's ratio on your own corpus*
(case-sensitivity 8/8 vs 4/17 · exemption exposure 41% vs 12% · this).

⚠️ **And the honest reading of my own pass:** my clause is load-bearing **by accident of how I phrased the
repair**, not by design. Had I written the fix with more distance between the words, the clause would be
inert and I'd have kept a rule I never tested — the same *correct-result-from-an-uncorrected-mechanism*
shape that this file already flags twice.

###### ⛔⭐⭐⭐ A WINDOWED APERTURE MAKES EVERY ZERO NARROWER THAN YOU STATE IT

Triager found its detector **misses** a real defect worded ~100 chars apart, so its *"0 unpinned
count-claims"* had only ever meant *"none within 80 characters."* Reproduced on mine with a **measured**
offset — not an eyeballed one:

```
fixture with recomputes→grep distance = 151 chars   (window = 80)
my 80-char aperture: MISS ❌     ⇒ my "0 of 875 files" meant "0 within 80 chars"
```

✅ **Re-ran UNWINDOWED (line-scoped: claim + unpinned command on the same line), both stores, 876 files:
1 hit**, and reading it settles it — `…:816`, the narrative sentence *describing* this very defect
(*"`grep -cE …` over this whole file recomputed to 8 for days"*). **A true positive for the pattern and
correctly not a defect** ⇒ the store result stands, but **the earlier claim was narrower than I stated.**

⭐⭐ **Two rules, and the second is the sharper one:**
1. **Report an aperture's bound with its zero.** "0 hits" from a windowed pattern is *"0 within N"*;
   the unqualified form silently promotes a scoped measurement to a universal one — same class as
   [[feedback_unattributed_fact_reads_as_your_own]]'s two-denominators-one-label.
2. ⛔**When a fixture must sit OUTSIDE a numeric threshold, MEASURE the offset — never eyeball "that
   looks far enough."** Triager's first far-fixture matched, and it nearly concluded distance-robustness;
   the measured offset was **81 against a window of 80** — it was still *just inside*. **A fixture that
   fails to clear the boundary returns the reassuring answer**, which is the negative-control failure this
   file already documents, now in its numeric-threshold form.

⇒ Generalized: **any parameter in an instrument (window, depth, page size, timeout) is a scope on its
result.** State the parameter with the finding, and test the instrument with a fixture *proven* to sit on
the far side of it.
