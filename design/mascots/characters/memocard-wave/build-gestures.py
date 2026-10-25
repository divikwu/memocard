"""Register gesture poses to the note plate, rather than its moving hand."""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

folder = Path(__file__).resolve().parent
runtime = folder.parents[1] / 'history/runtime-sheets'


def character(image):
    pixels = np.array(image.convert('RGBA'))
    labels, _ = ndimage.label(pixels[..., 3] > 40)
    counts = np.bincount(labels.ravel())
    counts[0] = 0
    mask = labels == counts.argmax()
    pixels[~ndimage.binary_dilation(mask, iterations=3), 3] = 0
    return Image.fromarray(pixels), mask


def note_anchor(mask):
    rows = np.where(mask.any(axis=1))[0]
    top, height = rows.min(), rows.max() - rows.min()
    # Above the hand, pencil and glasses: this band contains only the note plate.
    bands = [np.where(mask[y])[0] for y in range(top + int(height * .12), top + int(height * .25))]
    left = np.median([row.min() for row in bands])
    right = np.median([row.max() for row in bands])
    return top, (left + right) / 2, right - left


reference, mask = character(Image.open(folder / 'gesture-reference.png'))
target_top, target_center, target_width = note_anchor(mask)
sheet = Image.open(folder / 'gestures.raw.png').convert('RGBA')
cell = sheet.width // 3
atlas = Image.new('RGBA', (360 * 3, 360))
for index, name in enumerate(['greeting', 'adjust', 'relax']):
    frame, mask = character(sheet.crop((index * cell, 0, (index + 1) * cell, sheet.height)))
    top, center, width = note_anchor(mask)
    scale = target_width / width
    frame = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (360, 360))
    canvas.alpha_composite(frame, (round(target_center - center * scale), round(target_top - top * scale)))
    canvas.save(folder / f'gesture-{name}.png')
    atlas.alpha_composite(canvas, (index * 360, 0))
    print(f'{name}: scale {scale:.3f}, note top {target_top}px')
atlas.save(runtime / 'memocard-wave-gestures.webp', quality=90, method=6)
