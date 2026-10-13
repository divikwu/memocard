"""Add shallow pitch views while preserving the approved horizontal poses exactly."""
from pathlib import Path
import shutil

import numpy as np
from PIL import Image
from scipy import ndimage

source = Path(__file__).parent
runtime = source.parents[1] / 'mascots'
approved = Image.open(runtime / 'memocard-coffee-swapped-directions.webp').convert('RGBA')
generated = Image.open(source / 'directions.raw.png').convert('RGBA')
tile, cell_size = 360, generated.width // 3


def cell(sheet, size, index):
    x, y = index % 3 * size, index // 3 * size
    return sheet.crop((x, y, x + size, y + size))


def bounds(image):
    y, x = np.where(np.array(image)[..., 3] > 40)
    return int(x.min()), int(y.min()), int(x.max()) + 1, int(y.max()) + 1


atlas = Image.new('RGBA', (tile * 3, tile * 3))
for index in range(9):
    reference = cell(approved, tile, 3 + index % 3)
    ref = bounds(reference)
    if index in [3, 4, 5]:
        canvas = reference
    else:
        pixels = np.array(cell(generated, cell_size, index))
        labels, _ = ndimage.label(pixels[..., 3] > 40)
        counts = np.bincount(labels.ravel())
        counts[0] = 0
        content = labels == counts.argmax()
        pixels[~ndimage.binary_dilation(content, iterations=3), 3] = 0
        frame = Image.fromarray(pixels)
        box = bounds(frame)
        factor = (ref[3] - ref[1]) / (box[3] - box[1])
        frame = frame.resize((round(cell_size * factor), round(cell_size * factor)), Image.Resampling.LANCZOS)
        box = bounds(frame)
        canvas = Image.new('RGBA', (tile, tile))
        canvas.alpha_composite(frame, (round((ref[0] + ref[2] - box[0] - box[2]) / 2), ref[3] - box[3]))
    canvas.save(source / f'direction-{index}.png')
    atlas.paste(canvas, (index % 3 * tile, index // 3 * tile))
    box = bounds(canvas)
    print(index, f'{box[2] - box[0]}x{box[3] - box[1]}, baseline {box[3]}')

target = runtime / 'memocard-primary-directions.webp'
atlas.save(target, lossless=True, exact=True)
decoded = Image.open(target).convert('RGBA')
for index in [3, 4, 5]:
    assert cell(decoded, tile, index).tobytes() == cell(approved, tile, index).tobytes()
shutil.copyfile(runtime / 'memocard-coffee-swapped-reactions.webp', runtime / 'memocard-primary-reactions.webp')
print('Approved horizontal poses and reaction file preserved exactly.')
