"""Create contact sheets from rendered pages of the SAT-J user manual."""

from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent / "user-manual-render"
pages = sorted(root.glob("page-*.png"))
for group_index in range(0, len(pages), 4):
    batch = pages[group_index:group_index + 4]
    thumbs = []
    for page in batch:
        image = Image.open(page).convert("RGB")
        image.thumbnail((510, 660))
        thumbs.append((page.name, image.copy()))
    sheet = Image.new("RGB", (1080, 1380), "#d7d7d7")
    draw = ImageDraw.Draw(sheet)
    for idx, (name, image) in enumerate(thumbs):
        x = 20 + (idx % 2) * 530
        y = 35 + (idx // 2) * 680
        draw.text((x, 10 + (idx // 2) * 680), name, fill="black")
        sheet.paste(image, (x, y))
    sheet.save(root / f"contact-{group_index // 4 + 1:02d}.png")
