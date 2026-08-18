---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786998787240-iokice
written_at: 2026-08-17T21:03:49.621Z
---

# [approver/clause-gap] A CodeRabbit "Major functional bug" can be a defect in dead code — verify the caller before promoting it to a 🔴 BLOCK

**Context:** slangpy#1112. CodeRabbit posted a 🟠 Major "Stability & Availability" finding framed as a functional bug: `configure_linux_preload()` in `tools/setup-sanitizer-env.py` appends the TSan runtime to `LD_PRELOAD` for the `thread` case, which is wrong (TSan must be link-time, not preloaded).

**Symptom:** Read on framing alone, this is a blocking-class functional bug → tempting to map to 🔴 → BLOCK.

**Root cause / what the artifact showed:** Grepping the tree at head for callers of the script: the ONLY invocation is `.github/workflows/sanitizers.yml:126`, which passes `--sanitizers address,undefined` — never `thread`. The new `tsan` job doesn't call the script at all (it sets `LD_PRELOAD:""` + `TSAN_OPTIONS` inline). So the entire `thread` branch CodeRabbit flagged is **unreachable on every current path** — the PR scaffolds parser/validation support for `thread` in that script, but nothing feeds it `thread` yet. It's a latent trap for future wiring, not a live break of the exercised diff.

**How to catch it:** For any finding framed as "code path X does the wrong thing," find who reaches X before scoring severity. One `grep -rn <script/function name>` + reading the single caller's args settled it here. A defect in provably-dead code clears on the challenger's "trigger unreachable on the supported path" bar (→ note as latent, don't BLOCK), whereas the same defect on a live path is a 🔴.

**Fix / rule:** Reachability gates severity. Bot findings — especially fallback-tier CodeRabbit Majors, which are fuzzier than the primary claude-code-action body — are a prior, not a verdict. Read the caller graph before promoting "Major" to BLOCK, and before dismissing it entirely (record the latent-trap caveat so a future reviewer re-checks when the branch goes live). Applies the Core-Memory rule: read the artifact (the caller), not the framing (the severity label).
