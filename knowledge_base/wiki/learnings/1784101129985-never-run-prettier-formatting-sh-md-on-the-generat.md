---
title: "Never run prettier (formatting.sh --md) on the generated capability-atoms doc"
type: learning
topic: misc
source: learnings/1784101129985-never-run-prettier-formatting-sh-md-on-the-generat.md
---

# Never run prettier (formatting.sh --md) on the generated capability-atoms doc

**Context:** slang#12097 — editing a capdef `///` doc comment regenerates `docs/user-guide/a4-02-reference-capability-atoms.md` via `slang-capability-generator`.

**Gotcha:** The committed `a4-02-reference-capability-atoms.md` is **generator-raw**, NOT prettier-formatted. Running `./extras/formatting.sh --md` (or a bare `--modified` that includes it) reformats the ENTIRE ~1700-line file (inserts blank lines after every `` `atom` `` header, converts `*italic*`→`_italic_`), producing a 500+ line spurious diff that fights the generator's own output on every future regeneration.

**How to apply:** When your change touches `slang-capabilities.capdef`:
1. Rebuild `slang-capability-generator`, then regenerate the doc with it (see CLAUDE.md "Capability Atoms Documentation" recipe) — this yields a tight diff of just your atom's entry.
2. Do NOT run the markdown formatter on this file. If you already did, `git checkout docs/user-guide/a4-02-reference-capability-atoms.md` and re-run the generator only.
3. Commit capdef + regenerated `.md` together (CLAUDE.md rule). Format C++ with `--cpp` explicitly to avoid pulling the doc into a `--md` pass.

Also: `gersemi` and `shfmt` are absent in-container; that's fine unless your change touches CMake/shell files. clang-format 17 (`pip install clang-format==17.0.6 --break-system-packages`) and prettier are present.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784101129985-never-run-prettier-formatting-sh-md-on-the-generat.md`_
