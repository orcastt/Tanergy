import base64
import socket
from typing import Optional

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from tangent_api import ai_provider_assets, remote_image_import
from tangent_api.ai_schemas import AiRunRequest
from tangent_api.main import app
from tangent_api.request_context import ApiRequestContext, ApiWorkspaceContext
from tangent_api.remote_image_import import RemoteImageImport, fetch_remote_image
from tangent_api.storage import asset_store_common

PNG_BYTES = b"\x89PNG\r\n\x1a\n"
SVG_BYTES = b"<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"
PDF_BYTES = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n"
ACTIVE_DOCUMENT_DETAIL = "SVG and PDF assets are not accepted by the image pipeline."


class FakeRemoteResponse:
    def __init__(
        self,
        *,
        content: bytes = b"",
        headers: Optional[dict[str, str]] = None,
        status: int = 200,
        url: str = "",
    ):
        self._content = content
        self._cursor = 0
        self.headers = headers or {}
        self.status = status
        self._url = url

    def read(self, size: int) -> bytes:
        _ = size
        if self._cursor >= len(self._content):
            return b""
        chunk = self._content[self._cursor : self._cursor + size]
        self._cursor += len(chunk)
        return chunk

    def close(self) -> None:
        return None

    def geturl(self) -> str:
        return self._url


def test_asset_data_url_rejects_svg_and_pdf_payloads():
    for mime, payload in (("image/svg+xml", SVG_BYTES), ("application/pdf", PDF_BYTES)):
        data_url = f"data:{mime};base64,{base64.b64encode(payload).decode('ascii')}"
        with pytest.raises(HTTPException) as exc:
            asset_store_common.parse_image_data_url(data_url)

        assert exc.value.status_code == 400
        assert exc.value.detail == ACTIVE_DOCUMENT_DETAIL


def test_asset_upload_rejects_svg_and_pdf_payloads(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_ASSET_STORAGE_DIR", str(tmp_path / "assets"))
    client = TestClient(app)

    svg_response = client.post(
        "/api/v1/assets/upload",
        data={"height": "1", "origin": "upload", "title": "SVG", "width": "1"},
        files={"file": ("image.svg", SVG_BYTES, "image/svg+xml")},
    )
    assert svg_response.status_code == 400
    assert svg_response.json()["detail"] == ACTIVE_DOCUMENT_DETAIL

    pdf_response = client.post(
        "/api/v1/assets/upload",
        data={"height": "1", "origin": "upload", "title": "PDF", "width": "1"},
        files={"file": ("image.png", PDF_BYTES, "image/png")},
    )
    assert pdf_response.status_code == 400
    assert pdf_response.json()["detail"] == ACTIVE_DOCUMENT_DETAIL


def test_remote_image_import_rejects_private_and_metadata_hosts(monkeypatch):
    def fake_getaddrinfo(host, *_args, **_kwargs):
        if host == "example.com":
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))]
        if host == "127.0.0.1":
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 0))]
        if host == "100.100.100.200":
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("100.100.100.200", 0))]
        raise socket.gaierror()

    monkeypatch.setattr(remote_image_import.socket, "getaddrinfo", fake_getaddrinfo)
    monkeypatch.setattr(
        remote_image_import,
        "_open_remote_response",
        lambda url: FakeRemoteResponse(status=200, url=url),
    )

    with pytest.raises(HTTPException) as exc:
        fetch_remote_image("https://127.0.0.1/image.png")
    assert exc.value.status_code == 400
    assert exc.value.detail == "Remote image URL host is not allowed."

    with pytest.raises(HTTPException) as exc:
        fetch_remote_image("https://100.100.100.200/image.png")
    assert exc.value.status_code == 400
    assert exc.value.detail == "Remote image URL host is not allowed."

    with pytest.raises(HTTPException) as exc:
        fetch_remote_image("https://metadata.google.internal/image.png")
    assert exc.value.status_code == 400
    assert exc.value.detail == "Remote image URL host is not allowed."


