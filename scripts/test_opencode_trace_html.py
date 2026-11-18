"""opencode-trace-html.py turns an OpenCode trace into one readable page.

The page must show the main agent's conversation and every model call, must never carry the request
headers (the trace keeps them redacted, but the page has no reason to show them at all), and one bad
line in a trace must not lose the rest.
Run: python3 -m unittest scripts/test_opencode_trace_html.py
"""
from __future__ import annotations

import importlib.util
import json
import os
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("opencode_trace_html", os.path.join(HERE, "opencode-trace-html.py"))
oth = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(oth)

SYSTEM = {"role": "system", "content": "You are the triager. Follow the rules."}
USER = {"role": "user", "content": "Please look at issue 42."}


def sse(*chunks):
    return "".join("data: " + json.dumps(c) + "\n\n" for c in chunks) + "data: [DONE]\n\n"


def record(i, messages, body, status=200):
    return {
        "id": i,
        "at": f"2026-11-16T08:0{i}:00.000Z",
        "method": "POST",
        "url": "/v1/chat/completions",
        "requestHeaders": {"authorization": "Bearer SECRET-TOKEN-1234", "content-type": "application/json"},
        "request": {"body": {"model": "nvidia/zai-org/glm-5.3", "messages": messages, "tools": [{"type": "function"}]}},
        "status": status,
        "responseHeaders": {"content-type": "text/event-stream"},
        "response": {"body": body},
        "durationMs": 1500,
    }


def tool_call_chunk():
    return {"model": "nvidia/zai-org/glm-5.3", "choices": [{"delta": {"tool_calls": [
        {"index": 0, "function": {"name": "bash", "arguments": '{"command":'}}]}}]}


def tool_args_chunk():
    return {"choices": [{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": ' "gh issue view 42"}'}}]}}]}


def write_trace(path):
    first = record(1, [SYSTEM, USER], sse(tool_call_chunk(), tool_args_chunk(),
                                          {"choices": [], "usage": {"prompt_tokens": 1000, "completion_tokens": 20}}))
    tool_turn = [SYSTEM, USER,
                 {"role": "assistant", "content": None, "tool_calls": [{"function": {"name": "bash", "arguments": "{}"}}]},
                 {"role": "tool", "content": "issue 42: crash in the parser"}]
    second = record(2, tool_turn, sse(
        {"model": "nvidia/zai-org/glm-5.3", "choices": [{"delta": {"reasoning_content": "The parser crashes."}}]},
        {"choices": [{"delta": {"content": "Triage done: parser bug, labelled."}}]},
        {"choices": [], "usage": {"prompt_tokens": 1200, "completion_tokens": 30,
                                  "prompt_tokens_details": {"cached_tokens": 900}}}))
    failed = record(3, tool_turn, '{"error":"Too Many Requests"}', status=429)
    with open(path, "w") as f:
        f.write(json.dumps(first) + "\n")
        f.write("this line is not JSON\n")
        f.write(json.dumps(second) + "\n")
        f.write(json.dumps(failed) + "\n")


class ConvertTest(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        self.dir = os.path.join(self.root, "groups", "slang-triager", ".opencode-trace")
        os.makedirs(self.dir)
        self.trace = os.path.join(self.dir, "session-sess-1-abc.jsonl")
        write_trace(self.trace)

    def page(self):
        with open(oth.convert(self.trace)) as f:
            return f.read()

    def test_shows_the_conversation_and_the_final_reply(self):
        page = self.page()
        self.assertIn("OpenCode trace: slang-triager", page)
        self.assertIn("session sess-1-abc", page)
        self.assertIn("Please look at issue 42.", page)
        self.assertIn("Triage done: parser bug, labelled.", page)
        self.assertIn("The parser crashes.", page)

    def test_assembles_a_streamed_tool_call(self):
        self.assertIn("gh issue view 42", self.page())

    def test_lists_every_call_including_the_failed_one(self):
        page = self.page()
        self.assertEqual(page.count("<details><summary>call "), 3)
        self.assertIn("Too Many Requests", page)
        self.assertIn("3 model calls · 1 errors", page)
        self.assertIn("tokens in 2,200 (cached 900) · out 50", page)

    def test_never_shows_request_headers(self):
        page = self.page()
        self.assertNotIn("SECRET-TOKEN-1234", page)
        self.assertNotIn("authorization", page.lower().replace("authorization link", ""))

    def test_escapes_html_in_the_content(self):
        with open(self.trace, "a") as f:
            f.write(json.dumps(record(4, [SYSTEM, {"role": "user", "content": "<script>alert(1)</script>"}],
                                      sse({"choices": [{"delta": {"content": "ok"}}]}))) + "\n")
        page = self.page()
        self.assertNotIn("<script>alert(1)</script>", page)
        self.assertIn("&lt;script&gt;", page)

    def test_all_mode_writes_new_pages_and_skips_current_ones(self):
        self.assertEqual(oth.main(["--all", self.root]), 0)
        html_path = self.trace[: -len(".jsonl")] + ".html"
        self.assertTrue(os.path.exists(html_path))
        self.assertEqual(oct(os.stat(html_path).st_mode & 0o777), "0o600")
        before = os.path.getmtime(html_path)
        os.utime(html_path, (before + 100, before + 100))
        self.assertEqual(oth.main(["--all", self.root]), 0)
        self.assertEqual(os.path.getmtime(html_path), before + 100)

    def test_all_mode_ignores_event_files(self):
        with open(os.path.join(self.dir, "session-sess-1-abc.events.jsonl"), "w") as f:
            f.write('{"type":"x"}\n')
        oth.main(["--all", self.root])
        self.assertFalse(os.path.exists(os.path.join(self.dir, "session-sess-1-abc.events.html")))


if __name__ == "__main__":
    unittest.main()
