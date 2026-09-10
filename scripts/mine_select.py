#!/usr/bin/env python3
"""mine_select.py: the deterministic half of the review-cycle-mining task.

The Orchestrator's daily task reads the review-cycles snapshot
(`review-rounds.json`, schema >= 3, `perPR` list, written by
scripts/review-rounds.py and copied into data/shared/reports/ by
scripts/funnel-cron.sh) and explains, PR by PR, why the ones with many human
review rounds took that many. The agent is the LLM; everything that must be
the same on every run lives here instead, so it is tested code rather than a
rule the agent re-derives each morning:

  select   which PRs to mine: rounds > 5 or comments > 15, not yet present in
           the why file, most rounds first, capped to one bounded batch
  gate     the same selection as the task's pre-task script line
           ({"wakeAgent": bool, "data": {...}}, see `ncl tasks help`)
  merge    validate the records the agent wrote and fold them into the why
           file: one record per (repo, number), newest first, keep 200,
           atomic replace, never a partial file

Run inside the container as `python3 /workspace/shared/.mine_select.py ...`
(installed there by ops/slang-coworkers-prod/review-cycle-mining/README.md)
or anywhere with explicit `--rounds` / `--why` paths. Stdlib only.

Failure posture. A missing or unreadable snapshot, a producer that still
writes the old shape, a stale snapshot, or a corrupt why file all make the gate
WAKE the agent with `data.error` set, so a broken pipeline costs one line on the
task destination instead of a metric that quietly stops moving. A snapshot the
producer itself marked `complete: false` is transient (it is rewritten every 30
minutes) and gates quietly with a reason.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timedelta, timezone

DEFAULT_ROUNDS = "/workspace/shared/reports/review-rounds.json"
DEFAULT_WHY = "/workspace/shared/reports/review-cycles-why.json"

# Both thresholds are STRICT (a PR with exactly 5 rounds is not a candidate).
MIN_ROUNDS = 5
MIN_COMMENTS = 15
DEFAULT_LIMIT = 10
DEFAULT_KEEP = 200
# The producer runs every 30 minutes; a snapshot older than this means the
# cron or its shared copy is dead, which is a pipeline fault, not "no data".
MAX_AGE_HOURS = 36
MIN_SNAPSHOT_SCHEMA = 3
WHY_SCHEMA = 1

CATEGORIES = (
    "understanding",
    "design_disagreement",
    "scope_creep",
    "ci_flakiness",
    "style_nits",
    "missing_tests",
    "slow_reviewer",
    "author_churn",
    "automation_noise",
)
CAP_WHY_SHORT = 240
CAP_WHY_LONG = 1200
CAP_RULE = 300
CAP_QUOTE = 160
CAP_AUTHOR = 64
MAX_QUOTES = 3

REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")

# Fields copied from a perPR row into the selection output. The row is already
# compact; listing the fields (rather than passing the row through) keeps the
# batch stable when the producer adds keys the miner has no use for.
ROW_FIELDS = (
    "repo",
    "number",
    "url",
    "title",
    "author",
    "authorClass",
    "state",
    "createdAt",
    "mergedAt",
    "closedAt",
    "rounds",
    "comments",
    "inlineComments",
    "conversationComments",
    "threads",
    "changesRequested",
    "submissions",
    "reviewers",
    "classification",
    "removedAutomation",
    "removed",
    "longestComments",
    "activityWeeks",
    "firstActivityAt",
    "lastActivityAt",
    "reviewDurationDays",
    "truncated",
)


# ---------------------------------------------------------------- time


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(value: object) -> datetime | None:
    """ISO-8601 with a trailing Z or an offset; None when unparseable."""
    if not isinstance(value, str) or not value:
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


# ---------------------------------------------------------------- loading


def load_json(path: str) -> tuple[object, str | None]:
    """(value, None) on success; (None, reason) when missing or unparseable."""
    if not os.path.exists(path):
        return None, f"missing: {path}"
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh), None
    except (OSError, ValueError) as exc:
        return None, f"unreadable: {path}: {exc}"


def snapshot_status(snap: object, now: datetime, max_age_hours: float = MAX_AGE_HOURS) -> tuple[str | None, str | None]:
    """Classify a loaded snapshot as (loud_error, quiet_reason).

    Exactly one of the two is set when the snapshot is not usable; both are
    None when `perPR` can be read. Loud errors need a human; quiet reasons are
    transient by construction.
    """
    if not isinstance(snap, dict):
        return "snapshot is not a JSON object", None
    schema = snap.get("schema")
    if not isinstance(schema, int) or schema < MIN_SNAPSHOT_SCHEMA:
        msg = f"snapshot schema {schema!r} has no perPR list; review-cycles v2 (schema >= {MIN_SNAPSHOT_SCHEMA}) is not deployed"
        return msg, None
    generated = parse_iso(snap.get("generatedAt"))
    if generated is None:
        return "snapshot has no parseable generatedAt", None
    if now - generated > timedelta(hours=max_age_hours):
        return f"snapshot stale: generatedAt {snap.get('generatedAt')} is older than {max_age_hours:g}h", None
    if snap.get("complete") is not True:
        return None, f"snapshot incomplete (complete={snap.get('complete')!r}); producer will rewrite it"
    if not isinstance(snap.get("perPR"), list):
        return "snapshot is complete but carries no perPR list", None
    return None, None


def load_why(path: str) -> tuple[list[dict], str | None]:
    """Existing why records, or ([], None) when the file does not exist yet.

    Accepts the envelope this script writes ({"schema", "updatedAt", "records"})
    and a bare list. Anything else is an error: the merge must never replace a
    file it could not read.
    """
    value, err = load_json(path)
    if err is not None:
        if err.startswith("missing:"):
            return [], None
        return [], f"why file {err}"
    if isinstance(value, list):
        records = value
    elif isinstance(value, dict) and isinstance(value.get("records"), list):
        records = value["records"]
    else:
        return [], f"why file {path} has neither a records list nor a bare list"
    bad = [i for i, r in enumerate(records) if not isinstance(r, dict)]
    if bad:
        return [], f"why file {path}: records at index {bad[:5]} are not objects"
    return records, None


def record_key(rec: dict) -> tuple[str, int] | None:
    repo = rec.get("repo")
    number = rec.get("number")
    if isinstance(repo, str) and isinstance(number, int) and not isinstance(number, bool):
        return repo, number
    return None


# ---------------------------------------------------------------- selection


def _count(row: dict, field: str) -> int:
    value = row.get(field)
    if isinstance(value, bool) or not isinstance(value, int):
        return 0
    return max(value, 0)


def select_candidates(
    per_pr: list,
    mined: set[tuple[str, int]],
    min_rounds: int = MIN_ROUNDS,
    min_comments: int = MIN_COMMENTS,
    repo: str | None = None,
) -> list[dict]:
    """Every unmined PR over either threshold, most rounds first.

    Order: rounds desc, comments desc, number desc, repo asc. Deterministic,
    so two runs over the same snapshot produce the same batch.
    """
    out = []
    for row in per_pr:
        if not isinstance(row, dict):
            continue
        key = record_key(row)
        if key is None or key in mined:
            continue
        if repo is not None and key[0] != repo:
            continue
        rounds = _count(row, "rounds")
        comments = _count(row, "comments")
        if rounds > min_rounds or comments > min_comments:
            out.append(row)
    out.sort(key=lambda r: (-_count(r, "rounds"), -_count(r, "comments"), -r["number"], r["repo"]))
    return out


def trim_row(row: dict) -> dict:
    return {k: row[k] for k in ROW_FIELDS if k in row}


def selection(
    rounds_path: str,
    why_path: str,
    now: datetime,
    min_rounds: int = MIN_ROUNDS,
    min_comments: int = MIN_COMMENTS,
    limit: int = DEFAULT_LIMIT,
    repo: str | None = None,
    max_age_hours: float = MAX_AGE_HOURS,
) -> dict:
    """The shared core of `select` and `gate`.

    Returns a dict with exactly one of: `error` (loud), `reason` (quiet, empty
    batch), or a non-empty/empty `batch` plus counts.
    """
    base = {"roundsPath": rounds_path, "whyPath": why_path}
    snap, err = load_json(rounds_path)
    if err is not None:
        return dict(base, error=f"snapshot {err}")
    loud, quiet = snapshot_status(snap, now, max_age_hours)
    if loud is not None:
        return dict(base, error=loud)
    assert isinstance(snap, dict)
    base["snapshotGeneratedAt"] = snap.get("generatedAt")
    if quiet is not None:
        return dict(base, reason=quiet, batch=[], candidates=0)
    existing, why_err = load_why(why_path)
    if why_err is not None:
        return dict(base, error=why_err)
    mined = {k for k in (record_key(r) for r in existing) if k is not None}
    candidates = select_candidates(snap["perPR"], mined, min_rounds, min_comments, repo)
    return dict(
        base,
        thresholds={"rounds": f"> {min_rounds}", "comments": f"> {min_comments}"},
        alreadyMined=len(mined),
        candidates=len(candidates),
        batch=[trim_row(r) for r in candidates[:limit]],
    )


def gate_payload(sel: dict) -> dict:
    """Translate a selection into the pre-task script contract."""
    if "error" in sel:
        data = {k: sel[k] for k in ("error", "roundsPath", "whyPath", "snapshotGeneratedAt") if k in sel}
        return {"wakeAgent": True, "data": data}
    if sel.get("reason"):
        return {"wakeAgent": False, "data": {"reason": sel["reason"], "snapshotGeneratedAt": sel.get("snapshotGeneratedAt")}}
    if not sel["batch"]:
        return {"wakeAgent": False, "data": {"reason": "no new candidates", "alreadyMined": sel["alreadyMined"]}}
    brief = [
        {k: r.get(k) for k in ("repo", "number", "url", "rounds", "comments", "state", "authorClass")} for r in sel["batch"]
    ]
    return {
        "wakeAgent": True,
        "data": {
            "candidates": sel["candidates"],
            "batchSize": len(brief),
            "alreadyMined": sel["alreadyMined"],
            "thresholds": sel["thresholds"],
            "snapshotGeneratedAt": sel.get("snapshotGeneratedAt"),
            "batch": brief,
        },
    }


# ---------------------------------------------------------------- records


def _single_line(text: str) -> bool:
    return "\n" not in text and "\r" not in text


def validate_record(rec: object) -> list[str]:
    """Every way a record can be wrong, as human-readable problems.

    Length caps are enforced here rather than clipped: a clipped explanation
    reads as finished while its point is missing, and the agent can shorten a
    sentence in one edit once told the actual length and the cap.
    """
    problems: list[str] = []
    if not isinstance(rec, dict):
        return ["record is not an object"]

    repo = rec.get("repo")
    if not isinstance(repo, str) or not REPO_RE.match(repo):
        problems.append("repo must be 'owner/name'")
    number = rec.get("number")
    if isinstance(number, bool) or not isinstance(number, int) or number <= 0:
        problems.append("number must be a positive integer")
    url = rec.get("url")
    if isinstance(repo, str) and isinstance(number, int) and not isinstance(number, bool):
        expected = f"https://github.com/{repo}/pull/{number}"
        if url != expected:
            problems.append(f"url must be {expected}")
    elif not isinstance(url, str):
        problems.append("url must be a string")

    for field in ("rounds", "comments"):
        value = rec.get(field)
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            problems.append(f"{field} must be a non-negative integer (copy it from the snapshot)")

    for field, cap, single in (
        ("whyShort", CAP_WHY_SHORT, True),
        ("whyLong", CAP_WHY_LONG, False),
        ("suggestedRule", CAP_RULE, True),
    ):
        value = rec.get(field)
        if not isinstance(value, str) or not value.strip():
            problems.append(f"{field} must be a non-empty string")
            continue
        if len(value) > cap:
            problems.append(f"{field} is {len(value)} chars; cap is {cap}")
        if single and not _single_line(value):
            problems.append(f"{field} must be a single line")

    cats = rec.get("categories")
    if not isinstance(cats, list) or not cats:
        problems.append("categories must be a non-empty list")
    else:
        unknown = [c for c in cats if c not in CATEGORIES]
        if unknown:
            problems.append(f"categories not in the allowed set: {unknown}; allowed: {list(CATEGORIES)}")
        if len(set(map(str, cats))) != len(cats):
            problems.append("categories must not repeat")

    quotes = rec.get("quotes")
    if not isinstance(quotes, list):
        problems.append("quotes must be a list (may be empty)")
    else:
        if len(quotes) > MAX_QUOTES:
            problems.append(f"quotes has {len(quotes)} entries; cap is {MAX_QUOTES}")
        for i, q in enumerate(quotes):
            if not isinstance(q, dict):
                problems.append(f"quotes[{i}] is not an object")
                continue
            author = q.get("author")
            if not isinstance(author, str) or not author.strip() or len(author) > CAP_AUTHOR:
                problems.append(f"quotes[{i}].author must be a login (1..{CAP_AUTHOR} chars)")
            if parse_iso(q.get("date")) is None:
                problems.append(f"quotes[{i}].date must be ISO-8601 (the comment's createdAt)")
            text = q.get("text")
            if not isinstance(text, str) or not text.strip():
                problems.append(f"quotes[{i}].text must be a non-empty string")
            elif len(text) > CAP_QUOTE:
                problems.append(f"quotes[{i}].text is {len(text)} chars; cap is {CAP_QUOTE}")

    mined_at = rec.get("minedAt")
    if mined_at is not None and parse_iso(mined_at) is None:
        problems.append("minedAt, when present, must be ISO-8601")
    return problems


def normalize_record(rec: dict, now: datetime) -> dict:
    """Canonical key order; stamp minedAt when the agent left it out."""
    out = {
        "repo": rec["repo"],
        "number": rec["number"],
        "url": rec["url"],
        "rounds": rec["rounds"],
        "comments": rec["comments"],
        "minedAt": rec.get("minedAt") or iso(now),
        "whyShort": rec["whyShort"].strip(),
        "whyLong": rec["whyLong"].strip(),
        "categories": list(rec["categories"]),
        "quotes": [
            {"author": q["author"].strip(), "date": q["date"], "text": q["text"].strip()} for q in rec["quotes"]
        ],
        "suggestedRule": rec["suggestedRule"].strip(),
    }
    # Optional provenance the agent may attach; anything else is dropped so the
    # file cannot grow keys the dashboard never asked for.
    for extra in ("title", "authorClass", "state", "minedBy"):
        if extra in rec:
            out[extra] = rec[extra]
    return out


def merge_records(existing: list[dict], new: list[dict], keep: int = DEFAULT_KEEP) -> tuple[list[dict], int]:
    """Fold `new` into `existing`: same (repo, number) is replaced, newest first.

    Returns (merged, replaced_count). Ordering is minedAt desc, then repo asc,
    number desc; records without a parseable minedAt sort last.
    """
    by_key: dict[tuple[str, int], dict] = {}
    for rec in existing:
        key = record_key(rec)
        if key is not None:
            by_key[key] = rec
    replaced = 0
    for rec in new:
        key = record_key(rec)
        if key is None:
            continue
        if key in by_key:
            replaced += 1
        by_key[key] = rec

    def sort_key(rec: dict):
        mined = parse_iso(rec.get("minedAt"))
        stamp = mined.timestamp() if mined is not None else float("-inf")
        return (-stamp, rec["repo"], -rec["number"])

    merged = sorted(by_key.values(), key=sort_key)
    return merged[:keep], replaced


def atomic_write_json(path: str, value: object) -> None:
    """Write next to the target and rename over it, so a reader never sees a torn file."""
    directory = os.path.dirname(os.path.abspath(path)) or "."
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".mine-select-", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(value, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
            fh.flush()
            os.fsync(fh.fileno())
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def why_document(records: list[dict], now: datetime) -> dict:
    return {"schema": WHY_SCHEMA, "updatedAt": iso(now), "count": len(records), "records": records}


def load_new_records(path: str) -> tuple[list, str | None]:
    """The agent's output: a list, a {"records": [...]} envelope, or one record."""
    if path == "-":
        try:
            value = json.load(sys.stdin)
        except ValueError as exc:
            return [], f"stdin is not valid JSON: {exc}"
    else:
        value, err = load_json(path)
        if err is not None:
            return [], f"new records {err}"
    if isinstance(value, dict) and isinstance(value.get("records"), list):
        value = value["records"]
    if isinstance(value, dict):
        value = [value]
    if not isinstance(value, list):
        return [], "new records must be a list of records"
    return value, None


