#!/usr/bin/env python3
"""Import generated card faces from temp/ into the game.

- Reads each PNG's embedded prompt (Krea/ComfyUI write it into PNG metadata).
- Center-crops to square, strips multi-figure edge clutter, converts to WebP.
- Writes faces/face-NN.webp + faces/faces.json (prompts become captions).
- Does not delete temp/ (your originals stay).

Usage: python3 tools/import-faces.py
"""
import glob
import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMP = os.path.join(ROOT, "temp")
FACES = os.path.join(ROOT, "faces")
OUT_SIZE = 512  # card faces ship at 512 max dimension

# Style boilerplate is identical across prompts; the subject is the first
# sentence. Caption = subject, trimmed to game-friendly length.
STYLE_PREFIX_RE = re.compile(r"^A portrait of (a|an) ", re.IGNORECASE)


def subject_from_prompt(prompt: str) -> str:
    first = prompt.split(".")[0].strip()
    first = STYLE_PREFIX_RE.sub("", first)
    return first[:60].rstrip(" ,;:-")


def main() -> None:
    paths = sorted(glob.glob(os.path.join(TEMP, "*.png")))
    if not paths:
        print("no PNGs in temp/ — nothing to import")
        return

    os.makedirs(FACES, exist_ok=True)
    manifest = {"faces": []}
    start_index = 1

    # Keep existing declared faces (don't clobber manual faces.json edits)
    manifest_path = os.path.join(FACES, "faces.json")
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path) as f:
                old = json.load(f)
            keep = [f for f in old.get("faces", []) if os.path.exists(
                os.path.join(FACES, f["file"]))]
            manifest["faces"] = keep
            start_index = len(keep) + 1
        except (json.JSONDecodeError, KeyError):
            pass

    imported = 0
    for path in paths:
        img = Image.open(path)
        img = img.convert("RGB")

        prompt = img.info.get("prompt", "")
        subject = subject_from_prompt(prompt) if prompt else ""

        # Center-crop square (cards render 3:4 via object-fit: cover, so
        # squaring here only trims generator-liked edges)
        side = min(img.size)
        left = (img.width - side) // 2
        top = (img.height - side) // 2
        img = img.crop((left, top, left + side, top + side))
        img.thumbnail((OUT_SIZE, OUT_SIZE), Image.LANCZOS)

        num = start_index + imported
        out_name = f"face-{num:02d}.webp"
        out_path = os.path.join(FACES, out_name)
        img.save(out_path, "WEBP", quality=82, method=6)

        entry = {"file": out_name}
        if subject:
            entry["caption"] = subject
        manifest["faces"].append(entry)
        imported += 1
        kb = os.path.getsize(out_path) // 1024
        print(f"  {out_name}  {kb}KB  caption: {subject or '(none)'}")

    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    total = len(manifest["faces"])
    print(f"imported {imported}, library now {total} faces — commit faces/ when happy")


if __name__ == "__main__":
    main()