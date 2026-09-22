"""Deprecated stick-figure coaching loops.

Today no longer attaches these GIFs. A reviewed Gym visual WebM/MP4 clip is
preferred. When no close approved clip exists, the exercise still is the card.
This script only refreshes the archive under public/assets/coaching-loops/.
Do not wire the output back onto catalog exercises or Today cards.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "coaching-loops"
STILL_SRC = ROOT / "work" / "generated-still-sources" / "coaching-loops"

SIZE = 480
BG = (244, 247, 245, 255)
INK = (31, 58, 77, 255)
BAND = (216, 90, 48, 255)
FLOOR = (176, 190, 182, 255)
SKIN = (236, 220, 204, 255)
MUTED = (120, 140, 132, 255)
FRAMES = 12


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def ease(t: float) -> float:
    return 0.5 - 0.5 * math.cos(math.tau * t)


def circle_point(center: tuple[float, float], radius: float, other: tuple[float, float], other_radius: float, prefer_up: bool = True):
    dx = other[0] - center[0]
    dy = other[1] - center[1]
    dist = math.hypot(dx, dy)
    if dist < 1e-3:
        return (center[0], center[1] - radius)
    dist = min(max(dist, abs(radius - other_radius) + 0.5), radius + other_radius - 0.5)
    a = (radius * radius - other_radius * other_radius + dist * dist) / (2 * dist)
    h = math.sqrt(max(radius * radius - a * a, 0))
    xm = center[0] + a * dx / dist
    ym = center[1] + a * dy / dist
    rx = -dy * (h / dist)
    ry = dx * (h / dist)
    up = (xm + rx, ym + ry)
    down = (xm - rx, ym - ry)
    if prefer_up:
        return up if up[1] <= down[1] else down
    return down if down[1] >= up[1] else up


def new_canvas(size: int) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGBA", (size, size), BG)
    return image, ImageDraw.Draw(image)


def line(draw: ImageDraw.ImageDraw, a, b, width: int, fill=INK):
    draw.line([a, b], fill=fill, width=width)


def head(draw: ImageDraw.ImageDraw, center, radius: int, width: int):
    x, y = center
    draw.ellipse([x - radius, y - radius, x + radius, y + radius], fill=SKIN, outline=INK, width=width)


def band_loop(draw: ImageDraw.ImageDraw, box, width: int):
    draw.ellipse(box, outline=BAND, width=width)


def floor_line(draw: ImageDraw.ImageDraw, y: float, width: int, size: int):
    line(draw, (int(size * 0.08), y), (int(size * 0.92), y), width, FLOOR)


def stick(draw: ImageDraw.ImageDraw, joints: dict[str, tuple[float, float]], width: int, head_r: int):
    pairs = [
        ("head", "shoulder"),
        ("shoulder", "hip"),
        ("shoulder", "hand"),
        ("hip", "knee"),
        ("knee", "ankle"),
    ]
    for start, end in pairs:
        if start in joints and end in joints:
            line(draw, joints[start], joints[end], width)
    if "head" in joints:
        head(draw, joints["head"], head_r, max(3, width // 2))


def supine_base(t: float, size: int, heel_close: float):
    floor_y = size * 0.72
    hip = (size * 0.40, floor_y - size * 0.04)
    shoulder = (hip[0] - size * 0.16, hip[1])
    head_c = (shoulder[0] - size * 0.10, shoulder[1] - size * 0.01)
    hand = (shoulder[0] - size * 0.02, shoulder[1] - size * 0.12)
    thigh = size * 0.22
    shank = size * 0.22
    heel_x = lerp(hip[0] + size * 0.40, hip[0] + size * 0.12, heel_close)
    ankle = (heel_x, floor_y)
    knee = circle_point(hip, thigh, ankle, shank, prefer_up=True)
    return {
        "floor_y": floor_y,
        "joints": {
            "head": head_c,
            "shoulder": shoulder,
            "hand": hand,
            "hip": hip,
            "knee": knee,
            "ankle": ankle,
        },
    }


def draw_heel_slide(t: float, size: int):
    image, draw = new_canvas(size)
    width = max(6, size // 60)
    pose = supine_base(t, size, ease(t))
    floor_line(draw, pose["floor_y"], width, size)
    stick(draw, pose["joints"], width, size // 22)
    return image


def draw_quad_set(t: float, size: int):
    image, draw = new_canvas(size)
    width = max(6, size // 60)
    pulse = ease(t)
    floor_y = size * 0.72
    hip = (size * 0.36, floor_y - size * 0.045)
    shoulder = (hip[0] - size * 0.16, hip[1])
    head_c = (shoulder[0] - size * 0.10, shoulder[1])
    hand = (shoulder[0], shoulder[1] - size * 0.11)
    knee = (hip[0] + size * 0.22, floor_y - size * (0.07 - 0.045 * pulse))
    ankle = (knee[0] + size * 0.20, floor_y - size * 0.02)
    floor_line(draw, floor_y, width, size)
    stick(draw, {"head": head_c, "shoulder": shoulder, "hand": hand, "hip": hip, "knee": knee, "ankle": ankle}, width, size // 22)
    # Thigh squeeze mark
    mark = hip[0] + size * 0.10
    draw.arc([mark - 18, hip[1] - 28, mark + 18, hip[1] + 8], 200, 340, fill=BAND, width=max(4, width // 2))
    return image


def draw_tke(t: float, size: int):
    image, draw = new_canvas(size)
    width = max(6, size // 60)
    bend = 1 - ease(t)
    floor_y = size * 0.78
    hip = (size * 0.34, floor_y - size * 0.16)
    shoulder = (hip[0] - size * 0.02, hip[1] - size * 0.18)
    head_c = (shoulder[0], shoulder[1] - size * 0.10)
    hand = (shoulder[0] + size * 0.12, shoulder[1] + size * 0.06)
    support_ankle = (hip[0] + size * 0.28, floor_y)
    support_knee = (hip[0] + size * 0.16, floor_y - size * 0.02)
    work_ankle = (hip[0] + size * (0.30 + 0.08 * (1 - bend)), floor_y)
    work_hip = (hip[0] + size * 0.02, hip[1])
    thigh = size * 0.20
    shank = size * 0.20
    # More bend pulls the heel in and the knee up.
    work_ankle = (lerp(work_hip[0] + size * 0.36, work_hip[0] + size * 0.16, bend), floor_y)
    work_knee = circle_point(work_hip, thigh, work_ankle, shank, prefer_up=True)
    floor_line(draw, floor_y, width, size)
    line(draw, support_knee, support_ankle, width, MUTED)
    line(draw, hip, support_knee, width, MUTED)
    stick(draw, {"head": head_c, "shoulder": shoulder, "hand": hand, "hip": work_hip, "knee": work_knee, "ankle": work_ankle}, width, size // 22)
    # Short loop behind the working knee and around the other ankle. No door or chair.
    band_loop(draw, [
        work_knee[0] - size * 0.05,
        work_knee[1] - size * 0.04,
        support_ankle[0] + size * 0.04,
        support_ankle[1] + size * 0.03,
    ], max(5, width))
    return image


def draw_slr(t: float, size: int):
    image, draw = new_canvas(size)
    width = max(6, size // 60)
    lift = ease(t)
    floor_y = size * 0.74
    hip = (size * 0.40, floor_y - size * 0.05)
    shoulder = (hip[0] - size * 0.16, hip[1])
    head_c = (shoulder[0] - size * 0.10, shoulder[1])
    hand = (shoulder[0], shoulder[1] - size * 0.12)
    bent_knee = (hip[0] + size * 0.12, floor_y - size * 0.16)
    bent_ankle = (hip[0] + size * 0.24, floor_y)
    straight_knee = (hip[0] + size * 0.18, lerp(floor_y - size * 0.03, floor_y - size * 0.16, lift))
    straight_ankle = (hip[0] + size * 0.38, lerp(floor_y - size * 0.02, floor_y - size * 0.22, lift))
    floor_line(draw, floor_y, width, size)
    line(draw, hip, bent_knee, width, MUTED)
    line(draw, bent_knee, bent_ankle, width, MUTED)
    stick(draw, {"head": head_c, "shoulder": shoulder, "hand": hand, "hip": hip, "knee": straight_knee, "ankle": straight_ankle}, width, size // 22)
    return image


def draw_dead_bug(t: float, size: int):
    image, draw = new_canvas(size)
    width = max(6, size // 60)
    phase = ease(t)
    floor_y = size * 0.70
    hip = (size * 0.46, floor_y - size * 0.08)
    shoulder = (hip[0] - size * 0.16, hip[1] - size * 0.02)
    head_c = (shoulder[0] - size * 0.10, shoulder[1] - size * 0.03)
    reach = lerp(0.08, 0.22, phase)
    hand = (shoulder[0] - size * reach, shoulder[1] - size * 0.16)
    other_hand = (shoulder[0] + size * 0.04, shoulder[1] - size * 0.18)
    knee = (hip[0] + size * lerp(0.08, 0.20, phase), hip[1] - size * lerp(0.16, 0.05, phase))
    ankle = (knee[0] + size * lerp(0.02, 0.12, phase), knee[1] + size * 0.02)
    other_knee = (hip[0] + size * 0.06, hip[1] - size * 0.18)
    other_ankle = (other_knee[0] + size * 0.02, other_knee[1] + size * 0.08)
    floor_line(draw, floor_y, width, size)
    line(draw, shoulder, other_hand, width, MUTED)
    line(draw, hip, other_knee, width, MUTED)
    line(draw, other_knee, other_ankle, width, MUTED)
    stick(draw, {"head": head_c, "shoulder": shoulder, "hand": hand, "hip": hip, "knee": knee, "ankle": ankle}, width, size // 22)
    return image


def draw_side_plank(t: float, size: int):
    image, draw = new_canvas(size)
    width = max(6, size // 60)
    lift = lerp(0.02, 0.10, ease(t))
    floor_y = size * 0.74
    elbow = (size * 0.28, floor_y)
    shoulder = (elbow[0], floor_y - size * (0.16 + lift))
    head_c = (shoulder[0] - size * 0.08, shoulder[1] - size * 0.04)
    hand = (elbow[0] + size * 0.10, floor_y)
    hip = (shoulder[0] + size * 0.22, floor_y - size * (0.10 + lift))
    knee = (hip[0] + size * 0.12, floor_y)
    ankle = (knee[0] + size * 0.12, floor_y)
    floor_line(draw, floor_y, width, size)
    stick(draw, {"head": head_c, "shoulder": shoulder, "hand": hand, "hip": hip, "knee": knee, "ankle": ankle}, width, size // 22)
    line(draw, shoulder, elbow, width)
    return image


def draw_clam(t: float, size: int):
    image, draw = new_canvas(size)
    width = max(6, size // 60)
    opening = ease(t)
    floor_y = size * 0.78
    hip = (size * 0.42, floor_y - size * 0.08)
    shoulder = (hip[0] - size * 0.16, hip[1] - size * 0.03)
    head_c = (shoulder[0] - size * 0.10, shoulder[1] - size * 0.02)
    hand = (shoulder[0], shoulder[1] - size * 0.12)
    lower_knee = (hip[0] + size * 0.16, floor_y - size * 0.02)
    lower_ankle = (hip[0] + size * 0.04, floor_y)
    upper_knee = (hip[0] + size * 0.16, floor_y - size * lerp(0.08, 0.24, opening))
    upper_ankle = (hip[0] + size * 0.05, floor_y - size * 0.03)
    floor_line(draw, floor_y, width, size)
    line(draw, hip, lower_knee, width, MUTED)
    line(draw, lower_knee, lower_ankle, width, MUTED)
    stick(draw, {"head": head_c, "shoulder": shoulder, "hand": hand, "hip": hip, "knee": upper_knee, "ankle": upper_ankle}, width, size // 22)
    band_loop(draw, [
        lower_knee[0] - size * 0.06,
        upper_knee[1] - size * 0.04,
        lower_knee[0] + size * 0.08,
        lower_knee[1] + size * 0.05,
    ], max(5, width))
    return image


def draw_supine_abduction(t: float, size: int):
    image, draw = new_canvas(size)
    width = max(6, size // 60)
    spread = lerp(0.08, 0.20, ease(t))
    floor_y = size * 0.80
    shoulder = (size * 0.34, size * 0.42)
    head_c = (shoulder[0] - size * 0.11, shoulder[1])
    hand = (shoulder[0], shoulder[1] - size * 0.14)
    hip = (shoulder[0] + size * 0.18, shoulder[1] + size * 0.02)
    left_knee = (hip[0] + size * 0.16, hip[1] - size * spread)
    right_knee = (hip[0] + size * 0.16, hip[1] + size * spread)
    left_ankle = (left_knee[0] + size * 0.12, left_knee[1] - size * 0.02)
    right_ankle = (right_knee[0] + size * 0.12, right_knee[1] + size * 0.02)
    floor_line(draw, floor_y, width, size)
    line(draw, hip, left_knee, width)
    line(draw, left_knee, left_ankle, width)
    line(draw, hip, right_knee, width)
    line(draw, right_knee, right_ankle, width)
    stick(draw, {"head": head_c, "shoulder": shoulder, "hand": hand, "hip": hip}, width, size // 22)
    band_loop(draw, [
        left_knee[0] - size * 0.05,
        left_knee[1] - size * 0.04,
        right_knee[0] + size * 0.07,
        right_knee[1] + size * 0.04,
    ], max(5, width))
    return image


def draw_good_morning(t: float, size: int):
    image, draw = new_canvas(size)
    width = max(6, size // 60)
    hinge = ease(t)
    floor_y = size * 0.84
    ankle = (size * 0.58, floor_y)
    # Soft knee that stays stacked. The hips travel back; the torso folds. This is not a squat.
    knee = (ankle[0] - size * 0.015, floor_y - size * 0.22)
    hip = (knee[0] - size * lerp(0.02, 0.16, hinge), knee[1] - size * 0.22)
    shoulder = (
        hip[0] - size * lerp(0.04, 0.28, hinge),
        hip[1] - size * lerp(0.24, 0.08, hinge),
    )
    head_c = (shoulder[0] - size * lerp(0.02, 0.06, hinge), shoulder[1] - size * 0.08)
    hand = (shoulder[0] + size * 0.02, shoulder[1] + size * 0.02)
    other_ankle = (ankle[0] + size * 0.07, floor_y)
    other_knee = (knee[0] + size * 0.06, knee[1] + size * 0.005)
    floor_line(draw, floor_y, width, size)
    line(draw, other_knee, other_ankle, width, MUTED)
    line(draw, hip, other_knee, width, MUTED)
    stick(draw, {"head": head_c, "shoulder": shoulder, "hand": hand, "hip": hip, "knee": knee, "ankle": ankle}, width, size // 22)
    band_y = knee[1] - size * 0.07
    band_loop(draw, [knee[0] - size * 0.055, band_y - size * 0.03, other_knee[0] + size * 0.055, band_y + size * 0.04], max(5, width))
    return image


DRAW = {
    "heel-slide": draw_heel_slide,
    "quad-set": draw_quad_set,
    "band-terminal-knee-extension": draw_tke,
    "straight-leg-raise": draw_slr,
    "dead-bug": draw_dead_bug,
    "side-plank": draw_side_plank,
    "band-clam": draw_clam,
    "supine-band-hip-abduction": draw_supine_abduction,
    "mini-band-good-morning": draw_good_morning,
}

STILL_SLUGS = {"supine-band-hip-abduction", "mini-band-good-morning"}


def save_gif(frames: list[Image.Image], path: Path):
    palette = frames[0].convert("P", palette=Image.Palette.ADAPTIVE, colors=32)
    converted = [palette]
    for frame in frames[1:]:
        converted.append(frame.quantize(palette=palette, dither=Image.Dither.NONE))
    converted[0].save(
        path,
        save_all=True,
        append_images=converted[1:],
        duration=140,
        loop=0,
        optimize=True,
        disposal=2,
    )


def file_record(path: Path, public_url: str) -> dict:
    data = path.read_bytes()
    return {
        "publicUrl": public_url,
        "repositoryPath": str(path.relative_to(ROOT)),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "mimeType": "image/gif" if path.suffix == ".gif" else "image/jpeg" if path.suffix == ".jpg" else "image/webp",
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    assets = []
    for slug, drawer in DRAW.items():
        frames = [drawer(index / FRAMES, SIZE).convert("RGB") for index in range(FRAMES)]
        gif_path = OUT / f"{slug}.gif"
        poster_path = OUT / f"{slug}-poster.jpg"
        save_gif(frames, gif_path)
        frames[FRAMES // 3].save(poster_path, quality=85, optimize=True)
        asset = {
            "exerciseId": slug,
            "kind": "stick-figure-coaching-loop",
            "clinicalReviewStatus": "pending",
            "visualScope": "generic_pattern",
            "creator": "Knee Forward",
            "gif": file_record(gif_path, f"/assets/coaching-loops/{slug}.gif"),
            "poster": file_record(poster_path, f"/assets/coaching-loops/{slug}-poster.jpg"),
        }
        if slug in STILL_SLUGS:
            STILL_SRC.mkdir(parents=True, exist_ok=True)
            still = drawer(0.35, 1024).convert("RGB")
            png_path = STILL_SRC / f"{slug}.png"
            still.save(png_path)
            asset["stillSource"] = str(png_path.relative_to(ROOT))
        assets.append(asset)

    manifest = {
        "schemaVersion": 1,
        "generatedOn": "2026-09-22",
        "runtimePolicy": "Stick-figure coaching GIFs are deprecated for Today and are not attached to catalog exercises. Home cards use a reviewed Gym visual WebM/MP4 loop when a close approved clip exists, otherwise the exercise still. These GIF files remain an archive only. Gym visual and CDC motion stay WebM/MP4 and do not serve GIF.",
        "rightsBasis": "original_project_asset",
        "assets": assets,
    }
    (OUT / "media-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {len(assets)} coaching loops to {OUT}")


if __name__ == "__main__":
    main()
