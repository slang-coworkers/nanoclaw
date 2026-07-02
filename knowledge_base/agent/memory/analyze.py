import json

bots = {"nv-slang-bot[bot]", "nv-slang-bot"}
rows = []
for line in open("memory/chain-facts.jsonl"):
    line = line.strip()
    if not line:
        continue
    try:
        d = json.loads(line)
    except Exception:
        print("PARSE-FAIL:", line[:120])
        continue
    rows.append(d)

closed = [r for r in rows if r.get("state") == "CLOSED"]
openr = [r for r in rows if r.get("state") == "OPEN"]
err = [r for r in rows if r.get("err")]

print("total rows:", len(rows), " CLOSED:", len(closed), " OPEN:", len(openr), " ERR:", len(err))
print()

def ball_of(r):
    la = (r.get("lastc") or "|").split("|")
    author = la[0]
    at = la[1] if len(la) > 1 else ""
    if not author:
        return ("no-comments", "", "")
    if author in bots:
        return ("bot-last", author, at)
    return ("HUMAN-LAST", author, at)

print("=== CLOSED chains (archive + postmortem check) ===")
for r in sorted(closed, key=lambda x: int(x["num"])):
    repo = r["repo"].split("/")[-1]
    print("  #%-6s %-22s reason=%-12s pr=%s" % (r["num"], repo, r.get("reason") or "-", r.get("pr") or "-"))
print()

print("=== OPEN + PR (fix/issue branch) ===")
for r in sorted(openr, key=lambda x: int(x["num"])):
    if r.get("pr"):
        b, author, at = ball_of(r)
        print("  #%-6s PR=%-28s last-cmt=%-20s %s  [%s]" % (r["num"], r["pr"], author or "-", at, b))
print()

print("=== OPEN, no PR (triaged/parked/awaiting) ===")
for r in sorted(openr, key=lambda x: int(x["num"])):
    if not r.get("pr"):
        b, author, at = ball_of(r)
        print("  #%-6s %-22s last-cmt=%-20s %s  [%s]" % (r["num"], r["repo"].split("/")[-1], author or "-", at, b))
print()

print("=== ERR ===")
for r in err:
    print("  ", r)
