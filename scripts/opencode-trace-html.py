#!/usr/bin/env python3
"""Render an OpenCode trace (groups/<folder>/.opencode-trace/session-<id>.jsonl) as one self-contained HTML page.

The OpenCode trace proxy writes one JSON record per model call: the request body (OpenAI chat format, with the
whole message history) and the raw reply (a server-sent event stream). This page shows the main agent's
conversation once, then every call with its reply, so an OpenCode session can be read the way a claude-trace
page is read.

Usage:
  opencode-trace-html.py <trace.jsonl> [<out.html>]          one file (default: same name with .html)
  opencode-trace-html.py --all <nanoclaw root> [--since-min N] every trace newer than its page
Standard library only. The trace files hold prompts and replies, so the page must stay behind the same access
as the trace files themselves.
"""
import hashlib
import html
import json
import os
import sys
import time
from collections import Counter

TOOL_RESULT_LIMIT = 6000
SYSTEM_LIMIT = 40000


def esc(s):
    return html.escape(str(s if s is not None else ""))


def clip(s, n):
    s = s if isinstance(s, str) else json.dumps(s, ensure_ascii=False)
    return s if len(s) <= n else s[:n] + f"\n… [{len(s) - n} more characters]"


def content_text(content):
    """Return the text of an OpenAI message content: a string, or a list of parts."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out = []
        for p in content:
            if isinstance(p, dict):
                out.append(p.get("text") or (f"[{p.get('type')}]" if p.get("type") else json.dumps(p)[:200]))
            else:
                out.append(str(p))
        return "\n".join(out)
    return json.dumps(content, ensure_ascii=False)


def parse_reply(body):
    """Assemble a streamed (or plain) chat completion into text, reasoning, tool calls and usage."""
    text, reasoning, calls, usage, model = [], [], {}, {}, None
    if isinstance(body, dict):
        msg = (body.get("choices") or [{}])[0].get("message") or {}
        tool_calls = [{"name": (t.get("function") or {}).get("name"), "args": (t.get("function") or {}).get("arguments", "")}
                      for t in msg.get("tool_calls") or []]
        return {"text": content_text(msg.get("content")), "reasoning": msg.get("reasoning_content") or "",
                "tools": tool_calls, "usage": body.get("usage") or {}, "model": body.get("model")}
    for line in str(body or "").splitlines():
        line = line.strip()
        if not line.startswith("data:"):
            continue
        data = line[5:].strip()
        if data == "[DONE]":
            continue
        try:
            chunk = json.loads(data)
        except ValueError:
            continue
        model = chunk.get("model") or model
        if chunk.get("usage"):
            usage = chunk["usage"]
        for ch in chunk.get("choices") or []:
            d = ch.get("delta") or {}
            if d.get("content"):
                text.append(d["content"])
            if d.get("reasoning_content"):
                reasoning.append(d["reasoning_content"])
            for tc in d.get("tool_calls") or []:
                slot = calls.setdefault(tc.get("index", 0), {"name": "", "args": ""})
                fn = tc.get("function") or {}
                if fn.get("name"):
                    slot["name"] = fn["name"]
                if fn.get("arguments"):
                    slot["args"] += fn["arguments"]
    return {"text": "".join(text), "reasoning": "".join(reasoning), "tools": [calls[k] for k in sorted(calls)],
            "usage": usage, "model": model}


def load(path):
    recs = []
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            try:
                recs.append(json.loads(line))
            except ValueError:
                continue
    return recs


def call_view(rec):
    """Return the parts of one trace record that the page shows."""
    req = rec.get("request") or {}
    body = req.get("body") if isinstance(req, dict) else None
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except ValueError:
            body = None
    body = body if isinstance(body, dict) else {}
    resp = rec.get("response") or {}
    rbody = resp.get("body") if isinstance(resp, dict) else resp
    msgs = body.get("messages") or []
    system = content_text(msgs[0].get("content")) if msgs and msgs[0].get("role") == "system" else ""
    return {
        "at": rec.get("at", ""), "status": rec.get("status"), "ms": rec.get("durationMs"), "url": rec.get("url", ""),
        "model": body.get("model", "?"), "messages": msgs, "tools_offered": len(body.get("tools") or []),
        "thread": hashlib.sha1((body.get("model", "") + system[:4000]).encode()).hexdigest()[:8],
        "reply": parse_reply(rbody) if rec.get("status") and int(rec.get("status") or 0) < 300 else None,
        "error": None if (rec.get("status") or 0) < 300 else clip(rbody if isinstance(rbody, str) else json.dumps(rbody), 1500),
    }


def render_message(m):
    role = m.get("role", "?")
    body = content_text(m.get("content"))
    parts = [f'<div class="msg {esc(role)}"><div class="role">{esc(role)}</div>']
    if role == "system":
        parts.append(f"<details><summary>system prompt ({len(body)} characters)</summary><pre>{esc(clip(body, SYSTEM_LIMIT))}</pre></details>")
    elif role == "tool":
        parts.append(f"<details><summary>tool result ({len(body)} characters)</summary><pre>{esc(clip(body, TOOL_RESULT_LIMIT))}</pre></details>")
    elif body:
        parts.append(f"<pre>{esc(body)}</pre>")
    for tc in m.get("tool_calls") or []:
        fn = tc.get("function") or {}
        parts.append(f'<div class="tool">→ {esc(fn.get("name"))}<pre>{esc(clip(fn.get("arguments", ""), TOOL_RESULT_LIMIT))}</pre></div>')
    parts.append("</div>")
    return "".join(parts)


def render_reply(r):
    if not r:
        return ""
    out = ['<div class="msg assistant reply"><div class="role">reply</div>']
    if r["reasoning"]:
        out.append(f"<details><summary>reasoning ({len(r['reasoning'])} characters)</summary><pre>{esc(r['reasoning'])}</pre></details>")
    if r["text"]:
        out.append(f"<pre>{esc(r['text'])}</pre>")
    for t in r["tools"]:
        out.append(f'<div class="tool">→ {esc(t["name"])}<pre>{esc(clip(t["args"], TOOL_RESULT_LIMIT))}</pre></div>')
    out.append("</div>")
    return "".join(out)


CSS = """
:root{--bg:#f7f8f6;--fg:#1c2320;--muted:#5d6762;--line:#d3d9d4;--card:#fff;--sys:#eef1f6;--usr:#e8f3ec;--ast:#fff;--tool:#f6f1e7;--err:#a8431f}
@media (prefers-color-scheme:dark){:root{--bg:#121614;--fg:#e2e8e3;--muted:#9aa59f;--line:#2e3833;--card:#1a201d;--sys:#1b2230;--usr:#17291f;--ast:#1a201d;--tool:#2a2418;--err:#f09a78}}
body{background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;margin:0;padding:24px max(16px,env(safe-area-inset-left))}
main{max-width:1100px;margin:auto}h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px}
.meta{color:var(--muted);font-size:13px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid var(--line);padding:4px 8px;text-align:left}
.msg{border:1px solid var(--line);border-radius:6px;margin:8px 0;padding:6px 10px;background:var(--ast)}.msg.system{background:var(--sys)}.msg.user{background:var(--usr)}.msg.tool{background:var(--tool)}
.role{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}pre{white-space:pre-wrap;word-break:break-word;margin:4px 0;font:12.5px/1.45 ui-monospace,Menlo,monospace}
.tool{font-family:ui-monospace,monospace;font-size:12.5px;color:var(--muted)}.err{color:var(--err)}details>summary{cursor:pointer;color:var(--muted)}
"""


def render(path, group="?", session="?"):
    recs = load(path)
    calls = [call_view(r) for r in recs]
    ok = [c for c in calls if c["reply"]]
    errors = [c for c in calls if c["error"]]
    usage = Counter()
    for c in ok:
        u = c["reply"]["usage"] or {}
        usage["in"] += int(u.get("prompt_tokens") or 0)
        usage["out"] += int(u.get("completion_tokens") or 0)
        usage["cached"] += int(((u.get("prompt_tokens_details") or {}).get("cached_tokens")) or 0)
    threads = Counter(c["thread"] for c in calls)
    main_thread = threads.most_common(1)[0][0] if threads else None
    models = Counter(c["model"] for c in calls)
    head = (f"<title>OpenCode trace {esc(group)} {esc(session)}</title><style>{CSS}</style><main>"
            f"<h1>OpenCode trace: {esc(group)}</h1><div class='meta'>session {esc(session)} · {len(calls)} model calls"
            f" · {len(errors)} errors · first {esc(calls[0]['at'] if calls else '')} · last {esc(calls[-1]['at'] if calls else '')}<br>"
            f"models: {esc(', '.join(f'{m} ×{n}' for m, n in models.most_common()))} · tokens in {usage['in']:,}"
            f" (cached {usage['cached']:,}) · out {usage['out']:,}</div>")
    out = [head]
    last_main = next((c for c in reversed(calls) if c["thread"] == main_thread and c["reply"]), None)
    if last_main:
        out.append("<h2>Conversation (main agent, as of its last call)</h2>")
        out.extend(render_message(m) for m in last_main["messages"])
        out.append(render_reply(last_main["reply"]))
    out.append("<h2>Every model call</h2><table><tr><th>#</th><th>time</th><th>model</th><th>status</th><th>seconds</th>"
               "<th>messages</th><th>reply</th></tr>")
    for i, c in enumerate(calls, 1):
        r = c["reply"]
        summary = (r["text"][:90] if r and r["text"] else ", ".join(t["name"] for t in r["tools"]) if r else "") if r else c["error"][:90] if c["error"] else ""
        out.append(f"<tr><td>{i}</td><td>{esc(c['at'][11:19])}</td><td>{esc(c['model'])}</td>"
                   f"<td class='{'' if r else 'err'}'>{esc(c['status'])}</td><td>{(c['ms'] or 0) / 1000:.1f}</td>"
                   f"<td>{len(c['messages'])}</td><td>{esc(summary)}</td></tr>")
    out.append("</table>")
    prev = {}
    for i, c in enumerate(calls, 1):
        start = prev.get(c["thread"], 0)
        new = c["messages"][start:] if start <= len(c["messages"]) else c["messages"]
        prev[c["thread"]] = len(c["messages"])
        out.append(f"<details><summary>call {i} · {esc(c['at'][11:19])} · {esc(c['model'])} · status {esc(c['status'])}"
                   f" · {len(new)} new messages</summary>")
        out.extend(render_message(m) for m in new)
        out.append(render_reply(c["reply"]) if c["reply"] else f"<pre class='err'>{esc(c['error'])}</pre>")
        out.append("</details>")
    out.append("</main>")
    return "".join(out)


def convert(path, out=None):
    parts = os.path.normpath(path).split(os.sep)
    group = parts[-3] if len(parts) >= 3 else "?"
    session = os.path.basename(path)[len("session-"):-len(".jsonl")] if os.path.basename(path).startswith("session-") else os.path.basename(path)
    out = out or path[: -len(".jsonl")] + ".html"
    tmp = out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>")
        f.write(render(path, group, session))
    os.chmod(tmp, 0o600)
    os.replace(tmp, out)
    return out


def main(argv):
    if len(argv) >= 2 and argv[0] == "--all":
        root = argv[1]
        since = float(argv[argv.index("--since-min") + 1]) if "--since-min" in argv else None
        n = 0
        groups_dir = os.path.join(root, "groups")
        for g in sorted(os.listdir(groups_dir)):
            d = os.path.join(groups_dir, g, ".opencode-trace")
            if not os.path.isdir(d):
                continue
            for name in os.listdir(d):
                if not name.startswith("session-") or not name.endswith(".jsonl") or name.endswith(".events.jsonl"):
                    continue
                src = os.path.join(d, name)
                dst = src[: -len(".jsonl")] + ".html"
                if since is not None and os.path.getmtime(src) < time.time() - since * 60:
                    continue
                if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
                    continue
                try:
                    convert(src, dst)
                    n += 1
                except (OSError, ValueError, KeyError, TypeError) as e:  # one bad trace must not stop the rest
                    print(f"skip {src}: {e}", file=sys.stderr)
        print(f"opencode-trace-html: {n} page(s) written")
        return 0
    if not argv:
        print(__doc__)
        return 2
    print(convert(argv[0], argv[1] if len(argv) > 1 else None))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
