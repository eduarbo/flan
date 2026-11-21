"""Keep attribution inside each individually downloadable PNG and MP4."""
# SPDX-License-Identifier: GPL-3.0-or-later
from pathlib import Path
import struct
import subprocess
import tempfile
import zlib

MEDIA = Path(__file__).resolve().parents[2] / "docs/marketing"
RENDER = ("Flan CAD render by Eduardo Ruiz, with KLP Lamé keycaps by braindefender, "
          "placed and colored. Layout follows Piantor by beekeeb / Leo. "
          "CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/ · "
          "https://github.com/eduarbo/flan/blob/main/docs/marketing/ASSET-LICENSE.md")
MARK = ("Flan mark by Eduardo Ruiz. Artwork: GPL-3.0-or-later, "
        "https://www.gnu.org/licenses/gpl-3.0.html · "
        "Trademark policy: https://github.com/eduarbo/flan/blob/main/TRADEMARKS.md")


def credit_png(path, credit):
    # Preserve every image chunk; only replace our international text field.
    data = path.read_bytes()
    out = bytearray(data[:8])
    offset = 8
    keyword = b"Copyright\0"
    while offset < len(data):
        size = struct.unpack_from(">I", data, offset)[0]
        kind = data[offset + 4:offset + 8]
        end = offset + 12 + size
        if end > len(data):
            raise ValueError(f"Truncated PNG: {path}")
        if kind == b"IEND":
            payload = keyword + b"\0\0\0\0" + credit.encode()
            chunk = b"iTXt" + payload
            out += struct.pack(">I", len(payload)) + chunk + struct.pack(">I", zlib.crc32(chunk))
        if kind != b"iTXt" or not data.startswith(keyword, offset + 8):
            out += data[offset:end]
        offset = end
    if out != data:
        path.write_bytes(out)


def credit_video(path):
    current = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format_tags=comment",
         "-of", "default=noprint_wrappers=1:nokey=1", path], text=True).strip()
    if current == RENDER:
        return
    with tempfile.TemporaryDirectory(dir=path.parent) as tmp:
        dest = Path(tmp) / path.name
        subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-map", "0", "-c", "copy",
                        "-metadata", "comment=" + RENDER, "-movflags", "+faststart", dest], check=True)
        dest.replace(path)


if __name__ == "__main__":
    for directory in (MEDIA / "assets", MEDIA / "variants"):
        for image in directory.glob("*.png"):
            credit_png(image, MARK if image.name == "avatar.png" else RENDER)
        for video in directory.glob("*.mp4"):
            credit_video(video)
