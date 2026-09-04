---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788415956403-hpjczn
written_at: 2026-09-03T06:46:14.479Z
---

# [approver/human-disagreement] Maintainer self-merged a mirror-a-sibling callback add as-is over an OPEN_GAP abstain (slangpy#1133)

**Event:** slangpy#1133 (add Window `on_refresh` callback, mirrors `on_resize`). My decision: ABSTAIN_POLICY / OPEN_GAP, citing CodeRabbit's 🟠 Major exception-safety gap (a Python callback that raises can unwind a C++ exception through GLFW C frames → possible std::terminate). Human verdict (auto-joined): **MERGED as-is** by the author skallweitNV (MEMBER) at the SAME commit I decided on (f79ecada2d68), ~20 min after opening, self-merge, no human review comment, no follow-up commit addressing the gap.

**The mismatch (both rationales):**
- Mine: the gap had a plausible real trigger + real blast radius, and on the fuzzy fallback tier uncertainty does not round up → OPEN_GAP (conservative-lean, by the book).
- Human's: accepted the pre-existing convention — the gap applies identically to all 6 sibling callbacks, none wrap the user callback, so adding one more instance is not treated as blocking.

**Direction:** over-conservative (ABSTAIN where the human APPROVED) — NOT a false-safe. OPEN_GAP abstains are legitimate and not optimized to zero, so this is not proof the abstain was "wrong" in policy. But it is a concrete calibration data point.

**Transferable calibration (the class of signal to weigh next time):** For a *maintainer/MEMBER-authored* PR that adds one more instance of an *established, in-file sibling pattern* (callback/event-handler/accessor), a robustness concern a diff-in-isolation bot flags as "Major/before-merge" — when I have CONFIRMED by reading the whole file at head that it is (a) pre-existing across every sibling and (b) introduces no new risk class — is very likely to be merged as-is by that maintainer. When those two conditions are firmly established, the "branch already covered elsewhere / accepted-convention" clear is defensible and an OPEN_GAP abstain is likely to over-fire. Probe before deciding: is the author a maintainer? did they self-merge similar sibling adds without the boundary before? The abstain still carried the right context to the human (they cleared it in seconds), so it wasn't harmful — but the calibrated call for this exact shape leans toward clearing, not abstaining.

**Honest audit (both directions):** don't let the confirmed outcome merely flatter the anticipatory note I wrote at decision time. The outcome validates the maintainer's *bar* for this gap class; it does not retroactively make a real-trigger/real-blast-radius gap "inconsequential." The update is to my prior on how *this maintainer / this pattern* is treated, not a license to clear any real-trigger gap.
