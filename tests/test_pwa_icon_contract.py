"""PWA manifest/icon contract — see ~/Droppbox/programming/dev-kit/pwa-icons/CHECKLIST.md.

Reimplemented in Python (TestClient + stdlib zlib) rather than copying the
dev-kit's Node version verbatim, to match this project's existing
pytest/TestClient stack and avoid adding a Node/TypeScript toolchain or a
new pip dependency (Pillow isn't in requirements.txt). The PNG pixel
decoder below mirrors the dev-kit script's own hand-rolled decoder
(8-bit, non-interlaced, RGB/RGBA only) for the same dependency-free reason.
"""
import hashlib
import re
import struct
import zlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
client = TestClient(app)

# Calibrated in the dev-kit script against known-good/known-bad icons: a
# normal antialiased rounded-corner fringe sits near 0.3%; a washed-out
# unflattened fill sits near 35%. See pwa_icon_contract.ts for the history.
MAX_PARTIAL_ALPHA_FRACTION = 0.02


def _paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def decode_png(data: bytes):
    """Minimal 8-bit, non-interlaced RGB/RGBA PNG decoder. Returns (w, h, rgba bytes)."""
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    offset = 8
    width = height = bit_depth = color_type = interlace = 0
    idat = bytearray()
    while offset < len(data):
        (length,) = struct.unpack_from(">I", data, offset)
        chunk_type = data[offset + 4:offset + 8]
        chunk_data = data[offset + 8:offset + 8 + length]
        if chunk_type == b"IHDR":
            width, height = struct.unpack_from(">II", chunk_data, 0)
            bit_depth = chunk_data[8]
            color_type = chunk_data[9]
            interlace = chunk_data[12]
        elif chunk_type == b"IDAT":
            idat += chunk_data
        elif chunk_type == b"IEND":
            break
        offset += 12 + length
    assert bit_depth == 8, f"unsupported bit depth {bit_depth}"
    assert interlace == 0, "interlaced PNG not supported"
    assert color_type in (2, 6), f"unsupported color type {color_type}"

    channels = 4 if color_type == 6 else 3
    raw = zlib.decompress(bytes(idat))
    stride = width * channels
    out = bytearray(height * stride)
    raw_offset = 0
    for y in range(height):
        filter_type = raw[raw_offset]
        raw_offset += 1
        scanline = raw[raw_offset:raw_offset + stride]
        raw_offset += stride
        row_start = y * stride
        prev_start = (y - 1) * stride
        for x in range(stride):
            raw_byte = scanline[x]
            a = out[row_start + x - channels] if x >= channels else 0
            b = out[prev_start + x] if y > 0 else 0
            c = out[prev_start + x - channels] if y > 0 and x >= channels else 0
            if filter_type == 0:
                value = raw_byte
            elif filter_type == 1:
                value = (raw_byte + a) & 0xFF
            elif filter_type == 2:
                value = (raw_byte + b) & 0xFF
            elif filter_type == 3:
                value = (raw_byte + (a + b) // 2) & 0xFF
            elif filter_type == 4:
                value = (raw_byte + _paeth(a, b, c)) & 0xFF
            else:
                raise AssertionError(f"unsupported filter type {filter_type}")
            out[row_start + x] = value

    if channels == 3:
        rgba = bytearray(width * height * 4)
        for i, j in zip(range(0, len(out), 3), range(0, width * height * 4, 4)):
            rgba[j:j + 3] = out[i:i + 3]
            rgba[j + 3] = 255
        return width, height, bytes(rgba)
    return width, height, bytes(out)


def _pixel_at(pixels: bytes, width: int, x: int, y: int):
    i = (y * width + x) * 4
    return pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]


def _is_fully_opaque(pixels: bytes) -> bool:
    return all(pixels[i] == 255 for i in range(3, len(pixels), 4))


def _color_distance(a, b) -> float:
    return sum((a[k] - b[k]) ** 2 for k in range(3)) ** 0.5


def _corners_match_background(pixels: bytes, width: int, height: int, tolerance=40) -> bool:
    inset = max(4, round(min(width, height) * 0.03))
    corners = [
        (0, 0, inset, inset),
        (width - 1, 0, width - 1 - inset, inset),
        (0, height - 1, inset, height - 1 - inset),
        (width - 1, height - 1, width - 1 - inset, height - 1 - inset),
    ]
    return all(
        _color_distance(_pixel_at(pixels, width, cx, cy), _pixel_at(pixels, width, ix, iy)) <= tolerance
        for cx, cy, ix, iy in corners
    )


