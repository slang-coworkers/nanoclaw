---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786477327664-spdydc
written_at: 2026-08-11T22:52:57.764Z
---

# [approver/infra-abstain] devin-fetch extractor silently drops Devin "Flags" — devin-flags.md said 0 flags while the raw page had 6; always cross-check devin-page.txt

**Symptom:** On slang-rhi#831 R5, the harvested `review/devin-flags.md` (produced by `slang-pr-review-runner/scripts/devin-fetch.sh`) reported **"## Flags (none reported)"**, and the Devin subagent's returned text likewise said "0 flags". But the raw captured page `review/devin-page.txt:97` showed **"6 Flags"** followed by six real findings (lines 99–116): Windows-ARM64 loader wildcard, archive-overwrite, BGRX8Unorm-never-selected, RT-gating-ARM64-only, getTextureRowAlignment public-API contract change, heap-hard-fail-on-no-BDA. The OUTPUT_REVIEW critique (codex) caught the discrepancy by reading `devin-page.txt` directly; I had trusted `devin-flags.md`.

**Root cause:** the devin-fetch page→markdown extractor recognizes Devin's "Bugs" and "Informational" sections but mis-parses the "Flags" section (Devin renders flags as `<title> / Investigate / <file:line>` triplets under an "N Flags" header, distinct from the Bugs/Informational layout). The extractor emitted "none reported" for Flags even though the counter line said "6 Flags". So the synthesized review doc silently lost an entire severity tier of Devin's output — and "Flags/Investigate" is exactly the tier a challenger must adjudicate (it sits between advisory-informational and blocking-bug).

**Impact on the decision:** I built a provisional WOULD_APPROVE partly on "Devin found 0 flags," which was false. The flags turned out all benign on adjudication (dead BGRX case; getTextureRowAlignment no-op value change; heap no-BDA hard-fail is strictly better than base's silent address-0; etc.), so the verdict survived — but only after recovering and adjudicating them. Had any flag been real, the dropped-flags bug would have produced a false-approve.

**How to catch it (mechanical):** after running devin-fetch, NEVER trust `devin-flags.md`'s section counts alone. Grep the raw `review/devin-page.txt` for the counter lines — `rg -n 'Bugs|Flags|Informational'` — and reconcile the "N Flags"/"N Bugs" numbers against what `devin-flags.md` enumerated. If the raw page shows a non-zero Flags count that the markdown rendered as "none reported", re-extract the flag triplets from `devin-page.txt` (the `<title>\nInvestigate\n<file:line>` blocks) and adjudicate each. Better: have the Devin subagent return the raw counter line verbatim, or fix `devin-fetch.sh`'s Flags parser. Treat a "0 flags / 0 bugs" Devin result as suspicious until cross-checked — the extractor fails toward under-reporting, which is the dangerous direction for an approver.

**Cross-ref:** this is the Devin-side analogue of "never let a fall-through/empty result read as healthy" — a parser that emits "none reported" on a section it failed to parse manufactures false confidence. Void/failed extraction returns to UNKNOWN (go read the raw page), not to "clean".
