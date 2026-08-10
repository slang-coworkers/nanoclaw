#!/usr/bin/env python3
"""regression-quality — is coworker autonomy costing quality as it scales?

Companion to the Autonomy (bot PRs merged/week) and Latency (issue -> fix merged)
charts. Those show throughput and speed; neither shows whether the work holds up.

Counts `regression`-labelled issues over time and attributes each to a culprit PR,
classified bot vs human vs mixed.

Four design choices that matter:

RATE, NOT COUNT. Bot merge volume rose sharply, so a raw count of bot-caused
regressions will climb even if quality is flat or improving. The headline is
regressions per merged PR per author class. A count alone makes scaling autonomy
look like declining quality by construction.

ONE COHORT. The numerator is bucketed by the CULPRIT PR's merge month, not by the
month the regression was FILED. Those are different populations: a regression
filed in July against a PR merged in April was being divided by July's merge
volume, which had nothing to do with it. The dashboard renders that ratio as "per
100 bot/human PRs" — a sentence that is only true when numerator and denominator
describe the same cohort. They now do.

CAUSAL PHRASES, NOT BARE REFS. An issue mentioning "#12122" may be citing the fix,
a related PR, or context. Only references introduced by causal language ("Since
#N", "## Cause", "Bisected to", "introduced in", "regressed in", "caused by") are
counted as culprits, and only when the referenced PR actually merged BEFORE the
regression was filed. Measured against the real repo this is the difference
between a defensible number and a misleading one.

FAIL CLOSED. Every fetch runs through Collection; the first failure marks the run
INCOMPLETE, and an incomplete run publishes null metrics with an `errors` list and
exits nonzero. It never prints a zero or a "-" that an outage could have produced
— a broken collector used to be indistinguishable from a quiet month, i.e. an
outage read as a quality improvement. The incomplete snapshot IS written over the
previous one on purpose: the dashboard has to be able to see that its data is
broken rather than render last week's numbers as today's.

Needs network + `gh` auth (unlike kb-health/kb-doctor, which are offline).

  python3 scripts/regression-quality.py [--repo owner/name] [--months 12] [--json <out>]

Exit codes: 0 = complete, 1 = incomplete collection, 2 = nothing to measure.
"""
import argparse
import collections
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

SCHEMA = 2

# Author classes for the rate's numerator and denominator. Deliberately the same
# set on both sides — a PR counted as bot-authored in the denominator must count
# as a bot culprit in the numerator or the ratio is nonsense. Compared
# NORMALISED: GitHub renders the same actor as both "nv-slang-bot[bot]" and bare
# "nv-slang-bot" depending on the API surface, and matching only the suffixed
# spelling silently reclassified our own bot's work as human.
BOT_LOGINS = {"nv-slang-bot", "github-actions", "devin-ai-integration"}


def normalise_login(login):
    return re.sub(r"\[bot\]$", "", (login or "").strip(), flags=re.IGNORECASE).lower()


def is_bot(login):
    return normalise_login(login) in BOT_LOGINS


# A reference counts as a culprit only when introduced by causal language. Two traps,
# both of which silently UNDER-count and were caught against real issues:
#   - "Since #11524/#11558" lists several culprits; capturing only the first attributed the
#     regression to a human PR when the bot PR beside it was the actual cause.
#   - "## Cause" is a heading; the reference lands on a following line, so a newline-free
#     window matches nothing at all.
# So: find the causal marker, then take EVERY reference in the block after it, newlines
# included.
CAUSAL_MARKER = re.compile(
    r"(?:since|caused\s+by|introduced\s+(?:in|by)|regressed\s+(?:in|by)|bisect(?:ed)?\s*(?:to|on)?|"
    r"culprit|blame[sd]?\s+(?:on|to)|#{1,4}\s*cause|root\s+cause)\b", re.IGNORECASE)
REF = re.compile(r"#(\d{3,6})\b")
# The window now ends at the end of the causal BLOCK — a blank line or the next
# heading — instead of at a fixed character count. A flat 240-char window erred
# in both directions: it ran past the causal statement into unrelated prose, and
# it truncated long "bisected to ... / also ..." blocks mid-list. The cap remains
# as a backstop for pathological bodies, not as the primary boundary.
CAUSAL_WINDOW = 600
BLOCK_END = re.compile(r"\n[ \t]*\n|\n#{1,6}\s")


