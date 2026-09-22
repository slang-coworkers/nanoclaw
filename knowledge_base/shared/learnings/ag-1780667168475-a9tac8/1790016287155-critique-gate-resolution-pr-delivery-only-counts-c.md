---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790009689697-mg8s8g
written_at: 2026-09-21T18:44:47.155Z
---

# Critique-gate ([Resolution]/PR delivery) only counts codex calls in the exact codex-critique format

When the `critique-gate` overlay is active, posting a `[Resolution]` (or `gh pr create`) is gated on a recorded codex critique round with the right stage + an `approve` verdict. Two things I learned the slow way on shader-slang/slang#13202:

1. **Free-form `mcp__codex__codex` calls do NOT count.** `track-critique.sh` only records a round when the call carries (a) a `STAGE:` tag (`DIAGNOSIS_REVIEW | PLAN_REVIEW | CODE_REVIEW | DECISION_REVIEW | OUTPUT_REVIEW`) in the prompt AND (b) the **verbatim** `developer-instructions` block from the codex-critique SKILL.md, whose sentinel lines ("You are an independent reviewer…", "Return ONLY the structured output below") the hook greps for. My first 4 ad-hoc rounds logged "stages: none; verdicts: none" and did nothing for the gate. The moment I used the proper STAGE + verbatim developer-instructions, it logged "OUTPUT_REVIEW=1; verdict=…". Also: the skill requires `sandbox: "danger-full-access"` (read-only is rejected by a PreToolUse hook inside Docker).

2. **The `### Attested` sha256 binds the verdict to the file at approve-time; the gate re-hashes at send time.** So: write the deliverable to a file, get codex to attest it, and do NOT edit it after the approve — any edit changes the hash and the gate denies delivery. If you must fix something post-approve, re-run codex-reply so it emits a fresh Attested line for the edited file.

Answer/review-style deliverables (a verdict, a resolution) use the `OUTPUT_REVIEW` stage. For a code PR, `CODE_REVIEW` (with `git diff base..HEAD`). The gate names which required stage is still missing.

Bonus substantive lesson from the same PR: when correcting an *overstated* review finding, don't over-swing into *understating* — codex flagged that my "the witness is X, not the float→intptr I mentioned" wrongly rejected a still-valid witness. Both a negative-intptr `icmp slt` and a `float→intptr` (`FPToSI`/`FPToUI`) on `llvm-shader-ir` are valid load-bearing witnesses of an `isSignedType(dst)` flip; the real error in my earlier note was just the target name (`-target llvm` → `llvm-shader-ir`).
