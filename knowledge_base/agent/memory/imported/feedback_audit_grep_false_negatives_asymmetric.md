---
name: feedback_audit_grep_false_negatives_asymmetric
description: "An audit grep's false NEGATIVE reads as 'content is gone' and justifies undoing a correct edit — the asymmetry makes it worse than a false positive, and worst of all before a destructive op. Cure: the FIVE-part normalization instrument (link syntax, hard wrap, emphasis, inflection, CASE) + a control PROVEN to fire on a known-positive before any zero means anything. The 'stored re-check command is CODE' half (M9 family, aperture ladder) split to [[feedback_a_stored_verification_command_is_code]]."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5c386752-328d-4e3b-85ea-e19e41121b53
---

# A verification grep's FALSE NEGATIVE is asymmetrically dangerous — it reads as "content is gone"

**Distilled 2026-09-01** from a 67 KB accretion that had grown to hold several concepts under
one name. The core (this file): why the false-negative direction is dangerous, the five-part
instrument, the escalation ladder, and control discipline. The separable concept — *a stored
re-check command is CODE and needs a failing test* (the M9 family, the aperture ladder) — is
now [[feedback_a_stored_verification_command_is_code]].

## Why the direction matters

- A false **positive** ("still present" when it's gone) leaves stale text — bad, but the next
  reader can see and fix it.
- A false **negative** ("gone" when it's present) reads as **content loss** — precisely the
  finding that justifies re-adding bulk you just correctly removed, or reverting a good edit. It
  manufactures the evidence needed to undo correct work, and **it looks like diligence.**

⇒ **Never act on a zero-hit audit until a control grep returns non-zero.** Same discipline as
"N registered, M executed": a broader control must be non-zero before you believe any narrow zero.

⛔⭐ **Required rigour scales with the ACTION, not the cost of the check.** The same false zero
costs a moment's doubt on a *verification* grep but **destroys the only copy** on a
*pre-deletion* grep. Before running, ask *"what do I do if this returns zero?"* — if the answer is
delete/shorten/overwrite, the zero must be ladder-confirmed AND carry a non-zero control; if it is
re-check, a bare grep is fine.

## The eight mechanisms of a false zero (probe too narrow)

Reproduced, not recalled (2026-08-03, #12331 — see [[project_12331_spirv_opt_size_preset_Os]]):

1. **Typography** — en-dash `–` / em-dash `—` / curly quotes vs the ASCII you type from memory
   (`54-55` → 0, `54–55` → 1).
2. **Case** — index prose in SCREAMING CAPS, grepped canonical-lowercase (or vice versa). In this
   store CASE is the *strongest* form: the emphatic register is ALL-CAPS, so most load-bearing
   rules sit in a case a reader won't retype (8/8 false zeros case-sensitive, 8/8 found case-folded).
3. **Markdown inside the phrase — two failures, `-F` fixes only one.** (a) as regex, `**14**`
   never matches `14`; (b) as literal bytes, emphasis mid-phrase means the clean phrase you
   remember is not the text on disk. Probe a fragment *inside* one styled run, never one straddling
   a `**` / backtick / link boundary.
4. **Over-broad prose match** (the mirror) — hits the *description* of a problem, not an instance.
   Anchor to structure (frontmatter key, `^` anchor, line position), not vocabulary.
5. **Hard line wrap** — grep is line-oriented; a wrapped phrase can never match. `tr '\n' ' '`
   alone still fails because the continuation indent survives — you must **collapse AND squeeze**:
   `tr '\n' ' ' | tr -s ' '`. (Measured: 380 of 448 files here have indented continuations, so
   collapse-only fails silently on ~85% of the store.)
6. **`.` matches one BYTE, not one character, when the locale is unset** — a single `.` can never
   match a multi-byte char (en-dash is 3 bytes). Use `.*`, or `LC_ALL=C.UTF-8`, or a literal ASCII
   fragment with `-F`; never hand-count dots.
7. **Intervening words** — you remember the phrase tighter than you wrote it (`'collapse and'` vs
   *"collapse newlines **and squeeze** whitespace"* → 0). Probe 2–4 words max, or bridge with `.*`.
   Corollary: **a hit is not a hit until you read WHAT matched** — a late-ladder hit can land on
   your own cure line and close a true absence as "found".
8. **Over-escaping in a shell probe** — escaping metacharacters `-F` already neutralizes, or for
   the wrong quoting layer. With `-F`, escape nothing; `printf '%s' "$PAT" | od -c` to see the
   bytes grep receives.

## The five-part normalization instrument (use all five; any one alone lies)

```python
def norm(s):
    s = unicodedata.normalize('NFKC', s)          # … → ..., ① → 1, ² → 2
    s = re.sub(r'[*`~]', '', s)                    # emphasis mid-phrase — NOTE: NO underscore
    for d in '—–−‐‑': s = s.replace(d, '-')  # dash variants
    return re.sub(r'\s+', ' ', s).lower()          # hard wrap + CASE
```

⛔ **Do NOT add `_` to the strip set** — 70 of 84 wikilinks here contain underscores; stripping it
mangles `feedback_no_push_after_approval` → the token a link/concept probe needs. For inflection
(`stalls`/`stalled`) match a **stem**; don't widen the strip set. ⭐ **A rule present in the index
and absent from the operable child is worse than absent everywhere** — the index makes it feel
covered, and the child is what runs; when you add a form here, grep the index for it and reconcile.

## Controls — a zero means nothing until a control has FIRED

⛔ **A control must be shown to fire on a known-POSITIVE before its silence means anything** — and
harvest the probe/victim phrase **from the artifact with a regex, never from memory** (a probe
invented from memory can read "absent" both before and after the fix, proving nothing).

⛔ **A negative control burns the moment you document it** — a sentinel written into *this* file
becomes real corpus content a store-wide grep will match. Use a **fresh nonce per run** (`qqx7-…`);
if a negative control fires, suspect self-contamination before content. The documentation/corpus
boundary does not exist for a recursive store — every rule you write here becomes text your next
probe matches.

✅⭐ **Build controls that can self-contradict — two arms that MUST differ.** A bare zero is
consistent with both "clean" and "broken probe", so it needs a second party to catch; an A/B pair
whose arms must differ (intact ⇒ *no loss*, damaged ⇒ *LOSS*) converts a peer-only catch into a
solo, same-turn one. Cross-ref [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]].

## The ladder IS the discriminator — it separates the two failure directions

A zero is **not a verdict, it is a question**; *where the zero dies* is the answer.

| Where the zero dies | Meaning |
|---|---|
| **Steps 1–4** (punctuation → `-i` → shorter substring → collapse+squeeze) | your PATTERN was wrong — content is present |
| **Survives step 5** (synonym / inflection / stem) | the CONTENT is genuinely missing — act on it |

Recording only the false-negative half would teach the next reader to dismiss a *genuine* absence;
the ladder is what tells them apart. Pairs with [[feedback_mechanism_must_predict_observed_coordinates]]
— a check that can only fail one way carries no information.

## Cure — the actual commands (two NAMED, do not cross them)

```bash
grep -ciF 'literal fragment'  file              # -F: markup inert; -i: case. For EXISTENCE.
tr '\n' ' ' < file | tr -s ' ' | grep -ciF '…'  # WRAPPED phrase: collapse AND squeeze
grep -c  ''                   file              # CONTROL: total lines — must be non-zero
```

⚠️ **The collapse+squeeze cure returns a BIT, not a count** — it makes the file one line, and
`grep -c` counts lines, so it can only return 0 or 1. Keep existence and counting as two separate
named commands; reusing the collapse cure for a count silently reports 1 for any N. Count claims
belong to [[feedback_a_stored_verification_command_is_code]].

## Two adjacent traps

- **Emoji in an anchor pattern**: a string-replace anchored on `⚠️`/emoji can fail because the file
  holds a variation selector (U+FE0F) the typed pattern lacks — byte-different, visually identical.
  Anchor on **ASCII-only** substrings or a measured line offset. (Contrast a *stale* anchor, which
  doesn't fail at all — [[feedback_a_guard_can_be_inert_and_read_as_passing]].)
- **A link/dangling check scoped to ONE store is itself a false negative.** There are two memory
  stores at different roots; a check scanning only one reports a live file as dangling, justifying
  keeping duplicated detail. Check both roots before calling a link dead — and **strip fenced/inline
  code first**, or a `](example)`-style span written as *syntax documentation* (like the illustrative
  `](example)` and `[ctl2](bogus-control-token)` tokens in this very file) is counted as a real link
  and flagged. ⭐⭐⭐ **A checker that cannot report a defect is not evidence of its absence — inject
  the defect and confirm it fires before believing any zero.**

## The meta-lesson

I had the lossy-search rule filed *and cited it in the same session* while committing its sibling
twice. **Having the rule filed does not execute it** ([[project_critique_gate_pulls_pattern_builtin_floor]])
— what closes the gap is a *default command* (`grep -iF` + a fired control), not an awareness.
**Store the command, not the caution.**

## Cross-links

- [[feedback_a_stored_verification_command_is_code]] — the split-off half: a stored re-check is CODE.
- [[feedback_correction_must_sweep_whole_file]] — the sweep this instrument serves.
- [[feedback_shared_index_is_generated_use_shared_root]] — the slug-lookup form of the same class.
- [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]] — store the datum with the rule.
- [[feedback_name_what_you_held_fixed]] — a check measuring a proxy carries no information when it agrees.