def causal_window(body, start):
    """Text of the causal block beginning at `start`."""
    rest = body[start:start + CAUSAL_WINDOW]
    # Skip the newline(s) between a "## Cause" heading and its paragraph, or the
    # block boundary lands at offset 0 and the window is empty.
    lead = len(rest) - len(rest.lstrip())
    if lead >= len(rest):
        return ""
    end = BLOCK_END.search(rest, lead + 1)
    return rest[:end.start()] if end else rest


def causal_refs(text):
    out = set()
    body = text or ""
    for m in CAUSAL_MARKER.finditer(body):
        out |= {int(r) for r in REF.findall(causal_window(body, m.end()))}
    return out


class Collection:
    """Records every fetch failure so no caller can launder one into a zero.

    Callers keep going after a failure (to surface as many problems as possible
    in one run) but `ok` stays False and the run publishes as INCOMPLETE.
    """

    def __init__(self):
        self.ok = True
        self.errors = []

    def fail(self, what, detail):
        self.ok = False
        self.errors.append({"what": what, "detail": str(detail).strip()[:400]})


MISSING = object()  # a 404: a real ANSWER ("no such PR"), not a collection failure
NOT_FOUND = re.compile(r"HTTP 404|Not Found", re.IGNORECASE)


def gh(col, path, paginate=False, what=None, allow_missing=False, timeout=900):
    what = what or path
    cmd = ["gh", "api", path] + (["--paginate"] if paginate else [])
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout,
                           check=False)
    except (OSError, subprocess.SubprocessError) as e:
        col.fail(what, f"{type(e).__name__}: {e}")
        return None
    if r.returncode != 0:
        err = r.stderr or r.stdout
        # A 404 on pulls/N means "that reference is not a PR", which is an
        # answer. Treating it as an outage would fail every single run, because
        # issue bodies routinely cite issue numbers alongside PR numbers.
        if allow_missing and NOT_FOUND.search(err or ""):
            return MISSING
        col.fail(what, err)
        return None
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        # `gh --paginate` concatenates one JSON array per page with no separator:
        # "[...][...]". Splice them into ONE array. The previous repair wrapped
        # the spliced text in a SECOND pair of brackets, yielding [[...]] — so the
        # first multi-page response crashed the caller on `.get()`, and a
        # multi-page response is precisely what --paginate exists to produce.
        try:
            return json.loads(re.sub(r"\]\s*\[", ",", r.stdout))
        except json.JSONDecodeError as e:
            col.fail(what, f"unparseable response: {e}")
            return None


def pr_info(col, repo, num, cache):
    """(author, merged_at) for a PR number.

    None = the lookup FAILED (unknown). MISSING = the reference is not a PR.
    Keeping those apart is the whole point: one is an outage, the other is data.
    """
    if num not in cache:
        d = gh(col, f"repos/{repo}/pulls/{num}", what=f"pulls/{num}", allow_missing=True, timeout=120)
        if d is MISSING or d is None:
            cache[num] = d
        else:
            cache[num] = ((d.get("user") or {}).get("login"), d.get("merged_at"))
    return cache[num]