# ---------------------------------------------------------------- commands


def cmd_select(args: argparse.Namespace) -> int:
    sel = selection(
        args.rounds,
        args.why,
        now_utc(),
        min_rounds=args.min_rounds,
        min_comments=args.min_comments,
        limit=args.limit,
        repo=args.repo,
        max_age_hours=args.max_age_hours,
    )
    print(json.dumps(sel, indent=2, ensure_ascii=False))
    return 1 if "error" in sel else 0


def cmd_gate(args: argparse.Namespace) -> int:
    sel = selection(
        args.rounds,
        args.why,
        now_utc(),
        min_rounds=args.min_rounds,
        min_comments=args.min_comments,
        limit=args.limit,
        repo=args.repo,
        max_age_hours=args.max_age_hours,
    )
    # The scheduler reads the LAST stdout line; keep the payload on one line.
    print(json.dumps(gate_payload(sel), separators=(",", ":"), ensure_ascii=False))
    return 0


def cmd_merge(args: argparse.Namespace) -> int:
    now = now_utc()
    existing, err = load_why(args.why)
    if err is not None:
        print(f"merge refused: {err}", file=sys.stderr)
        return 2
    new_raw, err = load_new_records(args.new)
    if err is not None:
        print(f"merge refused: {err}", file=sys.stderr)
        return 2
    failures = []
    for i, rec in enumerate(new_raw):
        for problem in validate_record(rec):
            label = f"{rec.get('repo')}#{rec.get('number')}" if isinstance(rec, dict) else "?"
            failures.append(f"record[{i}] {label}: {problem}")
    if failures:
        print("merge refused; fix these and re-run (nothing was written):", file=sys.stderr)
        for line in failures:
            print(f"  - {line}", file=sys.stderr)
        return 2
    new = [normalize_record(rec, now) for rec in new_raw]
    merged, replaced = merge_records(existing, new, keep=args.keep)
    atomic_write_json(args.why, why_document(merged, now))
    print(f"merged {len(new)} record(s) ({replaced} replaced), {len(merged)} kept -> {args.why}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="mine_select.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    def common(p: argparse.ArgumentParser) -> None:
        p.add_argument("--rounds", default=DEFAULT_ROUNDS, help=f"review-rounds.json (default {DEFAULT_ROUNDS})")
        p.add_argument("--why", default=DEFAULT_WHY, help=f"review-cycles-why.json (default {DEFAULT_WHY})")
        p.add_argument("--min-rounds", type=int, default=MIN_ROUNDS, help="candidate when rounds > this (default 5)")
        p.add_argument("--min-comments", type=int, default=MIN_COMMENTS, help="or comments > this (default 15)")
        p.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="batch size per run (default 10)")
        p.add_argument("--repo", default=None, help="restrict to one owner/name")
        p.add_argument("--max-age-hours", type=float, default=MAX_AGE_HOURS, help="snapshot older than this is an error")

    p_select = sub.add_parser("select", help="print the batch of PRs to mine (JSON)")
    common(p_select)
    p_select.set_defaults(func=cmd_select)

    p_gate = sub.add_parser("gate", help="print the pre-task script line")
    common(p_gate)
    p_gate.set_defaults(func=cmd_gate)

    p_merge = sub.add_parser("merge", help="validate and fold new records into the why file")
    p_merge.add_argument("--why", default=DEFAULT_WHY)
    p_merge.add_argument("--new", required=True, help="JSON file with the new records, or - for stdin")
    p_merge.add_argument("--keep", type=int, default=DEFAULT_KEEP, help="records kept, newest first (default 200)")
    p_merge.set_defaults(func=cmd_merge)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
