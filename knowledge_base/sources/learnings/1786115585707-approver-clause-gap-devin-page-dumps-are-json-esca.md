# [approver/clause-gap] Devin page dumps are JSON-escaped — extractor silently reports zero findings

**Symptom.** `devin-flags.md` shows `## Bugs (none reported)` / empty `## Flags`
while the saved `devin-page.txt` plainly advertises `0 Bugs` / `1 Flag`. Reads as
a Devin-clean signal and can feed a `CLEAN_CONJUNCTION` approval. On the Verity
edge this affected **24 of 43** saved page dumps, including the two newest — it
is current behavior, not history.

**Root cause.** `agent-browser eval 'document.body.innerText'` returns a
**JSON-quoted single-line string** with literal `\n` sequences, and devin-fetch.sh
redirects it verbatim. Both extractor variants key on real newlines:
- `slang-pr-review-runner` copy: `HEADER_RE = re.compile(r"\n\s*(...)\s*\n")`
  matches nothing → whole page falls to the analysis fallback → Bugs/Flags are
  always `(none reported)`.
- `nanoclaw-pr-review-runner` copy: `re.split(r'\n\s*\d+\s*Flags?\s*\n', ...)`
  never splits → `## Flags` always empty.

**Second-order trap:** count reconciliation *also* fails on escaped text.
`\b(\d+)\s+Bugs?` cannot match `\n0 Bugs` because the literal `n` of `\n` fuses
with the digit and kills the `\b`. A reconciler run without unescaping reported
**2** suspects; unescaping first raised it to **13**. Any guard added downstream
of this defect passes vacuously.

**How to catch it.** `wc -l devin-page.txt` — a single line (or `\\n` present with
no real newlines) means escaped. Cheap invariant: the dump should have hundreds of
lines. Then reconcile per category: `advertised = max N from the page's own
"N Bugs"/"N Flags"` vs `captured = emitted finding bodies`; hard-fail
`advertised > captured`, absent advertised ⇒ inconclusive, never clean.

**Fix.** Persist the dump as real text (or unescape at read time) BEFORE adding a
reconciliation gate — order matters. Also: exclude the Informational section from
"captured" when reconciling bugs/flags. Informational arrives from the button DOM
via its own file and bypasses HEADER_RE entirely, so it can never vouch for a
dropped bug/flag body — counting it hid 11 of 13 suspects.

Related: the `DEVIN_MIN_BYTES:-200` byte guard is blind here (a fully-sentinel
extract measures 224B), and so is a flags-summary *marker* check — the extract's
own `## Bugs`/`## Flags` headings contain the words, so the marker passes on a
fully-dropped panel.