def culprits_for(col, repo, issue, cache):
    """Culprit PRs for one issue, plus where the attribution came from.

    Returns (culprits, source, failed). `failed` marks an issue whose attribution
    depended on a lookup that did not answer — UNKNOWN, which is not the same as
    "no culprit found" and must not be counted as one.
    """
    filed = issue.get("created_at") or ""
    refs, source = set(), None
    for name in ("body", "title"):
        found = causal_refs(issue.get(name))
        if found:
            refs |= found
            source = name if source is None else f"{source}+{name}"
    if not refs:
        # Widen only when the structured fields yielded nothing: maintainers very
        # often write "bisected to #N" in a COMMENT rather than in the body, and
        # scanning the body alone dropped those issues entirely. Gated on the
        # cheap path first so the extra call is proportional to the gap.
        comments = gh(col, f"repos/{repo}/issues/{issue['number']}/comments?per_page=100",
                      paginate=True, what=f"issues/{issue['number']}/comments")
        if comments is None:
            return [], None, True
        for c in comments if isinstance(comments, list) else []:
            found = causal_refs((c or {}).get("body"))
            if found:
                refs |= found
                source = "comment"

    culprits, failed = [], False
    for num in sorted(refs):
        info = pr_info(col, repo, num, cache)
        if info is None:
            failed = True  # unresolved — do NOT silently drop the candidate
            continue
        if info is MISSING:
            continue  # the reference was an issue, not a PR
        login, merged_at = info
        if not login or not merged_at:
            continue  # never merged, so it shipped nothing that could regress
        # Structured check: a PR merged AFTER the regression was filed cannot have
        # caused it. This also makes the cohort month well defined.
        if filed and merged_at >= filed:
            continue
        culprits.append({"pr": num, "author": login, "bot": is_bot(login), "mergedAt": merged_at})
    return culprits, source, failed


def classify(culprits):
    """bot | human | mixed. Mixed is NAMED, not folded into bot.

    The old rule was `any(bot) -> bot`, which quietly charged every joint
    bot+human regression to the bot and turned an upper bound into a measurement.
    """
    kinds = {c["bot"] for c in culprits}
    if kinds == {True}:
        return "bot"
    if kinds == {False}:
        return "human"
    return "mixed"


