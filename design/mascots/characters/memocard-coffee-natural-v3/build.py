"""Pack the three whole-character poses for the page-mascot preview."""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

source = Path(__file__).resolve().parent
destination = source.parents[1] / 'history/runtime-sheets'
sheet = Image.open(source / 'three-directions.png').convert('RGBA')
cell = sheet.width // 3
frames = []
for column in range(3):
    pixels = np.array(sheet.crop((column * cell, 0, (column + 1) * cell, sheet.height)))
    pixels[pixels[..., 3] <= 2] = 0
    labels, _ = ndimage.label(pixels[..., 3] > 40)
    counts = np.bincount(labels.ravel())
    counts[0] = 0
    content = labels == counts.argmax()
    pixels[~ndimage.binary_dilation(content, iterations=3), 3] = 0
    y, x = np.where(pixels[..., 3] > 16)
    bounds = (max(0, x.min() - 3), max(0, y.min() - 3),
              min(cell, x.max() + 4), min(sheet.height, y.max() + 4))
    frames.append(Image.fromarray(pixels).crop(bounds))

# Keep one scale across poses and pin the complete silhouette's centre and baseline.
# This character turns as a whole; it has no fixed shoulder anchor.
tile = 360
scale = 271 / frames[1].height
aligned = []
for name, frame in zip(['left', 'front', 'right'], frames):
    frame = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (tile, tile))
    canvas.alpha_composite(frame, ((tile - frame.width) // 2, 334 - frame.height))
    canvas.save(source / f'three-{name}.png')
    aligned.append(canvas)
    print(f'{name}: {frame.width}×{frame.height}px; baseline 334px')

def body_bounds(pixels):
    labels, _ = ndimage.label(pixels[..., 3] > 40)
    counts = np.bincount(labels.ravel())
    counts[0] = 0
    y, x = np.where(labels == counts.argmax())
    return x.min(), y.min(), x.max() + 1, y.max() + 1


# Match the complete character, excluding floating heart/stars/zzz from its anchor.
# The smaller common scale leaves headroom for those symbols in both atlases.
reference = body_bounds(np.array(aligned[1]))
target_height = reference[3] - reference[1]
target_center = (reference[0] + reference[2]) / 2
reactions = Image.open(source / 'three-reactions.png').convert('RGBA')
reaction_cell = reactions.width // 3
reaction_frames = []
for index in range(9):
    x, y = index % 3 * reaction_cell, index // 3 * reaction_cell
    # Include space above each cell for symbols that cross the source grid line.
    pixels = np.array(reactions.crop((x, y - reaction_cell // 12, x + reaction_cell, y + reaction_cell)))
    pixels[pixels[..., 3] <= 2] = 0
    labels, _ = ndimage.label(pixels[..., 3] > 40)
    counts = np.bincount(labels.ravel())
    counts[0] = 0
    keep = counts.argmax()
    content = labels == keep
    body_top = np.where(content)[0].min()
    # Retain only the character plus the expected coloured symbols above it.
    # This excludes fragments of the previous row's bow tie and the next row's zzz.
    for label in range(1, len(counts)):
        mask = labels == label
        if label == keep or counts[label] < 20 or np.where(mask)[0].max() >= body_top:
            continue
        red, green, blue = pixels[mask, :3].mean(axis=0)
        symbol = ((index == 1 and red > green * 1.3 and red > blue * 1.3)
                  or (index == 2 and red > 140 and green > 100 and blue < 120)
                  or (index == 6 and blue > red * 1.3 and blue > green * 1.05))
        if symbol:
            content |= mask
    pixels[~ndimage.binary_dilation(content, iterations=3), 3] = 0
    bounds = body_bounds(pixels)
    factor = target_height / (bounds[3] - bounds[1])
    frame = Image.fromarray(pixels).resize((round(pixels.shape[1] * factor), round(pixels.shape[0] * factor)), Image.Resampling.LANCZOS)
    position = (round(target_center - (bounds[0] + bounds[2]) / 2 * factor),
                round(reference[3] - bounds[3] * factor))
    canvas = Image.new('RGBA', (tile, tile))
    canvas.alpha_composite(frame, position)
    reaction_frames.append(canvas)

# Repeat horizontal poses across rows; all nine reaction cells contain distinct art.
for name, poses in [('directions', aligned * 3), ('reactions', reaction_frames)]:
    atlas = Image.new('RGBA', (tile * 3, tile * 3))
    for index, frame in enumerate(poses):
        atlas.alpha_composite(frame, (index % 3 * tile, index // 3 * tile))
    target = destination / f'memocard-coffee-natural-v3-{name}.webp'
    atlas.save(target, quality=90, method=6)
    print(target)
