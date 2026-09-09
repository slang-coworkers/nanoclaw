---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786961346824-tq15kj
written_at: 2026-08-17T18:14:08.164Z
---

# [approver/challenger] WebFetch silently FOLLOWS same-host 302s — verify any "URL X serves page Y" route claim with curl -D - (no-follow), not WebFetch

# [approver/challenger] WebFetch silently follows same-host 302s — a route/redirect claim needs `curl -D -`, not WebFetch

**PR:** shader-slang/slang#12572 R2 @ feb74712e849 — decided WOULD_APPROVE/CLEAN. The +2/-2 diff switched a dashboard PR-link suffix from `/files` to `/changes`. To confirm the PR's stated purpose ("link to the Files changed tab") I WebFetched `https://github.com/shader-slang/slang/pull/12572/changes`; it returned the rendered Files-changed diff view, so I wrote in the derivation that `/changes` is "a valid direct/canonical route that lands on the diff."

**Root cause:** WebFetch **silently follows same-host redirects** and reports only the FINAL page. `/pull/N/changes` actually returns **HTTP 302 → Location `/pull/N/files`** — it is a first-party GitHub *alias*, not a direct route. WebFetch masked the redirect entirely; the page I saw was `/files` reached via a hop. My "direct/canonical route" claim was materially wrong, and only the codex OUTPUT_REVIEW critique (which fetched with headers) caught it.

**How to catch it (transferable):** any claim of the form "URL X serves/renders page Y" — especially a *route-shape* claim in a challenger note (a link target, a redirect, a canonical path, a 404-vs-200 distinction) — must be verified with a **no-follow, header-printing** fetch, not WebFetch:
```
curl -sS -o /dev/null -D - "<url>"   # look at the FIRST status line + Location:
```
Interpret the status line, not the body: `200` = direct; `302/301` + `Location:` = a redirect/alias (report the hop). Add a **control**: fetch a deliberately bogus sibling (e.g. `/bogustab`) — if the real suffix redirects somewhere *specific* (`/changes`→`/files`) while the bogus one redirects *elsewhere* (`/bogustab`→conversation), the real suffix is a *recognized* alias, not a catch-all. WebFetch is fine for reading content; it is the wrong instrument for establishing routing/HTTP-status facts because it collapses the redirect chain.

**Consequence for the verdict:** the corrected fact (reviewer still lands on the diff, via one redirect hop) did not change the decision — a redirect hop is a cosmetic/robustness nit, not a regression or a purpose-undermining gap. But the *evidence wording* was wrong until corrected. General rule: when the decision turns on "does this URL go where the PR claims," the tool must show you the status code and Location header, not a post-redirect rendering. This is an instance of "the scrutiny I aim outward is the scrutiny I owe my own instruments" — WebFetch's redirect-following is a property of MY tool that silently altered the evidence.
