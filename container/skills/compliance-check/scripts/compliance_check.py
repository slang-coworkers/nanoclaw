#!/usr/bin/env python3
"""compliance-check — a read-only score of the coworker fleet against the Contributor AI Standard.

The Contributor AI Standard (shader-slang/slang#13591) holds people and the bot to the
same ten rules about what they post: short four-section PR descriptions, an AI
disclosure line, comments that say why, newcomer-labelled issues left to people,
Simple Technical English, a `bot` label, one Discord thread instead of numbered parts.
The fleet posts hundreds of items a week under one GitHub App login, and nothing reports
whether those items follow the rules. This tool scores every item the bot posted in a
window, attributes each to a coworker role, and writes a report. It costs no agent
tokens except when a judge model is configured for the two rules that need reading.

It is modelled on ops/practices-check/practices_check.py:

  three states, never two     OK / DRIFT / UNKNOWN per rule. A rule that could not be
                              scored is UNKNOWN with the reason, never a silent pass,
                              and UNKNOWN exits nonzero.
  reports, never repairs      Findings are written to the report. Nothing is posted,
                              labelled, commented or edited anywhere.
  read-only data access       GitHub through `gh api --method GET` only (a guard
                              refuses any other verb), the Discord export through a
                              file opened for reading, the judge through POST to the
                              model endpoint, which sends text and changes nothing.

The only writes are the report: `latest.json`, `latest.html`, `runs/<date>.json` and one
appended line per run in `history.log`, under COMPLIANCE_CHECK_OUT, which defaults to
`/workspace/agent/reports/compliance/` inside a coworker container (the group's own
directory, which the host sees as `groups/<folder>/reports/compliance/`) and to
`<NANOCLAW_DIR>/data/shared/compliance/` elsewhere. `ops/metrics/nanoclaw-metrics.py`
reads `latest.json` from the group directory and emits it as `nanoclaw_compliance`.

The tool runs as a weekly task of a dedicated read-only coworker group. In that
container GitHub is reached through the OneCLI proxy (`gh` is already configured) and
the judge through the gateway named by ANTHROPIC_BASE_URL, whose credential header is a
placeholder the gateway replaces; HTTPS_PROXY and SSL_CERT_FILE are honoured.

  python3 compliance_check.py [--since-days N] [--repos a/b,c/d] [--discord-export F]
                              [--no-report] [--out DIR]

Exit codes: 0 = clean, 1 = findings, 2 = at least one rule could not be scored.
Findings outrank UNKNOWN because a finding is actionable now; the report carries both.

Python 3.9+, standard library only. The two vendored checkers under vendor/ are the
code the standard proposes (PR #13586 and slang-skills#63), imported by path.
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import importlib.util
import json
import math
import os
import re
import ssl
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

SCHEMA = 1
OK, DRIFT, UNKNOWN = "OK", "DRIFT", "UNKNOWN"
# Verdicts on one item. An item the rule could not decide (judge budget spent, judge
# absent, text unreadable) is `unknown`, which is distinct from `pass`.
PASS, FAIL, UNJUDGED = "pass", "fail", "unknown"

NC = os.environ.get("NANOCLAW_DIR", "/home/ubuntu/slang-coworkers-prod/nanoclaw")
CONTAINER_GROUP_DIR = "/workspace/agent"


def default_out_dir(env=None, group_dir=CONTAINER_GROUP_DIR):
    """Where the report goes. Inside a coworker container the group directory is the
    one writable place that survives the session and that the host can read, so the
    report lives there; on a host the practices-check layout under data/shared applies.
    COMPLIANCE_CHECK_OUT overrides both."""
    env = os.environ if env is None else env
    explicit = env.get("COMPLIANCE_CHECK_OUT")
    if explicit:
        return explicit
    if os.path.isdir(group_dir):
        return os.path.join(group_dir, "reports", "compliance")
    return os.path.join(env.get("NANOCLAW_DIR", NC), "data", "shared", "compliance")


OUT_DIR = default_out_dir()
HERE = os.path.dirname(os.path.abspath(__file__))
VENDOR_DIR = os.path.join(HERE, "vendor")

# The GitHub App the coworkers post as. REST payloads spell it with the `[bot]` suffix;
# search qualifiers take `app/nv-slang-bot`. Both are derived from this one value.
BOT_LOGIN = os.environ.get("COMPLIANCE_BOT_LOGIN", "nv-slang-bot[bot]")
DEFAULT_REPOS = ("shader-slang/slang", "shader-slang/slangpy", "shader-slang/slang-rhi")
DEFAULT_SINCE_DAYS = 30

# Thresholds, each overridable by environment variable. The defaults encode the
# decisions taken for the standard; the R1 caps live in the vendored lint's own
# PR_TEXT_* variables.
THRESHOLDS = {
    "ste_max_per_100_words": ("COMPLIANCE_STE_MAX_PER_100_WORDS", 2),
    "discord_thread_window_min": ("COMPLIANCE_DISCORD_THREAD_WINDOW_MIN", 10),
    "judge_max_items": ("COMPLIANCE_JUDGE_MAX_ITEMS", 40),
    "max_pages": ("COMPLIANCE_MAX_PAGES", 100),
}

BOT_LABEL = "bot"
# R6 is a label rule. A newcomer label reserves an issue for people and the bot must not
# touch it; `bot-ok` is a maintainer handing such an issue to the bot after all, so it
# wins over a newcomer label, exactly as the host's webhook gate decides. Compared
# case-insensitively because GitHub labels are.
BOT_OK_LABELS = {"bot-ok"}
NEWCOMER_LABELS = {"goodfirstbug", "helpwanted", "no-bot"}

# The disclaimer every coworker appends to what it posts. It is not scored as prose and
# it is stripped before the STE checker runs.
DISCLAIMER_RE = re.compile(r"^\s*<sub>.*?</sub>\s*$", re.IGNORECASE | re.MULTILINE | re.DOTALL)
HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)

# One rule per check. `kind` says how the verdict is reached: a mechanical rule is
# computed here, a judge rule asks the configured Judge, an external rule reads a
# data export this host does not produce.
RULES = [
    {"rule": "R1", "check": "pr-description", "title": "PR description: four sections, three lines each, under 1,500 characters", "kind": "mechanical"},
    {"rule": "R2/R3", "check": "comment-rationale", "title": "Code comments state contracts and reasons, not narration or history", "kind": "judge"},
    {"rule": "R5", "check": "ai-disclosure", "title": "One-line AI assistance disclosure in the PR", "kind": "mechanical"},
    {"rule": "R6", "check": "issue-newcomer", "title": "Bot leaves newcomer-labelled issues to people", "kind": "mechanical"},
    {"rule": "R7", "check": "docs-updated", "title": "Documentation updated when behaviour changed", "kind": "judge"},
    {"rule": "R8", "check": "simple-english", "title": "Simple Technical English in posted text", "kind": "mechanical"},
    {"rule": "R9", "check": "bot-label", "title": "Bot-opened items carry the `bot` label", "kind": "mechanical"},
    {"rule": "R10", "check": "discord-thread", "title": "Discord: one post per topic with a thread, no numbered parts", "kind": "external"},
]
RULE_BY_CHECK = {r["check"]: r for r in RULES}
COWORKERS = ("fixer", "reviewer", "triager", "maintainer", "unattributed")


def threshold(name):
    env, default = THRESHOLDS[name]
    raw = os.environ.get(env)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def utcnow():
    return dt.datetime.now(dt.timezone.utc)


def parse_ts(s):
    """GitHub stamps are RFC 3339 with a Z suffix, which Python 3.9's fromisoformat does
    not accept, so the suffix is normalised first."""
    if not s:
        return None
    return dt.datetime.fromisoformat(str(s).replace("Z", "+00:00"))


# ---------- vendored checkers ----------


class VendorMissing(Exception):
    """A vendored checker could not be imported. The rules that depend on it are
    UNKNOWN, because scoring them with a reimplementation would not be scoring them
    against the standard's own code."""


