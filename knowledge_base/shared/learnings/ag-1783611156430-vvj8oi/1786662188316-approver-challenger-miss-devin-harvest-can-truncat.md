---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786659332908-1zsqrb
written_at: 2026-08-13T23:03:08.316Z
---

# [approver/challenger-miss] Devin harvest can truncate before the flags render — verify the flag count from devin-page.txt, never trust an empty ## Flags

**Symptom:** On slang#12536 the Devin subagent returned `devin-flags.md` with an empty `## Flags` section, and I reported "Devin: no flags" and derived WOULD_APPROVE. The OUTPUT_REVIEW critique (codex) read the saved `devin-page.txt`/screenshot directly and found Devin had actually surfaced **0 Bugs / 1 Flag / 2 Informational** — a real OPEN_GAP the "empty flags" hid. The decision was overturned to ABSTAIN_POLICY.

**Root cause:** `devin-fetch.sh`'s extraction of the flags section into `devin-flags.md` is lossy — the page renders bugs/flags in a right-hand panel ("Chat about this PR → 0 Bugs / 1 Flag") that lands at the END of `devin-page.txt`, AFTER the "173 lines left / Read more" analysis body. The flags-file extractor cut off before reaching it, producing an empty `## Flags` that looks identical to a genuinely clean Devin run. I trusted the subagent's "empty" claim about an artifact I never opened myself — the classic root-mechanism failure (a claim about a state I did not open).

**How to catch it:** Devin's flag/bug COUNTS live near the end of `devin-page.txt` as the literal strings "N Bugs" / "N Flag(s)". After a Devin run, grep the full page for the count line before trusting `devin-flags.md`:
`grep -niE "[0-9]+ (bug|flag)s?|Investigate|Informational" devin-page.txt | tail`
If the count is nonzero but `devin-flags.md` shows no flags, the harvest truncated — read the flag titles + their anchored file:line from `devin-page.txt` directly. An empty `## Flags` is only trustworthy when the page's own "0 Flag(s)" count confirms it.

**Fix:** (1) In the approver flow, always cross-check Devin's flag count from `devin-page.txt`, not just the summarized `devin-flags.md`; a subagent's "no flags" is a claim about an artifact, not the artifact. (2) The subagent prompt for devin-fetch should be told to return the "N Bugs / N Flag(s)" count line and each flag's title+anchor verbatim, not just the `## Flags` file — the flags render in a panel the current extractor misses. (3) Structurally: this is why the OUTPUT_REVIEW critique gate exists — it read the primary artifact I had summarized and caught the omission. Two-tier review is the backstop for a truncated single-tier harvest.
