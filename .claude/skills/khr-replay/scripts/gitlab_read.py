"""A GitLab REST client that can only read.

There is no write method: every request is a GET to ``/api/v4/...`` on the
configured host, redirects are refused, and no credential is ever sent. The
credential gateway (OneCLI) injects the token at the network boundary. Point
``HTTPS_PROXY`` at the gateway and ``SSL_CERT_FILE`` at its CA certificate.
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from collections.abc import Callable, Iterator
from typing import Any

Transport = Callable[[str], tuple[Any, dict[str, str]]]


class ReadOnlyError(RuntimeError):
    """Raised for anything other than a plain read of the configured host."""


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args: Any, **kwargs: Any) -> None:
        raise ReadOnlyError("redirects are refused")


def _urllib_transport(timeout: float) -> Transport:
    opener = urllib.request.build_opener(urllib.request.ProxyHandler(), _NoRedirect())

    def fetch(url: str) -> tuple[Any, dict[str, str]]:
        request = urllib.request.Request(
            url, method="GET", headers={"Accept": "application/json"}
        )
        with opener.open(request, timeout=timeout) as response:
            headers = {k.lower(): v for k, v in response.headers.items()}
            return json.loads(response.read().decode("utf-8")), headers

    return fetch


class ReadOnlyGitLab:
    def __init__(
        self,
        base_url: str,
        transport: Transport | None = None,
        timeout: float = 60.0,
        max_pages: int = 200,
    ):
        parsed = urllib.parse.urlsplit(base_url)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.path not in {"", "/"}
        ):
            raise ReadOnlyError("base_url must be https://<host> with no path")
        self.base = f"https://{parsed.netloc}"
        self.host = parsed.netloc
        self.max_pages = max_pages
        self._fetch = transport or _urllib_transport(timeout)

    def _url(self, path: str, params: dict[str, Any] | None) -> str:
        if not path.startswith("/api/v4/") or ".." in path:
            raise ReadOnlyError(f"refusing path outside /api/v4: {path}")
        query = urllib.parse.urlencode(
            {k: v for k, v in (params or {}).items() if v is not None}
        )
        url = f"{self.base}{path}" + (f"?{query}" if query else "")
        if urllib.parse.urlsplit(url).netloc != self.host:
            raise ReadOnlyError("refusing a different host")
        return url

    def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        body, _ = self._fetch(self._url(path, params))
        return body

    def paged(self, path: str, params: dict[str, Any] | None = None) -> Iterator[Any]:
        """Yield every item across pages, following ``X-Next-Page`` strictly in order."""
        page = 1
        for _ in range(self.max_pages):
            body, headers = self._fetch(
                self._url(path, {**(params or {}), "per_page": 100, "page": page})
            )
            if not isinstance(body, list):
                raise ReadOnlyError(f"expected a list from {path}")
            yield from body
            next_page = headers.get("x-next-page", "").strip()
            if not next_page:
                return
            if next_page != str(page + 1):
                raise ReadOnlyError(
                    f"non-sequential pagination from {path}: {page} -> {next_page}"
                )
            page += 1
        raise ReadOnlyError(f"more than {self.max_pages} pages from {path}")


def project_path(project: int | str) -> str:
    return urllib.parse.quote(str(project), safe="")