def load_vendored(name):
    path = os.path.join(VENDOR_DIR, name + ".py")
    if not os.path.isfile(path):
        raise VendorMissing(f"{path} is missing")
    spec = importlib.util.spec_from_file_location(f"compliance_vendor_{name}", path)
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
    except Exception as e:  # an import error in vendored code is a reason, not a crash
        raise VendorMissing(f"{path} failed to import: {type(e).__name__}: {e}") from e
    return mod


# ---------- report model ----------


class Report:
    """Collects one entry per rule. A rule registers exactly one state; a rule that
    cannot be scored registers UNKNOWN with the reason, because an absent row would
    read as a pass to anyone scanning the table."""

    def __init__(self):
        self.rules = []

    def add(self, check, state, summary, results=None, reason=None):
        meta = RULE_BY_CHECK[check]
        entry = {
            "rule": meta["rule"],
            "check": check,
            "title": meta["title"],
            "kind": meta["kind"],
            "state": state,
            "summary": summary,
            "results": results or [],
        }
        if reason is not None:
            entry["reason"] = reason
        self.rules.append(entry)

    def unknown(self, check, summary, reason):
        self.add(check, UNKNOWN, summary, reason=reason)

    def conclude(self, check, results, unknown_reason=None):
        """DRIFT when any item failed; otherwise UNKNOWN when any item could not be
        decided (or `unknown_reason` says the rule was only partly scored); otherwise
        OK. Failures outrank the undecided because they are actionable now."""
        n_fail = sum(1 for r in results if r["verdict"] == FAIL)
        n_unknown = sum(1 for r in results if r["verdict"] == UNJUDGED)
        n_pass = sum(1 for r in results if r["verdict"] == PASS)
        total = len(results)
        summary = f"{n_pass}/{total} pass"
        if n_fail:
            self.add(check, DRIFT, f"{n_fail} of {total} item(s) fail; {summary}", results)
        elif unknown_reason:
            self.add(check, UNKNOWN, f"{summary}; {unknown_reason}", results, reason=unknown_reason)
        elif n_unknown:
            reasons = sorted({r.get("reason", "") for r in results if r["verdict"] == UNJUDGED})
            why = reasons[0] if len(reasons) == 1 else f"{len(reasons)} distinct reasons"
            self.add(check, UNKNOWN, f"{n_unknown} of {total} item(s) undecided: {why}", results, reason=why)
        elif total == 0:
            self.add(check, OK, "no items in window", results)
        else:
            self.add(check, OK, summary, results)

    def of(self, state):
        return [r for r in self.rules if r["state"] == state]

    def failures(self):
        return [x for r in self.rules for x in r["results"] if x["verdict"] == FAIL]


def result(item, verdict, reason, **extra):
    """One scored item. Only what the HTML page and the metrics need is kept: the
    link, the kind, the coworker, the verdict and a one-line reason."""
    out = {
        "id": item["id"],
        "kind": item["kind"],
        "repo": item["repo"],
        "url": item["url"],
        "title": item.get("title") or "",
        "coworker": item.get("coworker") or "unattributed",
        "verdict": verdict,
        "reason": reason,
    }
    out.update(extra)
    return out


# ---------- read-only GitHub access ----------


class GitHubUnavailable(Exception):
    """A GitHub query failed. The items it would have returned are unknown, which is
    different from there being none."""


def gh_command(path, params=None):
    """The exact `gh api` invocation for a read. The method is pinned to GET and the
    path must be a bare REST path, so there is no way for this tool to issue a
    mutation through the GitHub CLI even by accident."""
    if path.startswith(("-", "graphql")) or " " in path:
        raise GitHubUnavailable(f"refusing non-REST or malformed path {path!r}")
    # `:` `/` and `+` stay literal because GitHub's search grammar reads them
    # (`repo:a/b`, `+` as the space); `>` `<` `=` must be percent-encoded or the
    # search endpoint answers HTTP 400 for a qualifier such as `created:>=DATE`.
    query = urllib.parse.urlencode(params or {}, safe=":/+")
    full = path + ("&" if "?" in path else "?") + query if query else path
    return ["gh", "api", "--method", "GET", "-H", "Accept: application/vnd.github+json", full]


def _gh_fetch(path, params=None):
    cmd = gh_command(path, params)
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120, check=False)
    except (OSError, subprocess.SubprocessError) as e:
        raise GitHubUnavailable(f"{type(e).__name__}: {e}") from e
    if r.returncode != 0:
        msg = (r.stderr or r.stdout or f"exit {r.returncode}").strip().splitlines()
        raise GitHubUnavailable(msg[0] if msg else f"exit {r.returncode}")
    try:
        return json.loads(r.stdout)
    except ValueError as e:
        raise GitHubUnavailable(f"non-JSON response from gh api {path}: {e}") from e


class GitHub:
    """Paged, counted, read-only access. `fetch(path, params) -> parsed JSON` is
    injectable so the tests never spawn `gh`."""

    def __init__(self, fetch=None, max_pages=None):
        self.fetch = fetch or _gh_fetch
        self.max_pages = max_pages or threshold("max_pages")
        self.calls = 0
        self._cache = {}

    def get(self, path, params=None):
        """One read. Any failure of the fetch layer is a GitHubUnavailable, so a caller
        sees one exception type whatever broke underneath (gh, the network, JSON)."""
        self.calls += 1
        try:
            return self.fetch(path, params)
        except GitHubUnavailable:
            raise
        except Exception as e:
            raise GitHubUnavailable(f"{type(e).__name__}: {e}") from e

    def cached(self, path):
        if path not in self._cache:
            self._cache[path] = self.get(path)
        return self._cache[path]

    def paginate(self, path, params, items_key=None):
        """Every page up to `max_pages`. Returns `(items, truncated)`: a run that hit the
        page cap did not see everything, and the caller reports that rather than
        scoring a sample as if it were the whole."""
        out = []
        page = 1
        while True:
            p = dict(params)
            p.update({"per_page": 100, "page": page})
            data = self.get(path, p)
            batch = data.get(items_key, []) if items_key else data
            if not isinstance(batch, list):
                raise GitHubUnavailable(f"unexpected payload shape from {path}")
            out.extend(batch)
            if len(batch) < 100:
                return out, False
            page += 1
            if page > self.max_pages:
                return out, True


def search_login(bot_login):
    return "app/" + bot_login[: -len("[bot]")] if bot_login.endswith("[bot]") else bot_login


