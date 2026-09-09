---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788415956403-hpjczn
written_at: 2026-09-03T06:26:27.180Z
---

# [approver/challenger-calibration] Mirror-a-sibling-callback PRs — a pre-existing cross-cutting gap does not clear, but it is not new risk

**Context:** slangpy#1133 added a Window `on_refresh` callback that mirrors the existing `on_resize` callback byte-for-byte across native + nanobind layers (+33/-0). Fallback tier (CodeRabbit + Devin; slangpy has no `github-actions[bot]` production claude review). Devin: clean. CodeRabbit (ASSERTIVE profile): 1 🟠 Major "Stability & Availability" — "a user callback that throws can propagate a C++ exception through GLFW's C frames and terminate the app; add exception handling at the GLFW boundary before merge." Decision: ABSTAIN_POLICY / OPEN_GAP.

**Symptom:** An assertive review bot flags a real robustness concern on a diff-in-isolation, framed as if the PR introduces it. It looks blockable ("Major", "High merge risk", "before merge").

**Root cause / the tell:** The concern is a *cross-cutting property of the subsystem*, not a defect this PR introduces. Read the WHOLE file at head, not just the diff: here all 6 sibling callbacks (on_resize, on_keyboard_event, on_mouse_event, on_gamepad_event, on_drop_files, on_gamepad_state) invoke their user callback from a GLFW C trampoline with NO exception boundary, and `process_events()`→`glfwPollEvents()` has no try/catch. The PR adds one more instance of the accepted pattern — zero new risk class.

**How to catch it:** For any "add a callback/handler/event" PR, (1) confirm the invocation half is wired (here `glfwSetWindowRefreshCallback` in the ctor — so it is NOT the dead-callback pattern), and (2) grep the file for the sibling handlers and check whether the bot's flagged concern already applies to all of them identically. If yes, it's pre-existing.

**Fix / calibration (the non-obvious part):** Pre-existing ≠ clearly-inconsequential. The conservative-lean severity bar clears a 🟡 gap only if trigger-unreachable / branch-covered / no-real-trigger. A user callback that raises IS a plausible real trigger and app-termination IS real blast radius — so it does NOT clear to WOULD_APPROVE, and on the fuzzy fallback tier uncertainty never rounds up. The correct call is ABSTAIN_POLICY:OPEN_GAP whose challenger field DOCUMENTS the pre-existing-pattern context so the human can clear it fast (accept the convention) or take the opportunity to add a boundary. The abstain is useful precisely because it carries that context — it is not a reflexive over-abstain, and it makes no negative claim about the (correct, symmetric) code. Watch the human-verdict join: merge-as-is confirms "additions of this shape are mergeable despite the shared gap"; a requested boundary confirms the abstain was well-placed.
