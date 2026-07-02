import json, subprocess

BASE = "https://3737-yjdzmdo7h.brevlab.com/#/cw"
GH = "https://github.com/shader-slang/slang"
TICK = 67
TS = "2026-07-01T12:55Z"

# folder map
folders = {}
g = json.loads(subprocess.run(["ncl","groups","list","--json"],capture_output=True,text=True).stdout)
for x in g.get("data", []):
    folders[x["id"]] = x.get("folder")

# sessions per thread → tier links
sl = json.loads(subprocess.run(["ncl","sessions","list","--limit","10000","--json"],capture_output=True,text=True).stdout)
from collections import defaultdict
by_thread = defaultdict(list)
for s in sl.get("data", []):
    t = s.get("thread_id") or ""
    if t.startswith("gh-issue-"):
        by_thread[t].append(s)

def tier_link(num, folder_substr, letter):
    key = "gh-issue-shader-slang/slang-%s" % num
    for s in by_thread.get(key, []):
        fol = folders.get(s.get("agent_group_id")) or ""
        if folder_substr in fol and "legacy" not in fol and "dashboard" not in fol:
            return "[%s](%s/%s/s/%s)" % (letter, BASE, fol, s["id"])
    return "—"

facts = {}
for line in open("memory/chain-facts.jsonl"):
    d = json.loads(line); facts[d["num"]] = d
titles = {}
for line in open("memory/titles.txt"):
    p = line.rstrip("\n").split("|")
    if len(p) >= 3: titles[p[1]] = p[2]
prf = {}
for line in open("memory/pr-facts.txt"):
    p = line.strip().split("|")
    if len(p) >= 5 and p[1] != "null":
        prf[p[0]] = {"pr": p[1], "state": p[2], "draft": p[3]=="true", "ms": p[4]}
sess_la = json.load(open("memory/sess-la.json"))

BOTS = {"nv-slang-bot[bot]","nv-slang-bot"}
def ci_cell(num):
    p = prf.get(num)
    if not p: return "—"
    if p["state"]=="MERGED": return "merged"
    if p["state"]=="CLOSED": return "closed"
    return {"BEHIND":"⤵️behind","DIRTY":"⚠️dirty","BLOCKED":"🔒blk","UNSTABLE":"unstable","CLEAN":"clean"}.get(p["ms"], (p["ms"] or "?").lower())
def gh_art(num):
    p = prf.get(num)
    if p: return "[PR #%s](%s/pull/%s)" % (p["pr"], GH, p["pr"])
    return "[iss](%s/issues/%s)" % (GH, num)

# read the curated NOTE/status from board_gen by re-importing
import importlib.util
spec = importlib.util.spec_from_file_location("bg", "memory/board_gen.py")
# board_gen prints on import; avoid — instead redefine NOTE inline
NOTE = {
 "11538":("skiminki driving; DIRTY","pr_open — await merge"),
 "11591":("frozen — stacked-PR clobber","pr_open — structure→maintainer"),
 "11599":("jkwak LGTM; reporter to test","advisory:maintainer — close EOW"),
 "11659":("PR BLOCKED (review)","pr_open — await review"),
 "11669":("PR BLOCKED","pr_open — await review"),
 "11715":("maintainer↔maintainer","advisory:maintainer — not our PR"),
 "11730":("draft BEHIND","pr_open — watch"),
 "11742":("PR BLOCKED","pr_open — await review"),
 "11784":("HELD autodiff Conditional","advisory:maintainer — await saipraveenb25"),
 "11790":("parked RHI-first","advisory:maintainer — await rhi#781"),
 "11813":("DEFERRED team ~07-06","active:human-debate — await team"),
 "11825":("parked team disc","triaged:awaiting-pickup — no PR"),
 "11829":("skiminki manual; #11834 closed","advisory:maintainer — closed our end"),
 "11855":("draft #11863; regr src #11693","pr_open — fixer aware"),
 "11856":("PR open","pr_open — watch"),
 "11858":("ceded to skiminki; unpushed","advisory:maintainer — await handover"),
 "11859":("expipiplus1 driving #11872 APPROVED","pr_open — maintainer editing"),
 "11864":("PR BLOCKED","pr_open — await review"),
 "11865":("PR BLOCKED","pr_open — await review"),
 "11874":("PR BLOCKED","pr_open — await review"),
 "11877":("draft BLOCKED","pr_open — watch"),
 "11878":("handed off expipiplus1","advisory:maintainer — stood down"),
 "11881":("RELEASED fixer working","fixing — draft PR incoming"),
 "9382":("3-maintainer design call","active:human-debate — await convergence"),
 "6319":("active today","fixing — in progress"),
 "11441":("maintainer disc (szihs/jkwak)","active:human-debate — maintainer-driving"),
 "11483":("PR #11484 MERGED, issue open","verify — Addresses or should-close?"),
 "11837":("PR #11838 MERGED (Addresses)","closing — half-float remaining gap"),
}

rows_order = []
for line in open("memory/target-chains.txt"):
    repo, num, la = line.strip().split("|")
    if facts.get(num, {}).get("state") != "OPEN": continue
    rows_order.append((num, la))

NEW = {"11715","11864","11865","11874","11877","11878","11881","11882","6319"}
def mk(num, la, tag):
    b = facts.get(num, {})
    lc = (b.get("lastc") or "|").split("|")
    author = lc[0] or "-"
    note = NOTE.get(num)
    if note: status, disp = note
    else:
        status = ("%s last %s" % (author, (lc[1] if len(lc)>1 else "")[5:16])) if author!="-" else "no comments"
        disp = ("pr_open" if prf.get(num) else "triaged:awaiting-pickup") + " — watch"
    o = tier_link(num,"main","o"); t = tier_link(num,"slang-triager","t")
    f = tier_link(num,"slang-fixer","f"); r = tier_link(num,"slang-reviewer","r")
    return "| %s [#%s](%s/issues/%s) | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s |" % (
        tag, num, GH, num, titles.get(num,"")[:30], o,t,f,r, gh_art(num), ci_cell(num), sess_la.get(num,"")[:16], status[:60], disp)

out = []
out.append("\n## Tick %d — %s\n" % (TICK, TS))
out.append("worktree-vol: 7GB free (⚠️ <10GB pressure). Universe: 187 live chains, 179 journaled + 94 archived. 11 NEW, 21 archived this tick. No implementation nudges (all recent chains maintainer-driven / awaiting-external / handled post-comment). GC: 2 clean reaps + 3 parked wake-confirm dispatched.\n")
out.append("| Δ #Issue | Title | Orch | Triage | Fixer | Rev | Github | CI | Last-active | Status | State — Next |")
out.append("|---|---|---|---|---|---|---|---|---|---|---|")
shown = set()
for num, la in rows_order:
    if num in NEW: out.append(mk(num, la, "🆕")); shown.add(num)
for num, la in rows_order:
    if num in shown: continue
    if la >= "2026-06-30T00:00": out.append(mk(num, la, "•")); shown.add(num)
tail = [num for num,la in rows_order if num not in shown]
out.append("\n**Collapsed (parked/older, disposition unchanged from prior tick):** " + ", ".join("#"+n for n in tail))

with open("reports/issue-chain-tracker.md","a") as fh:
    fh.write("\n".join(out) + "\n")
print("appended tick %d — %d detailed rows, %d collapsed" % (TICK, len(shown), len(tail)))
