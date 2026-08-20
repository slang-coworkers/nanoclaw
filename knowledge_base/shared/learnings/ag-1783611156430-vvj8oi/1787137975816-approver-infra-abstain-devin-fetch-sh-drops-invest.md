---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787060030215-1xvkzx
written_at: 2026-08-19T11:12:55.816Z
---

# [approver/infra-abstain] devin-fetch.sh drops Investigate flags into devin-flags.md as "none reported"

**Symptom:** On shader-slang/slang PR #12533, the Devin subagent returned (and `devin-flags.md` recorded) "Flags: (none reported)", so the synthesized review doc + first-pass decision were WOULD_APPROVE. The raw capture `review/devin-page.txt` line 112 actually said **"2 Flags"** with two `Investigate` items — one of them (`slang-lower-to-ir.cpp:9497`, "materializing l-value args inserts a load even for write-only `out` arguments") was directly on the changed line and turned out to be a REAL gap. `devin-fetch.sh`'s parser captured only the `Informational` item and silently dropped both `Investigate`-severity flags.

**Root cause:** `devin-fetch.sh` synthesizes `devin-flags.md` from the Devin page but does not carry over `Investigate`-severity flags (only Bugs + Informational, apparently). The subagent that runs devin-fetch returns `devin-flags.md` verbatim, so the drop propagates. The count line ("N Bugs / M Flags") and the flag bodies live in `devin-page.txt` (the raw page dump) but are lost by the time they reach `devin-flags.md`.

**How to catch it:** After a Devin run, ALWAYS read the raw `review/devin-page.txt` and grep for the flag-count line (`grep -nE "[0-9]+ (Bugs|Flags)" devin-page.txt`) and the `Investigate` markers — do NOT trust `devin-flags.md`'s "Flags" section as complete. If `devin-page.txt` shows more flags than `devin-flags.md` enumerates, the fetch dropped signal; adjudicate every `Investigate` item from the raw page. In this case the codex OUTPUT_REVIEW gate is what caught it (it reads the raw artifacts), which is the second line of defense — but the primary reader (the approver synthesizing the doc) should compare `devin-page.txt` flag count vs `devin-flags.md` before writing the review doc.

**Fix:** (a) Approver-side: after Devin, verify `devin-flags.md` flag count == the "M Flags" number in `devin-page.txt`; enumerate every `Investigate` line from `devin-page.txt:1XX` and adjudicate each in Step 3. (b) Tool-side (owner of `slang-pr-review-runner`): `devin-fetch.sh` should include `Investigate`-severity flags in `devin-flags.md`, not just Bugs+Informational. This is an infra gap that manufactures false WOULD_APPROVEs on exactly the PRs Devin flags something on.

**reason_code:** logged as the process_note on the ABSTAIN_POLICY:OPEN_GAP row for #12533 (the abstain itself was OPEN_GAP, not an infra reason_code, because the gap was real once recovered — but the drop is the infra defect worth burning down).
