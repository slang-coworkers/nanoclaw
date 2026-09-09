---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786749174835-feop8m
written_at: 2026-08-24T12:57:54.189Z
---

# [approver/challenger-miss] devin-fetch.sh drops Bug/Flag tabs — "0 bugs/0 flags" can mean "unparsed", not "clean"

**Symptom:** On PR #12548 R2 (test-only), `devin-fetch.sh` wrote `devin-flags.md` with "Bugs: (none), Flags: (none)". I synthesized a WOULD_APPROVE review-doc from it. The OUTPUT_REVIEW critique (codex) flagged that the RAW scraped page (`devin-page.txt`) shows a finding tab-bar "Info | Chat | **1 Bug** | **1 Flag**" — the script had only scraped the expanded "Info" tab (which held 3 resolved informational nits) and never opened the Bug/Flag tabs, so it defaulted their counts to none.

**Root cause:** `devin-fetch.sh`'s section extraction keys on the headers Devin renders in the currently-expanded panel. Devin's Bug and Flag findings live behind separate tab-bar tabs that the script does not click/expand, so their bodies never enter the scrape; the header-count parse then reports 0/0. This is a SILENT under-report of the single most decision-critical signal on the Devin-only tier.

**Why it matters:** On the Devin-only fallback tier the Devin run is the SOLE review signal. A dropped "Potential Bug" is a straight path to a FALSE WOULD_APPROVE over an open reviewer 🔴. Here the dropped bug was "CUDA test always fails on prelude for-loops" — which I later disproved (CUDA prelude is `#include`d not inlined; CI ran+passed all 3 GLSL/Metal/CUDA directives on the head), but procedure then barred clearing it to an approval anyway ⇒ the correct terminal state was ABSTAIN_POLICY(OPEN_GAP), NOT the WOULD_APPROVE the parse would have produced.

**How to catch it:** Never trust `devin-flags.md`'s "Bugs/Flags: none" at face value. Cross-check against the raw `devin-page.txt`: grep for the tab-bar line (`grep -nE '^[0-9]+ (Bug|Flag)$' devin-page.txt` — e.g. "1 Bug"/"1 Flag"). If the tab-bar count exceeds what `devin-flags.md` transcribed, the tabs weren't expanded — dispatch a browser subagent to open each Bug/Flag tab + its detail popover and transcribe the finding (title, severity, file:line, resolved-vs-open, applies-to-head). Only then disposition them.

**Fix (transferable + tooling):** (1) Approver habit: on the Devin-only tier, always reconcile `devin-flags.md` counts against the `devin-page.txt` tab-bar before parsing a verdict. (2) `devin-fetch.sh` needs to click through the Bug and Flag tabs (not just the default Info panel) before extracting — otherwise its "0 bugs/0 flags" is "did not look", not "looked and found none". A negative from a code path that never opened the tab is the least trustworthy result the fetch can produce. Related: the sibling learning on Devin serving a STALE cached analysis — both are "the Devin scrape looks clean but isn't head-truthful" failure modes.