def collect(gh, repo, since, bot_login=BOT_LOGIN):
    """Everything the bot posted in `repo` since `since`, plus the metadata the rules
    need about each item's parent.

    Five sources, each read-only: the search API for PRs and issues the bot opened
    (with the PR's changed files and patches), the repo-wide issue-comment and
    review-comment feeds since the window start (filtered to the bot locally, because
    GitHub offers no per-author feed), and the reviews of every PR the bot reviewed in
    the window. Returns a dict with `items` (normalised), `problems` (sources that
    failed or were truncated, each a reason) and `calls`.
    """
    since_s = since.strftime("%Y-%m-%dT%H:%M:%SZ")
    since_d = since.strftime("%Y-%m-%d")
    qlogin = search_login(bot_login)
    items, problems = [], []
    owner_repo = repo.split("/")[-1]

    def parent_of(number):
        try:
            return gh.cached(f"repos/{repo}/issues/{number}")
        except GitHubUnavailable as e:
            problems.append(f"{repo}#{number}: parent unreadable: {e}")
            return None

    def norm(kind, number, url, body, created, title="", labels=None, parent=None, **extra):
        it = {
            "id": f"{owner_repo}#{number}" + ("" if kind in ("pr", "issue") else f"/{kind}"),
            "kind": kind,
            "repo": repo,
            "number": number,
            "url": url,
            "title": title or "",
            "body": body or "",
            "created_at": created,
            "labels": [str(lb.get("name") if isinstance(lb, dict) else lb).lower() for lb in (labels or [])],
            "parent": parent,
        }
        it.update(extra)
        it["coworker"] = attribute(it, bot_login)
        return it

    # Bot-opened PRs, with files.
    try:
        prs, trunc = gh.paginate(
            "search/issues",
            {"q": f"repo:{repo} is:pr author:{qlogin} created:>={since_d}"},
            items_key="items",
        )
        if trunc:
            problems.append(f"{repo}: bot PR list truncated at {gh.max_pages} pages")
        for pr in prs:
            if parse_ts(pr.get("created_at")) < since:
                continue
            files = None
            try:
                files, ftrunc = gh.paginate(f"repos/{repo}/pulls/{pr['number']}/files", {})
                if ftrunc:
                    problems.append(f"{repo}#{pr['number']}: file list truncated")
            except GitHubUnavailable as e:
                problems.append(f"{repo}#{pr['number']}: files unreadable: {e}")
            items.append(
                norm("pr", pr["number"], pr["html_url"], pr.get("body"), pr.get("created_at"), pr.get("title"), pr.get("labels"), files=files)
            )
    except GitHubUnavailable as e:
        problems.append(f"{repo}: bot PR search failed: {e}")

    # Bot-opened issues.
    try:
        issues, trunc = gh.paginate(
            "search/issues",
            {"q": f"repo:{repo} is:issue author:{qlogin} created:>={since_d}"},
            items_key="items",
        )
        if trunc:
            problems.append(f"{repo}: bot issue list truncated at {gh.max_pages} pages")
        for iss in issues:
            if parse_ts(iss.get("created_at")) < since:
                continue
            items.append(norm("issue", iss["number"], iss["html_url"], iss.get("body"), iss.get("created_at"), iss.get("title"), iss.get("labels")))
    except GitHubUnavailable as e:
        problems.append(f"{repo}: bot issue search failed: {e}")

    # Issue comments (on issues and on PRs), repo-wide feed filtered to the bot.
    try:
        comments, trunc = gh.paginate(f"repos/{repo}/issues/comments", {"since": since_s, "sort": "created", "direction": "asc"})
        if trunc:
            problems.append(f"{repo}: issue-comment feed truncated at {gh.max_pages} pages")
        for c in comments:
            if (c.get("user") or {}).get("login") != bot_login:
                continue
            number = int(str(c.get("issue_url", "")).rstrip("/").rsplit("/", 1)[-1] or 0)
            parent = parent_of(number)
            items.append(norm("issue_comment", number, c["html_url"], c.get("body"), c.get("created_at"), (parent or {}).get("title"), parent=parent))
    except GitHubUnavailable as e:
        problems.append(f"{repo}: issue-comment feed failed: {e}")

    # Review comments (inline on a diff), repo-wide feed filtered to the bot.
    try:
        rcs, trunc = gh.paginate(f"repos/{repo}/pulls/comments", {"since": since_s, "sort": "created", "direction": "asc"})
        if trunc:
            problems.append(f"{repo}: review-comment feed truncated at {gh.max_pages} pages")
        for c in rcs:
            if (c.get("user") or {}).get("login") != bot_login:
                continue
            number = int(str(c.get("pull_request_url", "")).rstrip("/").rsplit("/", 1)[-1] or 0)
            parent = parent_of(number)
            items.append(
                norm(
                    "review_comment", number, c["html_url"], c.get("body"), c.get("created_at"), (parent or {}).get("title"),
                    parent=parent, in_reply_to=bool(c.get("in_reply_to_id")),
                )
            )
    except GitHubUnavailable as e:
        problems.append(f"{repo}: review-comment feed failed: {e}")

    # Reviews (the summary body of a review), per PR the bot reviewed in the window.
    try:
        reviewed, trunc = gh.paginate(
            "search/issues",
            {"q": f"repo:{repo} is:pr reviewed-by:{qlogin} updated:>={since_d}"},
            items_key="items",
        )
        if trunc:
            problems.append(f"{repo}: reviewed-PR list truncated at {gh.max_pages} pages")
        for pr in reviewed:
            try:
                reviews, rtrunc = gh.paginate(f"repos/{repo}/pulls/{pr['number']}/reviews", {})
            except GitHubUnavailable as e:
                problems.append(f"{repo}#{pr['number']}: reviews unreadable: {e}")
                continue
            if rtrunc:
                problems.append(f"{repo}#{pr['number']}: review list truncated")
            parent = parent_of(pr["number"])
            for rv in reviews:
                if (rv.get("user") or {}).get("login") != bot_login or not (rv.get("body") or "").strip():
                    continue
                if parse_ts(rv.get("submitted_at")) < since:
                    continue
                items.append(
                    norm("review", pr["number"], rv["html_url"], rv.get("body"), rv.get("submitted_at"), pr.get("title"), parent=parent, review_state=rv.get("state"))
                )
    except GitHubUnavailable as e:
        problems.append(f"{repo}: reviewed-PR search failed: {e}")

    return {"repo": repo, "items": items, "problems": problems}


def attribute(item, bot_login=BOT_LOGIN):
    """Which coworker role posted an item. The bot signs everything with one disclaimer
    and no role marker, so attribution follows what the item is: a PR body or a reply
    on the bot's own PR is the fixer's; a review or a comment on someone else's PR is
    the reviewer's; a comment on an issue is the triager's; an issue the bot opened is
    the triager's (it files reproduced crashes). The explain-diff marker the fixer's
    skill leaves is honoured when present. Anything else is `unattributed`."""
    kind = item["kind"]
    body = item.get("body") or ""
    if "<!-- explain-diff-html" in body:
        return "fixer"
    if kind == "pr":
        return "fixer"
    if kind == "issue":
        return "triager"
    parent = item.get("parent") or {}
    # REST issue payloads carry a `pull_request` key exactly when the issue is a PR.
    parent_is_pr = "pull_request" in parent or kind in ("review", "review_comment")
    parent_author = (parent.get("user") or {}).get("login")
    if kind == "review":
        return "reviewer"
    if kind == "review_comment":
        if parent_author == bot_login and item.get("in_reply_to"):
            return "fixer"
        return "reviewer" if parent_author and parent_author != bot_login else "fixer" if parent_author == bot_login else "unattributed"
    if kind == "issue_comment":
        if not parent:
            return "unattributed"
        if not parent_is_pr:
            return "triager"
        if parent_author == bot_login:
            return "fixer"
        return "reviewer"
    return "unattributed"


