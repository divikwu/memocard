"""Match a rebuilt direction atlas to its existing front; keep that front verbatim."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

name = sys.argv[1]
runtime = Path(__file__).resolve().parent.parent / 'history/runtime-sheets'
original = Image.open(runtime / f'{name}-directions.webp').convert('RGBA')
rebuilt = Image.open(Path('build/mascot-thin') / f'{name}-thin-v2-directions.webp').convert('RGBA')
tile = original.width // 3


def cell(sheet, index):
    x, y = index % 3 * tile, index // 3 * tile
    return sheet.crop((x, y, x + tile, y + tile))


def bounds(image):
    y, x = np.where(np.array(image)[..., 3] > 40)
    return int(x.min()), int(y.min()), int(x.max()) + 1, int(y.max()) + 1


front = cell(original, 4)
old_box = bounds(front)
target_size = (old_box[2] - old_box[0], old_box[3] - old_box[1])
atlas = Image.new('RGBA', original.size)
for index in range(9):
    if index == 4:
        atlas.paste(front, (tile, tile))
        continue
    # Both generated sheets place viewer-left/right in reversed columns.
    source_index = index // 3 * 3 + (2 - index % 3)
    source = cell(rebuilt, source_index)
    frame = source.crop(bounds(source)).resize(target_size, Image.Resampling.LANCZOS)
    aligned = Image.new('RGBA', (tile, tile))
    aligned.alpha_composite(frame, (old_box[0], old_box[1]))
    atlas.paste(aligned, (index % 3 * tile, index // 3 * tile))
    if index in [3, 5]:
        aligned.save(Path(__file__).resolve().parent / f'{name}-thin-v2' / f'direction-{"left" if index == 3 else "right"}.png')
target = runtime / f'{name}-thin-v2-directions.webp'
atlas.save(target, lossless=True, exact=True)
assert cell(Image.open(target).convert('RGBA'), 4).tobytes() == front.tobytes()
print(f'{target}: original front preserved exactly')
