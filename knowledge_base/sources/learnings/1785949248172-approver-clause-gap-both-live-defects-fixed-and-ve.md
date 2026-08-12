# [approver/clause-gap] Both live defects FIXED and verified by execution — SKILL.md now documents all 4 policy tiers with the pin-outranks-mount warning, and clauses.json now records policy_path; the test run independently re-confirmed #925 from the other direction

# [approver/clause-gap] The two machinery defects are closed, with a running test as proof

## What was fixed

Both defects affected **every** decision the approver makes, not just #925.

**Fix 1 — `SKILL.md` documented 2 policy tiers against an implemented 4.** This was the root
cause of the staging-fallback defect: the staging step behaved as designed *per the contract as
written*. The old text called `<ws>/policy/APPROVAL_POLICY.json` **"mounted"** — but that path
is the per-PR staged pin (tier 2); the actual mount is
`/workspace/extra/approver-policy/APPROVAL_POLICY.json` (tier 3), a different file with a
different lifetime. It also omitted that the pin **outranks** the mount, and omitted `--policy`
entirely. Replaced with all four tiers, the pin-outranks-mount warning, and the consequence
spelled out: a fallback to the bundled default reverts **all six axes** at once
(trusted_associations 3 vs 7, allow_fork_head false vs true, require_ci_green true vs false,
protected_paths 8 vs 1, caps 400/30 vs 8000/150), so the clause that fires is incidental.

**Fix 2 — `clauses.json` recorded `policy_version` but not which file produced it.** Tiers 2-4
can hold different files carrying the same version string, which is precisely why this took
eight rounds of archaeology. Now:

```python
result["policy_path"] = os.path.abspath(policy_path)
```

plus the path in stdout. One read now settles "which policy decided this?"

## Verified by running it, not by assuming the edit took

```
python3 -m py_compile eval-clauses.py                     → OK
python3 eval-clauses.py /tmp/wstest --policy <mount>      → runs
  clauses -> /tmp/wstest/clauses.json  (policy v0-shadow-wide from
             /workspace/extra/approver-policy/APPROVAL_POLICY.json)
  pass=[author_trust, head_provenance, commit_match, ci_green_on_sha,
        no_protected_paths, tier_eligible]
clauses.json → policy_path: /workspace/extra/approver-policy/APPROVAL_POLICY.json
```

Run on a **scratch copy** of #925's inputs so no real workspace was mutated.

**The test independently re-confirmed the #925 finding from the opposite direction:** the
recorded run (stale pin `v0-shadow`) had `no_protected_paths` **FAIL**; the same inputs under
the signed `v0-shadow-wide` give **all six clauses PASS**. So #925 does reach Step 2 under the
policy in force — where its `REQUEST_CHANGES`/2-gaps verdict still yields an abstain, on the
merits. Two independent paths to the same conclusion, one by auditing artifacts and one by
executing the fixed code.

## Durability — the part that will bite later

These edits live in `/home/node/.claude/skills/slangpy-pr-approver/`, which is a **one-shot
snapshot extracted at container-image build time** (all 30 skills share mtime
`2026-07-27 10:51:13`; upstream's `human-names`, added 07-31, is absent locally). So they
**survive until the next image rebuild**, then vanish silently. And there is **no upstream
route**: the skill is registry-listed as syncing from `shader-slang/slang-skills@main`, but
that repo's `skills/` (30 dirs) doesn't contain it — 1 of 5 such phantom entries out of 18.

⇒ Full replacement text for both fixes is recorded rebuild-proof at
**`/workspace/agent/tools/PENDING-SKILL-FIXES.md`**, to be re-applied after any rebuild. That
file also carries Fix 3 (the `.external-skills.json` schema gap — `{repo, ref}` cannot express
"local-only"), which is a host-config change to raise with the operator, not a skill edit.

**Method note:** the interim mitigation (`--policy <mount>` explicit, tier 1) was available and
correct the entire time and needed no edit. Shipping the doc fix matters more than the code
fix here — the code was doing what it said; the *contract* was wrong, and the contract is what
callers follow.

Siblings: the staging-fallback entry; "skill edits survive until the next image rebuild";
"a schema that cannot represent a real state will misrepresent it."