# ---------- text helpers ----------


def visible_text(body):
    """A posted body without the disclaimer line and HTML comments, which are not prose
    anyone reads and which the STE checker would otherwise count."""
    text = DISCLAIMER_RE.sub("", body or "")
    return HTML_COMMENT_RE.sub("", text).strip()


def word_count(text):
    return len(re.findall(r"[A-Za-z0-9'’-]+", text))


# ---------- mechanical rules ----------


def check_pr_description(rep, items, lint):
    """R1 over bot-opened PRs with the vendored `pr_text_lint.check`. The AI line is
    R5's concern and is scored there, so it is not requested here."""
    results = []
    for it in items:
        if it["kind"] != "pr":
            continue
        problems = lint.check(it["title"], it["body"])
        if problems:
            results.append(result(it, FAIL, problems[0], problems=problems))
        else:
            results.append(result(it, PASS, "four sections within caps"))
    rep.conclude("pr-description", results)


def check_ai_disclosure(rep, items, lint):
    """R5 over bot-opened PRs: one line matching the vendored `AI_LINE_RE`."""
    results = []
    for it in items:
        if it["kind"] != "pr":
            continue
        if any(lint.AI_LINE_RE.match(ln) for ln in it["body"].split("\n")):
            results.append(result(it, PASS, "AI assistance line present"))
        else:
            results.append(result(it, FAIL, "no `AI assistance:` line"))
    rep.conclude("ai-disclosure", results)


def check_bot_label(rep, items):
    """R9 over bot-opened PRs and issues: the `bot` label is on the item now. Labels
    are read as they stand at run time, so an item labelled late still passes."""
    results = []
    for it in items:
        if it["kind"] not in ("pr", "issue"):
            continue
        if BOT_LABEL in it["labels"]:
            results.append(result(it, PASS, "labelled `bot`"))
        else:
            results.append(result(it, FAIL, f"no `{BOT_LABEL}` label (labels: {', '.join(it['labels']) or 'none'})"))
    rep.conclude("bot-label", results)


def check_issue_newcomer(rep, items, since, bot_login=BOT_LOGIN):
    """R6 over human-filed issues created in the window that the bot commented on.
    One item per issue. The bot may comment on any issue except one a newcomer label
    reserves for people, unless a maintainer also labelled it `bot-ok`, which hands the
    issue to the bot and wins. Labels are read at run time, so an issue labelled after the
    bot commented still fails; that is the intended reading, because the bot would have
    had to leave once the label appeared. Issues opened before the window are skipped
    because their first bot comment may predate the feed this run read."""
    by_issue = {}
    for it in items:
        if it["kind"] != "issue_comment" or not it.get("parent"):
            continue
        parent = it["parent"]
        if "pull_request" in parent:
            continue
        if (parent.get("user") or {}).get("login") == bot_login:
            continue
        created = parse_ts(parent.get("created_at"))
        if created is None or created < since:
            continue
        key = (it["repo"], it["number"])
        if key not in by_issue or parse_ts(it["created_at"]) < parse_ts(by_issue[key]["created_at"]):
            by_issue[key] = it
    results = []
    for (_repo, _n), it in sorted(by_issue.items()):
        parent = it["parent"]
        labels = {str(lb.get("name", "")).lower() for lb in parent.get("labels") or []}
        issue_item = dict(it, kind="issue", url=parent.get("html_url") or it["url"], title=parent.get("title") or it["title"])
        issue_item["id"] = f"{it['repo'].split('/')[-1]}#{it['number']}"
        issue_item["coworker"] = it["coworker"]
        newcomer = sorted(labels & NEWCOMER_LABELS)
        if labels & BOT_OK_LABELS:
            results.append(result(issue_item, PASS, "labelled bot-ok: a maintainer handed the issue to the bot", first_comment=it["url"]))
        elif newcomer:
            results.append(result(issue_item, FAIL, f"commented on an issue labelled {', '.join(newcomer)} (reserved for people)", first_comment=it["url"]))
        else:
            results.append(result(issue_item, PASS, "no newcomer label; the bot may comment", first_comment=it["url"]))
    rep.conclude("issue-newcomer", results)


def ste_allowance(words, per_100):
    """How many STE findings a text of `words` words may carry and still pass. The
    checker is heuristic (its sentence splitter and noun-cluster regex misfire on
    identifiers and proper nouns) and the skill ships it as report-only, so one
    finding is noise in any text; above that the allowance scales with length, because
    the rule targets the density of long sentences and filler words, not their count."""
    return max(1, math.ceil(words / 100.0 * per_100))


def check_simple_english(rep, items, ste):
    """R8 over every text item with the vendored `ste_check.check_text`."""
    per_100 = threshold("ste_max_per_100_words")
    results = []
    for it in items:
        text = visible_text(it["body"])
        if not text:
            continue
        findings = ste.check_text(text)
        words = word_count(text)
        allowed = ste_allowance(words, per_100)
        n = len(findings)
        summary = f"{n} STE finding(s) in {words} words (allowance {allowed})"
        if n > allowed:
            first = findings[0][1] if findings else ""
            results.append(result(it, FAIL, f"{summary}: {first}", findings=n, words=words, allowance=allowed, examples=[m for _, m in findings[:3]]))
        else:
            results.append(result(it, PASS, summary, findings=n, words=words, allowance=allowed))
    rep.conclude("simple-english", results)


# ---------- R10: Discord export ----------

PART_RE = re.compile(r"^\s*[(\[]?\s*(?:part\s*)?(\d{1,2})\s*/\s*(\d{1,2})\s*[)\]]?(?=\s|$|[:.\-])", re.IGNORECASE)
PART_ANYWHERE_RE = re.compile(r"\(\s*part\s+\d{1,2}\s*/\s*\d{1,2}\s*\)", re.IGNORECASE)


