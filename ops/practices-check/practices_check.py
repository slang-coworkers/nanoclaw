#!/usr/bin/env python3
"""practices-check — a read-only audit of how the coworker fleet is being operated.

The fleet accumulates operating debt that no single request ever surfaces: a group's
memory file grows past what fits in a context window, a recurring task is created to
babysit one issue that webhooks already report on, a monitor script keeps failing
until the host parks its series, the groups volume fills up. Each of these is visible
in data the host already keeps — v2.db, the per-session mailboxes, the host logs, the
group directories — but only to someone who goes looking. This tool goes looking on a
timer, and costs no agent tokens doing it.

It follows the two offline tools it is modelled on:

  scripts/kb-doctor.py              three states, never two. A check that could not
                                    RUN is not a check that PASSED, so OK / DRIFT /
                                    UNKNOWN are distinct and UNKNOWN exits nonzero.
                                    Findings are reported, never repaired.
  ops/metrics/nanoclaw-metrics.py   every data source is opened read-only (SQLite via
                                    `file:...?mode=ro`, logs via 'rb'), and a failure
                                    in one section is contained so the others still
                                    report.

The only writes are the report itself, under `<NANOCLAW_DIR>/data/shared/practices-check/`
(or PRACTICES_CHECK_OUT): `latest.json` for machines, `latest.md` for people, and one
appended line per run in `history.log`. `nanoclaw-metrics.py` reads `latest.json` and
emits the counts as the `nanoclaw_practices` measurement, so the checks live here and
Grafana only reads their result.

Configuration is by environment variable with the same defaults as nanoclaw-metrics.py
(`NANOCLAW_DIR`); every threshold is overridable, see THRESHOLDS below.

  python3 practices_check.py [--quiet] [--no-report]

Exit codes: 0 = clean (every check ran, no findings), 1 = findings, 2 = at least one
check could not run (indeterminate). Findings outrank UNKNOWN because a finding is
actionable now; the report carries both regardless.

Python 3.10+, standard library only.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sqlite3
import subprocess
import sys
import tempfile
import time

SCHEMA = 1
OK, DRIFT, UNKNOWN = "OK", "DRIFT", "UNKNOWN"

# A finding is either actionable (counts towards the exit code and the `findings`
# metric) or informational (recorded and emitted, but a check made only of
# informational findings is still OK). The branch-drift count is informational: the
# merge train is expected to carry cherry-picks, so the number is context, not a fault.
ACTION, INFO = "action", "info"

NC = os.environ.get("NANOCLAW_DIR", "/home/ubuntu/slang-coworkers-prod/nanoclaw")
DB = os.path.join(NC, "data", "v2.db")
GROUPS_DIR = os.path.join(NC, "groups")
SESSIONS_DIR = os.path.join(NC, "data", "v2-sessions")
LOG = os.path.join(NC, "logs", "nanoclaw.log")
ERRLOG = os.path.join(NC, "logs", "nanoclaw.error.log")
OUT_DIR = os.environ.get("PRACTICES_CHECK_OUT", os.path.join(NC, "data", "shared", "practices-check"))

# Thresholds, each overridable by environment variable. The defaults encode the
# operating rules the fleet is held to, and the host's own constants where it has one:
# MAX_DAILY_FIRES is `src/modules/scheduling/create.ts`'s limit for an ungated agent
# recurrence, and SCRIPT_FAIL_PAUSE_CAP is the streak at which `recurrence.ts`
# re-arms a series paused.
THRESHOLDS = {
    "local_md_max_bytes": ("PRACTICES_LOCAL_MD_MAX_BYTES", 20_000),
    "claude_md_max_bytes": ("PRACTICES_CLAUDE_MD_MAX_BYTES", 60_000),
    "max_daily_fires": ("PRACTICES_MAX_DAILY_FIRES", 4),
    "fail_streak": ("PRACTICES_FAIL_STREAK", 3),
    "disk_free_min_pct": ("PRACTICES_DISK_FREE_MIN_PCT", 25),
    "skill_noise_max_per_hour": ("PRACTICES_SKILL_NOISE_MAX_PER_HOUR", 20),
    "compaction_max_per_day": ("PRACTICES_COMPACTION_MAX_PER_DAY", 5),
}
SCRIPT_FAIL_PAUSE_CAP = 8
MAX_LOG_SCAN = 32 * 1024 * 1024
PROD_REMOTES = ("origin/nv-main", "origin/nv-slang", "origin/nv-slangpy")


def threshold(name):
    env, default = THRESHOLDS[name]
    raw = os.environ.get(env)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


# ---------- report model ----------


class Report:
    """Collects per-check results. A check registers exactly one state; a check that
    cannot run must register UNKNOWN with the reason, never nothing at all, because an
    absent section would read as a pass to anyone scanning the summary."""

    def __init__(self):
        self.checks = []

    def add(self, check, state, summary, findings=None, reason=None, value=None):
        entry = {
            "check": check,
            "state": state,
            "summary": summary,
            "findings": findings or [],
        }
        if reason is not None:
            entry["reason"] = reason
        if value is not None:
            entry["value"] = value
        self.checks.append(entry)

    def ok(self, check, summary, findings=None, value=None):
        self.add(check, OK, summary, findings, value=value)

    def drift(self, check, summary, findings, value=None):
        self.add(check, DRIFT, summary, findings, value=value)

    def unknown(self, check, summary, reason):
        self.add(check, UNKNOWN, summary, reason=reason)

    def conclude(self, check, findings, ok_summary, value=None):
        """DRIFT when any finding is actionable, otherwise OK. Informational findings
        ride along in either state."""
        actionable = [f for f in findings if f.get("level", ACTION) == ACTION]
        if actionable:
            noun = "finding" if len(actionable) == 1 else "findings"
            self.drift(check, f"{len(actionable)} {noun}", findings, value=value)
        else:
            self.ok(check, ok_summary, findings, value=value)

    def of(self, state):
        return [c for c in self.checks if c["state"] == state]

    def actionable(self):
        return [f for c in self.checks for f in c["findings"] if f.get("level", ACTION) == ACTION]


def finding(message, group=None, series=None, value=None, threshold_=None, level=ACTION, **extra):
    f = {"level": level, "message": message}
    if group is not None:
        f["group"] = group
    if series is not None:
        f["series"] = series
    if value is not None:
        f["value"] = value
    if threshold_ is not None:
        f["threshold"] = threshold_
    f.update(extra)
    return f


# ---------- read-only data access ----------


def connect_ro(path):
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=5.0)
    con.execute("PRAGMA query_only = 1")
    return con


def table_columns(con, table):
    return {row[1] for row in con.execute(f"PRAGMA table_info([{table}])")}


class GroupsUnavailable(Exception):
    """The central DB could not answer which groups exist and which are paused. Every
    group-scoped check depends on that answer, so each reports UNKNOWN with this text."""


def load_groups(db_path=None):
    """Every agent_groups row as a dict, keyed by id. `paused` is required: a DB
    predating that column cannot say which groups are live, and guessing "none paused"
    would turn parked groups into findings."""
    path = db_path or DB
    if not os.path.exists(path):
        raise GroupsUnavailable(f"{path} does not exist")
    try:
        con = connect_ro(path)
    except sqlite3.Error as e:
        raise GroupsUnavailable(f"cannot open {path}: {e}") from e
    try:
        cols = table_columns(con, "agent_groups")
        for needed in ("id", "name", "folder", "paused", "coworker_type", "is_admin"):
            if needed not in cols:
                raise GroupsUnavailable(f"agent_groups has no `{needed}` column")
        groups = {}
        for gid, name, folder, paused, ctype, is_admin in con.execute(
            "SELECT id, name, folder, paused, coworker_type, is_admin FROM agent_groups"
        ):
            groups[gid] = {
                "id": gid,
                "name": name or "",
                "folder": folder or "",
                "paused": bool(paused),
                "coworker_type": ctype,
                "is_admin": bool(is_admin),
            }
        return groups
    except sqlite3.Error as e:
        raise GroupsUnavailable(f"cannot read agent_groups: {e}") from e
    finally:
        con.close()


def live_groups(groups):
    return {gid: g for gid, g in groups.items() if not g["paused"]}


# ---------- check 1: instruction-file bloat ----------


def check_instruction_bloat(rep, groups, groups_dir=None):
    """Oversized per-group instruction files. `CLAUDE.local.md` is the group's own
    memory and grows without bound unless someone prunes it; the composed `CLAUDE.md`
    is regenerated every spawn, so its size reflects the spine plus the group's extra
    instructions. Both are read on every turn, so bytes here are tokens on every turn."""
    base = groups_dir or GROUPS_DIR
    limits = {
        "CLAUDE.local.md": threshold("local_md_max_bytes"),
        "CLAUDE.md": threshold("claude_md_max_bytes"),
    }
    findings, unreadable, scanned = [], [], 0
    for g in live_groups(groups).values():
        gdir = os.path.join(base, g["folder"])
        # Group directories may be symlinks into another volume; following them is
        # the point, since the file the container mounts is the target.
        if not os.path.isdir(gdir):
            continue
        scanned += 1
        for fname, limit in limits.items():
            p = os.path.join(gdir, fname)
            try:
                size = os.stat(p).st_size
            except FileNotFoundError:
                continue
            except OSError as e:
                unreadable.append(f"{p} ({e.strerror})")
                continue
            if size > limit:
                findings.append(
                    finding(
                        f"{g['folder']}/{fname} is {size} bytes (limit {limit})",
                        group=g["folder"],
                        value=size,
                        threshold_=limit,
                        file=fname,
                    )
                )
    if unreadable:
        rep.unknown(
            "instruction-bloat",
            f"{len(unreadable)} instruction file(s) unreadable: {'; '.join(unreadable[:3])}",
            "unreadable",
        )
        return
    rep.conclude(
        "instruction-bloat",
        findings,
        f"{scanned} group dir(s) within limits",
    )


# ---------- check 2: untyped groups ----------


def check_untyped_groups(rep, groups):
    """Unpaused non-admin groups whose `coworker_type` is unset or `default`. The
    coworker type drives CLAUDE.md composition and role templates, so a group without
    one runs on the bare spine and is invisible to every per-type metric."""
    findings = []
    for g in live_groups(groups).values():
        if g["is_admin"]:
            continue
        ctype = (g["coworker_type"] or "").strip()
        if ctype == "" or ctype.lower() == "default":
            findings.append(
                finding(
                    f"{g['name'] or g['id']} ({g['folder']}) has coworker_type "
                    f"{g['coworker_type']!r}",
                    group=g["folder"],
                    value=g["coworker_type"],
                )
            )
    rep.conclude("untyped-groups", findings, "every live non-admin group has a coworker type")


# ---------- check 3: duplicate display names ----------


def check_duplicate_names(rep, groups):
    """Two live groups sharing a display name. Names are what every dashboard, Slack
    thread and `ncl` table identify a coworker by, so a duplicate makes two groups'
    activity indistinguishable there."""
    by_name = {}
    for g in live_groups(groups).values():
        key = (g["name"] or "").strip().lower()
        if key:
            by_name.setdefault(key, []).append(g["folder"])
    findings = [
        finding(
            f"display name {name!r} is used by {len(folders)} live groups: {', '.join(sorted(folders))}",
            value=len(folders),
            threshold_=1,
            name=name,
            groups=sorted(folders),
        )
        for name, folders in sorted(by_name.items())
        if len(folders) > 1
    ]
    rep.conclude("duplicate-names", findings, "live group display names are unique")


# ---------- scheduled-task series ----------

# These mirror the host's own rule in src/modules/scheduling/create.ts
# (PER_ISSUE_NAME, ISSUE_REF, PROMPT_SCAN_CHARS, taskNameFromSeriesId). Keeping the
# same shape means the check flags exactly what the host would refuse at creation, so
# a finding here is a series that predates the rule or was created by an operator.
PER_ISSUE_NAME = re.compile(r"^(i|issue|pr|gh|recheck|watch|dispatch)[-_]?\d{3,6}", re.IGNORECASE)
ISSUE_REF = re.compile(r"#(\d{3,6})\b")
PROMPT_SCAN_CHARS = 200


def task_name_from_series_id(series_id):
    return re.sub(r"-[0-9a-f]{4}$", "", series_id or "")


def targets_single_issue(name, prompt):
    if name and PER_ISSUE_NAME.match(name):
        return True
    refs = set(ISSUE_REF.findall((prompt or "")[:PROMPT_SCAN_CHARS]))
    return len(refs) == 1


def parse_task_content(raw):
    """The content column is a JSON envelope `{prompt, script, ...}`; rows older than
    the envelope hold the bare prompt, which the host reads the same way."""
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return {"prompt": raw or "", "script": None}
    if not isinstance(parsed, dict):
        return {"prompt": raw or "", "script": None}
    prompt = parsed.get("prompt")
    script = parsed.get("script")
    return {
        "prompt": prompt if isinstance(prompt, str) else "",
        "script": script if isinstance(script, str) else None,
    }


class SeriesUnavailable(Exception):
    """A mailbox that exists but could not be read. The series it holds are unknown,
    which is different from there being none."""


def load_series(groups, sessions_dir=None):
    """Every live task series across the unpaused groups' session mailboxes.

    Tasks are `messages_in` rows with `kind='task'` under
    `data/v2-sessions/<agent_group_id>/<session_id>/inbound.db`. A series is live when
    it has a pending or paused row (the next occurrence); its history is the completed
    and failed rows sharing the series id. Returns `(series, problems)`: a mailbox that
    could not be opened is a problem, not an empty result.
    """
    base = sessions_dir or SESSIONS_DIR
    live = live_groups(groups)
    series, problems = [], []
    if not os.path.isdir(base):
        raise SeriesUnavailable(f"{base} is not a directory")
    for gid, g in sorted(live.items()):
        gdir = os.path.join(base, gid)
        if not os.path.isdir(gdir):
            continue
        for sid in sorted(os.listdir(gdir)):
            db = os.path.join(gdir, sid, "inbound.db")
            if sid.startswith(".") or not os.path.isfile(db):
                continue
            try:
                series.extend(_series_in_mailbox(db, g, sid))
            except sqlite3.Error as e:
                problems.append(f"{g['folder']}/{sid}: {e}")
    return series, problems


def _series_in_mailbox(db_path, group, session_id):
    con = connect_ro(db_path)
    try:
        cols = table_columns(con, "messages_in")
        if "series_id" not in cols:
            return []
        has_class = "failure_class" in cols
        rows = con.execute(
            "SELECT id, COALESCE(series_id, id), status, recurrence, content, seq"
            + (", failure_class" if has_class else ", NULL")
            + " FROM messages_in WHERE kind = 'task' ORDER BY seq ASC"
        ).fetchall()
    finally:
        con.close()
    by_series = {}
    for _id, key, status, recurrence, content, _seq, fclass in rows:
        by_series.setdefault(key, []).append((status, recurrence, content, fclass))
    out = []
    for key, occurrences in by_series.items():
        live_rows = [o for o in occurrences if o[0] in ("pending", "paused")]
        if not live_rows:
            continue
        status, recurrence, content, _ = live_rows[-1]
        parsed = parse_task_content(content)
        history = [o for o in occurrences if o[0] in ("completed", "failed")]
        # The streaks mirror `trailingFailedRuns` in src/mailbox/sqlite/tasks.ts: the
        # plain streak counts trailing failed occurrences of any class, and the
        # script streak stops at the first failure of another class, because the
        # host's auto-pause only fires on an unambiguous run of script failures.
        streak, script_streak, script_run = 0, 0, True
        for st, _, _, fc in reversed(history):
            if st != "failed":
                break
            streak += 1
            script_run = script_run and fc == "script"
            if script_run:
                script_streak += 1
        out.append(
            {
                "series_id": key,
                "name": task_name_from_series_id(key),
                "group": group["folder"],
                "session": session_id,
                "status": status,
                "recurrence": recurrence,
                "prompt": parsed["prompt"],
                "script": parsed["script"],
                "failed_streak": streak,
                "script_failed_streak": script_streak,
                "failed_runs": sum(1 for o in history if o[0] == "failed"),
            }
        )
    return out


# ---------- cron arithmetic (stdlib) ----------

CRON_ALIASES = {
    "@yearly": "0 0 1 1 *",
    "@annually": "0 0 1 1 *",
    "@monthly": "0 0 1 * *",
    "@weekly": "0 0 * * 0",
    "@daily": "0 0 * * *",
    "@midnight": "0 0 * * *",
    "@hourly": "0 * * * *",
}
MONTH_NAMES = {
    m: i
    for i, m in enumerate(
        ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1
    )
}
DOW_NAMES = {d: i for i, d in enumerate(["sun", "mon", "tue", "wed", "thu", "fri", "sat"])}


class CronError(ValueError):
    pass


def _cron_field(spec, lo, hi, names=None):
    """The set of integers a single cron field matches. Supports `*`, lists, ranges,
    steps and month/weekday names; weekday 7 folds to 0. Unsupported syntax raises,
    so the caller can report the series as UNKNOWN rather than guess its cadence."""
    values = set()
    for part in spec.split(","):
        part = part.strip().lower()
        if not part:
            raise CronError(f"empty element in {spec!r}")
        step = 1
        if "/" in part:
            part, step_s = part.split("/", 1)
            if not step_s.isdigit() or int(step_s) < 1:
                raise CronError(f"bad step in {spec!r}")
            step = int(step_s)
        if part == "*":
            start, end = lo, hi
        elif "-" in part:
            a, b = part.split("-", 1)
            start, end = _cron_atom(a, names), _cron_atom(b, names)
        else:
            start = _cron_atom(part, names)
            end = hi if step > 1 else start
        if start < lo or end > hi or start > end:
            raise CronError(f"out of range in {spec!r}")
        for v in range(start, end + 1, step):
            values.add(0 if (names is DOW_NAMES and v == 7) else v)
    return values


def _cron_atom(tok, names):
    if tok.isdigit():
        return int(tok)
    if names and tok[:3] in names:
        return names[tok[:3]]
    raise CronError(f"bad value {tok!r}")


def parse_cron(expr):
    """Five standard fields (cron-parser's optional leading seconds field is accepted
    and its cardinality multiplies the count). Returns (seconds_count, minute, hour,
    dom, month, dow) as sets."""
    expr = (expr or "").strip()
    expr = CRON_ALIASES.get(expr.lower(), expr)
    fields = expr.split()
    seconds = 1
    if len(fields) == 6:
        seconds = len(_cron_field(fields[0], 0, 59))
        fields = fields[1:]
    if len(fields) != 5:
        raise CronError(f"expected 5 fields, got {len(fields)}: {expr!r}")
    minute = _cron_field(fields[0], 0, 59)
    hour = _cron_field(fields[1], 0, 23)
    dom = _cron_field(fields[2], 1, 31)
    month = _cron_field(fields[3], 1, 12, MONTH_NAMES)
    dow = _cron_field(fields[4], 0, 7, DOW_NAMES)
    dom_star, dow_star = fields[2].strip() == "*", fields[4].strip() == "*"
    return seconds, minute, hour, dom, month, dow, dom_star, dow_star


def fires_per_day(expr, start=None):
    """How many times `expr` fires in the 24 hours after `start` (UTC). Enumerating
    minutes is exact for the window and needs no cron library; day-of-month and
    day-of-week combine with OR when both are restricted, as in Vixie cron."""
    seconds, minute, hour, dom, month, dow, dom_star, dow_star = parse_cron(expr)
    t = (start or dt.datetime.now(dt.timezone.utc)).replace(second=0, microsecond=0)
    fires = 0
    for i in range(24 * 60):
        m = t + dt.timedelta(minutes=i)
        if m.minute not in minute or m.hour not in hour or m.month not in month:
            continue
        in_dom, in_dow = m.day in dom, m.isoweekday() % 7 in dow
        if dom_star or dow_star:
            if not (in_dom and in_dow):
                continue
        elif not (in_dom or in_dow):
            continue
        fires += 1
    return fires * seconds


# ---------- checks 4-6: series hygiene ----------


def check_series(rep, series, problems):
    """Three checks over the same live series list. They are reported separately
    because each has its own remedy, but they are loaded together because a mailbox
    that could not be read makes all three indeterminate for the series it holds."""
    per_issue, ungated, failing, cron_unknown = [], [], [], []
    max_fires = threshold("max_daily_fires")
    fail_streak = threshold("fail_streak")
    for s in series:
        if s["recurrence"] and targets_single_issue(s["name"], s["prompt"]):
            per_issue.append(
                finding(
                    f"{s['series_id']} ({s['group']}) recurs `{s['recurrence']}` but targets one issue/PR",
                    group=s["group"],
                    series=s["series_id"],
                    value=s["recurrence"],
                )
            )
        if s["recurrence"] and not s["script"]:
            try:
                fires = fires_per_day(s["recurrence"])
            except CronError as e:
                cron_unknown.append(f"{s['series_id']}: {e}")
            else:
                if fires > max_fires:
                    ungated.append(
                        finding(
                            f"{s['series_id']} ({s['group']}) fires {fires}x/day on `{s['recurrence']}` with no script gate",
                            group=s["group"],
                            series=s["series_id"],
                            value=fires,
                            threshold_=max_fires,
                        )
                    )
        auto_paused = s["status"] == "paused" and s["script_failed_streak"] >= SCRIPT_FAIL_PAUSE_CAP
        if auto_paused:
            failing.append(
                finding(
                    f"{s['series_id']} ({s['group']}) is auto-paused after "
                    f"{s['script_failed_streak']} consecutive script failures",
                    group=s["group"],
                    series=s["series_id"],
                    value=s["script_failed_streak"],
                    threshold_=SCRIPT_FAIL_PAUSE_CAP,
                    kind="auto-paused",
                )
            )
        elif s["failed_streak"] >= fail_streak:
            failing.append(
                finding(
                    f"{s['series_id']} ({s['group']}) has failed {s['failed_streak']} consecutive runs",
                    group=s["group"],
                    series=s["series_id"],
                    value=s["failed_streak"],
                    threshold_=fail_streak,
                    kind="failing",
                )
            )

    n = len(series)
    if problems:
        why = f"{len(problems)} mailbox(es) unreadable: {'; '.join(problems[:3])}"
        for check in ("per-issue-series", "ungated-series", "failing-series"):
            rep.unknown(check, why, "unreadable")
        return
    rep.conclude("per-issue-series", per_issue, f"{n} live series, none per-issue")
    if cron_unknown and not ungated:
        # Findings found elsewhere still count; only a run with nothing to report and
        # an unparseable cadence is indeterminate, because the unparsed series may be
        # the frequent one.
        rep.unknown(
            "ungated-series",
            f"{len(cron_unknown)} recurrence(s) could not be parsed: {'; '.join(cron_unknown[:3])}",
            "cron-parse",
        )
    else:
        for note in cron_unknown:
            ungated.append(finding(f"recurrence not parsed: {note}", level=INFO))
        rep.conclude("ungated-series", ungated, f"{n} live series within {max_fires} fires/day or gated")
    rep.conclude("failing-series", failing, f"{n} live series, none failing")


# ---------- check 7: disk pressure ----------


def check_disk(rep, groups_dir=None):
    """Free space on the volume the group directories resolve to. The groups tree is
    where memory files, run logs and workspaces grow, so it is the volume that fills."""
    path = os.path.realpath(groups_dir or GROUPS_DIR)
    min_pct = threshold("disk_free_min_pct")
    try:
        st = os.statvfs(path)
    except OSError as e:
        rep.unknown("disk-pressure", f"statvfs({path}) failed: {e}", "check-errored")
        return
    if st.f_blocks == 0:
        rep.unknown("disk-pressure", f"{path} reports zero blocks", "check-errored")
        return
    free_pct = round(100.0 * st.f_bavail / st.f_blocks, 1)
    findings = []
    if free_pct < min_pct:
        findings.append(
            finding(
                f"{path}: {free_pct}% free (minimum {min_pct}%)",
                value=free_pct,
                threshold_=min_pct,
                path=path,
            )
        )
    rep.conclude("disk-pressure", findings, f"{path}: {free_pct}% free", value=free_pct)


# ---------- host log windows ----------

ANSI = re.compile(r"\x1b\[[0-9;]*m")
LOG_TS = re.compile(r"^\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]")


def local_now():
    """The current time in the host's local zone, timezone-aware. The host logger stamps
    with local wall-clock time, so log windows are measured in that zone."""
    return dt.datetime.now(dt.timezone.utc).astimezone()


def recent_log_lines(path, window_sec, now=None, max_scan=MAX_LOG_SCAN):
    """Lines of `path` stamped within the last `window_sec`.

    The host logger stamps lines with local wall-clock time of day only
    (`[HH:MM:SS.mmm]`, src/log.ts), so a window is recovered by walking the tail
    backwards: within a day the stamps are monotone, and a stamp that is later than
    the line after it marks a midnight boundary and shifts everything before it one
    day earlier. Lines without a stamp (continuations) inherit the previous stamp.
    The file's mtime anchors the date of its last line, so a rotated predecessor that
    stopped days ago is not read as if its stamps were today's. Returns
    `(lines, error)`; a missing or unstamped log is an error, because a count of zero
    from a file that could not be dated is not a quiet hour.
    """
    now = now or local_now()
    try:
        size = os.path.getsize(path)
        anchor = min(now, dt.datetime.fromtimestamp(os.path.getmtime(path), dt.timezone.utc).astimezone())
        with open(path, "rb") as fh:
            if size > max_scan:
                fh.seek(size - max_scan)
            data = fh.read()
    except OSError as e:
        return None, f"{type(e).__name__}: {e}"
    lines = ANSI.sub("", data.decode("utf-8", "replace")).splitlines()
    if size > max_scan and lines:
        lines = lines[1:]  # the first line of a mid-file read is a fragment
    midnight = anchor.replace(hour=0, minute=0, second=0, microsecond=0)
    out, day_shift, newer = [], 0, None
    saw_stamp = False
    for line in reversed(lines):
        m = LOG_TS.match(line)
        if m:
            saw_stamp = True
            h, mi, s, ms = (int(x) for x in m.groups())
            tod = dt.timedelta(hours=h, minutes=mi, seconds=s, milliseconds=ms)
            if newer is not None and tod > newer:
                day_shift += 1
            newer = tod
            stamp = midnight - dt.timedelta(days=day_shift) + tod
            if stamp > anchor + dt.timedelta(minutes=5):
                # A stamp later than the anchor on the anchor's own day was written
                # before the most recent midnight; it belongs to the day before.
                day_shift += 1
                stamp -= dt.timedelta(days=1)
            if (now - stamp).total_seconds() > window_sec:
                break
        elif newer is None:
            continue
        out.append(line)
    if not saw_stamp:
        return None, "no timestamped lines found"
    out.reverse()
    return out, None


def log_files(*paths):
    """Each log plus its rotated predecessor when present, so a rotation inside the
    window does not hide the lines it carried off."""
    out = []
    for p in paths:
        for cand in (p + ".1", p):
            if os.path.isfile(cand):
                out.append(cand)
    return out


SKILL_NOISE = "Shared skill not symlinked"
COMPACTION = "CLAUDE.md stale"
FOLDER_KV = re.compile(r'\bfolder="([^"]*)"')


def check_skill_noise(rep, log=None, errlog=None, now=None):
    """`Shared skill not symlinked` warnings in the last hour. The warning fires once
    per conflicting skill per spawn, so a steady stream means a group carries a stale
    copy of a shared skill that every spawn trips over. The message is logged at WARN,
    which the host routes to the error log, so both logs are scanned."""
    files = log_files(log or LOG, errlog or ERRLOG)
    if not files:
        rep.unknown("skill-noise", "no host log found", "missing-input")
        return
    count, errors = 0, []
    for f in files:
        lines, err = recent_log_lines(f, 3600, now=now)
        if lines is None:
            errors.append(f"{f}: {err}")
            continue
        count += sum(1 for ln in lines if SKILL_NOISE in ln)
    if errors and count == 0:
        rep.unknown("skill-noise", "; ".join(errors), "unreadable")
        return
    limit = threshold("skill_noise_max_per_hour")
    findings = []
    if count > limit:
        findings.append(
            finding(
                f"{count} `{SKILL_NOISE}` warnings in the last hour (limit {limit})",
                value=count,
                threshold_=limit,
            )
        )
    rep.conclude("skill-noise", findings, f"{count} warning(s) in the last hour", value=count)


def check_compaction_storms(rep, groups, log=None, errlog=None, now=None):
    """Composed-document restarts per group in the last 24 hours. The sweep logs
    `CLAUDE.md stale — restarting container` with `folder=` whenever a session's
    composed CLAUDE.md changed under it and the container is killed to republish it
    (src/reconcile-session.ts). A deploy restarts every group once; a group restarting
    many times a day is being recomposed in a loop, and every restart discards the
    container's context. This is the same signal nanoclaw-metrics.py counts fleet-wide
    as `stale_restarts`, here attributed per group."""
    files = log_files(log or LOG, errlog or ERRLOG)
    if not files:
        rep.unknown("compaction-storms", "no host log found", "missing-input")
        return
    per_folder, errors = {}, []
    for f in files:
        lines, err = recent_log_lines(f, 24 * 3600, now=now)
        if lines is None:
            errors.append(f"{f}: {err}")
            continue
        for ln in lines:
            if COMPACTION not in ln:
                continue
            m = FOLDER_KV.search(ln)
            folder = m.group(1) if m else "?"
            per_folder[folder] = per_folder.get(folder, 0) + 1
    if errors and not per_folder:
        rep.unknown("compaction-storms", "; ".join(errors), "unreadable")
        return
    limit = threshold("compaction_max_per_day")
    paused = {g["folder"] for g in groups.values() if g["paused"]}
    findings = [
        finding(
            f"{folder}: {n} composed-document restarts in 24h (limit {limit})",
            group=folder,
            value=n,
            threshold_=limit,
        )
        for folder, n in sorted(per_folder.items())
        if n > limit and folder not in paused
    ]
    total = sum(per_folder.values())
    rep.conclude(
        "compaction-storms",
        findings,
        f"{total} restart(s) across {len(per_folder)} group(s) in 24h",
        value=total,
    )


# ---------- check 10: prod branch drift ----------


def git(repo, *args):
    try:
        r = subprocess.run(
            ["git", "-C", repo, *args],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as e:
        return None, f"{type(e).__name__}: {e}"
    if r.returncode != 0:
        return None, (r.stderr or r.stdout or f"exit {r.returncode}").strip().splitlines()[0]
    return r.stdout.strip(), None


def check_branch_drift(rep, repo=None):
    """Commits on the checked-out prod branch that no tracked upstream branch
    contains: cherry-picks waiting for the merge train. Informational only, and
    computed from the local remote-tracking refs as they stand, because this tool
    never fetches."""
    repo = repo or NC
    head, err = git(repo, "rev-parse", "--abbrev-ref", "HEAD")
    if head is None:
        rep.unknown("branch-drift", f"cannot resolve HEAD in {repo}: {err}", "check-errored")
        return
    present = []
    for ref in PROD_REMOTES:
        sha, _ = git(repo, "rev-parse", "--verify", "--quiet", ref)
        if sha:
            present.append(ref)
    if not present:
        rep.unknown(
            "branch-drift",
            f"none of {', '.join(PROD_REMOTES)} exist locally (not fetched?)",
            "missing-input",
        )
        return
    out, err = git(repo, "rev-list", "--count", "HEAD", *[f"^{r}" for r in present])
    if out is None:
        rep.unknown("branch-drift", f"rev-list failed: {err}", "check-errored")
        return
    ahead = int(out)
    findings = []
    if ahead:
        findings.append(
            finding(
                f"{head} carries {ahead} commit(s) not in {', '.join(present)}",
                value=ahead,
                level=INFO,
                branch=head,
                upstreams=present,
            )
        )
    rep.ok("branch-drift", f"{head}: {ahead} commit(s) ahead of {', '.join(present)}", findings, value=ahead)


# ---------- orchestration ----------


def run_all(rep, repo=None):
    """Run every check, containing failures: any exception inside a check becomes that
    check's UNKNOWN, so one broken data source cannot blank the rest of the report."""
    repo = repo or NC
    try:
        groups = load_groups()
    except GroupsUnavailable as e:
        groups = None
        for check in (
            "instruction-bloat",
            "untyped-groups",
            "duplicate-names",
            "per-issue-series",
            "ungated-series",
            "failing-series",
        ):
            rep.unknown(check, f"agent_groups unavailable: {e}", "missing-input")

    def guarded(name, fn):
        try:
            fn()
        except Exception as e:  # noqa: BLE001 — the fail-closed net: a check that
            # raises must surface as UNKNOWN, never as a missing section.
            if not any(c["check"] == name for c in rep.checks):
                rep.unknown(name, f"check raised {type(e).__name__}: {e}", "check-errored")

    if groups is not None:
        guarded("instruction-bloat", lambda: check_instruction_bloat(rep, groups))
        guarded("untyped-groups", lambda: check_untyped_groups(rep, groups))
        guarded("duplicate-names", lambda: check_duplicate_names(rep, groups))

        def series_checks():
            try:
                series, problems = load_series(groups)
            except SeriesUnavailable as e:
                for check in ("per-issue-series", "ungated-series", "failing-series"):
                    rep.unknown(check, str(e), "missing-input")
                return
            check_series(rep, series, problems)

        guarded("per-issue-series", series_checks)
    guarded("disk-pressure", lambda: check_disk(rep))
    guarded("skill-noise", lambda: check_skill_noise(rep))
    guarded("compaction-storms", lambda: check_compaction_storms(rep, groups or {}))
    guarded("branch-drift", lambda: check_branch_drift(rep, repo))


