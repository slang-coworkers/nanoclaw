---
name: project_nanoclaw_1082_ncl_mcp_tools_verbs
description: "slang-coworkers/nanoclaw#1082 ncl groups mcp-tools get/set — MERGED 5.5min after sync (7th race); reviewed POST-merge, 2/2 blobs == nv-main BY HASH; 2 red findings both in the operator-facing surface, live on nv-main"
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1082
---

**slang-coworkers/nanoclaw#1082** — `feat(ncl): mcp-tools get/set`, author **szihs**, base `nv-main`, branch
`fix/nv-main/ncl-mcp-tools`. 2 files, +123/−1 (`src/cli/resources/groups.ts`, `src/mcp-auth-proxy.ts`).
**ROUTING: handled INLINE by Main — 7th instance of the rule** (NanoClaw platform-infra fork, never to a
`*-pr-approver`; see [[project_nanoclaw_pr874_webhook_route_approver]]).

**MERGE RACE #7 — merged `10:26:12Z`, ~5.5 min after the `synchronize` push, mid-review.** Reviewed head
`976cd4aa`; **both changed blobs byte-identical to `nv-main` BY HASH** (`groups.ts` `84b0885…`,
`mcp-auth-proxy.ts` `166f6dc…`) ⇒ findings are LIVE. Comment `5190812383`.

**Two webhooks: `opened` then `synchronize`.** The sync was **prettier-only** (3 single-quoted strings
holding `\'` → double quotes; no logic), which cleared a REAL red `Format check`. Verified green locally
on the new head. ⭐**A `synchronize` mid-review is not automatically a re-review — diff the two heads
first; a formatting-only push means the whole in-flight analysis carries over unchanged.**

## The two 🔴 (both in the NEW OPERATOR SURFACE, neither findable by reading)

**(a) `get` reports a restricted group as UNRESTRICTED with `blocked: []`.** For a non-admin group with
`allowed_mcp_tools IS NULL`, `get` says `restricted:false / blocked:[]` and its own description says
"null means unrestricted (every discovered tool is callable)". But `resolveAllowedMcpTools`
(`container-runner.ts:329`) falls through to `resolveTypeManifest(agentGroup).tools` (:356) — a real narrow
list, **enforced on BOTH legs**: proxy 403 via `registerContainerToken` (:493 → `mcp-auth-proxy.ts:455`)
AND the SDK's `disallowedTools` via `computeBlockedTools` (`claude.ts:134`). Measured: `coworker_type`
null or `'default'` → **17 tools**, so not vacuous. ⭐⭐⭐**The repo already asserts the OPPOSITE reading:
`runtime-guardrails.test.ts` fixture has `allowed_mcp_tools: null` (~:87) and asserts 2–3 tools at :125,
:173-181; NO test anywhere asserts "null = unrestricted"** ⇒ a contradiction INSIDE the tree, not a
convention. Fix is cheap — `groups.ts` already imports `container-runner.js` (:4), no cycle.

**(b-EXTENDED, found by the late probe — the divergence hits `get` TOO, in the OPPOSITE direction.)** The
`get` handler has **zero `is_admin` references** (verified, `groups.ts:99-136`), so for an admin group it
parses the column and reports it as ACTIVE while the resolver never reads it. Measured on `is_admin:1` +
one-tool list: `get` → `restricted:true, blocked:["…create_or_update_file"]`; resolver → **both** tools.
⇒ **`get` names a specific tool as blocked that is in fact CALLABLE.** ⭐⭐⭐**Opposite direction from (a):
null non-admin ⇒ UNDER-reports restriction; admin ⇒ OVER-reports it. Same root cause — `get` reimplements
the column read instead of asking the resolver** ⇒ the one fix (call `resolveAllowedMcpTools`, expose
`effective_allow_list`/`effective_source`) closes null + admin + comma-form together. **Posted as a
follow-up comment `5190846434` because my first comment framed this as write-path-only.**

**(b) `set` on an `is_admin` group does NOT survive respawn but says it will.** `resolveAllowedMcpTools`
tests `is_admin` FIRST (:330) and returns the full discovered inventory at :340 — `allowed_mcp_tools` is
only read at :343, **unreachable for admin groups**. So `set` persists + re-scopes the live token (works
until respawn) and returns `"also persisted for future spawns."` — persisted but never HONORED.
**Reachable: both new guards constrain the CALLER (`groups.ts:151,158`), never the TARGET**, so a host
operator restricting the admin group is a normal invocation — and admin has the WIDEST inventory.

## 🟡 notes posted

- **Legacy comma form diverges between the two readers**: `get` (`JSON.parse`→`null` on throw, :112-118)
  reads it as UNRESTRICTED; the resolver catches and comma-splits (:347-353) → a real restriction.
  Verified on both routines. Latent (no writer emits comma today — `create-agent.ts:259` and the new `set`
  both `JSON.stringify`), but the resolver's fallback exists BECAUSE such rows are expected.
- **An agent self-targeted `set` mints an approval card GUARANTEED to fail** — at `cli_scope:'group'` the
  `--id` auto-fill makes the guard's cross-group check pass (`guard.ts:84`, `id===own`), `HOLD` returns at
  `dispatch.ts:170` **before the handler**, and the self-target throw lives INSIDE the handler ⇒ human
  approves, then it errors. Check is right, wrong side of the gate. ⭐**A card that can only fail trains
  operators to approve without reading.**
- `--tools null` leaves live containers narrow while the DB says unrestricted (inverse asymmetry) — but
  HONESTLY DISCLOSED in its own `note`, so design choice, not defect.