def load_discord_export(path):
    """One JSON object per line, the shape the README defines. A line that does not
    parse is an error for the whole export, because a partial read would score a
    sample as if it were the week."""
    posts = []
    with open(path, encoding="utf-8") as fh:
        for n, line in enumerate(fh, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except ValueError as e:
                raise ValueError(f"line {n}: {e}") from e
            for needed in ("id", "channel_id", "channel_type", "created_at", "content"):
                if needed not in obj:
                    raise ValueError(f"line {n}: missing `{needed}`")
            posts.append(obj)
    return posts


def check_discord(rep, export_path, since):
    """R10 from a JSONL export of the bot's Discord posts. Two findings: a post whose
    first line is a `(part k/N)` or `k/N` counter, and a top-level post on a text
    channel that follows another top-level post in the same channel within the window,
    which should have gone into that post's thread. Without an export the rule is
    UNKNOWN: prod keeps no store of sent posts and this tool does not talk to Discord."""
    if not export_path:
        rep.unknown("discord-thread", "no Discord export", "no export given (--discord-export / COMPLIANCE_DISCORD_EXPORT); the task exports the bot's posts with the Discord read tool first, this script never queries Discord")
        return
    try:
        posts = load_discord_export(export_path)
    except (OSError, ValueError) as e:
        rep.unknown("discord-thread", f"Discord export unreadable: {e}", "unreadable")
        return
    window = dt.timedelta(minutes=threshold("discord_thread_window_min"))
    posts = [p for p in posts if parse_ts(p["created_at"]) is not None and parse_ts(p["created_at"]) >= since]
    posts.sort(key=lambda p: parse_ts(p["created_at"]))
    results = []
    last_top_level = {}
    for p in posts:
        item = {
            "id": f"discord:{p['id']}",
            "kind": "discord_post",
            "repo": "discord",
            "url": p.get("url") or f"discord://{p['channel_id']}/{p['id']}",
            "title": (p.get("content") or "").strip().split("\n", 1)[0][:80],
            "coworker": p.get("coworker") or "maintainer",
        }
        content = p.get("content") or ""
        first_line = content.strip().split("\n", 1)[0]
        is_top_level = not p.get("thread_id") and p.get("channel_type") == "text"
        if PART_RE.match(first_line) or PART_ANYWHERE_RE.search(first_line):
            results.append(result(item, FAIL, f"numbered part: {first_line[:60]!r}"))
        elif is_top_level and p["channel_id"] in last_top_level and parse_ts(p["created_at"]) - parse_ts(last_top_level[p["channel_id"]]["created_at"]) <= window:
            prev = last_top_level[p["channel_id"]]
            results.append(result(item, FAIL, f"top-level follow-up {int((parse_ts(p['created_at']) - parse_ts(prev['created_at'])).total_seconds() // 60)} min after post {prev['id']}; it belongs in that post's thread"))
        else:
            results.append(result(item, PASS, "in a thread" if p.get("thread_id") else "one post per topic"))
        if is_top_level:
            last_top_level[p["channel_id"]] = p
    rep.conclude("discord-thread", results)


# ---------- judge rules ----------

COMMENT_EXTS_SLASH = (".c", ".cc", ".cpp", ".cxx", ".h", ".hpp", ".slang", ".hlsl", ".glsl", ".metal", ".wgsl", ".cu", ".ts", ".js", ".mjs", ".rs", ".java", ".cs", ".lua")
COMMENT_EXTS_HASH = (".py", ".sh", ".bash", ".cmake", ".yml", ".yaml", ".toml", ".txt", ".capdef")
BEHAVIOUR_PREFIXES = ("source/", "src/", "include/", "prelude/", "slangpy/", "lib/", "container/", "scripts/")
DOCS_HINTS = ("docs/", "readme", ".md", "changelog")
EXCERPT_CAP = 6000


def added_comment_excerpts(files):
    """For each changed file, the added lines that are comments, with two lines of
    patch context either side so the judge can tell a contract from narration.
    Comment syntax follows the extension; `#` lines count only for languages where
    `#` is not a preprocessor directive. Returns a list of (filename, excerpt)."""
    out = []
    for f in files or []:
        name = f.get("filename") or ""
        patch = f.get("patch") or ""
        lower = name.lower()
        if lower.endswith(COMMENT_EXTS_SLASH):
            def is_comment(s):
                return s.lstrip().startswith(("//", "/*", "*", "*/"))
        elif lower.endswith(COMMENT_EXTS_HASH) or lower.endswith("cmakelists.txt"):
            def is_comment(s):
                return s.lstrip().startswith("#") and not s.lstrip().startswith("#!")
        else:
            continue
        lines = patch.split("\n")
        keep = set()
        for i, ln in enumerate(lines):
            if ln.startswith("+") and not ln.startswith("+++") and is_comment(ln[1:]):
                keep.update(range(max(0, i - 2), min(len(lines), i + 3)))
        if not keep:
            continue
        excerpt, prev = [], -2
        for i in sorted(keep):
            if i != prev + 1:
                excerpt.append("...")
            excerpt.append(lines[i])
            prev = i
        out.append((name, "\n".join(excerpt)))
    return out


def docs_touched(files):
    return any(any(h in (f.get("filename") or "").lower() for h in DOCS_HINTS) for f in files or [])


def behaviour_touched(files):
    return any((f.get("filename") or "").startswith(BEHAVIOUR_PREFIXES) and not (f.get("filename") or "").endswith((".md", ".test.ts")) for f in files or [])


def judge_items(items):
    """Which bot PRs each judge rule reads, with the rendered material. R2/R3 reads PRs
    whose diff adds comment lines; R7 reads PRs that change behaviour files without
    touching documentation (one that touches docs passes without a judge)."""
    rationale, docs, docs_pass = [], [], []
    for it in items:
        if it["kind"] != "pr":
            continue
        if it.get("files") is None:
            continue
        excerpts = added_comment_excerpts(it["files"])
        if excerpts:
            text = "\n\n".join(f"--- {name}\n{ex}" for name, ex in excerpts)
            truncated = len(text) > EXCERPT_CAP
            rationale.append((it, {"title": it["title"], "url": it["url"], "comments": text[:EXCERPT_CAP], "truncated": truncated}))
        if behaviour_touched(it["files"]):
            if docs_touched(it["files"]):
                docs_pass.append(it)
            else:
                names = [f.get("filename") for f in it["files"]]
                docs.append((it, {"title": it["title"], "url": it["url"], "body": visible_text(it["body"])[:4000], "files": names[:200]}))
    return rationale, docs, docs_pass


RUBRICS = {
    "comment-rationale": (
        "You are reviewing code comments added by a pull request against this rule of the "
        "Slang contributor standard: a comment states a contract, a reason or an invariant "
        "(the why). It never narrates what the adjacent code does, never records the history "
        "of the change or a review thread (no 'fixed per review', 'previously this did X', "
        "'this PR adds'), and never explains basic language features. Judge the set of added "
        "comments shown as a whole: fail if a substantial share narrate mechanics or carry "
        "process history, pass otherwise. Identifiers, license headers and test-expectation "
        "lines (such as CHECK: lines) are not comments for this purpose."
    ),
    "docs-updated": (
        "You are judging a pull request against this rule of the Slang contributor standard: "
        "when a change alters behaviour that users or operators see (a language feature, a "
        "compiler option, a diagnostic's meaning, a tool's command line, a config variable, a "
        "runtime default), the documentation that describes that behaviour is updated in the "
        "same PR. A pure bug fix that restores documented behaviour, a refactor, a "
        "performance change or test-only work needs no doc change and passes. The PR did not "
        "touch any documentation file. From the description and the file list, decide whether "
        "it should have."
    ),
}
JUDGE_FORMAT = (
    'Answer with one JSON object and nothing else: {"verdict": "pass" or "fail", '
    '"reason": "<one sentence>"}.'
)


class Judge:
    """One verdict per (rule, item). Implementations return `{"verdict": pass|fail|unknown,
    "reason": str}` and never raise for a model-side failure, because an item the judge
    could not decide is `unknown` on that item, not a crash of the run."""

    name = "abstract"

    def judge(self, rule, item):
        raise NotImplementedError

    def describe(self):
        return {"impl": self.name}


class NullJudge(Judge):
    """No usable model endpoint: every judge rule stays UNKNOWN with the reason the
    environment gave (no base URL, or no credential). It is deliberately not a pass."""

    name = "null"

    def __init__(self, reason="no judge credentials"):
        self.reason = reason

    def describe(self):
        return {"impl": self.name, "reason": self.reason}

    def judge(self, rule, item):
        return {"verdict": UNJUDGED, "reason": self.reason}


def make_opener(env=None):
    """An opener that goes through HTTPS_PROXY (urllib's ProxyHandler reads the proxy
    variables from the environment and tunnels https with CONNECT) and trusts the CA
    bundle in SSL_CERT_FILE when one is set. The coworker container reaches the model
    gateway only through the OneCLI proxy with its own CA, so both matter there."""
    env = os.environ if env is None else env
    proxies = {}
    for scheme in ("https", "http"):
        value = env.get(scheme.upper() + "_PROXY") or env.get(scheme + "_proxy")
        if value:
            proxies[scheme] = value
    handlers = [urllib.request.ProxyHandler(proxies)] if proxies else []
    cafile = env.get("SSL_CERT_FILE")
    if cafile:
        handlers.append(urllib.request.HTTPSHandler(context=ssl.create_default_context(cafile=cafile)))
    return urllib.request.build_opener(*handlers)


def _urllib_transport(url, headers, body, timeout):
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with make_opener().open(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


class AnthropicMessagesJudge(Judge):
    """POST /v1/messages with a per-rule rubric and a budget. `transport(url, headers,
    body_bytes, timeout) -> (status, text)` is injectable so the tests never reach a
    network. 429 and 5xx are retried with backoff; anything else, or a reply that is
    not the requested JSON, makes that item `unknown`."""

    name = "anthropic-messages"
    DEFAULT_MODEL = "claude-opus-5-5"

    def __init__(self, base_url, token=None, api_key=None, model=None, max_items=None, transport=None, sleep=time.sleep, retries=3, timeout=120):
        if not base_url:
            raise ValueError("AnthropicMessagesJudge needs a base URL")
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.api_key = api_key
        self.model = model or self.DEFAULT_MODEL
        self.max_items = threshold("judge_max_items") if max_items is None else max_items
        self.transport = transport or _urllib_transport
        self.sleep = sleep
        self.retries = retries
        self.timeout = timeout
        self.used = 0
        self.failures = 0

    def describe(self):
        return {"impl": self.name, "endpoint": self.base_url, "model": self.model, "budget": self.max_items, "used": self.used, "transport_failures": self.failures}

    def headers(self):
        h = {"content-type": "application/json", "anthropic-version": "2023-06-01"}
        if self.token:
            h["authorization"] = f"Bearer {self.token}"
        elif self.api_key:
            h["x-api-key"] = self.api_key
        return h

    def judge(self, rule, item):
        if rule not in RUBRICS:
            return {"verdict": UNJUDGED, "reason": f"no rubric for {rule}"}
        if self.used >= self.max_items:
            return {"verdict": UNJUDGED, "reason": f"judge budget exhausted ({self.max_items} items; COMPLIANCE_JUDGE_MAX_ITEMS)"}
        self.used += 1
        payload = {
            "model": self.model,
            "max_tokens": 400,
            "system": RUBRICS[rule] + " " + JUDGE_FORMAT,
            "messages": [{"role": "user", "content": json.dumps(item, ensure_ascii=False, indent=1)}],
        }
        body = json.dumps(payload).encode("utf-8")
        last = None
        for attempt in range(self.retries + 1):
            try:
                status, text = self.transport(self.base_url + "/v1/messages", self.headers(), body, self.timeout)
            except (OSError, urllib.error.URLError) as e:
                status, text = None, f"{type(e).__name__}: {e}"
            if status == 200:
                return self.parse(text)
            last = f"HTTP {status}: {text[:200]}" if status else text
            if status is not None and not (status == 429 or status >= 500):
                break
            if attempt < self.retries:
                self.sleep(min(30, 2**attempt))
        self.failures += 1
        return {"verdict": UNJUDGED, "reason": f"judge request failed: {last}"}

    @staticmethod
    def parse(text):
        try:
            data = json.loads(text)
        except ValueError:
            return {"verdict": UNJUDGED, "reason": "judge returned non-JSON"}
        if data.get("stop_reason") == "refusal":
            return {"verdict": UNJUDGED, "reason": "judge refused the request"}
        out = "".join(b.get("text", "") for b in data.get("content") or [] if b.get("type") == "text")
        m = re.search(r"\{.*\}", out, re.DOTALL)
        if not m:
            return {"verdict": UNJUDGED, "reason": f"judge reply had no JSON verdict: {out[:120]!r}"}
        try:
            v = json.loads(m.group(0))
        except ValueError:
            return {"verdict": UNJUDGED, "reason": "judge verdict was not valid JSON"}
        verdict = str(v.get("verdict", "")).lower()
        if verdict not in (PASS, FAIL):
            return {"verdict": UNJUDGED, "reason": f"judge verdict {verdict!r} is neither pass nor fail"}
        return {"verdict": verdict, "reason": str(v.get("reason") or "").strip().split("\n")[0][:300] or "(no reason given)"}


def judge_from_env(env=None, transport=None):
    """The configured judge, from the container's environment.

    ANTHROPIC_BASE_URL names the gateway and is required: there is no default endpoint,
    because inside the container the only reachable model service is the one the host
    configured. ANTHROPIC_AUTH_TOKEN is sent as a Bearer token even when it is the
    gateway's placeholder, since the OneCLI gateway replaces it with the real credential
    on the way out; ANTHROPIC_API_KEY is the fallback header. The model is the first of
    COMPLIANCE_JUDGE_MODEL, ANTHROPIC_DEFAULT_OPUS_MODEL, ANTHROPIC_MODEL, then the
    built-in default. Without a base URL or any credential the NullJudge runs and the
    judge rules are UNKNOWN with that reason."""
    env = os.environ if env is None else env
    base = env.get("ANTHROPIC_BASE_URL") or None
    token = env.get("ANTHROPIC_AUTH_TOKEN") or None
    key = env.get("ANTHROPIC_API_KEY") or None
    if not base:
        return NullJudge("no judge endpoint (ANTHROPIC_BASE_URL unset)")
    if not token and not key:
        return NullJudge("no judge credentials (ANTHROPIC_AUTH_TOKEN/ANTHROPIC_API_KEY unset)")
    model = env.get("COMPLIANCE_JUDGE_MODEL") or env.get("ANTHROPIC_DEFAULT_OPUS_MODEL") or env.get("ANTHROPIC_MODEL") or None
    return AnthropicMessagesJudge(base, token=token, api_key=key, model=model, transport=transport)


def check_judge_rules(rep, items, judge):
    rationale, docs, docs_pass = judge_items(items)
    results = []
    for it, material in rationale:
        v = judge.judge("comment-rationale", material)
        results.append(result(it, v["verdict"], v["reason"], judged_by=judge.name))
    rep.conclude("comment-rationale", results)
    results = [result(it, PASS, "documentation files changed in the PR", judged_by="mechanical") for it in docs_pass]
    for it, material in docs:
        v = judge.judge("docs-updated", material)
        results.append(result(it, v["verdict"], v["reason"], judged_by=judge.name))
    rep.conclude("docs-updated", results)


# ---------- orchestration ----------


def run_all(rep, gh, repos, since, judge, discord_export=None, bot_login=BOT_LOGIN):
    """Collect, then score every rule, containing failures: an exception inside a rule
    becomes that rule's UNKNOWN, so one broken source cannot blank the rest."""
    items, problems = [], []
    for repo in repos:
        try:
            col = collect(gh, repo, since, bot_login)
        except Exception as e:  # noqa: BLE001 — the fail-closed net for a whole repo
            problems.append(f"{repo}: collection raised {type(e).__name__}: {e}")
            continue
        items.extend(col["items"])
        problems.extend(col["problems"])

    def guarded(check, fn):
        try:
            fn()
        except Exception as e:  # noqa: BLE001 — a rule that raises surfaces as UNKNOWN, never as a missing row
            if not any(r["check"] == check for r in rep.rules):
                rep.unknown(check, f"check raised {type(e).__name__}: {e}", "check-errored")

    try:
        lint = load_vendored("pr_text_lint")
    except VendorMissing as e:
        lint = None
        for check in ("pr-description", "ai-disclosure"):
            rep.unknown(check, str(e), "missing-input")
    try:
        ste = load_vendored("ste_check")
    except VendorMissing as e:
        ste = None
        rep.unknown("simple-english", str(e), "missing-input")

    if lint is not None:
        guarded("pr-description", lambda: check_pr_description(rep, items, lint))
    guarded("comment-rationale", lambda: check_judge_rules(rep, items, judge))
    if lint is not None:
        guarded("ai-disclosure", lambda: check_ai_disclosure(rep, items, lint))
    guarded("issue-newcomer", lambda: check_issue_newcomer(rep, items, since, bot_login))
    if ste is not None:
        guarded("simple-english", lambda: check_simple_english(rep, items, ste))
    guarded("bot-label", lambda: check_bot_label(rep, items))
    guarded("discord-thread", lambda: check_discord(rep, discord_export, since))

    # A collection problem means some GitHub rule scored a subset. Every GitHub-backed
    # rule that is not already DRIFT is downgraded to UNKNOWN, because its OK would
    # describe only the items that were read.
    if problems:
        why = f"{len(problems)} source problem(s): {'; '.join(problems[:3])}"
        for r in rep.rules:
            if r["check"] != "discord-thread" and r["state"] == OK:
                r["state"] = UNKNOWN
                r["reason"] = why
                r["summary"] = f"{r['summary']}; incomplete: {why}"
    # Rules are reported in the standard's order regardless of scoring order.
    order = {r["check"]: i for i, r in enumerate(RULES)}
    rep.rules.sort(key=lambda r: order[r["check"]])
    return items, problems


def build_document(rep, started, since, repos, items, problems, judge, gh, bot_login=BOT_LOGIN):
    failures = rep.failures()
    unknown = rep.of(UNKNOWN)
    status = "findings" if failures else ("unknown" if unknown else "clean")
    code = 1 if failures else (2 if unknown else 0)
    per_rule, matrix = {}, {}
    for r in rep.rules:
        counts = {"pass": 0, "fail": 0, "unknown": 0, "total": 0}
        for x in r["results"]:
            counts[x["verdict"]] += 1
            counts["total"] += 1
            cw = matrix.setdefault(x["coworker"], {}).setdefault(r["check"], {"pass": 0, "fail": 0, "unknown": 0, "total": 0})
            cw[x["verdict"]] += 1
            cw["total"] += 1
        counts["rate"] = round(counts["pass"] / counts["total"], 4) if counts["total"] else None
        per_rule[r["check"]] = counts
    by_kind, by_coworker = {}, {}
    for it in items:
        by_kind[it["kind"]] = by_kind.get(it["kind"], 0) + 1
        by_coworker[it["coworker"]] = by_coworker.get(it["coworker"], 0) + 1
    return {
        "schema": SCHEMA,
        "generatedAt": utcnow().isoformat(timespec="seconds"),
        "durationMs": int((time.time() - started) * 1000),
        "since": since.isoformat(timespec="seconds"),
        "repos": list(repos),
        "bot": bot_login,
        "status": status,
        # False = at least one rule could not be scored; no findings is not compliance
        # when this is false.
        "complete": not unknown,
        "exitCode": code,
        "thresholds": {k: threshold(k) for k in THRESHOLDS},
        "counts": {
            "ok": len(rep.of(OK)),
            "drift": len(rep.of(DRIFT)),
            "unknown": len(unknown),
            "findings": len(failures),
            "items": len(items),
            "itemsByKind": by_kind,
            "itemsByCoworker": by_coworker,
            "perRule": per_rule,
        },
        "coworkers": matrix,
        "judge": judge.describe(),
        "github": {"calls": gh.calls, "problems": problems},
        "rules": rep.rules,
    }


# ---------- output ----------


def write_atomic(path, text):
    """Temp file, fsync, rename. The metrics collector and the dashboard read these
    files on their own schedule; a half-written file would parse as corrupt exactly
    when it is read."""
    d = os.path.dirname(os.path.abspath(path))
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".compliance-check.", suffix=".tmp")
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


def previous_run(out_dir, today):
    """The newest `runs/<date>.json` dated before `today`, so a rerun on the same day
    compares against the last distinct run, not against itself."""
    runs = os.path.join(out_dir, "runs")
    if not os.path.isdir(runs):
        return None
    names = sorted(n for n in os.listdir(runs) if n.endswith(".json") and n[:-5] < today)
    for name in reversed(names):
        try:
            with open(os.path.join(runs, name), encoding="utf-8") as fh:
                return json.load(fh)
        except (OSError, ValueError):
            continue
    return None


def write_report(doc, out_dir):
    today = doc["generatedAt"][:10]
    prev = previous_run(out_dir, today)
    write_atomic(os.path.join(out_dir, "latest.json"), json.dumps(doc, indent=1) + "\n")
    write_atomic(os.path.join(out_dir, "runs", f"{today}.json"), json.dumps(doc, indent=1) + "\n")
    write_atomic(os.path.join(out_dir, "latest.html"), render_html(doc, prev))
    c = doc["counts"]
    line = (
        f"{doc['generatedAt']} status={doc['status']} findings={c['findings']} unknown={c['unknown']} "
        f"items={c['items']} exit={doc['exitCode']}\n"
    )
    with open(os.path.join(out_dir, "history.log"), "a", encoding="utf-8") as fh:
        fh.write(line)


def pct(rate):
    return "—" if rate is None else f"{round(rate * 100)}%"


def render_html(doc, prev=None):
    """A self-contained page: no scripts, no external resources, colours from
    `prefers-color-scheme`. Everything from the data goes through html.escape."""
    e = html.escape
    c = doc["counts"]
    prev_rates = {k: v.get("rate") for k, v in ((prev or {}).get("counts", {}).get("perRule") or {}).items()}
    coworkers = [cw for cw in COWORKERS if cw in doc["coworkers"]] + sorted(cw for cw in doc["coworkers"] if cw not in COWORKERS)
    rows = []
    for r in doc["rules"]:
        pr = c["perRule"].get(r["check"], {})
        cur, before = pr.get("rate"), prev_rates.get(r["check"])
        trend = f"{pct(before)} → {pct(cur)}" if prev is not None else pct(cur)
        cells = "".join(
            f"<td class='num'>{m['pass']}/{m['total']}<small> {pct(m['pass'] / m['total'] if m['total'] else None)}</small></td>"
            if (m := doc["coworkers"].get(cw, {}).get(r["check"])) else "<td class='num muted'>—</td>"
            for cw in coworkers
        )
        rows.append(
            f"<tr><td><b>{e(r['rule'])}</b> <span class='muted'>{e(r['check'])}</span><br><small>{e(r['title'])}</small></td>"
            f"<td><span class='state {e(r['state'].lower())}'>{e(r['state'])}</span></td>"
            f"<td class='num'>{pr.get('pass', 0)}/{pr.get('total', 0)}</td><td class='num'>{e(trend)}</td>{cells}</tr>"
        )
    worst = []
    for r in doc["rules"]:
        fails = [x for x in r["results"] if x["verdict"] == FAIL][:10]
        if not fails:
            continue
        lis = "".join(
            f"<li><a href='{e(x['url'])}'>{e(x['id'])}</a> <span class='muted'>{e(x['kind'])} · {e(x['coworker'])}</span>"
            f"<br>{e(x['reason'])}</li>"
            for x in fails
        )
        worst.append(f"<h3>{e(r['rule'])} {e(r['check'])}</h3><ol>{lis}</ol>")
    unknowns = [
        f"<li><b>{e(r['rule'])} {e(r['check'])}</b>: {e(r.get('reason') or r['summary'])}</li>"
        for r in doc["rules"]
        if r["state"] == UNKNOWN
    ]
    problems = "".join(f"<li>{e(p)}</li>" for p in doc["github"]["problems"][:20])
    kinds = ", ".join(f"{e(k)} {v}" for k, v in sorted(c["itemsByKind"].items()))
    cws = ", ".join(f"{e(k)} {v}" for k, v in sorted(c["itemsByCoworker"].items()))
    judge = doc.get("judge", {})
    judge_s = ", ".join(f"{e(str(k))}={e(str(v))}" for k, v in judge.items())
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Compliance check — {e(doc['status'].upper())}</title>
<style>
:root {{ --bg:#fff; --fg:#1b1f23; --muted:#6a737d; --line:#e1e4e8; --ok:#22863a; --drift:#b31d28; --unk:#b08800; --card:#f6f8fa; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#0d1117; --fg:#c9d1d9; --muted:#8b949e; --line:#30363d; --ok:#3fb950; --drift:#f85149; --unk:#d29922; --card:#161b22; }} }}
body {{ margin:0 auto; max-width:1100px; padding:16px; font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:var(--bg); color:var(--fg); }}
a {{ color:inherit; }} h1 {{ margin:.2em 0; }} h2 {{ margin-top:1.6em; border-bottom:1px solid var(--line); padding-bottom:.2em; }}
table {{ border-collapse:collapse; width:100%; font-size:14px; }} th,td {{ border-bottom:1px solid var(--line); padding:6px 8px; text-align:left; vertical-align:top; }}
th {{ background:var(--card); position:sticky; top:0; }} td.num {{ text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }}
.muted {{ color:var(--muted); }} small {{ color:var(--muted); }}
.state {{ font-weight:600; padding:1px 6px; border-radius:4px; color:#fff; }} .ok {{ background:var(--ok); }} .drift {{ background:var(--drift); }} .unknown {{ background:var(--unk); }}
.cards {{ display:flex; flex-wrap:wrap; gap:12px; margin:12px 0; }} .card {{ background:var(--card); border:1px solid var(--line); border-radius:6px; padding:10px 14px; min-width:120px; }}
.card b {{ font-size:22px; display:block; }} ol li {{ margin:6px 0; }} .wrap {{ overflow-x:auto; }}
</style></head><body>
<h1>Contributor AI Standard — compliance check: <span class="state {e(doc['status'] if doc['status'] != 'findings' else 'drift')}">{e(doc['status'].upper())}</span></h1>
<p class="muted">Generated {e(doc['generatedAt'])} · window since {e(doc['since'][:10])} · repos {e(', '.join(doc['repos']))} · bot <code>{e(doc['bot'])}</code>{' · previous run ' + e(prev['generatedAt'][:10]) if prev else ''}</p>
<div class="cards">
<div class="card"><b>{c['items']}</b>items scored</div>
<div class="card"><b>{c['findings']}</b>failing items</div>
<div class="card"><b>{c['ok']}</b>rules OK</div>
<div class="card"><b>{c['drift']}</b>rules DRIFT</div>
<div class="card"><b>{c['unknown']}</b>rules UNKNOWN</div>
</div>
<p class="muted">Items by kind: {kinds or 'none'}. Items by coworker: {cws or 'none'}. Judge: {judge_s}. GitHub reads: {doc['github']['calls']}.</p>
<h2>Pass rate per rule and coworker</h2>
<div class="wrap"><table><thead><tr><th>Rule</th><th>State</th><th>Pass / total</th><th>Previous → current</th>{''.join(f'<th>{e(cw)}</th>' for cw in coworkers)}</tr></thead>
<tbody>{''.join(rows)}</tbody></table></div>
<p class="muted">Each cell is passing items / scored items for that coworker. The trend column compares this run's overall pass rate with the previous run in <code>runs/</code>.</p>
{'<h2>UNKNOWN — rules that could not be scored</h2><ul>' + ''.join(unknowns) + '</ul><p>UNKNOWN means the rule could not be scored. That is not a pass.</p>' if unknowns else ''}
{'<h2>Worst items per rule</h2>' + ''.join(worst) if worst else '<h2>Worst items per rule</h2><p>No failing items.</p>'}
{'<h2>Source problems</h2><ul>' + problems + '</ul>' if problems else ''}
</body></html>
"""


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--since-days", type=int, default=DEFAULT_SINCE_DAYS, help=f"window length in days (default {DEFAULT_SINCE_DAYS})")
    ap.add_argument("--repos", default=",".join(DEFAULT_REPOS), help="comma-separated owner/repo list")
    ap.add_argument("--bot", default=BOT_LOGIN, help=f"bot login as REST reports it (default {BOT_LOGIN})")
    ap.add_argument("--quiet", action="store_true", help="print only non-OK rules plus the summary")
    ap.add_argument("--no-report", action="store_true", help="skip writing latest.json/latest.html/runs/history.log")
    ap.add_argument("--out", default=None, help=f"report directory (default {OUT_DIR})")
    ap.add_argument("--discord-export", default=None, help="JSONL export of the bot's Discord posts for R10 (default $COMPLIANCE_DISCORD_EXPORT)")
    args = ap.parse_args(argv)

    started = time.time()
    since = utcnow() - dt.timedelta(days=args.since_days)
    repos = [r.strip() for r in args.repos.split(",") if r.strip()]
    rep = Report()
    gh = GitHub()
    judge = judge_from_env()
    discord_export = args.discord_export or os.environ.get("COMPLIANCE_DISCORD_EXPORT") or None
    items, problems = run_all(rep, gh, repos, since, judge, discord_export, args.bot)
    doc = build_document(rep, started, since, repos, items, problems, judge, gh, args.bot)
    code = doc["exitCode"]

    if not args.no_report:
        out_dir = args.out or OUT_DIR
        try:
            write_report(doc, out_dir)
        except (OSError, TypeError, ValueError) as e:
            print(f"ERROR: could not write report to {out_dir}: {type(e).__name__}: {e}", file=sys.stderr)
            code = max(code, 2)

    for r in rep.rules:
        if args.quiet and r["state"] == OK:
            continue
        print(f"{r['state']:<8}{r['rule']:<6}{r['check']:<20}{r['summary']}")
        for x in r["results"]:
            if x["verdict"] == FAIL and not args.quiet:
                print(f"        - {x['id']} ({x['coworker']}): {x['reason']}")
    c = doc["counts"]
    print(
        f"compliance-check: {doc['status'].upper()} — {c['items']} items, {c['findings']} failing, "
        f"{c['ok']} ok, {c['drift']} drift, {c['unknown']} unknown (exit {code})"
    )
    if c["unknown"]:
        print("UNKNOWN means the rule could not be scored. That is not a pass — fix the cause or this tool is blind to that rule.")
    return code


if __name__ == "__main__":
    sys.exit(main())
