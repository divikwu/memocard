"""Clean and pad generated grids before the page-mascot skill packs them."""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

folder = Path(__file__).resolve().parent
for sheet_name in ['directions', 'reactions']:
    sheet = Image.open(folder / f'{sheet_name}.raw.png').convert('RGBA')
    cell = sheet.width // 3
    padding = 40
    headroom = cell // 12
    tile = cell + padding * 2
    clean = Image.new('RGBA', (tile * 3, tile * 3))
    for index in range(9):
        x, y = index % 3 * cell, index // 3 * cell
        pixels = np.array(sheet.crop((x, y - headroom, x + cell, y + cell)))
        pixels[pixels[..., 3] <= 2] = 0
        labels, _ = ndimage.label(pixels[..., 3] > 40)
        counts = np.bincount(labels.ravel())
        counts[0] = 0
        keep = counts.argmax()
        content = labels == keep
        body_top = np.where(content)[0].min()
        if sheet_name == 'reactions':
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
        clean.alpha_composite(Image.fromarray(pixels),
                              (index % 3 * tile + padding, index // 3 * tile + padding - headroom))
    target = folder / f'{sheet_name}.png'
    clean.save(target)
    print(target)
