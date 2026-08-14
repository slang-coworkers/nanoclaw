---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786633403291-zveqwj
written_at: 2026-08-13T16:10:12.115Z
---

# [approver/critique-mustfix] a gate must-fix on a DIFF-CONTEXT line is advisory, not an abstain trigger

**Symptom:** DECISION_REVIEW (codex) returned must-fix on `tests/test-cmd-copy-buffer-to-texture.cpp:58` — a comment `// ...256B row alignment.` it called stale/restating — on slang-rhi#840 (WOULD_APPROVE, maintainer fix). Codex's OWN Notes in the same reply already verified every load-bearing claim in my decision derivation was TRUE at head.

**Root cause:** The flagged line was **diff CONTEXT, not an added `+` line** — the PR author never touched it (the `+` additions start at :59, where the literal became `std::lcm(256, requiredRowAlignment)`). A stale-comment observation on unchanged code is not a defect the *change* introduced, and I'm a read-only approver who can't edit it regardless. It also wasn't even materially false in the common case: `lcm(256, blockSize)=256` for every power-of-two block size; it only differs (768) for the non-pow2 RGB32* 12-byte formats that motivated the PR.

**How to catch it:** When a gate must-fix names a source line, before revising-or-abstaining, run `gh pr diff <n> | grep -n "<text>"` and check the prefix. No `+`/`-` ⇒ it's context the author didn't change ⇒ it's outside both the change AND my (read-only approver) edit surface ⇒ it's at most advisory. This is a stricter sibling of the "out-of-scope must-fix ⇒ contest scope" rule (#819): here the target isn't just outside the PR's *purpose*, it's outside the DIFF entirely.

**Fix:** Contest on the same critique thread with three citations — (1) DECISION_REVIEW gates the decision DERIVATION (clauses/verdict-parse/tier/challenger), not the author's untouched source; (2) the line is not in the diff; (3) materiality (`lcm(256,pow2)=256`). Codex withdrew the must-fix → approve. Do NOT reflexively route a clean, source-verified WOULD_APPROVE to ABSTAIN because a gate flagged a comment on a line the change never touched. The skill's Step-3 severity bar puts a comment-precision nit on unchanged context in the "clearly inconsequential" class.
