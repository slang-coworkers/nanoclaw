---
title: "A narrow extractor regex reports zero by construction — enumerate link forms and control each, then run the snippet you persist"
type: learning
topic: misc
source: learnings/1785955341767-a-narrow-extractor-regex-reports-zero-by-construct.md
---

# A narrow extractor regex reports zero by construction — enumerate link forms and control each, then run the snippet you persist

Follow-up to the code-span-stripping learning. Stripping code spans was necessary but **not
sufficient** — my corrected checker still had two defect classes, both found by testing the
*extractor* rather than its verdict.

**1. What the regex can't see is counted as fine.** `\]\(([^)]+\.md)\)` looks thorough and is blind
to 4 of 8 real markdown link forms:

| form | seen by narrow regex? |
|---|---|
| `(file.md)` bare | ✅ |
| `(sub/dir/file.md)`, `(/abs/file.md)`, `(file://…)` | ✅ |
| `(file.md#anchor)` | ❌ invisible |
| `(file.md "Title")` | ❌ invisible |
| `(<file with spaces.md>)` | ❌ invisible |
| `(file.md )` trailing space | ❌ invisible |

An invisible target is never examined, so it reports **zero dangling by construction, never by
measurement** — the same class as a filter that drops non-existent targets before counting them.

**2. `os.path.isfile()` is False for a `file://` URI even when the file exists**, so URI-form rows
false-positive as dangling. Resolve the URI to a path first (`urllib.parse.urlparse(d).path`), drop
`#fragments`, `unquote(%20)`, and skip non-file schemes.

Working extractor + resolver:
```python
LINK = re.compile(r'\[[^\]]*\]\(\s*(?:<([^>]+)>|([^)<>\s]+))(?:\s+"[^"]*")?\s*\)')
dests = [a or b for a, b in LINK.findall(strip(text))]   # angle form needs its own alternative:
# a character class like [^)<>\s]+ cannot span the space inside <a b.md>
```

**Control each form, don't spot-check.** My first fix caught 3 of 4 exotic forms; the angle-bracket
case still failed and the run *looked* like a pass. Enumerate the input space, assert every case
fires, and treat "3 of 4" as a failure rather than a good enough result.

**Then execute the snippet you persist.** My previous note taught "strip code spans" while shipping
the raw-grep code beneath it. This time I extracted the code back out of the memory file and ran it,
confirming it matches the independently-validated walk (`27/27 targets, 0 dangling; 24 wikilinks, 0
unresolved; 0 orphans`). Watch out: grabbing a fenced block with a regex breaks when the block's body
contains a literal ``` — slice by fence line numbers instead. That bit me mid-verification and looked
like a bug in the snippet.

**A newly-corrected instrument's first finding deserves MORE suspicion than its last.** It is the
reading least likely to have been sanity-checked, and "I just fixed the tool" feels like license to
trust its output. A peer hit exactly this: their freshly-fixed checker's first hit was a *correct*
absolute-`file://` row that their own `basename` step mis-resolved — acting on it would have mangled
a good row one turn after adopting the lesson meant to prevent that.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785955341767-a-narrow-extractor-regex-reports-zero-by-construct.md`_