- **No tests** (+123/−1, zero test lines). Baseline MEASURED byte-identical head vs base `a5e5b48`:
  `mcp-auth-proxy.test.ts` 28 pass/3 skip, `src/cli` 164 pass ⇒ no regressions AND no new coverage.
  One assertion each would have caught both 🔴. `tsc --noEmit` clean.
- Neither verb declares `args` ⇒ lenient path, stray flags ignored (`crud.ts:501`); `tasks.ts`/`sessions.ts`
  opt into strict. Bare `--tools` → boolean `true` (`client.ts:78-80`) lands in `Array.isArray(true)` ⇒
  right error, misleading route.

## ✅ Claims that CHECKED OUT (verified, not assumed)

"No new MCP handshake" — accurate, `getDiscoveredToolInventory()` (:234) is a pure cache read; discovery
runs at `index.ts:248` + `mcp-registry.ts:510`. `updateContainerTokenScope` mutating in place — correct AND
for the right reason: iterates ALL tokens for the folder (a group holds several: root + per-thread), and
`revokeContainerToken` is wired on exit (`container-runner.ts:572`) ⇒ `live_containers_rescoped` is truthful.

**RESUME = szihs replies ⇒ ONE follow-up closes both 🔴** (reuse the resolver in `get` + `effective_*`
fields; admin-branch honor-or-refuse; move the self-target check into the guard's `decide`; 4 tests).
Offered in the comment. Regressions LIVE on `nv-main`.

## ⛔⭐⭐⭐ The challenger proposed a NARROWING I checked and REFUSED — it was unfounded

**Adversarial pass returned "BOTH CLAIMS SURVIVE" on all 8 refutation angles** (a-h), independently
confirming: null is the DEFAULT for non-admin groups (`agent-groups.ts:17`, `create-agent.ts:259`) so the
case is common not edge; the description string `'A null allow-list means unrestricted (every discovered
tool is callable)'` (`groups.ts:105`) is a RUNTIME claim that forecloses the charitable "has a DB override"
reading; `get` is the ONLY per-group view (the proxy's `/tools` endpoint at `:327` is global);
`is_admin` has **no UNIQUE/CHECK constraint** — multiple admin groups are representable, `LIMIT 1`
(`agent-groups.ts:38`) is convention not cardinality; and the admin failure **fails OPEN** (silent
re-widening to full inventory on the most privileged group).

⛔**But it also urged me to re-ground 🔴#1 on the SDK leg only, because `mcp__nanoclaw__*` is exempted from
the proxy filter (`mcp-auth-proxy.ts:57,84`) and a `default`-typed manifest is mostly nanoclaw tools ⇒
"someone could argue unrestricted is nearly accurate on the proxy leg." I CHECKED IT AND IT IS WRONG:**
`blocked` = `discovered.filter(...)`, and `discovered` is keyed **only** by registry server names
(`detectStdioServers` reads `container/mcp-servers/*/pyproject.toml`; `detectRemoteServers` parses
`REMOTE_MCP_SERVERS` — `mcp-registry.ts:105-158`). **`mcp__nanoclaw__*` are IN-CONTAINER SDK tools and can
never key the discovered inventory** — the probe's measured inventory was `{"slangmcp":[…]}`, no nanoclaw
key. ⇒ **The exemption cannot affect `blocked[]` at all: those tools are not in the set being filtered.**
The objection "a reviewer will raise" does not apply, and adopting the narrowing would have weakened a
correct published claim on a false premise. **Nothing retracted.**

⭐⭐⭐**Textbook [[feedback_reversing_a_correct_position_under_a_defective_input]] — and the trap was
STRONGER here than usual: the correction arrived from a source that had just confirmed me on 8/8 points,
which is maximum borrowed credibility.** A challenger that agrees with you then hands you one weakening is
the least-audited input in the exchange. ⇒ **Check the objection's PREMISE with the same instrument you'd
use on a claim; "a reviewer might say X" is not evidence that X is true.**

**Both background agents went silent, I posted with an explicit "unchallenged" caveat, then one returned
~4 min later with a DIFFERENT harness** (real `dispatch()`, real proxy 403 + a 200 control, real
`discoverTools` vs my paired parse-routine mirror) and **corroborated all 4 findings AND found the boundary
above.** ✅**Every published claim held; nothing retracted.** But:

⭐⭐⭐**A CORRECT RULE WITH AN UNVISITED BOUNDARY is indistinguishable from a complete one — and I could
not have found this edge by re-reading my own review, because my verification range never included an
admin group's READ path.** I checked admin-`set` and non-admin-`get`; the untested cell was admin-`get`.
⇒ **Enumerate the CASE MATRIX over the axes you already identified (caller/target × admin/non-admin ×
read/write), not just the cells your narrative walks through.** Same shape as #1079's "only a case matrix
× 3 triggers found it".
⭐⭐**And the late result is why the caveat was worth writing:** labelling it "unchallenged" cost nothing
and made the follow-up a strengthening rather than an embarrassment. **Publish the confidence BASIS, not
just the finding.**
⚠️**My prompt to the probe contained a framing error ("proper subset") that I did NOT publish** — the
posted claim was the general form and is correct. ⭐⭐**Check what you actually SHIPPED before retracting;
a flaw in your working notes is not automatically a flaw in the artifact.** (Measured fixture: manifest
list and discovered inventory were DISJOINT, so the real consequence is stronger than "proper subset".)

⭐⭐**Same series lesson, 4th consecutive PR: every defect is in the INSTRUMENT/operator surface, and
reading the diff finds NONE of them** — both 🔴 came from running the real resolver and both parse
routines with paired controls. Direct instance of [[feedback_control_the_instrument_not_the_reasoning]]
and [[feedback_a_guard_can_be_inert_and_read_as_passing]] (here: a *report* that cannot say "restricted by
manifest", so it says "unrestricted").
