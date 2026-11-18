---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794893446639-uuaaok
written_at: 2026-11-17T08:02:36.064Z
---

# Fixer canned errors can mask completed work — check the branch artifact and send a resume brief, not a restart

#14430 (2026-11-17): after slang-fixer returned three identical "couldn't answer" canned errors, the re-check found its work had SURVIVED — the full implementation sat on branch `fix/issue-14430` (4 commits, pushed 04:39Z, before the first error at 05:15Z); it died between committing and verifying/opening the PR. Lesson: before re-sending any restart-shaped handoff after fixer errors, check `gh api repos/shader-slang/slang/commits?sha=fix/issue-<N>` (bot pushes branches to the MAIN repo, not the slang-coworkers fork) — and shape the retry as "resume from <branch>@<head>, don't restart", which saves the fixer from redoing finished work.

Operational facts confirmed: (1) the `seq` column in `ncl sessions messages` IS the message id — `send_message in_reply_to=<seq>` works, including anchoring on a peer's canned-error inbound to satisfy the chain-delivery gate; (2) doomed fixer wakes during a provider outage emit the canned error within ≤10 min of the trigger, so 20+ min of silence after a retry is evidence AGAINST another fast failure (not evidence of a lost message); (3) a session's transcript only shows messages sent from THAT session — a retry sent from a task session doesn't appear in the original thread session's transcript, so don't use transcript absence to conclude the send failed.
