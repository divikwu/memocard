"""Pack the full-body variant with uniform scale and a shared foot baseline."""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

folder = Path(__file__).resolve().parent
runtime = folder.parents[1] / 'history/runtime-sheets'
tile, height, baseline = 360, 270, 334


def largest(mask):
    labels, _ = ndimage.label(mask)
    counts = np.bincount(labels.ravel())
    counts[0] = 0
    return labels, counts, labels == counts.argmax()


for kind in ['directions', 'reactions']:
    sheet = Image.open(folder / f'{kind}.raw.png').convert('RGBA')
    cell = sheet.width // 3
    atlas = Image.new('RGBA', (tile * 3, tile * 3))
    for index in range(9):
        x, y = index % 3 * cell, index // 3 * cell
        pixels = np.array(sheet.crop((x, y - cell // 12, x + cell, y + cell)))
        labels, counts, body = largest(pixels[..., 3] > 40)
        content = body.copy()
        body_top = np.where(body)[0].min()
        if kind == 'reactions':
            for label in range(1, len(counts)):
                mask = labels == label
                if counts[label] < 20 or np.where(mask)[0].max() >= body_top:
                    continue
                red, green, blue = pixels[mask, :3].mean(axis=0)
                expected = ((index == 1 and red > green * 1.3 and red > blue * 1.3)
                            or (index == 2 and red > 140 and green > 100 and blue < 120)
                            or (index == 6 and blue > red * 1.3 and blue > green * 1.05))
                if expected:
                    content |= mask
        pixels[~ndimage.binary_dilation(content, iterations=3)] = 0
        pixels[pixels[..., 3] <= 2] = 0
        yy = np.where(body)[0]
        factor = height / (yy.max() - yy.min() + 1)
        frame = Image.fromarray(pixels).resize(
            (round(pixels.shape[1] * factor), round(pixels.shape[0] * factor)), Image.Resampling.LANCZOS)
        _, _, scaled_body = largest(np.array(frame)[..., 3] > 40)
        scaled_y, scaled_x = np.where(scaled_body)
        canvas = Image.new('RGBA', (tile, tile))
        canvas.alpha_composite(frame, (round(tile / 2 - (scaled_x.min() + scaled_x.max() + 1) / 2),
                                       baseline - int(scaled_y.max() + 1)))
        canvas.save(folder / f'{kind}-{index}.png')
        atlas.paste(canvas, (index % 3 * tile, index // 3 * tile))
    target = runtime / f'memocard-feet-{kind}.webp'
    atlas.save(target, lossless=True, exact=True)
    print(target)
