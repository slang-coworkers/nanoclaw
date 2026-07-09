#!/usr/bin/env python3
"""Prepare offline/historical rounds for /slangpy-pr-approve.

For each requested PR of shader-slang/slangpy this script RESOLVES the commits
a human actually reviewed (read-only gh; the lab container has it) and emits
round manifests of (pr, commit, human_verdict) triples. It downloads NO diffs
and NO snapshots — the workflow hands each commit to the reviewer coworker on
demand, exactly like the live flow. The only thing baked here is the ground
truth for scoring: which commit a human reviewed and what they concluded.

Revisions: reviews are grouped by the commit they reviewed. R0 is the head
the FIRST human review saw; R1, R2, ... are later reviewed heads. Default is
R0 only (the launch/headline metric). --per-revision emits the full chain —
the workflow replays a chain in ONE Verity session, dispatching a fresh
review of each revision's commit between turns, exactly like the live flow.

Usage:
  prepare-offline-rounds.py --prs 9069,11238            [--out pr-snapshots]
  prepare-offline-rounds.py --prs-file sample-v1.json   [--round-size 20]
  prepare-offline-rounds.py --prs 10193 --per-revision

Output under --out/:
  task-manifest-round-NNN.json  [{pr, mode: historical,
                                  revisions: [{index, head_sha, human_verdict,
                                               reviewed_at}]}, ...]

Idempotent: re-running regenerates the manifests from live gh data. The
manifests are the sole artifact — score-decisions.py joins ledger rows to the
(pr, head_sha, human_verdict) triples they carry. stdlib + gh only.
"""
import argparse, json, os, subprocess, sys

REPO = "shader-slang/slangpy"
BOT_MARKERS = ("[bot]", "claude", "coderabbit", "copilot", "nv-slang-bot")
STATE_RANK = {"CHANGES_REQUESTED": 2, "APPROVED": 1, "COMMENTED": 0, "DISMISSED": 0}


def gh_json(path, paginate=False):
    args = ["gh", "api", path]
    if paginate:
        args += ["--paginate", "--slurp"]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("gh api %s failed: %s" % (path, r.stderr[:300]))
    out = json.loads(r.stdout)
    if paginate:
        merged = []
        for page in out:
            merged.extend(page if isinstance(page, list) else [page])
        return merged
    return out


def is_bot(user):
    if not user:
        return True
    login = (user.get("login") or "").lower()
    return user.get("type") == "Bot" or any(m in login for m in BOT_MARKERS)


def revisions_of(reviews, final_head):
    """Group human reviews by reviewed commit, in time order -> revision list."""
    human = [r for r in reviews if not is_bot(r.get("user")) and r.get("commit_id")]
    human.sort(key=lambda r: r.get("submitted_at") or "")
    revs, seen = [], {}
    for r in human:
        sha = r["commit_id"]
        state = r.get("state") or "COMMENTED"
        if sha in seen:
            i = seen[sha]
            if STATE_RANK.get(state, 0) > STATE_RANK.get(revs[i]["human_verdict"], 0):
                revs[i]["human_verdict"] = state
        else:
            seen[sha] = len(revs)
            revs.append({"index": len(revs), "head_sha": sha,
                         "human_verdict": state,
                         "reviewed_at": r.get("submitted_at")})
    if not revs:
        revs = [{"index": 0, "head_sha": final_head,
                 "human_verdict": "NO_HUMAN_REVIEW", "reviewed_at": None}]
    return revs


def resolve(pr, per_revision):
    meta = gh_json(f"repos/{REPO}/pulls/{pr}")
    reviews = gh_json(f"repos/{REPO}/pulls/{pr}/reviews?per_page=100", paginate=True)
    revs = revisions_of(reviews, meta["head"]["sha"])
    if not per_revision:
        revs = revs[:1]
    return {"pr": pr, "mode": "historical", "revisions": revs}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prs", help="comma-separated PR numbers")
    ap.add_argument("--prs-file", help="json file: [{pr:...}] or [123, ...]")
    ap.add_argument("--out", default="pr-snapshots")
    ap.add_argument("--round-size", type=int, default=20)
    ap.add_argument("--per-revision", action="store_true",
                    help="emit the full R0..Rn chain (default: R0 only)")
    a = ap.parse_args()
    prs = []
    if a.prs:
        prs += [int(x) for x in a.prs.split(",") if x.strip()]
    if a.prs_file:
        data = json.load(open(a.prs_file))
        prs += [int(e["pr"] if isinstance(e, dict) else e) for e in data]
    if not prs:
        ap.error("no PRs given")
    os.makedirs(a.out, exist_ok=True)
    entries, failed = [], []
    for pr in prs:
        try:
            entry = resolve(pr, a.per_revision)
            entries.append(entry)
            n = len(entry["revisions"])
            print(f"resolved PR {pr} ({n} revision{'s' if n != 1 else ''})")
        except Exception as e:
            failed.append({"pr": pr, "error": str(e)[:200]})
            print(f"FAILED PR {pr}: {e}", file=sys.stderr)
    for i in range(0, len(entries), a.round_size):
        rf = os.path.join(a.out, f"task-manifest-round-{i // a.round_size + 1:03d}.json")
        json.dump(entries[i:i + a.round_size], open(rf, "w"), indent=1)
        print("wrote", rf)
    if failed:
        json.dump(failed, open(os.path.join(a.out, "prepare-failures.json"), "w"), indent=1)
        print(f"{len(failed)} failures recorded", file=sys.stderr)
    print(f"done: {len(entries)} PRs resolved, {len(failed)} failed")


if __name__ == "__main__":
    main()
