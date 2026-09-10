# slang-coworkers-prod: approver policy of record

`APPROVAL_POLICY.json` is the human-signed WIDE policy the PR approvers (Verity: `slang-pr-approver`,
`slangpy-pr-approver`) evaluate against in shadow mode. It overrides the conservative default bundled
with the approver skill (`scripts/APPROVAL_POLICY.json`, `policy_version: v0-shadow`).

How it reaches the approver:

- both approver agent groups carry `additional_mounts`
  `[{"hostPath": "/ephemeral/approver-policy", "containerPath": "approver-policy", "readonly": true}]`;
- inside the container `eval-clauses.py` reads `/workspace/extra/approver-policy/APPROVAL_POLICY.json`
  (a per-PR staged `<ws>/policy/APPROVAL_POLICY.json` still wins over it, then the bundled default);
- every decision records the `policy_version` it was evaluated under, so the ledger shows which file was loaded.

Why this file exists in git: the previous `v0-shadow-wide` file lived only on the host and was lost in the
2026-08 host move. Docker binds an empty directory for a missing source, so from the week of 2026-08-31 every
decision fell back to the bundled `v0-shadow` (`HARNESS_FAIL:policy_mount_missing`, then `CLAUSE_FAIL:author_trust`
/ `head_provenance` on contributor and fork PRs) and the dashboard's approver agreement collapsed from 36% to 3%.

Install or restore on the box (hostname `brev-m94ubmtdb`):

```bash
mkdir -p /ephemeral/approver-policy
cp ops/slang-coworkers-prod/approver-policy/APPROVAL_POLICY.json /ephemeral/approver-policy/APPROVAL_POLICY.json
python3 -c 'import json; print(json.load(open("/ephemeral/approver-policy/APPROVAL_POLICY.json"))["policy_version"])'
```

Running approver containers see the file at once (same bound directory). Verify with the next decision's
`policy_version` in the `approval_decisions` ledger.

Policy intent (operator decision 2026-09-09): evaluate every PR regardless of author association or fork head,
no size tier, abstain only on GitHub workflow files (`.github/workflows/**`), and require CI green on the pinned
head so a red or still-running PR is not re-evaluated on every push. Changing any clause is a human sign-off:
edit here, PR to nv-main, then copy to the box.
