"""Evidence of what a pull request set out to do, for judging a perf cost.

A compile-time cost is only a defect if it is not a consequence of what the change
was for. Deciding that takes the PR's stated purpose, what kind of change it is,
what the author and reviewers already said about performance, and the issues it
resolves. This module collects those as bounded, structured excerpts. It does not
judge: classification is the analyst's, and it must quote this evidence.

Everything returned from a PR is untrusted text. It is capped in size and meant to
be read as data. Nothing here follows, evaluates or executes it.

Stdlib only, and independent of the perf suite, so its tests run anywhere.
"""
import json
import re

MAX_PURPOSE = 700
MAX_MENTION = 260
MAX_MENTIONS = 8
MAX_LINKED = 4
MAX_COMMENT_PAGES = 1  # one page of 100 per comment source: enough, and bounded

# Sentences that talk about cost. Deliberately broad: the reader filters.
PERF_TERMS = re.compile(
    r"\b(perf(?:ormance)?|slow(?:er|down|ing)?|overhead|trade-?offs?|"
    r"compile[- ]times?|latency|allocat(?:e|es|ed|ion|ions)|cach(?:e|es|ed|ing)|hot[- ]path|"
    r"O\([a-z0-9 ^*]+\)|memory|bytes|footprint|startup|faster|speed)\b"
    # "regression" alone mostly means "regression test"; it counts only beside a cost word.
    r"|\b(?:perf(?:ormance)?|compile[- ]time|speed|latency|memory|startup|throughput)"
    r"\s+(?:regress(?:ion|ions|ed)?|impact|cost|hit|penalty)\b"
    r"|\b(?:regress(?:ion|ed|es)?|degrad(?:e|es|ed|ation))\s+(?:in\s+)?"
    r"(?:perf(?:ormance)?|compile[- ]time|speed|latency|memory|startup)\b", re.I)

# Phrases that say the author knew about a cost and accepted it. A subset of the
# above; a hit means "acknowledged", not "justified".
ACKNOWLEDGED = re.compile(
    r"(trade-?off|expected (?:cost|overhead|slowdown|increase)|"
    r"(?:slightly|marginally|somewhat) (?:slower|higher|larger|more)|"
    r"(?:small|minor|modest) (?:increase|overhead|cost|slowdown|regression)|"
    r"at the cost of|(?:accept|accepts|accepted|acceptable) .{0,30}(?:cost|overhead|slowdown)|"
    r"increases? .{0,40}(?:time|ms|%|latency|memory)|known (?:cost|overhead|regression))", re.I)

PURPOSE_HEADINGS = re.compile(r"^#{1,4}\s*(motivation|summary|why|background|problem|purpose)\b", re.I)
HEADING = re.compile(r"^#{1,4}\s")
LINK = re.compile(r"\b(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?|implements?|related to|part of)\s+"
                  r"(?:[\w.-]+/[\w.-]+)?#(\d+)", re.I)

# Label text that tells what kind of change this is. First match wins.
KIND_RULES = [
    ("breaking", re.compile(r"(?<!non-)(?<!non )breaking", re.I)),
    ("feature", re.compile(r"new feature|feature|enhancement", re.I)),
    ("fix", re.compile(r"\bbug\b|\bfix\b|regression fix", re.I)),
    ("refactor", re.compile(r"refactor|cleanup|clean-up|chore", re.I)),
    ("docs-tests", re.compile(r"\bdocs?\b|documentation|\btests?\b|\bci\b", re.I)),
]
TITLE_KIND_RULES = [
    ("fix", re.compile(r"^\s*fix\b|\bfix(?:es)?\s+#\d+", re.I)),
    ("feature", re.compile(r"^\s*(?:add|support|implement|introduce|enable|allow)\b", re.I)),
    ("refactor", re.compile(r"^\s*(?:refactor|clean ?up|move|rename|simplify|remove)\b", re.I)),
]


def sentences(text):
    """Split prose into sentences well enough to excerpt; code fences are dropped."""
    text = re.sub(r"```.*?```", " ", text or "", flags=re.S)
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


def collect_intent(gh, number):
    """Structured intent evidence for one merged PR. Raises on a failed fetch of the
    PR itself; the secondary sources (comments, linked issues) degrade to empty and
    say so in `gaps` rather than failing the whole record."""
    pr = _json(gh, f"pulls/{number}")
    labels = [l["name"] for l in pr.get("labels", [])]
    body = pr.get("body") or ""
    rec = {"pr": number, "title": pr.get("title", ""), "author": (pr.get("user") or {}).get("login"),
           "labels": labels, "kind": kind_of(pr.get("title", ""), labels),
           "merged_at": pr.get("merged_at"), "purpose": purpose_of(body),
           "linked_issues": [], "perf_mentions": perf_mentions("description", body),
           "gaps": [], "untrusted": True}
    sources = (("comment", f"issues/{number}/comments?per_page=100", "body"),
               ("review", f"pulls/{number}/reviews?per_page=100", "body"),
               ("review-thread", f"pulls/{number}/comments?per_page=100", "body"))
    for source, path, field in sources:
        try:
            for item in _json(gh, path):
                login = ((item.get("user") or {}).get("login") or "")
                if login.endswith("[bot]") and "perf" not in (item.get(field) or "").lower():
                    continue
                rec["perf_mentions"] += perf_mentions(source, item.get(field) or "")
        except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
            rec["gaps"].append(f"{source}s not read: {exc}")
    for n in linked_issue_numbers(body):
        try:
            issue = _json(gh, f"issues/{n}")
            rec["linked_issues"].append({"number": n, "title": issue.get("title", ""),
                                         "labels": [l["name"] for l in issue.get("labels", [])],
                                         "purpose": purpose_of(issue.get("body") or "")})
        except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
            rec["gaps"].append(f"issue #{n} not read: {exc}")
    # Cost statements from the description and the author's own comments rank
    # first, then reviewers'; cap the list so the bundle stays small.
    order = {"description": 0, "comment": 1, "review": 2, "review-thread": 3}
    rec["perf_mentions"].sort(key=lambda m: (not m["acknowledges_cost"], order[m["source"]]))
    rec["perf_mentions"] = rec["perf_mentions"][:MAX_MENTIONS]
    rec["acknowledged_tradeoff"] = any(m["acknowledges_cost"] for m in rec["perf_mentions"])
    return rec