def write_json(path, doc):
    """Atomic replace, creating the directory.

    The writer assumed reports/ already existed and wrote in place, so a fresh
    checkout failed on ENOENT and a crash mid-write left the dashboard parsing
    half a document.
    """
    d = os.path.dirname(os.path.abspath(path))
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".regression-quality.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(doc, f, indent=1)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default="shader-slang/slang")
    ap.add_argument("--label", default="regression")
    ap.add_argument("--months", type=int, default=12)
    ap.add_argument("--json", default=None)
    a = ap.parse_args()

    col = Collection()
    doc = {"schema": SCHEMA, "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "repo": a.repo, "label": a.label, "months": a.months,
           "cohort": "culprit-merge-month", "complete": False, "errors": col.errors}

    def publish(code):
        """The single exit path. Metrics are emitted ONLY by a complete run, so
        `complete: false` and a populated `errors` are the dashboard's signal to
        render "collection broken" rather than a number."""
        doc["complete"] = col.ok
        if a.json:
            write_json(a.json, doc)
            print(f"wrote {a.json}")
        if not col.ok:
            print(f"INCOMPLETE collection — {len(col.errors)} error(s); metrics withheld", file=sys.stderr)
            for e in col.errors[:10]:
                first = e["detail"].splitlines()[0] if e["detail"] else ""
                print(f"  {e['what']}: {first}", file=sys.stderr)
        return code

    labels_raw = gh(col, f"repos/{a.repo}/labels?per_page=100", paginate=True, what="labels")
    if labels_raw is None:
        return publish(1)
    labels = {l["name"] for l in labels_raw if isinstance(l, dict)}
    if a.label not in labels:
        near = [l for l in labels if a.label.lower() in l.lower()]
        col.fail("label", f"label {a.label!r} not found on {a.repo}. Similar: {near or 'none'}")
        print(f"label {a.label!r} not found on {a.repo}. Similar: {near or 'none'}", file=sys.stderr)
        return publish(2)

    issues_raw = gh(col, f"repos/{a.repo}/issues?labels={a.label}&state=all&per_page=100",
                    paginate=True, what="issues")
    if issues_raw is None:
        return publish(1)
    issues = [i for i in issues_raw if isinstance(i, dict) and not i.get("pull_request")]
    if not issues:
        col.fail("issues", "no issues carry this label — nothing to measure")
        print("no issues found", file=sys.stderr)
        return publish(2)

    cache = {}
    filed_month = collections.Counter()
    cohort = {"bot": collections.Counter(), "human": collections.Counter(), "mixed": collections.Counter()}
    rows, unattributed, attribution_failed = [], 0, 0

    for i in issues:
        filed_month[i["created_at"][:7]] += 1
        culprits, source, failed = culprits_for(col, a.repo, i, cache)
        if culprits:
            kind = classify(culprits)
            # Cohort = the LATEST-merged culprit's month: of the candidates, the
            # one that landed closest to the regression, and the only choice that
            # keeps a multi-culprit issue in exactly one bucket.
            month = max(c["mergedAt"] for c in culprits)[:7]
            cohort[kind][month] += 1
        elif failed:
            kind, month = "unknown", None
            attribution_failed += 1  # a fetch failed — NOT evidence of no culprit
        else:
            kind, month = "unattributed", None
            unattributed += 1
        rows.append({"issue": i["number"], "filedMonth": i["created_at"][:7], "cohortMonth": month,
                     "attribution": kind, "source": source, "title": i["title"][:90],
                     "culprits": culprits})

    # Denominator: merged PRs per month per class, so the metric is a RATE.
    merged_raw = gh(col, f"repos/{a.repo}/pulls?state=closed&per_page=100&sort=updated&direction=desc",
                    paginate=True, what="merged-prs")
    if merged_raw is None:
        return publish(1)
    pr_month_bot, pr_month_human = collections.Counter(), collections.Counter()
    for p in merged_raw:
        if not isinstance(p, dict) or not p.get("merged_at"):
            continue
        m = p["merged_at"][:7]
        (pr_month_bot if is_bot((p.get("user") or {}).get("login")) else pr_month_human)[m] += 1

    if not col.ok:
        # Something failed along the way. Everything below this point would print
        # numbers a reader could not tell apart from a real result.
        doc["partial"] = {"issues": len(issues), "unattributed": unattributed,
                          "attributionFailed": attribution_failed}
        return publish(1)

    attributed = len(issues) - unattributed - attribution_failed
    # Months come from the COHORT domain (culprit merge months + merge volume),
    # because that is the population the table divides.
    months = sorted(set(pr_month_bot) | set(pr_month_human) |
                    set(cohort["bot"]) | set(cohort["human"]) | set(cohort["mixed"]))[-a.months:]

    def rate(n, d):
        return round(100 * n / d, 1) if d else None

    doc.update({
        "issues": len(issues), "attributed": attributed, "unattributed": unattributed,
        "attributionFailed": attribution_failed,
        "attributionCoveragePct": round(100 * attributed / len(issues), 1),
        "months_shown": months,
        "filed_month": dict(filed_month),
        "cohort_bot": dict(cohort["bot"]), "cohort_human": dict(cohort["human"]),
        "cohort_mixed": dict(cohort["mixed"]),
        "merged_bot": dict(pr_month_bot), "merged_human": dict(pr_month_human),
        "rate_bot_per_100": {m: rate(cohort["bot"][m], pr_month_bot.get(m, 0)) for m in months},
        "rate_human_per_100": {m: rate(cohort["human"][m], pr_month_human.get(m, 0)) for m in months},
        "rows": rows,
    })

    print(f"{a.repo} — issues labelled '{a.label}': {len(issues)}  "
          f"(attributed {attributed}, unattributed {unattributed}, lookup-failed {attribution_failed})")
    print("cohort = culprit PR's MERGE month, so numerator and denominator are the same population\n")
    print(f"{'month':<9}{'bot':>5}{'human':>7}{'mixed':>7}{'botPRs':>8}{'per100':>8}{'humanPRs':>10}{'per100':>8}")
    for m in months:
        bp, hp = pr_month_bot.get(m, 0), pr_month_human.get(m, 0)
        br, hr = rate(cohort["bot"][m], bp), rate(cohort["human"][m], hp)
        print(f"{m:<9}{cohort['bot'][m]:>5}{cohort['human'][m]:>7}{cohort['mixed'][m]:>7}"
              f"{bp:>8}{('-' if br is None else f'{br:.1f}'):>8}"
              f"{hp:>10}{('-' if hr is None else f'{hr:.1f}'):>8}")

    print(f"\nattribution coverage {doc['attributionCoveragePct']}% — "
          "the rest cite no causal reference, so bot/human splits are a FLOOR, not a total.")
    print(f"mixed bot+human culprits are counted separately ({sum(cohort['mixed'].values())} issues), "
          "not charged to the bot.")

    return publish(0)


if __name__ == "__main__":
    sys.exit(main())
