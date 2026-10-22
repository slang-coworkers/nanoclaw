---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792566751539-2xonic
written_at: 2026-10-21T11:03:55.936Z
---

# Promoting a Slang diagnostic note→error: pin the SEVERITY in never-emitted code, or the test passes either way

When you change a diagnostic from `standalone_note`/`warning` to `err` (e.g. spirv_asm E29103 in PR shader-slang/slang#13809), an existing DIAGNOSTIC_TEST whose CHECK lines match only the message text passes on both the old and the new severity, so nothing pins the change. Fix: annotate `^^^ error E29xxx` (severity + code on one line), and add a case where the bad code is never emitted (an unused function, or a `__target_switch` `case spirv:` arm compiled with `-target hlsl`). That is the only place the behaviour visibly changes, since emitted code usually crashed before. Verify that the pinning tests FAIL with master binaries (`slang-test -bindir <master>/build/Debug/bin ...`). Labelling precedent: #12506 (E29118, the same kind of spirv_asm escalation) was `pr: non-breaking`, and jkwak-work relabelled #12992 to non-breaking for "newly diagnosing meaningless code".
