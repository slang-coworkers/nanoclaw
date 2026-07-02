import json, datetime

NOW = "2026-07-01T12:55:00Z"
TICK_AT = NOW

state = json.load(open("memory/supervisor-state.json"))

# load facts
facts = {}
for line in open("memory/chain-facts.jsonl"):
    d = json.loads(line)
    facts[(d["repo"], d["num"])] = d

titles = {}
for line in open("memory/titles.txt"):
    line = line.rstrip("\n")
    parts = line.split("|")
    if len(parts) >= 3:
        titles[(parts[0], parts[1])] = parts[2]

# pr facts (slang only)
prf = {}
for line in open("memory/pr-facts.txt"):
    line = line.strip()
    if not line: continue
    p = line.split("|")
    num = p[0]
    if len(p) >= 5 and p[1] != "null":
        prf[num] = {"pr": p[1], "state": p[2], "draft": p[3], "mergeState": p[4]}

NEW = ["11715","11793","11864","11865","11874","11877","11878","11881","11882","6319","1040"]
# 1040 is slangpy; 11793 is a release-branch merged PR (archive)

archived = state.setdefault("_archived", {})

def key(repo, num):
    return "gh-issue-%s-%s" % (repo, num)

# --- Journal NEW chains ---
new_journaled = []
for line in open("memory/chain-facts.jsonl"):
    d = json.loads(line)
    repo, num = d["repo"], d["num"]
    k = key(repo, num)
    if num not in NEW and not (repo.endswith("slangpy") and num == "1040"):
        continue
    if d.get("state") == "CLOSED":
        continue  # handled in archive pass
    entry = {
        "title": titles.get((repo, num), ""),
        "issueState": d.get("state"),
        "lastObservedActivity": NOW,
        "firstJournaledAt": NOW,
    }
    if num in prf:
        entry["pr"] = prf[num]
    if k not in state:
        state[k] = entry
        new_journaled.append(k)
    else:
        state[k].update(entry)

# --- Archive CLOSED chains from target set ---
newly_archived = []
for line in open("memory/chain-facts.jsonl"):
    d = json.loads(line)
    repo, num = d["repo"], d["num"]
    if d.get("state") != "CLOSED":
        continue
    k = key(repo, num)
    reason = d.get("reason") or "closed"
    archived[k] = {
        "reason": "issue %s (%s)" % ("CLOSED", reason),
        "title": titles.get((repo, num), ""),
        "archivedAt": NOW,
        "pr": prf.get(num),
    }
    if k in state:
        del state[k]
    newly_archived.append(k)

state["lastTick"] = state.get("lastTick", 0) + 1
state["lastTickAt"] = TICK_AT

json.dump(state, open("memory/supervisor-state.json", "w"), indent=2)

print("NEW journaled (%d):" % len(new_journaled))
for k in new_journaled: print("  +", k)
print("Newly archived (%d):" % len(newly_archived))
for k in newly_archived: print("  ~", k)
print("tick:", state["lastTick"], "top-level chains:", len([k for k in state if k.startswith("gh-issue-")]), "archived:", len(archived))
