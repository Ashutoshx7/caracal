"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Test fixtures that boot the twenty external-style providers on free ports and wire the partner integration env.
"""
from __future__ import annotations

import os
import socket
import sys
import threading
import time

import pytest
import uvicorn

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("PROVIDERLAB_FAST", "1")


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class _UvicornInThread:
    def __init__(self, app, port: int):
        cfg = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning", loop="asyncio")
        self.server = uvicorn.Server(cfg)
        self.thread = threading.Thread(target=self.server.run, daemon=True)

    def start(self) -> None:
        self.thread.start()
        for _ in range(300):
            if self.server.started:
                return
            time.sleep(0.01)
        raise RuntimeError("uvicorn did not start")

    def stop(self) -> None:
        self.server.should_exit = True
        self.thread.join(timeout=3.0)


@pytest.fixture(scope="session")
def providerlab() -> dict[str, str]:
    """Boot every provider on a free port and wire LYNX_PARTNER_* env from its seed credential."""
    from _mock.providerlab import catalog, credentials
    from _mock.providerlab.app import build_app

    servers: list[_UvicornInThread] = []
    urls: dict[str, str] = {}

    def _eid(provider_id: str) -> str:
        return provider_id.upper().replace("-", "_")

    for provider in catalog.CATALOG:
        port = _free_port()
        server = _UvicornInThread(build_app(provider), port)
        server.start()
        servers.append(server)
        url = f"http://127.0.0.1:{port}"
        urls[provider.id] = url
        eid = _eid(provider.id)
        os.environ[f"LYNX_PARTNER_{eid}_URL"] = url
        seed = credentials.load(provider.id).data["seed"]
        if provider.category in ("api_key", "sdk"):
            os.environ[f"LYNX_PARTNER_{eid}_API_KEY"] = seed["apiKey"]
        elif provider.category == "bearer_token" or (provider.category == "mcp" and provider.mcp_auth == "bearer"):
            os.environ[f"LYNX_PARTNER_{eid}_TOKEN"] = seed["bearerToken"]
        elif provider.category in ("oauth2_client_credentials", "oauth2_authorization_code"):
            os.environ[f"LYNX_PARTNER_{eid}_CLIENT_ID"] = seed["clientId"]
            os.environ[f"LYNX_PARTNER_{eid}_CLIENT_SECRET"] = seed["clientSecret"]

    yield urls

    from app.services import partners
    partners.reset()
    for server in servers:
        server.stop()
