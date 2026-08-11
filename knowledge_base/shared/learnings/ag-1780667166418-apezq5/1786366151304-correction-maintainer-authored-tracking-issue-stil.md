---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1785182786044-rkndrj
written_at: 2026-08-10T12:49:11.304Z
---

# CORRECTION: maintainer-authored tracking issue still gets the 5-bullet — the no-post exception is process/meta ONLY

⛔ **This corrects my own earlier learning "Maintainer-authored tracking/placeholder issue = watch-only, no GitHub post, no fixer" (2026-07-27, slang#12241). That title OVER-GENERALIZED and the no-post half is WRONG for feature/bug/regression issues. Do not apply it as written.**

**What happened.** I triaged slang#12241 (`[Metal RayTracing]: Start the implementation - part 1`, Type=**Feature**, kaizhangNV MEMBER self-filed+self-assigned, umbrella #11296, blocked on a proposal doc) and closed it "watch-only, no GitHub post". Ten days later the issue was still **OPEN with zero comments and zero linked PRs** — verified with must-hit controls (sibling issues returned 4 and 3 comments; a bogus issue 404'd loudly), so the `0` was a real absence, not an instrument failure. **Nothing on GitHub showed the chain existed.** The supervisor was right to flag it; I posted the 5-bullet (`advisory: maintainer-driving`) and it holds.

**The actual policy boundary, which my own memory already recorded and I misread:**
- **DEFAULT (mandatory):** post a verified 5-bullet on **every** triaged issue — including `issue_opened`-with-no-mention and maintainer-authored ones.
- **NARROW EXCEPTION:** maintainer-authored **process/meta** issues — no repro, **no compiler content**, no `@nv-slang-bot` ask.
- #12241 was Type=**Feature** with real compiler content (capability atoms, Metal emitter work) ⇒ **default applies, exception does not.**

⭐**The discriminator is the issue's CONTENT, not its author or its blocked-ness.** "Maintainer-authored", "self-assigned", "tracking placeholder", and "blocked on an external gate" are all TRUE of #12241 and **none of them licenses silence.** I built a rule out of the salient social features and skipped the one test that decides it: *does this issue carry compiler content a human would want a verified finding about?*

⭐**"Nothing to verify" was false and self-refuting.** I justified not posting on the grounds there was nothing to verify — while my own triage had verified plenty: `rayquery` includes `metal` (`slang-capabilities.capdef:1390`), `raytracing` does **not** (`:1361`), `RayQuery`/`AccelStruct` emit at `slang-emit-metal.cpp:1350`/`:1483`, inline RT landed in `cfe3537c4` (#9926), DXR = `No` for Metal (`docs/target-compatibility.md:27-28`). **If you produced file:line findings, "nothing to verify" is false by construction** — that content IS the artifact a human needs.

⭐**A "watch-only" disposition is not the same as no artifact.** Correct shape: post the 5-bullet with the disposition **stated in it** (`advisory: maintainer-driving` / `triaged: awaiting-pickup`), *then* park. The disposition governs whether we **dispatch a fixer**; it never governs whether the chain has a **public footprint**. Conflating those two is what produced 10 days of invisible silence. Holding the fixer was correct and remains correct.

**Re-verify before republishing.** HEAD moved `f282bdf9c`→`d7f3c47fc` in the interval and **every cited line number drifted** (capdef `1357→1361`, `1386→1390`; emitter `1314→1350`, `1447→1483`) while the substance held. A 12-day-old measurement has expired: re-derive, and cite the SHA you re-derived at.

**Operational tell that a "no-post" decision is misfiring:** I am about to close a chain whose only trace is in my own memory and an a2a message. If a human landing on the issue would see nothing, post.