def test_remote_image_import_rejects_redirect_to_private_host(monkeypatch):
    def fake_getaddrinfo(host, *_args, **_kwargs):
        if host == "example.com":
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))]
        if host == "cdn.example.com":
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.35", 0))]
        if host == "169.254.169.254":
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("169.254.169.254", 0))]
        raise socket.gaierror()

    responses = [
        FakeRemoteResponse(status=302, headers={"location": "http://169.254.169.254/latest/meta-data/"}),
    ]
    monkeypatch.setattr(remote_image_import.socket, "getaddrinfo", fake_getaddrinfo)
    monkeypatch.setattr(remote_image_import, "_open_remote_response", lambda url: responses.pop(0))

    with pytest.raises(HTTPException) as exc:
        fetch_remote_image("https://example.com/image.png")

    assert exc.value.status_code == 400
    assert exc.value.detail == "Remote image URL host is not allowed."


def test_remote_image_import_rejects_redirect_to_non_http_scheme(monkeypatch):
    monkeypatch.setattr(
        remote_image_import.socket,
        "getaddrinfo",
        lambda host, *_args, **_kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))],
    )
    responses = [
        FakeRemoteResponse(status=302, headers={"location": "file:///etc/passwd"}),
    ]
    monkeypatch.setattr(remote_image_import, "_open_remote_response", lambda url: responses.pop(0))

    with pytest.raises(HTTPException) as exc:
        fetch_remote_image("https://example.com/image.png")

    assert exc.value.status_code == 400
    assert exc.value.detail == "Remote image URL must use HTTP or HTTPS."


def test_remote_image_import_follows_redirect_to_public_image(monkeypatch):
    def fake_getaddrinfo(host, *_args, **_kwargs):
        if host == "example.com":
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))]
        if host == "cdn.example.com":
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.35", 0))]
        raise socket.gaierror()

    responses = [
        FakeRemoteResponse(
            status=302,
            headers={"location": "https://cdn.example.com/final.png"},
            url="https://example.com/image.png",
        ),
        FakeRemoteResponse(
            content=PNG_BYTES,
            headers={"content-length": str(len(PNG_BYTES)), "content-type": "image/png"},
            status=200,
            url="https://cdn.example.com/final.png",
        ),
    ]
    monkeypatch.setattr(remote_image_import.socket, "getaddrinfo", fake_getaddrinfo)
    monkeypatch.setattr(remote_image_import, "_open_remote_response", lambda url: responses.pop(0))

    result = fetch_remote_image("https://example.com/image.png")

    assert isinstance(result, RemoteImageImport)
    assert result.mime == "image/png"
    assert result.file_name == "final.png"
    assert result.content == PNG_BYTES


def test_ai_output_asset_rejects_svg_payloads(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_ASSET_STORAGE_DIR", str(tmp_path / "assets"))
    payload = AiRunRequest(prompt="Generate an image.", run_type="image_generation")
    context = _make_context()

    with pytest.raises(HTTPException) as exc:
        ai_provider_assets.persist_provider_output_assets(
            [ai_provider_assets.ProviderImageOutput(content=SVG_BYTES, mime="image/svg+xml")],
            context,
            payload,
            "jiekou",
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == ACTIVE_DOCUMENT_DETAIL


def _make_context() -> ApiRequestContext:
    return ApiRequestContext(
        auth_mode="required",
        is_dev_fallback=False,
        user_avatar_initials="TU",
        user_display_name="Test User",
        user_email="test@example.com",
        user_email_verified=True,
        user_id="user_test",
        workspace_board_count=0,
        workspace_id="workspace_test",
        workspace_kind="solo_workspace",
        workspace_memberships=[
            ApiWorkspaceContext(
                board_count=0,
                workspace_id="workspace_test",
                workspace_kind="solo_workspace",
                workspace_name="workspace_test",
                workspace_plan_key="free_canvas",
                workspace_role="owner",
            )
        ],
        workspace_name="workspace_test",
        workspace_plan_key="free_canvas",
        workspace_role="owner",
    )
