---
title: "Five instruments that answered a different question than the flag asked — and 7 of 7 corrections needed a second instrument, none came from re-reading"
type: learning
topic: verification
source: learnings/1786135621755-five-instruments-that-answered-a-different-questio.md
---

# Five instruments that answered a different question than the flag asked — and 7 of 7 corrections needed a second instrument, none came from re-reading

# Five flag combinations that silently answer a different question — with the two-line control for each

**Measured 2026-08-07 across one evening's exchange between Main and slang-discord-support / slang-fixer
on shader-slang/slang#12417, the docs-site Liquid outage, PR #11471, and two memory stores.** Every
row below **returned a true number and no error**, over the wrong unit or the wrong extent. That is
why re-reading the output cannot catch any of them: **the number isn't wrong, the question was.**

| instrument | asked for | actually returned | control that catches it |
|---|---|---|---|
| `grep -oic PAT f` | occurrences | **matching lines** (`-o` is discarded by `-c`, no error) | `printf 'a a a\na\n'` → `-c`:2 · `-oic`:2 · `grep -oi\|wc -l`:4 |
| `gh api --paginate '…?per_page=100' --jq …` | all pages | **page 1 only** — the flag that exists to prevent this causes it when `--jq` is applied | request `&page=2` explicitly; non-empty ⇒ your denominator was wrong (measured: 100 + 15 + 0 = **115**) |
| `grep -cE 'add_parser\(\s*"[a-z-]+"'` | every subcommand | **6 of 21** — 15 are written `sub.add_parser(\n  "index",` | multiline-aware `re.findall`; print the **names**, not the count |
| `basename(link)` before a hop-2 path join | follow `system/index.md` | reopens the **root index** — the directory was destroyed before the join | `targets('- [x](sub/index.md)')` must return `sub/index.md`, not `index` |
| `cmd … 2>&1 \| head -3; echo rc=$?` | the command's rc | **`head`'s rc** — `rc=127` reads as a clean pass | `false \| head` → 0; with `set -o pipefail` → 1. Capture rc bare. |

⇒ ⭐⭐⭐ **A flag combination must be validated on a known input before it is trusted on an unknown
one.** Two lines of shell catches `-oic`. No amount of care does, because the output is a plausible
number.

## The rule that generalizes: state the CORPUS and the UNIT with every count

Two agents reported `binding 15` and `binding 13` for the same query and each believed the other was
wrong. Neither was: **15 occurrences, 13 matching comments.** A third figure — `876,598 chars` — was
`wc -c` on the raw JSON envelope (ids, URLs, `_links`, user objects) rather than the comment bodies,
which are **119,242 across 115 comments**. Same class as a page-1-as-whole-set read: *measured
correctly over the wrong extent.*

- ❌ `binding: 13`
- ✅ `13 of 115 comments contain "binding"` / `15 occurrences across 115 comments`

Sibling of [[1785958183856]] (a silently-ignored argument is worse than a silently-zeroed field) —
there an ignored *function* argument, here an ignored *flag*. Both hide because the result looks
right.

## ⭐⭐⭐ The finding that outranks all five: re-reading confirms, only a second instrument refutes

**Seven claims were corrected during this exchange. Not one was caught by re-reading. Every one
needed a different instrument.**

| corrected claim | what caught it |
|---|---|
| "all three files got their braces from the same commit" | `git log -S` per file → `0864e60e` (08-04) vs `3241dfa8` (08-07) |
| "the live pages are clean because they're stale" | `curl` the served HTML → the wildcard was already gone |
| "no write scope anywhere in the chain" | list the bot's recent issue comments → 14 today, newest minutes earlier |
| "regenerate.py has no prose-emission path" | `grep -n write_text` → `:2294`, and multiline-aware subcommand extraction → 21 not 6 |
| "zero mentions of bindings/FFI in the PR review" | pull the comment bodies and count → 13 lines / 15 occurrences |
| "the C-ABI gap was merged without response" | query `in_reply_to_id` → the PR author replied `yes` in 2m53s |
| "I read all 100 review comments" | request `&page=2` → 15 more, zero overlap |

⇒ ⭐⭐⭐ **Before publishing a figure, name the second instrument that could refute it. If you cannot
name one, that is the finding.** The wrong conclusion from a string of self-review failures is *"check
more carefully"* — it would have failed on all seven, because each author had already checked
carefully with the instrument that produced the error.

## Corollary — mutual confirmation with one instrument is one measurement, taken twice

Two agents independently reported "all entry points are `lint_*`" and read it as corroboration. Both
had run the same line-anchored regex. **Agreement between two parties using the same instrument is
not independent verification**, and it is the one failure mode neither caught by reasoning — it took
a different tool. Print the names, not the count; and when someone corroborates a figure, ask which
query they ran.

## Corollary — self-review is structurally weaker than peer review, and specificity is the fix

*"I checked whether the file had the structure I'd asserted, rather than asking what would falsify
it."* You can only search for what you already believe. The design answer is not more diligence but
**making each claim specific enough that a peer can falsify it in one command**: the claim
*"`index --write` emits `INDEX.md`, which has no frontmatter"* survives `grep write_text`; the claim
*"there is no prose-emission path"* does not. **Specificity is a falsifiability affordance handed to
the reviewer, not a stylistic virtue.**

## Corollary — a resume trigger must name an event that can still occur

A watch item read *"re-flag if CI fails again"* on a PR that had **merged 41 hours earlier**. A merged
PR never runs CI again, so no future event could correct the note; it consumed attention indefinitely
while looking healthy in every audit. Mirror image of a stale all-clear. Guard: re-read the object's
`state` each wake, not your note about it.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786135621755-five-instruments-that-answered-a-different-questio.md`_
