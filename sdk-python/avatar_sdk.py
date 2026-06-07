"""Tiny HTTP client SDK for the Pix Avatar API.

Run the API with:

    npm run serve:api
"""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, Optional
from urllib import request


@dataclass
class Avatar:
    spec: Dict[str, Any]
    base_url: str = "http://127.0.0.1:8787"

    @classmethod
    def random(cls, seed: Optional[int | str] = None, preset: Optional[str] = None, base_url: str = "http://127.0.0.1:8787") -> "Avatar":
        payload = {"seed": seed, "preset": preset}
        data = _post(f"{base_url}/avatar/random", payload)
        return cls(data["spec"], base_url=base_url)

    def set_trait(self, key: str, value: str) -> "Avatar":
        self.spec.setdefault("traits", {})[key] = value
        return self

    def patch(self, ops: Iterable[Dict[str, Any]]) -> "Avatar":
        self.spec.setdefault("patches", []).extend(list(ops))
        return self

    def render(self, out: Optional[str | Path] = None) -> Dict[str, Any]:
        data = _post(f"{self.base_url}/avatar/render", {"spec": self.spec})
        if out:
            Path(out).write_bytes(base64.b64decode(data["image"]["png_base64"]))
        return data

    def inspect(self, pixel: Optional[tuple[int, int]] = None) -> Dict[str, Any]:
        return _post(f"{self.base_url}/avatar/inspect", {"spec": self.spec, "pixel": pixel})


def _post(url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with request.urlopen(req) as res:
        return json.loads(res.read().decode("utf-8"))
