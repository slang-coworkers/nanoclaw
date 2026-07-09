#!/usr/bin/env python3
"""Prepare offline/historical rounds for /slang-pr-approve.

For each requested PR of shader-slang/slang this script DOWNLOADS
revision-pinned snapshots (read-only gh; the lab container has it) and
emits round manifests the workflow consumes.

Revisions: reviews are grouped by the commit they reviewed. R0 is the head
the FIRST human review saw; R1, R2, ... are later reviewed heads. Default
is R0 only (the launch/headline metric). --per-revision emits the full
chain — the workflow replays a chain in ONE Verity session, appending each
revision's delta + the human review comments between turns, exactly like
the live flow.

Usage:
  prepare-offline-rounds.py --prs 9069,11238            [--out pr-snapshots]
  prepare-offline-rounds.py --prs-file sample-v1.json   [--round-size 20]
  prepare-offline-rounds.py --prs 10193 --per-revision

Outputs under --out/<slug>/:
  pr.json               full REST pull object (author_association, head/base, state)
  reviews.json          all reviews, fully paginated
  review-comments.json  all inline review comments, fully paginated
  rev-<n>-<sha12>/
    diff.patch          merge-base three-dot diff base_ref...Rn (the Rn-era diff)
    files.txt           changed paths, derived from diff.patch (Rn-accurate)
    delta.patch         Rn-1...Rn (n>0 only; what the author changed in response)
    checks.json         check-runs + combined status at Rn (ci_green evaluability)
  task-manifest-round-NNN.json  [{pr, slug, mode: historical,
                                  revisions: [{index, head_sha, human_verdict,
                                               reviewed_at}]}, ...]

Idempotent: existing complete revision dirs are skipped. stdlib + gh only.
"""
import argparse, json, os, subprocess, sys

REPO = "shader-slang/slang"
BOT_MARKERS = ("[bot]", "claude", "coderabbit", "copilot", "nv-slang-bot")
STATE_RANK = {"CHANGES_REQUESTED": 2, "APPROVED": 1, "COMMENTED": 0, "DISMISSED": 0}

def gh(*args, raw=False):
    r = subprocess.run(["gh"] + list(args), capture_output=True, text=not raw)
    if r.returncode != 0:
        err = r.stderr if not raw else r.stderr.decode()
        raise RuntimeError("gh %s failed: %s" % (args[0], err[:300]))
    return r.stdout

def gh_json(path, paginate=False):
    args = ["api", path]
    if paginate:
        args += ["--paginate", "--slurp"]
    out = json.loads(gh(*args))
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

def fetch_diff(basehead, dest):
    r = subprocess.run(["gh", "api", f"repos/{REPO}/compare/{basehead}",
                        "-H", "Accept: application/vnd.github.diff"],
                       capture_output=True)
    if r.returncode != 0 or not r.stdout:
        raise RuntimeError(f"diff {basehead} failed: {r.stderr.decode()[:200]}")
    open(dest, "wb").write(r.stdout)
    return r.stdout

def files_from_diff(diff_bytes, dest):
    paths = []
    for line in diff_bytes.decode(errors="replace").splitlines():
        if line.startswith("+++ b/"):
            paths.append(line[6:])
        elif line.startswith("rename to "):
            paths.append(line[10:])
    with open(dest, "w") as f:
        f.write("\n".join(dict.fromkeys(paths)) + "\n")

def fetch_checks(sha, dest):
    try:
        pages = json.loads(gh("api", f"repos/{REPO}/commits/{sha}/check-runs?per_page=100",
                              "--paginate", "--slurp"))
        runs = []
        for pg in pages:
            runs.extend(pg.get("check_runs", []))
        combined = gh_json(f"repos/{REPO}/commits/{sha}/status")
        json.dump({"check_runs": [{"name": c.get("name"), "conclusion": c.get("conclusion")}
                                  for c in runs],
                   "combined_status": combined.get("state")}, open(dest, "w"), indent=1)
    except Exception as e:
        json.dump({"error": str(e)[:200]}, open(dest, "w"))

def snapshot(pr, out, per_revision):
    meta = gh_json(f"repos/{REPO}/pulls/{pr}")
    reviews = gh_json(f"repos/{REPO}/pulls/{pr}/reviews?per_page=100", paginate=True)
    revs = revisions_of(reviews, meta["head"]["sha"])
    if not per_revision:
        revs = revs[:1]
    slug = f"{REPO.replace('/', '-')}-pr{pr}-r0-{revs[0]['head_sha'][:12]}"
    d = os.path.join(out, slug)
    os.makedirs(d, exist_ok=True)
    json.dump(meta, open(os.path.join(d, "pr.json"), "w"), indent=1)
    json.dump(reviews, open(os.path.join(d, "reviews.json"), "w"), indent=1)
    comments = gh_json(f"repos/{REPO}/pulls/{pr}/comments?per_page=100", paginate=True)
    json.dump(comments, open(os.path.join(d, "review-comments.json"), "w"), indent=1)
    base_ref = meta["base"]["ref"]
    cached = 0
    for i, rv in enumerate(revs):
        rd = os.path.join(d, f"rev-{rv['index']}-{rv['head_sha'][:12]}")
        dp = os.path.join(rd, "diff.patch")
        if os.path.exists(dp) and os.path.getsize(dp) > 0:
            cached += 1
            continue
        os.makedirs(rd, exist_ok=True)
        diff = fetch_diff(f"{base_ref}...{rv['head_sha']}", dp)
        files_from_diff(diff, os.path.join(rd, "files.txt"))
        fetch_checks(rv["head_sha"], os.path.join(rd, "checks.json"))
        if i > 0:
            fetch_diff(f"{revs[i-1]['head_sha']}...{rv['head_sha']}",
                       os.path.join(rd, "delta.patch"))
    entry = {"pr": pr, "slug": slug, "mode": "historical", "revisions": revs}
    return entry, cached == len(revs)

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
    entries, skipped, failed = [], 0, []
    for pr in prs:
        try:
            entry, was_cached = snapshot(pr, a.out, a.per_revision)
            entries.append(entry)
            skipped += was_cached
            n = len(entry["revisions"])
            print(("cached " if was_cached else "fetched") +
                  f" PR {pr} -> {entry['slug']} ({n} revision{'s' if n != 1 else ''})")
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
    print(f"done: {len(entries)} snapshots ({skipped} fully cached), {len(failed)} failed")

if __name__ == "__main__":
    main()
