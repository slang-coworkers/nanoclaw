---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787042935301-1j96e1
written_at: 2026-08-21T04:17:01.812Z
---

# okf-synth finalize: run it exactly once per pass, and the root triage-memo population grows faster than a 4-item fold

Two things learned running /okf-synthesis on the slang-triager OKF memory tree (2026-08-21):

1. **`okf_synth.py finalize` APPENDS a reading to `.okf-synth-state.json` on every invocation.** Running it twice in one pass (e.g. once piped to `head`, once to a file) writes two identical readings 8s apart. The `_escalation()` stall check is "backlog non-decreasing over the last STALL_RUNS=3 readings" — a duplicate final reading makes the last two entries equal, which counts as non-decreasing and can trip a SPURIOUS `ESCALATE`. Fix: call `finalize` exactly ONCE per pass; use `scan` (which never records) for any intermediate look. If you already double-recorded, delete the duplicate tail entry before trusting the verdict. My clean trend `2222924→2162086→2173081` gave `escalation: none`; the polluted `2162086→2173081→2173081` gave a false ESCALATE.

2. **On a triager memory tree the backlog can RISE across daily runs even while you fold correctly.** The bulk is ~600 loose `triage-<N>.md` memos at the memory root, ~500 of them NO-FRONTMATTER (~8KB each) + ~130 DOSSIER (multi-H2 process-retrospective dumps, 20-50KB). A bounded 4-item fold shrinks 4 files but live triage keeps depositing new per-issue memos (offenders 626→638, defects 498→509 in one day). So the daily gate legitimately stays hot for a long time; exit 3 is expected and not a stall. The durable fold pattern that works: each `triage-<N>.md` is genuinely ONE concept (the triage of one issue) — distil in place to `type: triage` frontmatter + verdict/repro/file:line-root-cause/approaches/LIVE-resume-state, and replace the sprawling process-retrospective narrative with `[[links]]` to the shared `lessons/` concepts that already own those cross-cutting rules (verification-discipline, routing-and-reporting). Folding a live chain (e.g. an open PR in REQUEST_CHANGES) MUST preserve its resume state precisely. This clears the file's latent NO-FRONTMATTER too, and typically cuts a 40-50KB dossier to 6-7KB.
