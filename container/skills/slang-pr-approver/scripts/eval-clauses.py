#!/usr/bin/env python3
"""Evaluate the eligibility clauses for one PR workspace — from DATA ONLY.

This is Step 1 of the slang-pr-approver decision procedure. It never judges
the code and never reasons: every clause is a mechanical predicate over PR
metadata + the changed paths at the pinned commit (read-only gh) and the
policy file. The skill reads the output and maps it to a decision:

  any clause FAIL        -> ABSTAIN_POLICY (reason CLAUSE_FAIL:<name>)
  any clause UNEVALUABLE -> ABSTAIN_INFRA  (reason CLAUSE_UNEVALUABLE:<name>)
  all PASS               -> continue to the verdict parse (Step 2)

Input: a workspace dir staged by /slang-pr-approve, containing
  tmp/context.json   {repo, pr, commit_sha, mode, human_verdict_or_null}
  review/review-doc.md   (embedded ```json {..., diff_hash, ...})
Policy: --policy PATH (default: the mounted policy/APPROVAL_POLICY.json, else
the v0 default shipped next to this script). JSON, not YAML — the lab
container has no PyYAML and these scripts are stdlib-only.

Output: <workspace>/clauses.json
  {"policy_version": "...", "commit_sha": "...", "mode": "...",
   "clauses": [{"name","status","evidence"}...],
   "summary": {"pass":[...], "fail":[...], "unevaluable":[...]}}

HISTORICAL LEAK GUARD: in historical mode nothing that postdates the R0
commit may be consulted — later reviews, merge state, post-R0 comments, or
CI on a newer sha. Every gh call here is keyed on `commit_sha` (the R0
commit) or on stable PR-level facts (author association, base/head repo),
never on the PR's *final* head or its review/merge history.

stdlib + gh only.
"""
import argparse, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_POLICY = os.path.join(HERE, "APPROVAL_POLICY.json")


def gh_json(path):
    """One read-only gh api call -> parsed JSON, or raise (caller marks the
    dependent clause unevaluable)."""
    r = subprocess.run(["gh", "api", path], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("gh api %s failed: %s" % (path, r.stderr[:200]))
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


def review_diff_hash(ws):
    """Pull diff_hash out of the review doc's embedded ```json block.
    Missing doc / no block / no field -> None (commit_match unevaluable)."""
    p = os.path.join(ws, "review", "review-doc.md")
    if not os.path.exists(p):
        return None
    text = open(p, encoding="utf-8", errors="replace").read()
    for m in re.finditer(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL):
        try:
            obj = json.loads(m.group(1))
        except json.JSONDecodeError:
            continue
        if "diff_hash" in obj:
            return obj.get("diff_hash")
    return None


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
    except Exception as e:
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

    # 3. commit_match — the review doc reviewed this commit's diff. We can't
    # recompute the reviewer's hash, so the predicate is: the doc records a
    # diff_hash at all (a doc with none never reviewed a pinned commit). The
    # skill's Step 2 cross-checks the hash value against commit_sha too.
    dh = review_diff_hash(ws)
    if dh:
        clauses.append(clause("commit_match", "pass", f"review doc diff_hash={dh[:16]}"))
    else:
        clauses.append(clause("commit_match", "unevaluable",
                              "review doc absent or carries no diff_hash"))

    # 4. ci_green_on_sha — combined status at the PINNED commit (never a newer
    # sha; at R0 in historical mode). Skipped if policy doesn't require it.
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
        except Exception as e:
            clauses.append(clause("ci_green_on_sha", "unevaluable", f"status fetch: {str(e)[:160]}"))

    # Changed paths at the pinned commit — base_ref...commit_sha (the Rn-era
    # diff, not the PR's final files). Feeds clauses 5 + 6.
    files, files_err = None, None
    if meta is not None:
        base_ref = (meta.get("base") or {}).get("ref")
        try:
            cmp = gh_json(f"repos/{repo}/compare/{base_ref}...{sha}")
            files = cmp.get("files", [])
        except Exception as e:
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

    policy_path = a.policy
    if not policy_path:
        mounted = os.path.join(ws, "policy", "APPROVAL_POLICY.json")
        policy_path = mounted if os.path.exists(mounted) else DEFAULT_POLICY
    with open(policy_path) as f:
        policy = json.load(f)

    result = evaluate(ws, policy)
    out = os.path.join(ws, "clauses.json")
    json.dump(result, open(out, "w"), indent=1)
    s = result["summary"]
    print(f"clauses -> {out}  (policy {result['policy_version']})")
    print(f"  pass={s['pass']}")
    if s["fail"]:
        print(f"  FAIL={s['fail']}  -> ABSTAIN_POLICY")
    if s["unevaluable"]:
        print(f"  UNEVALUABLE={s['unevaluable']}  -> ABSTAIN_INFRA")


if __name__ == "__main__":
    main()
