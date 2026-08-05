#!/usr/bin/env python3
"""regression-quality — is coworker autonomy costing quality as it scales?

Companion to the Autonomy (bot PRs merged/week) and Latency (issue -> fix merged)
charts. Those show throughput and speed; neither shows whether the work holds up.

Counts `regression`-labelled issues over time and attributes each to a culprit PR,
classified bot vs human.

Two design choices that matter:

RATE, NOT COUNT. Bot merge volume rose sharply, so a raw count of bot-caused
regressions will climb even if quality is flat or improving. The headline is
regressions per merged PR per author class. A count alone makes scaling autonomy
look like declining quality by construction.

CAUSAL PHRASES, NOT BARE REFS. An issue mentioning "#12122" may be citing the fix,
a related PR, or context. Only references introduced by causal language ("Since
#N", "## Cause", "Bisected to", "introduced in", "regressed in", "caused by") are
counted as culprits. Measured against the real repo this is the difference between
a defensible number and a misleading one.

Needs network + `gh` auth (unlike kb-health/kb-doctor, which are offline).

  python3 scripts/regression-quality.py [--repo owner/name] [--months 12] [--json <out>]
"""
import argparse, collections, json, re, subprocess, sys

BOT_LOGINS = {"nv-slang-bot", "nv-slang-bot[bot]", "github-actions[bot]", "devin-ai-integration[bot]"}

# A reference counts as a culprit only when introduced by causal language. Two traps,
# both of which silently UNDER-count and were caught against real issues:
#   - "Since #11524/#11558" lists several culprits; capturing only the first attributed the
#     regression to a human PR when the bot PR beside it was the actual cause.
#   - "## Cause" is a heading; the reference lands on a following line, so a newline-free
#     window matches nothing at all.
# So: find the causal marker, then take EVERY reference in the window after it, newlines
# included.
CAUSAL_MARKER = re.compile(
    r"(?:since|caused\s+by|introduced\s+(?:in|by)|regressed\s+(?:in|by)|bisect(?:ed)?\s*(?:to|on)?|"
    r"culprit|blame[sd]?\s+(?:on|to)|#{1,4}\s*cause|root\s+cause)\b", re.I)
REF = re.compile(r"#(\d{3,6})\b")
CAUSAL_WINDOW = 240


def causal_refs(body):
    out = set()
    for m in CAUSAL_MARKER.finditer(body or ""):
        out |= {int(r) for r in REF.findall(body[m.end():m.end() + CAUSAL_WINDOW])}
    return out


def gh(path, paginate=False):
    cmd = ["gh", "api", path] + (["--paginate"] if paginate else [])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return None
    try:
        return json.loads(r.stdout)
    except Exception:
        try:
            return json.loads("[" + r.stdout.replace("][", ",") + "]")
        except Exception:
            return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default="shader-slang/slang")
    ap.add_argument("--label", default="regression")
    ap.add_argument("--months", type=int, default=12)
    ap.add_argument("--json", default=None)
    a = ap.parse_args()

    labels = {l["name"] for l in (gh(f"repos/{a.repo}/labels?per_page=100", paginate=True) or [])}
    if a.label not in labels:
        near = [l for l in labels if a.label.lower() in l.lower()]
        print(f"label {a.label!r} not found on {a.repo}. Similar: {near or 'none'}", file=sys.stderr)
        return 2

    issues = [i for i in (gh(f"repos/{a.repo}/issues?labels={a.label}&state=all&per_page=100",
                             paginate=True) or []) if not i.get("pull_request")]
    if not issues:
        print("no issues found", file=sys.stderr)
        return 2

    pr_cache = {}

    def author(num):
        if num not in pr_cache:
            d = gh(f"repos/{a.repo}/pulls/{num}")
            pr_cache[num] = ((d or {}).get("user", {}).get("login"), bool((d or {}).get("merged_at"))) if d else (None, False)
        return pr_cache[num]

    by_month = collections.Counter()
    bot_month = collections.Counter()
    human_month = collections.Counter()
    rows, unattributed = [], 0

    for i in issues:
        m = i["created_at"][:7]
        by_month[m] += 1
        culprits = []
        for num in causal_refs(i.get("body")):
            login, merged = author(num)
            if login and merged:
                culprits.append({"pr": num, "author": login, "bot": login in BOT_LOGINS})
        if not culprits:
            unattributed += 1
        elif any(c["bot"] for c in culprits):
            bot_month[m] += 1
        else:
            human_month[m] += 1
        rows.append({"issue": i["number"], "month": m, "title": i["title"][:90], "culprits": culprits})

    # denominator: merged PRs per month per class, so the metric is a RATE
    merged = gh(f"repos/{a.repo}/pulls?state=closed&per_page=100&sort=updated&direction=desc", paginate=True) or []
    pr_month_bot, pr_month_human = collections.Counter(), collections.Counter()
    for p in merged:
        if not p.get("merged_at"):
            continue
        m = p["merged_at"][:7]
        (pr_month_bot if (p.get("user") or {}).get("login") in BOT_LOGINS else pr_month_human)[m] += 1

    months = sorted(by_month)[-a.months:]
    print(f"{a.repo} — issues labelled '{a.label}': {len(issues)}  "
          f"(attributed {len(issues)-unattributed}, unattributed {unattributed})\n")
    print(f"{'month':<9}{'regr':>6}{'bot':>5}{'human':>7}{'botPRs':>8}{'per100':>8}{'humanPRs':>10}{'per100':>8}")
    for m in months:
        bp, hp = pr_month_bot.get(m, 0), pr_month_human.get(m, 0)
        br = f"{100*bot_month[m]/bp:.1f}" if bp else "-"
        hr = f"{100*human_month[m]/hp:.1f}" if hp else "-"
        print(f"{m:<9}{by_month[m]:>6}{bot_month[m]:>5}{human_month[m]:>7}{bp:>8}{br:>8}{hp:>10}{hr:>8}")

    print(f"\nattribution coverage {100*(len(issues)-unattributed)//len(issues)}% — "
          "the rest cite no causal reference, so bot/human splits are a FLOOR, not a total.")

    if a.json:
        json.dump({"repo": a.repo, "label": a.label, "issues": len(issues),
                   "unattributed": unattributed, "rows": rows,
                   "by_month": dict(by_month), "bot_month": dict(bot_month),
                   "human_month": dict(human_month),
                   "merged_bot": dict(pr_month_bot), "merged_human": dict(pr_month_human)},
                  open(a.json, "w"), indent=1)
        print(f"wrote {a.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
