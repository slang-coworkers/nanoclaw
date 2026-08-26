#!/usr/bin/env python3
"""Evaluate the eligibility clauses for one PR workspace — from DATA ONLY.

This is Step 1 of the slang-pr-approver decision procedure. It never judges
the code and never reasons: every clause is a mechanical predicate over PR
metadata + the changed paths at the pinned commit (read-only gh) and the
policy file. The skill reads the output and maps it to a decision:

  any clause FAIL        -> ABSTAIN_POLICY (reason CLAUSE_FAIL:<name>)
  any clause UNEVALUABLE -> ABSTAIN_POLICY (reason CLAUSE_UNEVALUABLE:<name>)
  all PASS               -> continue to the verdict parse (Step 2)

Input: a workspace dir staged by /slang-pr-approve, containing
  tmp/context.json   {repo, pr, commit_sha, mode}
  review/review-doc.md   (embedded ```json {..., commit_id, diff_hash, ...})
Policy: --policy PATH (default: the mounted policy/APPROVAL_POLICY.json, else
the v0 default shipped next to this script). JSON, not YAML — the lab
container has no PyYAML and these scripts are stdlib-only.

Output: <workspace>/clauses.json
  {"policy_version": "...", "commit_sha": "...", "mode": "...",
   "clauses": [{"name","status","evidence"}...],
   "summary": {"pass":[...], "fail":[...], "unevaluable":[...]}}

stdlib + gh only.
"""
import argparse
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_POLICY = os.path.join(HERE, "APPROVAL_POLICY.json")


def gh_json(path):
    """One read-only gh api call -> parsed JSON, or raise (caller marks the
    dependent clause unevaluable)."""
    r = subprocess.run(["gh", "api", path], capture_output=True, text=True, check=False)
    if r.returncode != 0:
        raise RuntimeError(f"gh api {path} failed: {r.stderr[:200]}")
    return json.loads(r.stdout)


def glob_to_re(glob):
    """Translate a path glob to a regex. `**` spans path separators, `*` does
    not, `?` is a single non-separator char. Anchored full-match."""
    out, i = ["^"], 0
    while i < len(glob):
        c = glob[i]
        if c == "*":
            if glob[i + 1:i + 2] == "*":
                out.append(".*")
                i += 2
                if glob[i:i + 1] == "/":  # `**/` also matches zero dirs
                    i += 1
                continue
            out.append("[^/]*")
        elif c == "?":
            out.append("[^/]")
        else:
            out.append(re.escape(c))
        i += 1
    out.append("$")
    return re.compile("".join(out))


def load_context(ws):
    with open(os.path.join(ws, "tmp", "context.json")) as f:
        return json.load(f)


def _result_block(ws):
    """Parse the workflow's synthesized result object out of review-doc.md.

    The harvested bot-review body is pasted VERBATIM and is UNTRUSTED — it may
    contain its own ```json fences (examples, metadata). So we do NOT trust
    block position: we prefer the block carrying the `_approver_result` marker
    the workflow stamps on its result. Fallback (marker absent, older doc): the
    LAST parseable json block, since the workflow always appends its result
    last. Returns the parsed dict, or None."""
    p = os.path.join(ws, "review", "review-doc.md")
    if not os.path.exists(p):
        return None
    with open(p, encoding="utf-8", errors="replace") as fh:
        text = fh.read()
    blocks = []
    for m in re.finditer(r"```json\s*(.*?)```", text, re.DOTALL):
        raw = m.group(1).strip()
        try:
            obj = json.loads(raw)  # full-object parse — nested braces are fine
        except json.JSONDecodeError:
            continue
        if isinstance(obj, dict):
            blocks.append(obj)
    if not blocks:
        return None
    for obj in blocks:
        if obj.get("_approver_result") is True:
            return obj
    return blocks[-1]  # marker absent -> the workflow appends its result last


def _review_field(ws, key):
    """One field from the synthesized result block (None if absent)."""
    obj = _result_block(ws)
    return obj.get(key) if obj else None


def review_diff_hash(ws):
    """The diff_hash the synthesized review doc records (secondary evidence)."""
    return _review_field(ws, "diff_hash")


