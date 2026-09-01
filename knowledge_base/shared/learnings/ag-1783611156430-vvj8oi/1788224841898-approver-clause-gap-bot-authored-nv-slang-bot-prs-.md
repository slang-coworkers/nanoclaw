---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788224204274-c9tjij
written_at: 2026-09-01T01:07:21.898Z
---

# [approver/clause-gap] Bot-authored (nv-slang-bot) PRs are a foregone author_trust ABSTAIN — check it before the expensive Devin/challenger run

## Symptom
PR #12519 (shader-slang/slang, "Fix #12485: single-argument class constructor call aborts with internal error") was authored by `nv-slang-bot[bot]`. I ran the full /slang-pr-approve pipeline — harvest, a fresh Devin subagent run, empirical pre-fix binary testing of the challenger's upcast concern — and only *then* ran `eval-clauses.py`, which failed `author_trust` and produced a deterministic `ABSTAIN_POLICY:CLAUSE_FAIL:author_trust`. The Devin run and challenger investigation added nothing to the recorded decision (a clause-fail abstain is an early return; the skill says skip the challenger/critique gate entirely).

## Root cause
Two conditions co-occur *structurally* for `nv-slang-bot[bot]`-authored fixer PRs, and both are knowable up front:
1. **Devin-only tier is forced.** Production `claude-pr-review.yml` genuinely skips bot-authored PRs, so `collect-reviews.sh` returns exit 20 (`harvest.json={"found":false}`) — no `github-actions[bot]`/CodeRabbit review to harvest.
2. **`author_trust` fails.** The bot's `authorAssociation` is `CONTRIBUTOR`, which is not in the policy's trusted set `{COLLABORATOR, MEMBER, OWNER}` (v0-shadow). A clause FAIL ⇒ `ABSTAIN_POLICY` regardless of code quality or how many humans approved.

So for any `nv-slang-bot`-authored PR the decision is a foregone `CLAUSE_FAIL:author_trust` abstain.

## How to catch it
When the tasking message shows the PR **author is a bot / `nv-slang-bot[bot]`** (or any non-trusted association), run `eval-clauses.py` (Step 1) **first / early** — it's cheap and read-only. If `author_trust` fails, you already have your `ABSTAIN_POLICY:CLAUSE_FAIL:author_trust`: record it and stop, per the skill's "early return on ABSTAIN_POLICY — do NOT run the full pipeline." No need to spawn the Devin subagent or do challenger digging for a decision that's already determined by the clause gate. (The workflow's nominal ordering puts harvest+Devin before the clause check; this is the one case where evaluating the clauses first saves the whole expensive stage.)

## Fix / rule
For a bot-authored (or otherwise plainly-untrusted-author) PR: evaluate `author_trust` before the harvest/Devin stage. If it fails, abstain immediately. Reserve Devin + the adversarial challenger for PRs that can actually reach `WOULD_APPROVE`/`BLOCK` (trusted author, clauses otherwise green). Note the abstain is excluded from agreement scoring, so extra investigation on it does not even improve calibration metrics.

## Side note (calibration, not scored)
On the merits the fix looked sound: a root-cause change in the checker's `ResolveInvoke` (not a masking lowering guard, so it survives `SLANG_ASSERT`→`SLANG_ASSUME` in Release), with trigger-present regression tests (an EXECUTABLE test running `new Counter(4)` — the exact ICE trigger — and a diagnostic test asserting E30066 instead of abort). Devin's "lost coercion / upcast" flag was empirically unreachable: class-to-class inheritance is unsupported (E30832) and cast-to-class from an interface value already errors pre-fix (E30019/E33070), while the identity coercion `(C)c` stays on the fast-path. Two MEMBERs had already approved. None of that changes the policy abstain — it is exactly the "a human must look" case the author_trust clause exists for.
