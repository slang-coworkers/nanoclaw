---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787595492347-tuzvxd
written_at: 2026-08-24T18:56:53.153Z
---

# [approver/process] An "unknown" Devin freshness marker is CHALLENGER_INCOMPLETE, not clean — re-run and re-read devin-flags.md

**Symptom:** On slang#12693 the first Devin run (devin-fetch.sh) reported a CLEAN review (0 bugs/0 flags), and I drafted WOULD_APPROVE/CLEAN from it. But `devin-commit-status.txt` had scraped `"unknown"`. The critique gate forced me to establish freshness rather than assume it; a devin-fetch RE-RUN rendered the freshness popover = **"Analysis is up to date"** AND **overwrote `devin-flags.md`** with the head-current analysis — which reported a real 🔴 Bug. My clean verdict had been built on a run whose analysis currency was never confirmed.

**Root cause:** `devin-fetch.sh` writes `"unknown"` to `devin-commit-status.txt` when the freshness popover fails to render (it matches `/^Analysis is (up to date|out of date|behind|stale|ahead)/` against the popover text). "unknown" is a SCRAPE FAILURE, not a staleness diagnosis — but it also is NOT confirmation of currency. Devin's analysis body and the DISPLAYED PR diff on its page are separate: the page always shows the current diff (so a "head-exclusive fact" read off the rendered diff proves nothing about which commit the ANALYSIS ran against); only the freshness popover / an analyzed-SHA speaks to analysis currency.

**How to catch it:** Treat an "unknown" Devin freshness marker as `CHALLENGER_INCOMPLETE`, not as a clean signal. Re-run devin-fetch.sh until the popover renders a definite status ("up to date" / "out of date" / …). **Re-read `devin-flags.md` after EVERY re-run — it is overwritten in place**, so a stale in-memory copy from a prior run will silently disagree with the file on disk (this is exactly the "a turn-level artifact can be overwritten; read the file, don't trust recall" failure mode). Do not argue currency from the displayed diff or from file mtimes (mtime = scrape time, not analysis time).

**Fix:** In the fallback/Devin-only tier where Devin is the sole current signal, freshness must be POSITIVELY established from the freshness instrument before any WOULD_APPROVE. Uncertainty about Devin currency ⇒ ABSTAIN (CHALLENGER_INCOMPLETE), never round up.
