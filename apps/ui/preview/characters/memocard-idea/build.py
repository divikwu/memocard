"""Pack the idea mascot; reuse the reference bulb at fixed atlas coordinates."""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

folder = Path(__file__).parent
runtime = folder.parents[1] / 'mascots'
tile, height, baseline = 360, 250, 334


def body_pixels(image):
    pixels = np.array(image.convert('RGBA'))
    labels, _ = ndimage.label(pixels[..., 3] > 40)
    counts = np.bincount(labels.ravel())
    counts[0] = 0
    body = labels == counts.argmax()
    pixels[~ndimage.binary_dilation(body, iterations=3)] = 0
    pixels[pixels[..., 3] <= 2] = 0
    return pixels, body


def pack(image):
    pixels, body = body_pixels(image)
    yy = np.where(body)[0]
    factor = height / (yy.max() - yy.min() + 1)
    frame = Image.fromarray(pixels).resize(
        (round(pixels.shape[1] * factor), round(pixels.shape[0] * factor)),
        Image.Resampling.LANCZOS)
    _, scaled_body = body_pixels(frame)
    yy, xx = np.where(scaled_body)
    origin = (round(tile / 2 - (xx.min() + xx.max() + 1) / 2),
              baseline - int(yy.max() + 1))
    canvas = Image.new('RGBA', (tile, tile))
    canvas.alpha_composite(frame, origin)
    return canvas, frame.size, origin


front = Image.open(folder / 'front-reference.png')
_, reference_size, reference_origin = pack(Image.open(folder / 'original-body.png'))
bulb = Image.new('RGBA', (tile, tile))
bulb.alpha_composite(Image.open(folder / 'bulb-reference.png').resize(
    reference_size, Image.Resampling.LANCZOS), reference_origin)
bulb.save(folder / 'bulb.png')

for kind in ['directions', 'reactions']:
    sheet = Image.open(folder / f'{kind}.raw.png')
    cell = sheet.width // 3
    atlas = Image.new('RGBA', (tile * 3, tile * 3))
    order = list(range(9))
    for index, source in enumerate(order):
        x, y = source % 3 * cell, source // 3 * cell
        image = sheet.crop((x, y - cell // 12, x + cell, y + cell))
        if kind == 'directions' and index == 4:
            image = front
        canvas, _, _ = pack(image)
        canvas.alpha_composite(bulb)
        canvas.save(folder / f'{kind}-{index}.png')
        atlas.paste(canvas, (index % 3 * tile, index // 3 * tile))
    target = runtime / f'memocard-idea-{kind}.webp'
    atlas.save(target, lossless=True, exact=True)
    print(target)
