"""Evidence of what a pull request set out to do, for judging a perf cost.

A compile-time cost is only a defect if it is not a consequence of what the change
was for. Deciding that takes the PR's stated purpose, what kind of change it is,
what the author and reviewers already said about performance, and the issues it
resolves. This module collects those as bounded, structured excerpts. It does not
judge: classification is the analyst's, and it must quote this evidence.

Everything returned from a PR is untrusted text. It is capped in size and meant to
be read as data. Nothing here follows, evaluates or executes it.

Two limits shrink what an outsider can put in front of the analyst:

  * Only MERGED pull requests are read. The analysis runs on commits already on
    master, so open and fork PRs never reach it.
  * "Merged" means the code was reviewed, not that the text around it is
    trustworthy: anyone can comment on a merged PR, even after the merge, and anyone
    can file an issue a PR then links. So comments, reviews and linked-issue bodies
    are read only from the PR's author and from people with a trusted
    `author_association` (maintainers, by default). The count of what was ignored is
    reported, so a reader can see that text was withheld and why.

Run only after bisect and parent verification identify the responsible PR:
    python3 intent.py --pr <number> --policy <policy.json> --out <intent.json>

Stdlib only, and independent of the perf suite, so its tests run anywhere.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

MAX_PURPOSE = 700
MAX_MENTION = 260
MAX_MENTIONS = 8
MAX_LINKED = 4
MAX_COMMENT_PAGES = 1  # one page of 100 per comment source: enough, and bounded

# GitHub's `author_association` values whose text is read besides the PR author's.
# Policy (`trust.intent_text_associations`) can narrow or widen this.
DEFAULT_TRUSTED = ("OWNER", "MEMBER", "COLLABORATOR")

# Sentences that talk about cost. Deliberately broad: the reader filters.
PERF_TERMS = re.compile(
    r"\b(perf(?:ormance)?|slow(?:er|down|ing)?|overhead|trade-?offs?|"
    r"compile[- ]times?|latency|allocat(?:e|es|ed|ion|ions)|cach(?:e|es|ed|ing)|hot[- ]path|"
    r"O\([a-z0-9 ^*]+\)|memory|bytes|footprint|startup|faster|speed)\b"
    # "regression" alone mostly means "regression test"; it counts only beside a cost word.
    r"|\b(?:perf(?:ormance)?|compile[- ]time|speed|latency|memory|startup|throughput)"
    r"\s+(?:regress(?:ion|ions|ed)?|impact|cost|hit|penalty)\b"
    r"|\b(?:regress(?:ion|ed|es)?|degrad(?:e|es|ed|ation))\s+(?:in\s+)?"
    r"(?:perf(?:ormance)?|compile[- ]time|speed|latency|memory|startup)\b", re.IGNORECASE)

# Phrases that say the author knew about a cost and accepted it. A subset of the
# above; a hit means "acknowledged", not "justified".
ACKNOWLEDGED = re.compile(
    r"(trade-?off|expected (?:cost|overhead|slowdown|increase)|"
    r"(?:slightly|marginally|somewhat) (?:slower|higher|larger|more)|"
    r"(?:small|minor|modest) (?:increase|overhead|cost|slowdown|regression)|"
    r"at the cost of|accept(?:s|ed|ing|able)? .{0,30}(?:cost|overhead|slowdown)|"
    r"increases? .{0,40}(?:time|ms|%|latency|memory)|known (?:cost|overhead|regression))", re.IGNORECASE)

PURPOSE_HEADINGS = re.compile(r"^#{1,4}\s*(motivation|summary|why|background|problem|purpose)\b", re.IGNORECASE)
HEADING = re.compile(r"^#{1,4}\s")
LINK = re.compile(r"\b(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?|implements?|related to|part of)\s+"
                  r"(?:[\w.-]+/[\w.-]+)?#(\d+)", re.IGNORECASE)

# Label text that tells what kind of change this is. First match wins.
KIND_RULES = [
    ("breaking", re.compile(r"(?<!non-)(?<!non )breaking", re.IGNORECASE)),
    ("feature", re.compile(r"new feature|feature|enhancement", re.IGNORECASE)),
    ("fix", re.compile(r"\bbug\b|\bfix\b|regression fix", re.IGNORECASE)),
    ("refactor", re.compile(r"refactor|cleanup|clean-up|chore", re.IGNORECASE)),
    ("docs-tests", re.compile(r"\bdocs?\b|documentation|\btests?\b|\bci\b", re.IGNORECASE)),
]
TITLE_KIND_RULES = [
    ("fix", re.compile(r"^\s*fix\b|\bfix(?:es)?\s+#\d+", re.IGNORECASE)),
    ("feature", re.compile(r"^\s*(?:add|support|implement|introduce|enable|allow)\b", re.IGNORECASE)),
    ("refactor", re.compile(r"^\s*(?:refactor|clean ?up|move|rename|simplify|remove)\b", re.IGNORECASE)),
]


def sentences(text):
    """Split prose into sentences well enough to excerpt; code fences are dropped."""
    text = re.sub(r"```.*?```", " ", text or "", flags=re.DOTALL)
    text = re.sub(r"`[^`]*`", lambda m: m.group(0).strip("`"), text)
    out = []
    for line in re.split(r"\n+", text):
        line = re.sub(r"^\s*(?:[-*+]|\d+\.)\s+", "", line).strip()
        if not line or HEADING.match(line) or line.startswith("|"):
            continue
        out.extend(s.strip() for s in re.split(r"(?<=[.!?])\s+", line) if s.strip())
    return out


def trim(text, limit):
    text = " ".join(text.split())
    return text if len(text) <= limit else text[:limit - 3].rstrip() + "..."


def purpose_of(body):
    """The author's own statement of why: the first purpose-like section, else the
    first paragraph. Excerpted, never paraphrased."""
    lines = (body or "").splitlines()
    for i, line in enumerate(lines):
        if PURPOSE_HEADINGS.match(line.strip()):
            chunk = []
            for nxt in lines[i + 1:]:
                if HEADING.match(nxt.strip()):
                    break
                chunk.append(nxt)
            text = " ".join(" ".join(sentences("\n".join(chunk))).split())
            if text:
                return trim(text, MAX_PURPOSE)
    paragraphs = [p for p in re.split(r"\n\s*\n", body or "") if sentences(p)]
    return trim(" ".join(sentences(paragraphs[0])), MAX_PURPOSE) if paragraphs else ""


def kind_of(title, labels):
    for kind, rx in KIND_RULES:
        if any(rx.search(l) for l in labels):
            return kind
    for kind, rx in TITLE_KIND_RULES:
        if rx.search(title or ""):
            return kind
    return "unknown"


def perf_mentions(source, text):
    """Sentences about cost from one text, tagged with where they came from."""
    found = []
    for s in sentences(text):
        if PERF_TERMS.search(s):
            found.append({"source": source, "text": trim(s, MAX_MENTION),
                          "acknowledges_cost": bool(ACKNOWLEDGED.search(s))})
    return found


def linked_issue_numbers(body):
    seen, out = set(), []
    for m in LINK.finditer(body or ""):
        n = int(m.group(1))
        if n not in seen:
            seen.add(n)
            out.append(n)
    return out[:MAX_LINKED]


def _json(gh, path):
    data = json.loads(gh.get(path))
    if isinstance(data, dict) and "message" in data and "id" not in data and "number" not in data:
        raise ValueError(data["message"])  # a gh error body that exited zero
    return data


class NotMerged(ValueError):
    """The PR is not merged. The analysis is defined on merged commits only."""


def collect_intent(gh, number, trusted=DEFAULT_TRUSTED):
    """Structured intent evidence for one merged PR. Raises on a failed fetch of the
    PR itself and NotMerged for a PR that is not merged; the secondary sources
    (comments, linked issues) degrade to empty and say so in `gaps` rather than
    failing the whole record. Text from anyone but the PR's author and the trusted
    associations is counted in `ignored_untrusted` and not read."""
    pr = _json(gh, f"pulls/{number}")
    if not pr.get("merged_at"):
        raise NotMerged(f"#{number} is not merged")
    trusted = set(trusted)
    pr_author = (pr.get("user") or {}).get("login")
    labels = [l["name"] for l in pr.get("labels", [])]
    body = pr.get("body") or ""
    rec = {"pr": number, "title": pr.get("title", ""), "author": (pr.get("user") or {}).get("login"),
           "labels": labels, "kind": kind_of(pr.get("title", ""), labels),
           "author_association": pr.get("author_association"),
           "merged_at": pr.get("merged_at"), "purpose": purpose_of(body),
           "linked_issues": [], "perf_mentions": perf_mentions("description", body),
           "ignored_untrusted": {"comment": 0, "review": 0, "review-thread": 0, "issue-body": 0},
           "gaps": [], "untrusted": True}
    sources = (("comment", f"issues/{number}/comments?per_page=100", "body"),
               ("review", f"pulls/{number}/reviews?per_page=100", "body"),
               ("review-thread", f"pulls/{number}/comments?per_page=100", "body"))
    for source, path, field in sources:
        try:
            for item in _json(gh, path):
                login = ((item.get("user") or {}).get("login") or "")
                if login != pr_author and item.get("author_association") not in trusted:
                    rec["ignored_untrusted"][source] += 1
                    continue
                if login.endswith("[bot]") and "perf" not in (item.get(field) or "").lower():
                    continue
                rec["perf_mentions"] += perf_mentions(source, item.get(field) or "")
        except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
            rec["gaps"].append(f"{source}s not read: {exc}")
    for n in linked_issue_numbers(body):
        try:
            issue = _json(gh, f"issues/{n}")
            issue_author = (issue.get("user") or {}).get("login")
            body_trusted = issue_author == pr_author or issue.get("author_association") in trusted
            if not body_trusted:
                rec["ignored_untrusted"]["issue-body"] += 1
            rec["linked_issues"].append({"number": n, "title": issue.get("title", ""),
                                         "labels": [l["name"] for l in issue.get("labels", [])],
                                         "purpose": purpose_of(issue.get("body") or "") if body_trusted else "",
                                         "body_ignored": not body_trusted})
        except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
            rec["gaps"].append(f"issue #{n} not read: {exc}")
    # Cost statements from the description and the author's own comments rank
    # first, then reviewers'; cap the list so the bundle stays small.
    order = {"description": 0, "comment": 1, "review": 2, "review-thread": 3}
    rec["perf_mentions"].sort(key=lambda m: (not m["acknowledges_cost"], order[m["source"]]))
    rec["perf_mentions"] = rec["perf_mentions"][:MAX_MENTIONS]
    rec["acknowledged_tradeoff"] = any(m["acknowledges_cost"] for m in rec["perf_mentions"])
    return rec


class GitHub:
    """Read the attributed PR through the container's brokered gh credential."""

    def __init__(self, repo):
        self.repo = repo

    def get(self, path):
        try:
            return subprocess.run(["gh", "api", f"repos/{self.repo}/{path}"],
                                  capture_output=True, text=True, check=True, timeout=120).stdout
        except subprocess.SubprocessError as exc:
            raise OSError(f"GitHub read failed for {path}: {exc}") from exc


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pr", type=int, required=True, help="PR identified by measured attribution")
    parser.add_argument("--github-repo", default="shader-slang/slang")
    mounted = Path("/workspace/extra/perf-policy/PERF_POLICY.json")
    parser.add_argument("--policy", type=Path, default=mounted if mounted.exists()
                        else Path(__file__).with_name("PERF_POLICY.json"))
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    if args.pr <= 0:
        parser.error("--pr must be positive")
    try:
        policy = json.loads(args.policy.read_text())
        configured = (policy.get("trust") or {}).get("intent_text_associations")
        # An empty list explicitly excludes everyone except the PR's author.
        trusted = DEFAULT_TRUSTED if configured is None else tuple(configured)
        record = collect_intent(GitHub(args.github_repo), args.pr, trusted)
        args.out.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f"intent: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
