"""Finish a khr job: validate the agent's report, re-derive results from Git and evidence, write the outcome.

    python3 finish_job.py --job /workspace/agent/jobs/<job>

The agent's ``report.json`` is checked against ``report.schema.json``. Then, for
every prepared worktree, Git is authoritative:

- a changed repository is one whose ``HEAD`` moved off its pinned base;
- its tree must be clean, its ``HEAD`` must descend from the base, and every new
  commit's author and committer must equal the configured identity.

Test entries are reconciled with the check wrapper's evidence log. A ``checkId``
that is missing or unknown is flagged unverified; evidence the report omits is
added. Nothing is pushed or posted. The would-publish record (topic branch,
Draft MR title, bundle and patch per changed repository, reply text) goes to
``result/`` and ``outcome.json``, and the change set is journaled locally so
follow-ups continue it.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from khrjob import (
    JobError,
    append_journal,
    change_set_key,
    git,
    now_iso,
    read_json,
    reject_filters,
    write_json,
)
from khrjob import git_env as khrjob_git_env

RESULTS = {"passed", "failed", "infrastructure_error", "timeout", "skipped", "not_run"}
SCHEMA = Path(__file__).resolve().parent.parent / "report.schema.json"


def validate_report(report: Any) -> list[str]:
    errs: list[str] = []
    if not isinstance(report, dict):
        return ["report is not an object"]
    req = {"summary", "assumptions", "repositories", "tests", "blockedReason"}
    errs += [f"missing {k}" for k in sorted(req - report.keys())]
    errs += [f"unexpected {k}" for k in sorted(report.keys() - req)]
    if not isinstance(report.get("summary"), str):
        errs.append("summary must be a string")
    if not (
        isinstance(report.get("assumptions"), list)
        and all(isinstance(a, str) for a in report["assumptions"])
    ):
        errs.append("assumptions must be a list of strings")
    for i, r in enumerate(report.get("repositories") or []):
        if not isinstance(r, dict) or set(r) != {"path", "summary"}:
            errs.append(f"repositories[{i}] must have exactly path and summary")
    for i, t in enumerate(report.get("tests") or []):
        if not isinstance(t, dict) or set(t) != {
            "command",
            "result",
            "details",
            "checkId",
            "exitCode",
            "failureKind",
        }:
            errs.append(f"tests[{i}] has the wrong fields")
        elif t["result"] not in RESULTS:
            errs.append(
                f"tests[{i}].result {t['result']!r} is not one of {sorted(RESULTS)}"
            )
    if report.get("blockedReason") is not None and not isinstance(
        report.get("blockedReason"), str
    ):
        errs.append("blockedReason must be a string or null")
    return errs


def derive_repository(
    target: dict[str, Any], identity: dict[str, str]
) -> dict[str, Any]:
    wt, base = Path(target["path"]), target["base"]
    head = git(wt, "rev-parse", "HEAD")
    problems = []
    reject_filters(wt)  # status would run them
    if git(
        wt, "status", "--porcelain", "--untracked-files=all", "--ignore-submodules=all"
    ):
        problems.append("working tree not clean")
    if (
        subprocess.run(
            ["git", "-C", str(wt), "merge-base", "--is-ancestor", base, head],
            env=khrjob_git_env(),
            check=False,
        ).returncode
        != 0
    ):
        problems.append("HEAD does not descend from the pinned base")
    commits = []
    if head != base:
        for line in git(
            wt,
            "log",
            "--no-show-signature",  # log.showSignature would run gpg.program
            "--encoding=UTF-8",  # i18n.logOutputEncoding would break parsing
            "--format=%H%x00%an%x00%ae%x00%cn%x00%ce%x00%s",
            f"{base}..{head}",
        ).splitlines():
            sha, an, ae, cn, ce, subject = line.split("\0")
            commits.append({"sha": sha, "subject": subject})
            if (an, ae) != (identity["name"], identity["email"]) or (cn, ce) != (
                identity["name"],
                identity["email"],
            ):
                problems.append(
                    f"commit {sha[:12]} identity {an} <{ae}> / {cn} <{ce}> is not the configured identity"
                )
    return {
        **target,
        "head": head,
        "changed": head != base,
        "commits": commits,
        "problems": problems,
    }


def reconcile_tests(
    job_root: Path, tests: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], list[str]]:
    path = job_root / ".khr-validation" / "checks.jsonl"
    evidence = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                rec = json.loads(line)
                evidence[rec["checkId"]] = rec
    out, incidents, seen = [], [], set()
    for t in tests:
        rec = evidence.get(t.get("checkId") or "")
        if rec is None:
            incidents.append(
                f"unverified test (no matching checkId): {t.get('command', '')[:80]}"
            )
            out.append({**t, "verified": False})
            continue
        seen.add(rec["checkId"])
        out.append(
            {
                **t,
                "command": " ".join(rec["command"]),
                "result": rec["result"],
                "exitCode": rec["exitCode"],
                "failureKind": rec["failureKind"],
                "name": rec["name"],
                "kind": rec["kind"],
                "verified": True,
            }
        )
    for cid, rec in evidence.items():
        if cid not in seen:
            out.append(
                {
                    "command": " ".join(rec["command"]),
                    "result": rec["result"],
                    "details": "recorded by the check wrapper; not in the report",
                    "checkId": cid,
                    "exitCode": rec["exitCode"],
                    "failureKind": rec["failureKind"],
                    "name": rec["name"],
                    "kind": rec["kind"],
                    "verified": True,
                }
            )
    latest: dict[str, dict[str, Any]] = {}
    for t in out:
        latest[t.get("name") or t["command"]] = t
    return list(latest.values()), incidents


def draft_title(summary: str) -> str:
    first = summary.strip().splitlines()[0] if summary.strip() else "khr change"
    first = re.sub(
        r"^\s*((draft|wip)\s*:\s*|\[(draft|wip)\]\s*|khr(bot)?\s*:\s*)+",
        "",
        first,
        flags=re.IGNORECASE,
    )
    return "Draft: " + first[:200]


def render_reply(
    request: dict[str, Any],
    report: dict[str, Any],
    repos: list[dict[str, Any]],
    tests: list[dict[str, Any]],
    status: str,
    incidents: list[str],
) -> str:
    lines = [
        f"**Job status:** {status} (dry run: nothing was published)",
        "",
        report.get("summary", "").strip(),
        "",
    ]
    changed = [r for r in repos if r["changed"]]
    if changed:
        lines.append("**Would publish:**")
        lines += [
            f"- `{r['projectPath']}`: Draft MR from `{r['topicBranch']}` ({len(r['commits'])} commit(s)) — {r.get('reportSummary', '')}"
            for r in changed
        ]
        lines.append("")
    if tests:
        lines.append("**Checks:**")
        lines += [
            f"- `{t.get('name') or t['command'][:60]}`: {t['result']}{'' if t.get('verified') else ' (unverified)'}"
            for t in tests
        ]
        lines.append("")
    if report.get("assumptions"):
        lines.append("**Assumptions:**")
        lines += [f"- {a}" for a in report["assumptions"]]
        lines.append("")
    problems = [p for r in repos for p in r["problems"]] + incidents
    if problems:
        lines.append("**Problems found by the finish step:**")
        lines += [f"- {p}" for p in problems]
    if report.get("blockedReason"):
        lines += ["", f"**Blocked:** {report['blockedReason']}"]
    return "\n".join(lines).strip() + "\n"


def finish(job_root: Path) -> dict[str, Any]:
    request = read_json(job_root / "request.json")
    targets = read_json(job_root / "targets.json")
    report = read_json(job_root / "report.json")
    errors = validate_report(report)
    if errors:
        raise JobError("report.json does not match the schema: " + "; ".join(errors))
    identity = targets["identity"]
    repos = [derive_repository(t, identity) for t in targets["repositories"]]
    reported = {r["path"]: r["summary"] for r in report["repositories"]}
    incidents = []
    for r in repos:
        r["reportSummary"] = reported.get(r["path"], "")
        if r["changed"] and r["path"] not in reported:
            incidents.append(f"{r['name']} changed but is missing from the report")
        if not r["changed"] and r["path"] in reported:
            incidents.append(f"{r['name']} is in the report but has no new commits")
    for path in reported:
        if path not in {r["path"] for r in repos}:
            incidents.append(f"report path {path} is not a job worktree root")
    tests, test_incidents = reconcile_tests(job_root, report["tests"])
    incidents += test_incidents
    problems = any(r["problems"] for r in repos)
    changed = [r for r in repos if r["changed"]]
    if report["blockedReason"] and not changed:
        status = "blocked"
    elif problems:
        status = "rejected"
    elif changed:
        status = "complete" if not incidents else "complete-with-incidents"
    else:
        status = "no-change"
    result_dir = job_root / "result"
    result_dir.mkdir(exist_ok=True)
    if not problems:
        for r in changed:
            git(
                r["path"],
                "bundle",
                "create",
                str(result_dir / f"{r['name']}.bundle"),
                r["topicBranch"],
                f"^{r['base']}",
            )
            (result_dir / f"{r['name']}.patch").write_text(
                git(r["path"], "format-patch", "--stdout", f"{r['base']}..{r['head']}")
                + "\n",
                encoding="utf-8",
            )
    reply = render_reply(request, report, repos, tests, status, incidents)
    (result_dir / "reply.md").write_text(reply, encoding="utf-8")
    outcome = {
        "job": job_root.name,
        "finishedAt": now_iso(),
        "status": status,
        "changeSet": change_set_key(request),
        "draftTitle": draft_title(report["summary"]),
        "repositories": [
            {
                k: r[k]
                for k in (
                    "name",
                    "projectPath",
                    "path",
                    "targetBranch",
                    "base",
                    "head",
                    "topicBranch",
                    "changed",
                    "commits",
                    "problems",
                )
            }
            for r in repos
        ],
        "tests": tests,
        "incidents": incidents,
        "blockedReason": report["blockedReason"],
        "reply": reply,
    }
    write_json(job_root / "outcome.json", outcome)
    if changed and not problems:
        key = change_set_key(request)
        if request["kind"] == "mr":
            owned = [
                e
                for e in _journal_entries(job_root)
                if e.get("wouldBeMr")
                == {"projectId": request["project_id"], "iid": request["iid"]}
            ]
            key = owned[-1]["changeSet"] if owned else key
        append_journal(
            job_root,
            {
                "changeSet": key,
                "job": job_root.name,
                "at": now_iso(),
                "repositories": {
                    r["name"]: {"head": r["head"], "topicBranch": r["topicBranch"]}
                    for r in changed
                },
                "wouldBeMrTitle": outcome["draftTitle"],
            },
        )
    return outcome


def _journal_entries(job_root: Path) -> list[dict[str, Any]]:
    from khrjob import read_journal

    return read_journal(job_root)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--job", required=True)
    args = ap.parse_args(argv)
    try:
        outcome = finish(Path(args.job).resolve())
    except JobError as exc:
        print(f"KHR_FINISH_FAILED: {exc}")
        return 2
    print(
        f"KHR_FINISHED: status={outcome['status']} changed={[r['name'] for r in outcome['repositories'] if r['changed']]}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
