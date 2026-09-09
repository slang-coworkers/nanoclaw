---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788562047204-pwtlcf
written_at: 2026-09-08T22:14:26.798Z
---

# [approver/calibration] CI workflow that merges+builds an untrusted PR: CWE-522 persist-credentials is blocking only under specific factors

**Signal (merge-join calibration).** shader-slang/slangpy#1143 added a `repository_dispatch` CI step that `git merge`s an external PR head into the checkout and then builds it. CodeRabbit raised a Major **CWE-522**: `actions/checkout` persists `GITHUB_TOKEN` in `.git/config`, so PR-controlled build code could read/exfiltrate it (fix: `persist-credentials: false`). My decision was `ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths` (protected-path routing). **Outcome: the author (who holds merge access) merged at my exact decision commit WITHOUT setting `persist-credentials:false`**, after posting a threat-model rebuttal. So the join is `merged ⇒ APPROVED`, and the abstain was aligned (abstain routes to a human; the human decided).

**Transferable lens — judge a persist-credentials / CWE-522 finding on a CI workflow by these factors, not by its mere presence:**
1. **Token scope (read `permissions:` first — cheapest, strongest mitigator).** #1143 declares `permissions: contents: read` — the persisted `GITHUB_TOKEN` cannot push code; its only write scopes were `checks`/`statuses` (moderate, not code-write). A least-privilege `permissions:` block sharply bounds the blast radius. CodeRabbit's finding did NOT weight this; always check the top-level/job `permissions:` block before treating the finding as serious.
2. **New vs pre-existing exposure.** The job ALREADY built untrusted code with the same token (`build-and-test-with-slang` checks out and builds an arbitrary Slang PR). The new step adds SlangPy PR code to an already-untrusted build — it does not change the credential-exposure *class*.
3. **Trigger controllability.** The PR number is not attacker-supplied: it comes from `SLANGPY_CHERRY_PICK_PR` set on `shader-slang/slang` `master`, so triggering requires merge access to Slang master (trusted).
4. **Runner reuse.** Self-hosted reused workspaces (`nvrgfx-kernelvm-bridge`) amplify persisted-state risk (leftover refs/creds across runs) — aggravating when reused, mitigated when ephemeral.

**How to use it.** When a CI-workflow PR that executes untrusted PR/branch code draws a CWE-522/persist-credentials finding, it is neither auto-blocking nor auto-ignorable. For the approver this stays an ABSTAIN (protected-path → human), and this join CONFIRMS that routing is well-calibrated: a genuine security question requiring a threat model went to the human holding the merge-access context. Record the four factors; a future similar PR where `permissions:` is broad (e.g. `contents: write`) OR the trigger is attacker-controllable OR the exposure is genuinely new is the higher-risk variant worth flagging harder to the human.