def review_commit_id(ws):
    """The commit_id the harvested review reported reviewing. The workflow
    synthesizes this from the posted bot review's `.commit_id`; a review that
    matched the pinned commit carries the pinned sha here. When the harvest
    footer lacked a diff sha256, diff_hash is written as a `commit:<sha>`
    sentinel — commit_match still passes off this field."""
    return _review_field(ws, "commit_id")


def clause(name, status, evidence):
    return {"name": name, "status": status, "evidence": evidence}


def evaluate(ws, policy):
    ctx = load_context(ws)
    repo, pr, sha = ctx["repo"], ctx["pr"], ctx["commit_sha"]
    clauses = []

    # PR-level metadata (author association, base/head repo) — stable facts,
    # not history. Failure to fetch makes the metadata-derived clauses
    # unevaluable rather than guessing.
    try:
        meta = gh_json(f"repos/{repo}/pulls/{pr}")
    except Exception as e:  # noqa: BLE001 - any failure must make the clause unevaluable, not guess
        meta = None
        meta_err = str(e)[:160]

    # 1. author_trust — association must be in the trusted set.
    trusted = set(policy.get("trusted_associations", []))
    if meta is None:
        clauses.append(clause("author_trust", "unevaluable", f"pr metadata: {meta_err}"))
    else:
        assoc = (meta.get("author_association") or "").upper()
        clauses.append(clause("author_trust", "pass" if assoc in trusted else "fail",
                              f"author_association={assoc or 'unknown'}; trusted={sorted(trusted)}"))

    # 2. head_provenance — same-repo head, unless policy allows fork heads.
    if meta is None:
        clauses.append(clause("head_provenance", "unevaluable", "pr metadata unavailable"))
    else:
        head_repo = ((meta.get("head") or {}).get("repo") or {}).get("full_name")
        is_fork = head_repo is not None and head_repo != repo
        if not is_fork:
            clauses.append(clause("head_provenance", "pass", f"same-repo head ({head_repo})"))
        elif policy.get("allow_fork_head", False):
            clauses.append(clause("head_provenance", "pass", f"fork head allowed by policy ({head_repo})"))
        else:
            clauses.append(clause("head_provenance", "fail", f"fork head {head_repo}, policy forbids"))

    # 3. commit_match — the review reviewed exactly this commit. The workflow
    # writes commit_id into the review doc's embedded json: the harvested bot
    # review's `.commit_id` on the harvest tier, or the pinned commit_sha on the
    # Devin-only tier (Devin reviews the pinned head). Predicate: commit_id ==
    # the pinned commit_sha. Present but different => a synthesis error (the
    # workflow only ever writes the pinned sha or a matched harvest) — fail.
    # Absent => the review doc is missing/malformed — unevaluable. diff_hash is
    # kept as secondary evidence.
    cid = review_commit_id(ws)
    dh = review_diff_hash(ws)
    if cid is None:
        clauses.append(clause("commit_match", "unevaluable",
                              "review doc absent or carries no commit_id"))
    elif cid == sha:
        clauses.append(clause("commit_match", "pass",
                              f"review commit_id={cid[:12]} == pinned"
                              + (f"; diff_hash={dh[:16]}" if dh else "")))
    else:
        clauses.append(clause("commit_match", "fail",
                              f"review commit_id={cid[:12]} != pinned {sha[:12]}"))

    # 4. ci_green_on_sha — combined status at the PINNED commit (the PR head).
    # Skipped if policy doesn't require it.
    if not policy.get("require_ci_green", True):
        clauses.append(clause("ci_green_on_sha", "pass", "policy does not require CI green"))
    else:
        try:
            st = gh_json(f"repos/{repo}/commits/{sha}/status")
            state = st.get("state")  # success | pending | failure | error
            if state == "success":
                clauses.append(clause("ci_green_on_sha", "pass", f"combined status=success @ {sha[:12]}"))
            elif state in ("failure", "error"):
                clauses.append(clause("ci_green_on_sha", "fail", f"combined status={state} @ {sha[:12]}"))
            else:  # pending / no statuses reported
                clauses.append(clause("ci_green_on_sha", "unevaluable",
                                      f"combined status={state or 'none'} @ {sha[:12]}"))
        except Exception as e:  # noqa: BLE001 - see above: unevaluable beats a guessed verdict
            clauses.append(clause("ci_green_on_sha", "unevaluable", f"status fetch: {str(e)[:160]}"))

    # Changed paths at the pinned commit — base_ref...commit_sha. Feeds 5 + 6.
    files, files_err = None, None
    if meta is not None:
        base_ref = (meta.get("base") or {}).get("ref")
        try:
            cmp = gh_json(f"repos/{repo}/compare/{base_ref}...{sha}")
            files = cmp.get("files", [])
        except Exception as e:  # noqa: BLE001 - see above: unevaluable beats a guessed verdict
            files_err = str(e)[:160]
    else:
        files_err = "pr metadata unavailable (no base ref)"

    # 5. no_protected_paths — no changed path matches a protected glob.
    protected = [glob_to_re(g) for g in policy.get("protected_paths", [])]
    if files is None:
        clauses.append(clause("no_protected_paths", "unevaluable", f"compare: {files_err}"))
    else:
        hits = [f["filename"] for f in files
                if any(rx.match(f["filename"]) for rx in protected)]
        if hits:
            clauses.append(clause("no_protected_paths", "fail",
                                  f"touches protected: {', '.join(hits[:5])}"))
        else:
            clauses.append(clause("no_protected_paths", "pass",
                                  f"{len(files)} changed path(s), none protected"))

    # 6. tier_eligible — size caps on total churn and file count.
    if files is None:
        clauses.append(clause("tier_eligible", "unevaluable", f"compare: {files_err}"))
    else:
        total = sum((f.get("additions", 0) + f.get("deletions", 0)) for f in files)
        max_lines = policy.get("max_total_lines", 400)
        max_files = policy.get("max_files", 30)
        if total > max_lines:
            clauses.append(clause("tier_eligible", "fail",
                                  f"{total} lines changed > cap {max_lines}"))
        elif len(files) > max_files:
            clauses.append(clause("tier_eligible", "fail",
                                  f"{len(files)} files > cap {max_files}"))
        else:
            clauses.append(clause("tier_eligible", "pass",
                                  f"{total} lines / {len(files)} files within caps"))

    summary = {
        "pass": [c["name"] for c in clauses if c["status"] == "pass"],
        "fail": [c["name"] for c in clauses if c["status"] == "fail"],
        "unevaluable": [c["name"] for c in clauses if c["status"] == "unevaluable"],
    }
    return {
        "policy_version": policy.get("policy_version", "unknown"),
        "commit_sha": sha,
        "mode": ctx.get("mode"),
        "clauses": clauses,
        "summary": summary,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("workspace", help="per-PR workspace dir (has tmp/context.json)")
    ap.add_argument("--policy", help="policy JSON (default: mounted policy/ else bundled v0)")
    a = ap.parse_args()

    ws = a.workspace
    if not os.path.exists(os.path.join(ws, "tmp", "context.json")):
        print(f"no tmp/context.json under {ws}", file=sys.stderr)
        sys.exit(2)

    # Policy resolution order (first that exists wins):
    #   1. --policy PATH (explicit override)
    #   2. per-PR staged policy: <ws>/policy/APPROVAL_POLICY.json
    #   3. group-mounted policy: /workspace/extra/approver-policy/APPROVAL_POLICY.json
    #      (a per-group additional_mount off an allowlisted host root — the lever
    #      for relaxing shadow-mode clauses without editing the bundled default)
    #   4. bundled conservative v0 default shipped next to this script
    MOUNTED_POLICY = "/workspace/extra/approver-policy/APPROVAL_POLICY.json"
    policy_path = a.policy
    if not policy_path:
        per_pr = os.path.join(ws, "policy", "APPROVAL_POLICY.json")
        if os.path.exists(per_pr):
            policy_path = per_pr
        elif os.path.exists(MOUNTED_POLICY):
            policy_path = MOUNTED_POLICY
        else:
            policy_path = DEFAULT_POLICY
    with open(policy_path) as f:
        policy = json.load(f)

    result = evaluate(ws, policy)
    out = os.path.join(ws, "clauses.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=1)
    s = result["summary"]
    print(f"clauses -> {out}  (policy {result['policy_version']})")
    print(f"  pass={s['pass']}")
    if s["fail"]:
        print(f"  FAIL={s['fail']}  -> ABSTAIN_POLICY")
    if s["unevaluable"]:
        print(
            f"  UNEVALUABLE={s['unevaluable']}  -> ABSTAIN_POLICY (reason CLAUSE_UNEVALUABLE:<name>)"
        )


if __name__ == "__main__":
    main()
