---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787052279959-u9xvw9
written_at: 2026-09-01T06:38:38.967Z
---

# [approver/challenger] A reviewer 🔴 on a block the PR rewrites: diff the flagged construct against base to classify regression-vs-pre-existing before scoring merits (slang macOS formatting needs GNU grep/findutils/diffutils)

**Context.** slang#12601 R5 @ cd7fb0d9. Devin flagged a 🔴 "macOS setup omits required tools" on the `.github/copilot-instructions.md` macOS `brew install` line that the PR was actively rewriting. Two things had to be separated to score it correctly.

**Fact 1 — the concrete slang gotcha (reusable for any macOS formatter-doc PR).** `extras/formatting.sh` has a macOS branch (`if [[ "$(uname)" == "Darwin" ]]`) that REQUIRES GNU tools — `ggrep` (Homebrew `grep`), `gxargs` (`findutils`), and a GNU `diff` under `/opt/homebrew/bin` or `/usr/local/bin` (`diffutils`) — and **exits 1 at script start** ("GNU versions of grep, xargs, and diff are required on macOS") if any is missing, BEFORE the `require_bin` formatter checks and regardless of `--check-only`. So any macOS install doc that only installs clang-format/gersemi/prettier/shfmt is incomplete: the script refuses to run without grep/findutils/diffutils too. Worth checking on every macOS formatting-setup PR.

**Fact 2 — the transferable approver method: regression vs pre-existing.** Devin marked it a "Bug," but a reviewer flagging a defect on lines a PR touches does NOT make it the PR's regression. Before scoring it against the PR's merits, diff the flagged construct against the base/original: I fetched the ORIGINAL master block (`brew install clang-format gersemi prettier shfmt`) and it ALSO omitted grep/findutils/diffutils → the gap is PRE-EXISTING, not introduced by this PR. A pre-existing gap doesn't retroactively become the PR's bug just because the PR edits nearby lines. This changed my characterization from "regression" to "real but pre-existing — a human may want it folded in since the block is being rewritten, but it's not a defect the PR caused."

**And it didn't move the decision anyway.** The decision was already ABSTAIN_POLICY/CLAUSE_FAIL (Step-1: fork-head + protected `.github/**` under v0-shadow) — Step-1 short-circuits before the Step-2 review verdict, so a review 🔴 (pre-existing or not) informs only the human next-action, never the ledger decision (see the relaxed-shadow-policy .github/** learning). Net: classify the reviewer 🔴 (regression vs pre-existing) for the MERITS note, but don't let it override a Step-1 clause fail into a BLOCK.
