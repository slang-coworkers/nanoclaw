import json

GH = "https://github.com/shader-slang/slang"

facts = {}
for line in open("memory/chain-facts.jsonl"):
    d = json.loads(line)
    facts[d["num"]] = d
titles = {}
for line in open("memory/titles.txt"):
    p = line.rstrip("\n").split("|")
    if len(p) >= 3:
        titles[p[1]] = p[2]
prf = {}
for line in open("memory/pr-facts.txt"):
    p = line.strip().split("|")
    if len(p) >= 5 and p[1] != "null":
        prf[p[0]] = {"pr": p[1], "state": p[2], "draft": p[3] == "true", "ms": p[4]}

BOTS = {"nv-slang-bot[bot]", "nv-slang-bot"}

def ball(num):
    d = facts.get(num, {})
    la = (d.get("lastc") or "|").split("|")
    a = la[0]; at = la[1] if len(la) > 1 else ""
    if not a: return ("none", "-", "")
    return ("human" if a not in BOTS else "bot", a, at)

NOTE = {
 "11538":("skiminki driving; DIRTY (conflict)","pr_open","await merge"),
 "11591":("frozen — stacked-PR clobber","pr_open","structure→maintainer"),
 "11599":("jkwak LGTM; reporter to test PR #11789","advisory:maintainer","close EOW if no repro"),
 "11659":("PR #11661 BLOCKED (review)","pr_open","await review"),
 "11669":("PR #11816 BLOCKED","pr_open","await review"),
 "11715":("maintainer↔maintainer (jkwak↔Yong)","advisory:maintainer","not our PR"),
 "11730":("draft PR #11818 BEHIND","pr_open","watch"),
 "11742":("PR #11743 BLOCKED","pr_open","await review"),
 "11784":("HELD — autodiff Conditional scope call","advisory:maintainer","await saipraveenb25"),
 "11790":("parked — RHI-first (slang-rhi#781)","advisory:maintainer","await #781+jkwak"),
 "11813":("DEFERRED — team disc ~07-06","active:human-debate","await team"),
 "11825":("parked — team discussion","triaged:awaiting-pickup","no PR; deferred"),
 "11829":("skiminki fixing manually; #11834 closed","advisory:maintainer","closed our end"),
 "11855":("draft PR #11863; regression src #11693","pr_open","fixer aware"),
 "11856":("PR #11866 open","pr_open","watch"),
 "11858":("ceded to skiminki (assigned); unpushed","advisory:maintainer","await handover"),
 "11859":("expipiplus1 driving #11872 (APPROVED)","pr_open","maintainer editing"),
 "11864":("PR #11867 BLOCKED","pr_open","await review"),
 "11865":("PR #11869 BLOCKED","pr_open","await review"),
 "11874":("PR #11876 BLOCKED","pr_open","await review"),
 "11877":("draft PR #11879 BLOCKED","pr_open","watch"),
 "11878":("handed off — expipiplus1 self-assigned","advisory:maintainer","fixer stood down"),
 "11881":("RELEASED — fixer working (numthreads)","fixing","draft PR incoming"),
 "9382":("3-maintainer design call (gather)","active:human-debate","await convergence"),
 "6319":("active today (running)","fixing","in progress"),
 "11441":("maintainer disc (szihs/jkwak) — bot answered","active:human-debate","maintainer-driving"),
 "11483":("PR #11484 MERGED but issue OPEN","verify","Addresses or should-close?"),
 "11837":("PR #11838 MERGED (Addresses, non-closing)","closing","half-float NaN/Inf remaining gap"),
}

def cell_ci(num):
    p = prf.get(num)
    if not p: return "—"
    if p["state"] == "MERGED": return "merged"
    if p["state"] == "CLOSED": return "closed"
    ms = p["ms"]
    return {"BEHIND":"behind","DIRTY":"dirty","BLOCKED":"blocked","UNSTABLE":"unstable","CLEAN":"clean"}.get(ms, (ms or "?").lower())

def gh_link(num):
    p = prf.get(num)
    if p: return "[PR #%s](%s/pull/%s)" % (p["pr"], GH, p["pr"])
    return "[issue](%s/issues/%s)" % (GH, num)

def pr_col(num):
    p = prf.get(num)
    if not p: return "no-PR"
    return "#%s %s" % (p["pr"], "draft" if p["draft"] else "ready")

rows_order = []
for line in open("memory/target-chains.txt"):
    repo, num, la = line.strip().split("|")
    if facts.get(num, {}).get("state") != "OPEN":
        continue
    rows_order.append((num, repo, la))

def render_row(num, repo, la, tag):
    b, author, at = ball(num)
    note = NOTE.get(num)
    if note:
        st, disp, nxt = note
    else:
        if b == "human":
            st = "%s last %s" % (author, at[5:16]); disp = "awaiting_us?"; nxt = "review ball"
        elif b == "bot":
            st = "bot last %s" % at[5:16]; disp = "pr_open" if prf.get(num) else "triaged:pickup"; nxt = "watch"
        else:
            st = "no comments"; disp = "pr_open" if prf.get(num) else "triaged"; nxt = "watch"
    title = titles.get(num, "")[:32]
    return "| %s #%s | %s | %s | %s | %s | %s | %s — %s |" % (tag, num, title, gh_link(num), pr_col(num), cell_ci(num), st[:44], disp, nxt)

NEW = {"11715","11864","11865","11874","11877","11878","11881","11882","6319"}
lines = ["| Δ #Issue | Title | Github | PR | Merge | Status | State — Next |",
         "|---|---|---|---|---|---|---|"]
shown = set()
for num, repo, la in rows_order:
    if num in NEW:
        lines.append(render_row(num, repo, la, "🆕")); shown.add(num)
for num, repo, la in rows_order:
    if num in shown: continue
    if la >= "2026-06-30T00:00":
        lines.append(render_row(num, repo, la, "•")); shown.add(num)
board = "\n".join(lines)
tail = [num for num, repo, la in rows_order if num not in shown]
open("memory/board-inline.md", "w").write(board)
open("memory/board-tail.txt", "w").write(",".join("#"+n for n in tail))
print(board)
print("\nTAIL(%d): %s" % (len(tail), ",".join("#"+n for n in tail)))