def _get_manifest_url():
    html = client.get("/").text
    links = re.findall(r'<link[^>]+rel=["\']manifest["\'][^>]*>', html, re.IGNORECASE)
    assert len(links) == 1, f"expected exactly one manifest link, found {len(links)}"
    href_match = re.search(r'href=["\']([^"\']+)["\']', links[0], re.IGNORECASE)
    return html, href_match.group(1) if href_match else "/manifest.json"


def test_exactly_one_manifest_link():
    _get_manifest_url()


def test_apple_touch_icon_link_present():
    html, _ = _get_manifest_url()
    assert re.search(r'<link[^>]+rel=["\']apple-touch-icon["\']', html, re.IGNORECASE)


def _load_manifest():
    _, manifest_href = _get_manifest_url()
    res = client.get(manifest_href)
    assert res.status_code == 200, f"manifest did not resolve: {res.status_code}"
    return res.json()


def test_manifest_has_stable_id_and_scope():
    manifest = _load_manifest()
    assert manifest.get("id"), "manifest is missing a stable id"
    assert manifest.get("scope"), "manifest is missing a scope"


def test_manifest_has_start_url():
    manifest = _load_manifest()
    assert manifest.get("start_url")


def test_manifest_display_is_installable():
    manifest = _load_manifest()
    assert manifest.get("display") in ("standalone", "minimal-ui", "fullscreen")


def test_has_any_purpose_icons_at_192_and_512():
    manifest = _load_manifest()
    any_icons = [i for i in manifest["icons"] if i.get("purpose", "any") == "any"]
    assert any(i["sizes"] == "192x192" for i in any_icons)
    assert any(i["sizes"] == "512x512" for i in any_icons)


@pytest.mark.xfail(
    strict=True,
    reason=(
        "No maskable icon artwork exists yet (icon design is Ashish's call, "
        "not something this install generates — see CHECKLIST.md). Remove "
        "this xfail once maskable 192x192/512x512 icons are added to the "
        "manifest, so this test starts proving the real thing again."
    ),
)
def test_has_maskable_icons_at_192_and_512():
    manifest = _load_manifest()
    maskable_icons = [i for i in manifest["icons"] if i.get("purpose") == "maskable"]
    assert any(i["sizes"] == "192x192" for i in maskable_icons)
    assert any(i["sizes"] == "512x512" for i in maskable_icons)


def _icon_params():
    manifest = _load_manifest()
    return manifest["icons"]


@pytest.mark.parametrize("icon", _icon_params(), ids=lambda i: i["src"])
def test_manifest_icon_serves_correctly(icon):
    src_path = icon["src"].split("?")[0]
    res = client.get(icon["src"])
    assert res.status_code == 200, f"{icon['src']} -> {res.status_code}"
    assert "image/png" in res.headers.get("content-type", "")

    width, height, pixels = decode_png(res.content)
    declared_w, declared_h = (int(n) for n in icon["sizes"].split("x"))
    assert (width, height) == (declared_w, declared_h), (
        f"{icon['src']} declared {icon['sizes']}, actual {width}x{height}"
    )

    repo_file = FRONTEND / src_path.lstrip("/")
    assert repo_file.is_file(), f"committed file not found at {repo_file}"
    repo_bytes = repo_file.read_bytes()
    assert hashlib.sha1(res.content).digest() == hashlib.sha1(repo_bytes).digest(), (
        f"live bytes for {icon['src']} differ from committed file {repo_file}"
    )

    if icon.get("purpose") == "maskable":
        assert _is_fully_opaque(pixels), f"{icon['src']} is not fully opaque (maskable)"
        assert _corners_match_background(pixels, width, height), (
            f"{icon['src']} corners don't match the background (maskable)"
        )

    if icon.get("purpose", "any") == "any":
        total = width * height
        partial = sum(1 for i in range(3, len(pixels), 4) if 0 < pixels[i] < 255)
        fraction = partial / total
        assert fraction <= MAX_PARTIAL_ALPHA_FRACTION, (
            f"{icon['src']} has {partial}/{total} ({fraction:.1%}) partially-transparent "
            "pixels — looks like unflattened/washed-out fill, not AA fringe"
        )


def test_apple_touch_icon_bytes_match_committed_file():
    html, _ = _get_manifest_url()
    href_match = re.search(
        r'<link[^>]+rel=["\']apple-touch-icon["\'][^>]*href=["\']([^"\']+)["\']', html, re.IGNORECASE
    )
    assert href_match, "apple-touch-icon link has no href"
    href = href_match.group(1)

    res = client.get(href)
    assert res.status_code == 200

    repo_file = FRONTEND / href.split("?")[0].lstrip("/")
    assert repo_file.is_file(), f"committed file not found at {repo_file}"
    assert hashlib.sha1(res.content).digest() == hashlib.sha1(repo_file.read_bytes()).digest(), (
        "apple-touch-icon served bytes differ from the committed file"
    )
