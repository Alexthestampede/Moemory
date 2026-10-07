#!/usr/bin/env python3
"""Generate 18 distinct geometric SVG placeholder card faces in faces/.

Replace with real generated artwork whenever ready — same filenames work.
"""
import os

DIR = os.path.join(os.path.dirname(__file__), "..", "faces")

# (shape, fill) — distinct shape AND color at a glance
FACES = [
    ("circle",   "#e63946"), ("square",    "#4573d2"), ("triangle", "#2f9e44"),
    ("star",     "#f59f00"), ("heart",     "#d6336c"), ("diamond",  "#7048e8"),
    ("hexagon",  "#f76707"), ("crescent",  "#15aabf"), ("plus",     "#0ca678"),
    ("ring",     "#74b816"), ("oval",      "#845ef7"), ("pentagon", "#e8590c"),
    ("circle",   "#1c7ed6"), ("square",    "#1098ad"), ("triangle", "#5f3dc4"),
    ("star",     "#d6336c"), ("heart",     "#f76707"), ("diamond",  "#2f9e44"),
]

INK = "#22252e"

def shape(name, c):
    if name == "circle":   return f'<circle cx="50" cy="50" r="34" fill="{c}"/>'
    if name == "square":   return f'<rect x="18" y="18" width="64" height="64" rx="10" fill="{c}"/>'
    if name == "triangle": return f'<path d="M50 14 L90 82 L10 82 Z" fill="{c}"/>'
    if name == "star":     return f'<path d="M50 10 L61 38 L91 40 L68 59 L75 88 L50 72 L25 88 L32 59 L9 40 L39 38 Z" fill="{c}" stroke="{INK}" stroke-width="3"/>'
    if name == "heart":    return f'<path d="M50 86 C18 60 10 44 10 30 A19 19 0 0 1 50 20 A19 19 0 0 1 90 30 C90 44 82 60 50 86 Z" fill="{c}"/>'
    if name == "diamond":  return f'<path d="M50 10 L86 50 L50 90 L14 50 Z" fill="{c}"/>'
    if name == "hexagon":  return f'<polygon points="50,12 85,31 85,69 50,88 15,69 15,31" fill="{c}"/>'
    if name == "crescent": return f'<path d="M62 12 A40 40 0 1 0 62 88 A32 32 0 1 1 62 12 Z" fill="{c}"/>'
    if name == "plus":     return f'<path d="M38 12 H62 V38 H88 V62 H62 V88 H38 V62 H12 V38 H38 Z" fill="{c}"/>'
    if name == "ring":     return f'<circle cx="50" cy="50" r="30" fill="none" stroke="{c}" stroke-width="14"/>'
    if name == "oval":     return f'<ellipse cx="50" cy="50" rx="24" ry="36" fill="{c}"/>'
    if name == "pentagon": return f'<polygon points="50,12 90,42 75,88 25,88 10,42" fill="{c}"/>'
    raise ValueError(name)

def svg(body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
            f'<rect width="100" height="100" rx="12" fill="#f4f7ff"/>{body}</svg>')

os.makedirs(DIR, exist_ok=True)
for i, (shape_name, color) in enumerate(FACES, 1):
    path = os.path.join(DIR, f"face-{i:02d}.svg")
    with open(path, "w") as f:
        f.write(svg(shape(shape_name, color)))
print(f"wrote {len(FACES)} faces to {os.path.abspath(DIR)}")