def build_document(rep, started):
    actionable = rep.actionable()
    unknown = rep.of(UNKNOWN)
    status = "findings" if actionable else ("unknown" if unknown else "clean")
    code = 1 if actionable else (2 if unknown else 0)
    per_check = {c["check"]: len([f for f in c["findings"] if f.get("level", ACTION) == ACTION]) for c in rep.checks}
    return {
        "schema": SCHEMA,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "durationMs": int((time.time() - started) * 1000),
        "repo": os.path.abspath(NC),
        "status": status,
        # False = at least one check could not run; the absence of findings is not
        # health when this is false.
        "complete": not unknown,
        "exitCode": code,
        "thresholds": {k: threshold(k) for k in THRESHOLDS},
        "counts": {
            "ok": len(rep.of(OK)),
            "drift": len(rep.of(DRIFT)),
            "unknown": len(unknown),
            "findings": len(actionable),
            "perCheck": per_check,
        },
        "checks": rep.checks,
    }


def render_markdown(doc):
    L = [
        f"# practices-check — {doc['status'].upper()}",
        "",
        (
            f"Generated {doc['generatedAt']} for `{doc['repo']}`. "
            f"{doc['counts']['findings']} finding(s), {doc['counts']['unknown']} check(s) could not run."
        ),
        "",
        "| Check | State | Summary |",
        "|---|---|---|",
    ]
    for c in doc["checks"]:
        L.append(f"| {c['check']} | {c['state']} | {c['summary'].replace('|', '/')} |")
    details = [c for c in doc["checks"] if c["findings"] or c["state"] == UNKNOWN]
    if details:
        L += ["", "## Details", ""]
        for c in details:
            L.append(f"### {c['check']} — {c['state']}")
            L.append("")
            if c["state"] == UNKNOWN:
                L.append(f"- could not run ({c.get('reason')}): {c['summary']}")
            for f in c["findings"]:
                tag = " _(info)_" if f.get("level") == INFO else ""
                L.append(f"- {f['message']}{tag}")
            L.append("")
    if not doc["complete"]:
        L += ["UNKNOWN means the check could not run. That is not a pass.", ""]
    lines = [ln.rstrip() for ln in L]
    while lines and not lines[-1]:
        lines.pop()
    return "".join(ln + "\n" for ln in lines)


