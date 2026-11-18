"""Incremental cache behind `pull-universe.sh --cache-dir` (the hourly supervise gate's data).

A full pull of the chain universe costs minutes on prod (2,400+ chains, 5,500+
sessions): one GraphQL batch per 50 chains and one `ncl sessions messages`
mailbox round-trip per session. The hourly gate (`supervise-gate.py`) has a few
minutes at most, so it pulls incrementally. This module owns only the
bookkeeping of that mode: what was fetched last time, and what must be
fetched again now. pull-universe.sh keeps the fetching itself (the GraphQL
queries, the outbound reader, the chain assembly), so the full pull and the
cached pull build one payload shape from one code path.

Two caches live in the cache directory:

  github.json    per chain key "<repo>:<num>": the issue_data and pr_details
                 entries pull-universe.sh builds, each with `fetched_at`; per
                 repo the `synced_at` of the last change listing; and `dirty`,
                 the keys known changed but not yet refetched.
  outbound.json  per session id: the newest outbound we have read, and the
                 `last_active` / `container_status` it was read at.

A chain's GitHub data is refetched when the repo's change listing (issues and
PRs updated since `synced_at`) names its number, its PR's number, or a PR whose
body references it; when it was never fetched; or when an open entry is older
than MAX_AGE_S (the backstop for an event that does not bump `updated_at`).

A repo that GitHub refuses to list (HTTP 401 or 404) while another repo lists
fine in the same run is out of the bot's reach: renamed, removed from the App,
or a mistyped repo in a hand-typed thread id (prod: `gh-issue-slang/slang-12371`
for shader-slang/slang#12371). Its chains cannot be fetched, so the gate stops
listing the repo and fetching its chains for UNREACHABLE_RETRY_S, reports it under
`unreachable`, and then probes it again. When every listing fails, the cause is
the token or the network, not one repo, and each repo is a plain sync error.

A session's outbound is reread unless the cached read was taken while the
container was stopped and `last_active` has not moved since. The host stamps
`last_active` when it queues an inbound message and when it starts the
container, never when the agent writes an outbound row, so a stopped container
with an unchanged `last_active` cannot have written anything since the read.
A running container can, so it is reread every time.

`report.json` summarises the last cached pull for the gate's last-run record.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone

GITHUB_CACHE = "github.json"
OUTBOUND_CACHE = "outbound.json"
REPORT = "report.json"

# An open chain's GitHub entry is refetched at least this often, whatever the
# change listing says.
MAX_AGE_S = 24 * 60 * 60
# Each change listing starts this far before the previous one's start, so an
# update stamped while the previous listing ran is never missed.
SYNC_OVERLAP_S = 10 * 60
# Only `owner/name` can be listed; a thread id with a longer path (seen on
# prod: `gh-issue-shader-slang/slang-11568/recovery`) is fetched as a cold
# chain and then only by the MAX_AGE_S backstop.
REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
# A repo found out of reach is not listed again for this long.
UNREACHABLE_RETRY_S = 24 * 60 * 60
# list_changed's answer when GitHub refuses the listing itself (HTTP 401 or 404).
UNREACHABLE = object()
REFUSED_RE = re.compile(r"\(HTTP (?:401|404)\)")
# A bare `#123` in a PR body (not `owner/repo#123`, not a URL fragment).
BODY_REF_RE = re.compile(r"(?<![\w/])#(\d+)\b")
# An issue/PR URL in a PR body; the repo is checked by the caller.
BODY_URL_RE = re.compile(r"github\.com/([\w.-]+/[\w.-]+)/(?:issues|pull)/(\d+)")


def iso(ts: datetime) -> str:
    return ts.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(value):
    """ISO-8601 (with or without `Z`, naive read as UTC) to an aware datetime, or None."""
    if not value or not isinstance(value, str):
        return None
    try:
        ts = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)


def load_json(path: str, default):
    """The JSON object at `path`, or `default` when it is missing or unreadable.

    A cache that cannot be read is rebuilt, never trusted: the worst case is
    one cold pull, not a wrong classification.
    """
    try:
        with open(path) as f:
            data = json.load(f)
    except (OSError, ValueError):
        return default
    return data if isinstance(data, dict) else default


def save_json_atomic(path: str, obj) -> None:
    """Write `obj` to `path` through a temp file and rename, so a killed run leaves the old file whole."""
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=directory, prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(obj, f)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def body_refs(body: str, repo: str) -> set:
    """Issue numbers in `repo` that a PR body names, as `#N` or as a github.com URL."""
    refs = {int(n) for n in BODY_REF_RE.findall(body or "")}
    for url_repo, num in BODY_URL_RE.findall(body or ""):
        if url_repo.lower() == repo.lower():
            refs.add(int(num))
    return refs


def list_changed(repo: str, since: str, timeout: float = 30):
    """Numbers of the issues and PRs in `repo` updated at or after `since`, plus every issue a
    changed PR's body names; UNREACHABLE when GitHub refuses the listing with HTTP 401 or 404
    (`gh` reports "Bad credentials (HTTP 401)"); None when the listing fails any other way.

    One paginated REST call (`GET /repos/{repo}/issues?state=all&since=…`), which returns
    PRs as well as issues. A PR's body is read so that a new fix PR marks the issue it
    fixes as changed even when the issue itself was not touched.
    """
    jq = '.[] | [.number, (if .pull_request then (.body // "") else "" end)]'
    try:
        r = subprocess.run(
            ["gh", "api", "--paginate",
             f"repos/{repo}/issues?state=all&since={since}&per_page=100", "--jq", jq],
            capture_output=True, text=True, timeout=timeout, check=False)
    except (OSError, subprocess.SubprocessError):
        return None
    if r.returncode != 0:
        return UNREACHABLE if REFUSED_RE.search(r.stderr or "") else None
    changed = set()
    for line in r.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            number, body = json.loads(line)
        except (ValueError, TypeError):
            return None
        changed.add(int(number))
        changed |= body_refs(body, repo)
    return changed


class UniverseCache:
    """The two on-disk caches of one cached pull, loaded at start and saved at the end."""

    def __init__(self, cache_dir: str, now: datetime):
        self.dir = cache_dir
        self.now = now
        gh = load_json(os.path.join(cache_dir, GITHUB_CACHE), {})
        self.repos = gh.get("repos") if isinstance(gh.get("repos"), dict) else {}
        self.issues = gh.get("issues") if isinstance(gh.get("issues"), dict) else {}
        self.prs = gh.get("prs") if isinstance(gh.get("prs"), dict) else {}
        self.dirty = set(gh.get("dirty") or [])
        lo = load_json(os.path.join(cache_dir, OUTBOUND_CACHE), {})
        self.outbound = lo.get("sessions") if isinstance(lo.get("sessions"), dict) else {}
        self.sync_errors = []
        self.unreachable = []
        self.changed = set()

    # --- GitHub -------------------------------------------------------------

    def plan_github(self, threads, session_last_active, lister=list_changed):
        """Order the chain keys whose GitHub data must be fetched this run, most urgent first.

        `threads` are pull-universe's `{thread, repo, issue, sessions}` rows and
        `session_last_active` maps a session id to its `last_active`. Runs one change
        listing per repo (advancing `synced_at`) and returns the keys in four tiers:
        changed since the last listing, left dirty by an earlier run, never fetched
        (most recently active chain first), and open entries older than MAX_AGE_S
        (oldest first). A repo whose listing fails keeps its `synced_at`, so the next
        run lists the same window again. A repo out of reach (see the module docstring)
        keeps its `synced_at` too, and none of its chains are planned.
        """
        by_repo = {}
        for t in threads:
            by_repo.setdefault(t["repo"], []).append(t)
        listing_start = iso(self.now)
        refused, any_listed = [], False
        for repo, repo_threads in sorted(by_repo.items()):
            if not REPO_RE.match(repo):
                continue
            state = self.repos.get(repo) or {}
            unreachable_at = parse_iso(state.get("unreachable_at"))
            if unreachable_at is not None and (self.now - unreachable_at).total_seconds() < UNREACHABLE_RETRY_S:
                self.unreachable.append(repo)
                continue
            synced = parse_iso(state.get("synced_at"))
            if synced is None:
                # First sight of this repo: every chain in it is fetched as cold.
                self.repos[repo] = {"synced_at": listing_start}
                continue
            since = iso(synced - timedelta(seconds=SYNC_OVERLAP_S))
            numbers = lister(repo, since)
            if numbers is UNREACHABLE:
                refused.append(repo)
                continue
            if numbers is None:
                self.sync_errors.append(repo)
                continue
            any_listed = True
            self.repos[repo] = {"synced_at": listing_start}
            for t in repo_threads:
                key = chain_key(t)
                pr_number = ((self.issues.get(key) or {}).get("bot_pr") or {}).get("number")
                if t["issue"] in numbers or (pr_number is not None and pr_number in numbers):
                    self.changed.add(key)
        for repo in refused:
            if any_listed:
                self.repos[repo] = {**self.repos[repo], "unreachable_at": listing_start}
                self.unreachable.append(repo)
            else:
                self.sync_errors.append(repo)
        self.dirty |= self.changed
        out_of_reach = set(self.unreachable)

        def recency(t):
            return max((session_last_active.get(s) or "" for s in t["sessions"]), default="")

        changed, dirty, cold, stale = [], [], [], []
        for t in threads:
            if t["repo"] in out_of_reach:
                continue
            key = chain_key(t)
            entry = self.issues.get(key)
            if key in self.changed:
                changed.append(t)
            elif key in self.dirty:
                dirty.append(t)
            elif entry is None:
                cold.append(t)
            elif entry.get("state") == "OPEN":
                fetched = parse_iso(entry.get("fetched_at"))
                if fetched is None or (self.now - fetched).total_seconds() >= MAX_AGE_S:
                    stale.append(t)
        cold.sort(key=recency, reverse=True)
        stale.sort(key=lambda t: (self.issues.get(chain_key(t)) or {}).get("fetched_at") or "")
        return [chain_key(t) for t in changed + dirty + cold + stale]

    def record_issue(self, key: str, issue_data: dict, bot_pr) -> None:
        """Store a freshly fetched chain's issue_data (and the PR the chain resolved to)."""
        entry = dict(issue_data)
        entry["bot_pr"] = {"number": bot_pr["number"]} if bot_pr else None
        entry["fetched_at"] = iso(self.now)
        self.issues[key] = entry

    def record_pr(self, key: str, details: dict) -> None:
        entry = dict(details)
        entry["fetched_at"] = iso(self.now)
        self.prs[key] = entry

    def cached_issue(self, key: str):
        """The cached issue_data for a chain key (without the cache's own fields), or None."""
        entry = self.issues.get(key)
        if entry is None:
            return None
        return {k: v for k, v in entry.items() if k not in ("fetched_at", "bot_pr")}

    def cached_pr(self, key: str):
        entry = self.prs.get(key)
        if entry is None:
            return None
        return {k: v for k, v in entry.items() if k != "fetched_at"}

    # --- outbound -----------------------------------------------------------

    def outbound_is_current(self, session: dict) -> bool:
        """True iff the cached outbound read of `session` still holds (see the module docstring)."""
        entry = self.outbound.get(session.get("id"))
        if not isinstance(entry, dict):
            return False
        return (entry.get("container_status") == "stopped"
                and session.get("container_status") == "stopped"
                and entry.get("last_active") == session.get("last_active"))

    def record_outbound(self, session: dict, ts, text) -> None:
        """Store a fresh outbound read. A read that saw no outbound row keeps the older one we knew."""
        sid = session["id"]
        old = self.outbound.get(sid) if isinstance(self.outbound.get(sid), dict) else {}
        if ts is None or (old.get("ts") and old["ts"] > ts):
            ts, text = old.get("ts"), old.get("text")
        self.outbound[sid] = {
            "ts": ts, "text": text,
            "last_active": session.get("last_active"),
            "container_status": session.get("container_status"),
        }

    def cached_outbound(self, sid: str):
        """(ts, text) of the newest outbound cached for a session, or None when it was never read."""
        entry = self.outbound.get(sid)
        if not isinstance(entry, dict):
            return None
        return entry.get("ts"), entry.get("text")

    # --- persistence --------------------------------------------------------

    def save(self, live_keys, live_sessions, report: dict) -> None:
        """Write both caches and the report, dropping chains and sessions that left the universe."""
        live_keys = set(live_keys)
        live_sessions = set(live_sessions)
        issues = {k: v for k, v in self.issues.items() if k in live_keys}
        live_prs = {
            f"{k.rsplit(':', 1)[0]}:{v['bot_pr']['number']}"
            for k, v in issues.items() if isinstance(v.get("bot_pr"), dict)
        }
        save_json_atomic(os.path.join(self.dir, GITHUB_CACHE), {
            "version": 1,
            "repos": self.repos,
            "issues": issues,
            "prs": {k: v for k, v in self.prs.items() if k in live_prs},
            "dirty": sorted(k for k in self.dirty if k in live_keys),
        })
        save_json_atomic(os.path.join(self.dir, OUTBOUND_CACHE), {
            "version": 1,
            "sessions": {k: v for k, v in self.outbound.items() if k in live_sessions},
        })
        save_json_atomic(os.path.join(self.dir, REPORT), report)


def chain_key(thread: dict) -> str:
    """The cache key of a chain: `<repo>:<issue>`, the same key pull-universe.sh uses for issue_data."""
    return f"{thread['repo']}:{thread['issue']}"
