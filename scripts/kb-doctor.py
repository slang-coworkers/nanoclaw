#!/usr/bin/env python3
"""kb-doctor — reconcile what git says against what production actually runs.

The KB has four propagation paths and three of them have no automatic link:

  SKILL.md  --materialise-->  data/shared/.learnings_wiki.py     (manual)
  SKILL.md  --group-init--->  data/v2-sessions/*/.claude-shared  (on restart/spawn only)
  git       --???---------->  live scheduled-task prompts        (NO link at all)
  nv-main   --merge-------->  nv-coworkers (prod branch)         (manual)

Every drift found on 2026-08-04/05 was SILENT — the source files looked correct while
production behaved differently. The materialised builder had a prod-only footer
normalizer that a blind deploy would have reverted; the fold objective lived only in a
SQLite row; the skill's schedule_task template would have recreated that task weekly with
none of its objective. None of it announced itself.

So this REPORTS drift, it does not repair it. Silently rewriting live agent instructions
to match git is the same class of failure in the other direction — git is not always the
newer truth, as the footer normalizer proved.

Offline and deterministic: no network, no API, no LLM. Exit 0 clean, 1 if drift found.

  python3 scripts/kb-doctor.py [--repo <path>] [--quiet]
"""
import argparse, glob, hashlib, json, os, re, subprocess, sys


def sha(text):
    return hashlib.sha256(text.encode("utf-8", "replace")).hexdigest()[:16]


def embedded_builder(skill_path):
    """The python block inside SKILL.md — the source of truth for the materialised script."""
    try:
        s = open(skill_path, encoding="utf-8").read()
    except OSError:
        return None
    blocks = re.findall(r"```python\n(.*?)```", s, re.S)
    return max(blocks, key=len) if blocks else None


def check_builder(repo, findings):
    skill = os.path.join(repo, "container/skills/learnings-wiki/SKILL.md")
    live = os.path.join(repo, "data/shared/.learnings_wiki.py")
    emb = embedded_builder(skill)
    if emb is None or not os.path.exists(live):
        findings.append(("SKIP", "builder", "SKILL.md or materialised builder missing"))
        return
    cur = open(live, encoding="utf-8").read()
    if sha(emb) == sha(cur):
        findings.append(("OK", "builder", "materialised == SKILL.md"))
    else:
        findings.append(("DRIFT", "builder",
                         f"data/shared/.learnings_wiki.py ({len(cur)} B, {sha(cur)}) != "
                         f"SKILL.md embedded ({len(emb)} B, {sha(emb)}). "
                         "Diff before overwriting — prod may hold a fix git does not."))


def check_group_skills(repo, findings):
    src = os.path.join(repo, "container/skills/learnings-wiki/SKILL.md")
    if not os.path.exists(src):
        return
    want = sha(open(src, encoding="utf-8").read())
    copies = glob.glob(os.path.join(repo, "data/v2-sessions/*/.claude-shared/skills/learnings-wiki/SKILL.md"))
    stale = [p for p in copies if sha(open(p, encoding="utf-8", errors="replace").read()) != want]
    if not copies:
        findings.append(("SKIP", "group-skills", "no .claude-shared copies found"))
    elif stale:
        findings.append(("DRIFT", "group-skills",
                         f"{len(stale)}/{len(copies)} group copies stale vs checkout — "
                         "they are bind-mounted, so cp refreshes them live"))
    else:
        findings.append(("OK", "group-skills", f"all {len(copies)} copies match checkout"))


def check_tasks(repo, findings):
    snap = None
    for cand in glob.glob(os.path.join(repo, "docs/scheduled-tasks.*.json")):
        snap = cand
        break
    if not snap:
        findings.append(("SKIP", "tasks", "no docs/scheduled-tasks.*.json snapshot"))
        return
    try:
        committed = {t["series_id"]: t.get("prompt", "") for t in json.load(open(snap))["tasks"]}
    except Exception as e:
        findings.append(("SKIP", "tasks", f"unreadable snapshot: {e}"))
        return
    ncl = os.path.join(repo, "bin", "ncl")
    if not os.path.exists(ncl):
        findings.append(("SKIP", "tasks", "bin/ncl not present"))
        return
    drift, missing = [], []
    for sid, prompt in committed.items():
        r = subprocess.run([ncl, "tasks", "get", "--id", sid, "--json"],
                           cwd=repo, capture_output=True, text=True)
        if r.returncode != 0:
            missing.append(sid)
            continue
        try:
            live = json.loads(r.stdout)["data"].get("prompt", "")
        except Exception:
            missing.append(sid)
            continue
        if sha(live) != sha(prompt):
            drift.append(sid)
    if missing:
        findings.append(("DRIFT", "tasks", f"{len(missing)} committed task(s) not live: {', '.join(missing[:4])}"))
    if drift:
        findings.append(("DRIFT", "tasks",
                         f"{len(drift)} live prompt(s) differ from the snapshot: {', '.join(drift[:4])}. "
                         "Re-run scripts/dump-scheduled-tasks.py if the live text is intended."))
    if not missing and not drift:
        findings.append(("OK", "tasks", f"all {len(committed)} live prompts match the snapshot"))


def check_branch(repo, findings):
    def git(*a):
        r = subprocess.run(["git", *a], cwd=repo, capture_output=True, text=True)
        return r.stdout.strip() if r.returncode == 0 else None
    cur = git("rev-parse", "--abbrev-ref", "HEAD")
    if not cur:
        return
    KB = ["container/skills/learnings-wiki", "container/spines/base",
          "container/workflows", "scripts/kb-health.py", "scripts/kb-doctor.py"]
    behind = git("log", "--oneline", f"HEAD..origin/nv-main", "--", *KB)
    if behind is None:
        findings.append(("SKIP", "branch", "origin/nv-main not fetched"))
    elif behind:
        n = len(behind.splitlines())
        findings.append(("DRIFT", "branch",
                         f"{cur} is behind origin/nv-main by {n} commit(s) on KB paths"))
    else:
        findings.append(("OK", "branch", f"{cur} current with origin/nv-main on KB paths"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=os.path.expanduser("~/slang-coworkers-prod/nanoclaw"))
    ap.add_argument("--quiet", action="store_true", help="print only drift")
    args = ap.parse_args()

    findings = []
    for fn in (check_builder, check_group_skills, check_tasks, check_branch):
        try:
            fn(args.repo, findings)
        except Exception as e:
            findings.append(("SKIP", fn.__name__, f"check errored: {e}"))

    drift = [f for f in findings if f[0] == "DRIFT"]
    for state, name, msg in findings:
        if args.quiet and state != "DRIFT":
            continue
        print(f"{state:<6} {name:<14} {msg}")
    if drift:
        print(f"\n{len(drift)} drift finding(s). Reported, not repaired — inspect before syncing "
              "either direction; production is sometimes the newer truth.")
    return 1 if drift else 0


if __name__ == "__main__":
    sys.exit(main())
