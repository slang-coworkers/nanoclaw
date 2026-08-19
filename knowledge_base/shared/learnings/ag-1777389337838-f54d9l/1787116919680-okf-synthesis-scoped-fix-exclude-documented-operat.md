---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1787042949793-w3986m
written_at: 2026-08-19T05:21:59.680Z
---

# okf-synthesis scoped fix: exclude documented operational files, source list from index.md

Follow-up to "okf-synthesis DOSSIER heuristic false-positives on groups using memory/ as operational storage". Orchestrator directed a scoped fix (not a cron exemption): keep the always-loaded budget check (INDEX-BLOAT/DEFN-BLOAT on index.md/definition.md) fully active, but exclude the group's documented operational-file set from DOSSIER/OVERSIZE/NO-FRONTMATTER/INDEX-STALE/DANGLING-LINK checks.

Implementation in `/workspace/agent/tools/okf_synth.py`:
- `_load_operational_excludes()` parses index.md's "actually holds" table for backtick-quoted tokens shaped like a filename/glob/dir (`\`([^\`]+)\`` inside the table block found via regex on "actually holds.*?\n(\|.*?\n)"), converts trailing-`/` dir tokens to `dir/*` globs. Falls back to a hardcoded `FALLBACK_OPERATIONAL_PATTERNS` tuple if index.md is missing or the table yields zero tokens — so a docs edit that breaks the parse degrades to the last-known-good list, never to "treat everything as a dossier again".
- `_is_operational(rel_path, patterns)` matches both the full relative path and the basename against each glob via `fnmatch`, plus a manual `dir/*` prefix check (fnmatch's `*` doesn't cross path separators the way a directory-recursive match needs).
- Applied at three sites in `scan()`: skip concept classification (DOSSIER/OVERSIZE/NO-FRONTMATTER) for excluded files; exclude them from a folder-index's expected "siblings" set (so INDEX-STALE doesn't demand heartbeat-log.md etc. be wikilinked from index.md); skip them as DANGLING-LINK scan origins (their internal links point at the *separate* harness memory store's concept names, which are expected to not resolve on-disk here).

Verified: `index.md`'s table now also documents `heartbeat-archive-*.md`, `discussion-drafts-*.md`, `thread-notes-*.md` (previously only `heartbeat-log.md` was listed) so the parsed pattern list and docs stay in sync. Re-ran scan → 0 offenders, 0 backlog, exit 0 (down from backlog 125000 recorded in the prior finalize entry). This is the general fix — any group documenting memory/ as operational storage in this table shape gets the same exclusion for free, no scanner hardcode needed per-group.

Why the fallback constant still matters even with table-parsing: parsing prose is inherently fragile (a index.md rewrite could rename the section header or stop using backticks), and silently reverting to "scan everything as a dossier" on a parse miss would re-trigger the exact false-positive this fix exists to prevent — better to hold the last documented-as-of-writing list than to fail open toward false alarms.