def write_atomic(path, text):
    """Temp file, fsync, rename. The dashboard and the metrics collector read these
    files on their own schedule; a half-written file would parse as corrupt exactly
    when it is read."""
    d = os.path.dirname(os.path.abspath(path))
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".practices-check.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def write_report(doc, out_dir):
    write_atomic(os.path.join(out_dir, "latest.json"), json.dumps(doc, indent=1) + "\n")
    write_atomic(os.path.join(out_dir, "latest.md"), render_markdown(doc))
    line = (
        f"{doc['generatedAt']} status={doc['status']} findings={doc['counts']['findings']} "
        f"unknown={doc['counts']['unknown']} exit={doc['exitCode']}\n"
    )
    with open(os.path.join(out_dir, "history.log"), "a", encoding="utf-8") as fh:
        fh.write(line)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--quiet", action="store_true", help="print only non-OK checks plus the summary")
    ap.add_argument("--no-report", action="store_true", help="skip writing latest.json/latest.md/history.log")
    ap.add_argument("--out", default=None, help=f"report directory (default {OUT_DIR})")
    args = ap.parse_args(argv)

    started = time.time()
    rep = Report()
    run_all(rep)
    doc = build_document(rep, started)
    code = doc["exitCode"]

    if not args.no_report:
        out_dir = args.out or OUT_DIR
        try:
            write_report(doc, out_dir)
        except (OSError, TypeError, ValueError) as e:
            print(f"ERROR: could not write report to {out_dir}: {type(e).__name__}: {e}", file=sys.stderr)
            code = max(code, 2)

    for c in rep.checks:
        if args.quiet and c["state"] == OK:
            continue
        print(f"{c['state']:<8}{c['check']:<20}{c['summary']}")
        for f in c["findings"]:
            if c["state"] == OK and args.quiet:
                continue
            print(f"        - {f['message']}")
    counts = doc["counts"]
    print(
        f"practices-check: {doc['status'].upper()} — {counts['findings']} findings, "
        f"{counts['ok']} ok, {counts['drift']} drift, {counts['unknown']} unknown (exit {code})"
    )
    if counts["unknown"]:
        print("UNKNOWN means the check could not run. That is not a pass — fix the cause or this tool is blind to that path.")
    return code


if __name__ == "__main__":
    sys.exit(main())
