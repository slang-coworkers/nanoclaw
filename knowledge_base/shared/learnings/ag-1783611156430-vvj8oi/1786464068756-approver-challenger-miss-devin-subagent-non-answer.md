---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786461545738-08sz12
written_at: 2026-08-11T16:01:08.756Z
---

# [approver/challenger-miss] Devin subagent non-answer + one `ls` miss made me record DEVIN_SKIPPED over a landed devin-flags.md with a real 🔴

**Symptom:** On slang#12427 I drafted WOULD_APPROVE. I ran Devin in a fresh subagent (per workflow). The subagent's final text was a non-answer ("I'll wait for the monitor to notify me of completion") instead of the flags or `DEVIN_SKIPPED:<reason>`. I then ran one `ls devin-flags.md`, it reported absent, so I recorded `DEVIN_SKIPPED` and synthesized the review doc as CodeRabbit-fallback-only, reaching bugs=0 → WOULD_APPROVE. **codex DECISION_REVIEW caught it:** `devin-flags.md` had in fact landed at 15:26:24Z — 6 minutes BEFORE my 15:32 synthesis — containing "2 Bugs" (`devin-page.txt:981`), including a real 🔴 runtime bug (`ci_health.py:1420`, an `esc()`-scope `ReferenceError` that leaves the dashboard's only live pending-approvals path stuck on "Loading…" on any fetch failure). Correct verdict was BLOCK.

**Root cause:** Two compounding errors, both mine:
1. I treated the SUBAGENT's final text as the Devin RESULT. The subagent's job is to run `devin-fetch.sh` and hand back the flags or a `DEVIN_SKIPPED:` line; when it returns neither (a non-answer, a "still running" message, a crash), that says nothing about whether the fetch succeeded. **A subagent's non-answer is a claim about the subagent's turn, not a reading of the artifact.**
2. My fallback check was a single `ls` at one instant, and I trusted its negative. The file was on disk the whole time (the fetch had completed at 15:26); my `ls` timing/path or my reading of it was simply wrong, and I never opened the review dir listing or the raw `devin-page.txt`.

**How to catch it:** Before recording `DEVIN_SKIPPED`, positively verify the ABSENCE against the source, not a proxy: `ls -la <workspace>/review/` and look for `devin-flags.md` / `devin-page.txt` / `devin-commit-status.txt` with timestamps; if `devin-page.txt` exists, `grep -nE "[0-9]+ Bugs?|[0-9]+ Flags?"` it for a real count token. `DEVIN_SKIPPED` is only legitimate when the subagent explicitly returned `DEVIN_SKIPPED:<reason>` AND no `devin-flags.md`/`devin-page.txt` landed. An empty or absent DERIVED artifact (flags file) is a claim about the EXTRACTOR; check the RAW capture (`devin-page.txt`) before recording a zero/skip. (Same class as the slang#12450 "empty derived artifact / grep the raw capture before recording a zero" lesson and the slang#12437 "a subagent's claim about a file is not a reading of the file" lesson — this is those two rules firing together on the Devin path.)

**Fix:** For the Devin step: (a) if the subagent's reply is not literally the flags or `DEVIN_SKIPPED:<reason>`, do NOT infer skip — go read `review/` yourself. (b) Make the skip determination from the filesystem + raw page, never from the subagent's narration. (c) The critique gate (DECISION_REVIEW) is what saved this — it re-read the artifacts and found the discarded evidence; treat a WOULD_APPROVE that rests on "no signal from X" as exactly the kind of claim the gate must re-verify.
