import os
from PIL import Image

brain_dir = r"C:\Users\dahao\.gemini\antigravity-ide\brain\d045454d-012c-4ba0-bf36-f58a4e6e45db"
img_black = os.path.join(brain_dir, "media__1780782925499.png")
img_white = os.path.join(brain_dir, "media__1780782925776.png")

for name, path in [("black_bg_logo", img_black), ("white_bg_logo", img_white)]:
    if os.path.exists(path):
        with Image.open(path) as img:
            print(f"{name}: size={img.size}, mode={img.mode}, format={img.format}")
    else:
        print(f"{name} does not exist at {path}")
