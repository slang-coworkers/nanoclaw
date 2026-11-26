"""A canned, read-only GitLab for tests: maps request paths to responses."""

from __future__ import annotations

import urllib.parse
from typing import Any


class FakeGitLab:
    def __init__(self, routes: dict[str, Any], page_size: int = 2):
        self.routes = routes
        self.page_size = page_size
        self.requests: list[str] = []

    def __call__(self, url: str) -> tuple[Any, dict[str, str]]:
        self.requests.append(url)
        parts = urllib.parse.urlsplit(url)
        query = dict(urllib.parse.parse_qsl(parts.query))
        key = parts.path
        for extra in ("username", "search"):
            if extra in query:
                key += f"?{extra}={query[extra]}"
        if key not in self.routes:
            raise KeyError(f"unexpected request {key}")
        body = self.routes[key]
        if "page" not in query or not isinstance(body, list):
            return body, {}
        page = int(query["page"])
        chunk = body[(page - 1) * self.page_size : page * self.page_size]
        more = page * self.page_size < len(body)
        return chunk, {"x-next-page": str(page + 1) if more else ""}
