---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786957699438-ha65lx
written_at: 2026-08-17T14:03:01.585Z
---

# [approver/infra-abstain] eval-clauses silently falls back to the STRICT bundled policy when --policy omits the mount — v0-shadow in clauses.json is the tell

**Symptom:** On shader-slang/slang#12569 I recorded ABSTAIN_POLICY:CLAUSE_FAIL:head_provenance — "fork head, policy forbids". It was WRONG. I had copied the *bundled* `scripts/APPROVAL_POLICY.json` (`v0-shadow`, `allow_fork_head:false`) into the workspace and passed that to eval-clauses, instead of the MOUNTED active policy at `/workspace/extra/approver-policy/APPROVAL_POLICY.json` (`v0-shadow-wide`, `allow_fork_head:true`, human-signed haaggarwal 2026-08-04). The same mistake sat under my #12452 re-gate until I compared the two files.

**Root cause:** `eval-clauses.py`'s `--policy` defaults to the strict bundled default shipped next to the script (`DEFAULT_POLICY = HERE/APPROVAL_POLICY.json`). If you don't explicitly point `--policy` at the mount, it uses the strict one and SILENTLY produces a different verdict — `head_provenance` fails on every fork PR, `no_protected_paths` protects 8 globs instead of 1, caps are 20× tighter (400/30 vs 8000/150). The mounted `v0-shadow-wide` exists precisely because in shadow mode the human is the real gate, so a Step-1 terminal FAIL only destroys measurement signal (measured 91% of decisively-judged abstains were later approved). Using the strict policy manufactures false ABSTAIN_POLICY rows that look like diligence.

**The tell (already in my memory, and I still missed it):** `policy_version` in the emitted `clauses.json`. `v0-shadow` in a wide-era decision IS the infra signal. **Read `policy_version` from clauses.json and state it before trusting any "N/6 pass".** The mounted policy is at `/workspace/extra/approver-policy/APPROVAL_POLICY.json` (also copied at `/workspace/agent/policy/APPROVAL_POLICY.json`).

**Fix / rule:** ALWAYS run `eval-clauses.py <ws> --policy /workspace/extra/approver-policy/APPROVAL_POLICY.json` (the mount), and stage THAT file into `work/<pr>/policy/` so the workspace is reproducible. Never copy the bundled `scripts/APPROVAL_POLICY.json` into a workspace. Verify `clauses.json.policy_version == v0-shadow-wide` as a post-condition. A `head_provenance` FAIL on a MEMBER-authored fork PR under shadow mode is a near-certain wrong-policy artifact — check the policy_version before recording.

**Secondary infra note from the same session:** the `no_protected_paths`/`tier_eligible` clauses fetch changed paths via `gh api repos/OWNER/NAME/compare/master...<sha>`, which began returning a transient HTTP 404 mid-session (it succeeded earlier on identical data; `gh pr view`/`gh pr diff` kept working). That is a false ABSTAIN_INFRA by fall-through. Hand-verify those two clauses from authoritative sources (paths from `gh pr diff --name-only`, sizes from `pulls/N` scalars) and stamp the evidence, rather than accept the fall-through — same discipline as the collect-reviews exit-21 pagination false-infra.
