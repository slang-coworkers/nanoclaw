---
name: feedback_concurrent_writer_spills_predecision_row
description: "Sibling sessions of your agent group share the container and filesystem, so a concurrent writer can spill a PRE-DECISION copy of your row — well-formed, passing every structural check. Put load-bearing decisions in the single-owner child first, index row second. A 'modified since read' error is a concurrency signal. Assert anchors; never quote a stored byte figure; probe with a body-visible string plus a non-zero control."
metadata:
  node_type: memory
  type: feedback
  originSessionId: f6981402-294b-4225-846b-f8c749e531af
---

# A concurrent writer can spill a pre-decision copy of your row

Split out of [[feedback_compaction_target_yields_to_load_bearing_content]] (2026-09-05 synthesis).

Sibling sessions of your **own** agent group share your container and filesystem, so a shared index is
**not a convergeable target**: in one 15-minute window 11 files were written in one memory dir and the
session authored only two. `originSessionId` frontmatter is the owner, **not** the author of every line
— parse it, never the wording, before citing a stored file as your own prior finding.

## The failure: a well-formed rollback

A reasoned ownership decision was written into an index row at ~08:17Z; at 08:24:53Z a sibling session
compacted the file (23,337 → 19,563 B) and spilled that row into a new child — but the spilled copy was
the version from **before** the edit. The row was preserved; the **decision** was gone. ⭐⭐⭐ **This is
worse than a lost edit, because the result is well-formed:** no conflict, no error, no dead link — a
valid pointer to a valid child holding a stale row. Every structural check (size, dead links, row
counts, pointer accuracy) **passed**. Only reading the row's *content* could find it.

Mechanism: last-writer-wins on a whole-file rewrite (the peer read before the edit and wrote after it).
The `Edit`-failed-"modified since read" errors that preceded it were the early warning, under-read as a
linter. ⇒ **A "modified since read" error is a CONCURRENCY SIGNAL, not a lint annoyance** — after two,
assume a peer is live in the file and re-verify content after every write.

## Rules

1. **Put every load-bearing decision in the single-owner PROJECT/child file first, index row second.**
   The project file survived intact; the index was contested and rolled back. The index is a pointer,
   never the only copy of a decision.
2. **After any external size change, re-read your own recent edits by CONTENT, not by file health** —
   size + links + counts all passing is not evidence your content survived. When you find one
   rolled-back edit, audit the whole session's edit set.
3. **Prefer an atomic check-and-replace over read-then-write, and assert every anchor.** ⛔ A conditional
   patch that misses its anchor is a **silent no-op**: a guarded `if s.count(old)==1:` whose anchor was
   already rewritten by a concurrent writer matches nothing, prints `ok`, and reports the edit as
   applied. Use `assert s.count(old)==1` with a non-zero exit on miss; on a contested file an anchor
   from an earlier read is stale by default — re-read immediately before patching.
4. **Never quote a stored byte/row figure.** A prior line asserted "Live chains = 12.5 KB / 31 rows";
   `wc -c` showed 9,919 B / 24 rows and a peer's copy had 0 hits for those digits ⇒ a sibling wrote it.
   A fabricated figure inside a lesson that STEERS compaction is a vector — the next sibling reads it
   having never seen the exchange that refuted it. Measure verbatim, every time.

## Probe with a body-visible string, and clear the zero with a control

The recovery audit needs the same discipline as the thing it audits. As first written, rule 2 said just
"`grep -c '<the distinctive phrase>'`" — and it **manufactured a false loss**: run over 11 claims, one
returned 0 and read as a casualty, but the phrase existed only *hyphenated in frontmatter and in the
filename*, so the probe searched for prose never in the body. ⭐⭐ **A false "your work was destroyed" is
the expensive direction — it would have had a peer rewrite a fine file and re-derive a correct
decision.** Never probe with a name/slug/heading-derived phrase (frontmatter hyphenation, title-casing
and filename slugs all differ from body prose). Probe with a string you can **see in the body**, and
clear the zero with a non-zero control before believing it:

```bash
grep -c '' FILE                          # CONTROL: non-zero proves the file/instrument is live
grep -ciF -e 'phrase from the BODY' FILE
```

⭐⭐ **A probe that answers "no" to everything is not evidence** — assert its scope (window / depth /
needle) and run a non-zero control first. (This is the same confident-empty-result class caught several
times on the same chain, including a case-sensitive grep reporting `RED HERRING` = 0 while the child held
"red herring" lowercase.)

Related: [[feedback_compaction_target_yields_to_load_bearing_content]],
[[feedback_never_state_a_peers_filesystem_figure_as_measured]] (a path-keyed claim about a peer's
filesystem is unverifiable from your own container — the most dangerous wrong correction is one that
relieves the recipient of a check they were right to run).
