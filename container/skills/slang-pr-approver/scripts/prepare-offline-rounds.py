#!/usr/bin/env python3
"""Prepare offline/historical rounds for /slang-pr-approve.

For each requested PR of shader-slang/slang this script DOWNLOADS an
R0-pinned snapshot (read-only gh; the lab container has it) and emits
round manifests the workflow consumes. R0 = the head the FIRST human
review saw; PRs with no human review pin R0 to the final head and are
marked r0_kind=no_human_review.

Usage:
  prepare-offline-rounds.py --prs 9069,11238            [--out pr-snapshots]
  prepare-offline-rounds.py --prs-file sample-v1.json   [--round-size 20]

Outputs under --out:
  <slug>/pr.json       full REST pull object (author_association, head/base, state)
  <slug>/reviews.json  all reviews, fully paginated
  <slug>/files.txt     changed paths (paginated)
  <slug>/r0.json       {r0_head_sha, r0_kind, first_human_review_at}
  <slug>/diff.patch    merge-base three-dot diff base_ref...R0 (the R0-era diff)
  <slug>/r0-checks.json check-runs + combined status at R0 (ci_green evaluability)
  task-manifest-round-NNN.json  [{pr, slug, mode: historical, r0_head_sha}, ...]

Idempotent: existing complete slugs are skipped. stdlib + gh only.
"""
import argparse, json, os, subprocess, sys

REPO = "shader-slang/slang"
BOT_MARKERS = ("[bot]", "claude", "coderabbit", "copilot", "nv-slang-bot")

def gh(*args, raw=False):
    r = subprocess.run(["gh"] + list(args), capture_output=True, text=not raw)
    if r.returncode != 0:
        raise RuntimeError("gh %s failed: %s" % (args[0], (r.stderr if not raw else r.stderr.decode())[:300]))
    return r.stdout

def gh_json(path, paginate=False):
    args = ["api", path]
    if paginate:
        args += ["--paginate", "--slurp"]
    out = json.loads(gh(*args))
    if paginate:  # --slurp yields a list of pages
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

def snapshot(pr, out):
    slug = None
    meta = gh_json(f"repos/{REPO}/pulls/{pr}")
    head = meta["head"]["sha"]
    reviews = gh_json(f"repos/{REPO}/pulls/{pr}/reviews?per_page=100", paginate=True)
    human = [r for r in reviews if not is_bot(r.get("user")) and r.get("commit_id")]
    human.sort(key=lambda r: r.get("submitted_at") or "")
    if human:
        r0, r0_kind, r0_at = human[0]["commit_id"], "first_human_review", human[0].get("submitted_at")
    else:
        r0, r0_kind, r0_at = head, "no_human_review", None
    slug = f"{REPO.replace('/', '-')}-pr{pr}-r0-{r0[:12]}"
    d = os.path.join(out, slug)
    if os.path.exists(os.path.join(d, "diff.patch")) and os.path.getsize(os.path.join(d, "diff.patch")) > 0:
        return {"pr": pr, "slug": slug, "mode": "historical", "r0_head_sha": r0}, True
    os.makedirs(d, exist_ok=True)
    json.dump(meta, open(os.path.join(d, "pr.json"), "w"), indent=1)
    json.dump(reviews, open(os.path.join(d, "reviews.json"), "w"), indent=1)
    json.dump({"r0_head_sha": r0, "r0_kind": r0_kind, "first_human_review_at": r0_at},
              open(os.path.join(d, "r0.json"), "w"), indent=1)
    # CI state at R0 — without this, ci_green_on_sha is unevaluable for every
    # historical PR (a guaranteed infra-abstain). Check-runs + legacy combined
    # status both persist on GitHub for old commits.
    try:
        pages = json.loads(gh("api", f"repos/{REPO}/commits/{r0}/check-runs?per_page=100",
                              "--paginate", "--slurp"))
        runs = []
        for pg in pages:
            runs.extend(pg.get("check_runs", []))
        combined = gh_json(f"repos/{REPO}/commits/{r0}/status")
        json.dump({"check_runs": [{"name": c.get("name"), "conclusion": c.get("conclusion")}
                                  for c in runs],
                   "combined_status": combined.get("state")},
                  open(os.path.join(d, "r0-checks.json"), "w"), indent=1)
    except Exception as e:
        json.dump({"error": str(e)[:200]}, open(os.path.join(d, "r0-checks.json"), "w"))
    files = gh_json(f"repos/{REPO}/pulls/{pr}/files?per_page=100", paginate=True)
    with open(os.path.join(d, "files.txt"), "w") as f:
        f.write("\n".join(x["filename"] for x in files) + "\n")
    # R0-era diff: three-dot compare (merge-base) base ref ... R0 sha
    base_ref = meta["base"]["ref"]
    patch = subprocess.run(["gh", "api", f"repos/{REPO}/compare/{base_ref}...{r0}",
                            "-H", "Accept: application/vnd.github.diff"],
                           capture_output=True)
    if patch.returncode != 0 or not patch.stdout:
        raise RuntimeError(f"diff fetch failed for PR {pr} at {r0[:12]}: {patch.stderr.decode()[:200]}")
    open(os.path.join(d, "diff.patch"), "wb").write(patch.stdout)
    return {"pr": pr, "slug": slug, "mode": "historical", "r0_head_sha": r0}, False

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prs", help="comma-separated PR numbers")
    ap.add_argument("--prs-file", help="json file: [{pr:...}] or [123, ...]")
    ap.add_argument("--out", default="pr-snapshots")
    ap.add_argument("--round-size", type=int, default=20)
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
            entry, was_cached = snapshot(pr, a.out)
            entries.append(entry)
            skipped += was_cached
            print(("cached " if was_cached else "fetched") + f" PR {pr} -> {entry['slug']}")
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
    print(f"done: {len(entries)} snapshots ({skipped} cached), {len(failed)} failed")

if __name__ == "__main__":
    main()
