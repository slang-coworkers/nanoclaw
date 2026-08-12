---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1783957284686-c8ztio
written_at: 2026-08-11T14:52:52.267Z
---

# [approver/clause-gap] The approval policy silently falls back to the STRICT bundled default when its mount is absent — measured 12/279 runs, and clauses.json makes it auditable

## Symptom

`eval-clauses.py` resolves its policy through a 4-step fallback chain and the last step is **silent**. If the group-mounted policy is absent, it uses the conservative bundled default with **no warning, no diagnostic, no marker in the output** other than the `policy_version` string.

The two policies disagree on whether the same PR is eligible. Measured on shader-slang/slang#12084 (1 file, `.github/workflows/nightly-mdl-perf-test.yml`, fork head) by running the real script both ways:

| policy | source | `no_protected_paths` | `head_provenance` | outcome |
|---|---|---|---|---|
| `v0-shadow-wide` | group mount | **pass** (1 glob: `**/slang-tag-version.h`) | **pass** (`allow_fork_head: true`) | 6/6 PASS → decidable |
| `v0-shadow` | bundled default | **fail** (8 globs incl. `.github/**`, `**/*.yml`) | **fail** (`allow_fork_head` ABSENT) | `ABSTAIN_POLICY:CLAUSE_FAIL` |

⚠️ **TWO clauses flip, not one.** The widely-discussed one is `protected_paths` (8 globs → 1). The second is easy to miss: **`allow_fork_head` is entirely ABSENT from the bundled default**, so every fork-authored PR — the majority of external contributions — additionally fails `head_provenance`. Caps also tighten: `max_total_lines` 8000 → 400, `max_files` 150 → 30.

## Root cause

`eval-clauses.py:275-283`, resolution order — first that exists wins:
1. `--policy PATH`
2. `<workspace>/policy/APPROVAL_POLICY.json` (per-PR staged)
3. the group-mounted policy
4. `DEFAULT_POLICY` = the copy bundled next to the script ← **silent fallback, and it is the STRICT one**

`SKILL.md:33` documents the behavior ("If none is mounted, `eval-clauses.py` falls back to the v0 default bundled next to it"), so it is intended — but nothing at runtime tells you which branch was taken. Compounding it: the strict default is duplicated in several places in the tree while the widened policy exists as a single copy on a mount that has been observed backed by scratch/ephemeral storage (`findmnt` → `/dev/vdb`). So the *authoritative* policy is the *least durable* copy.

⭐⭐⭐ **A CONFIG WHOSE ABSENCE SILENTLY CHANGES A VERDICT IS THE FALSE-GREEN SHAPE ONE LAYER UP FROM THE DECISION.** Every clause-level anti-false-green discipline (positive tokens, enumerate-don't-fold, read the evidence string) assumes the *policy* is a fixed input. It isn't.

⚠️ Note the failure direction is toward ABSTAIN, i.e. **fails safe** — a dropped mount over-abstains, it does not over-approve. That is why it can persist unnoticed: it produces conservative-looking output. Do not "fix" it into failing open.

## How to catch it — and it IS recoverable retrospectively

**`clauses.json` records `policy_version`.** That makes mount presence auditable per-decision after the fact, which is worth knowing when someone says per-wake mount state is unrecoverable — it is, from the decision artifacts:

```bash
cd <work-dir> && for d in */; do f="$d/clauses.json"; [ -f "$f" ] && \
  printf '%-30s %-18s fail=%s\n' "${d%/}" "$(jq -r '.policy_version' "$f")" "$(jq -c '.summary.fail' "$f")"; done
```

Measured across 279 decision workspaces in one container: **216 `v0-shadow-relaxed`, 51 `v0-shadow-wide`, 12 `v0-shadow`**. So the mount-absent path is not hypothetical — **~4% of runs fell back to the strict default**, several of them landing `CLAUSE_FAIL:head_provenance` / `no_protected_paths` that the live policy would have passed. One PR shows the flip *within its own revision chain* across 6 revisions.

## Fix / practice

- **Before trusting `6/6 pass` as a stable input, read `policy_version` out of `clauses.json` and say it out loud in the decision note.** A clause set without its policy version is not comparable to any other clause set.
- Treat `v0-shadow` appearing in a *shadow-wide-era* decision as an **infra signal**, not a policy result — the mount was missing for that wake.
- When comparing decisions across dates, do not infer the governing policy from timestamps alone. Dates establish which policy *was current*; only `policy_version` establishes which one *was used*. (Worked example: four merges 3–6 days after a widening — the date inference said "wide", and the artifacts independently confirmed `v0-shadow-wide` for all of them. Confirmable, but confirm it rather than assume it.)
- Operator items: put the authoritative policy on durable storage, and make the fallback **loud** — print the resolved policy path and a warning on the branch at `:283`, so a missing mount is visible rather than inferred.
- When probing "what would the other policy say?", run the real script with `--policy` against a **copy** of the workspace. Overwriting `clauses.json` in place destroys the hash the critique gate attested and invalidates your approve.
