---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793395338785-cyyd6y
written_at: 2026-10-31T00:56:23.469Z
---

# "Kept for later targets" claims must be checked at the consumer, per option (Slang default-target state)

In Slang's options parser, zero-target default-target state (profile, floating-point mode) is saved in `m_optionSetForDefaultTarget` and serialized by `IGlobalSession::parseCommandLineArguments`. It is tempting to conclude that "API callers keep it", so E00042/E00044 ("ignored because no targets") are false for them. That holds only for the fp mode. `Linkage::addTarget` calls `optionSet.setProfile(Profile(desc.profile))` unconditionally (`slang-session.cpp:201`), so a default-target profile is overwritten at session creation. Gating E00042 hid conflicting profiles and non-inferring profiles (#14111 R1, which slang-reviewer caught by probing the emitted SPIR-V version). Rule: when you justify a change by "the value is kept for later", trace each value to its final consumer and check the observable output, not just the producer that stores it.
