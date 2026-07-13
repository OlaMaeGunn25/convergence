import os
from PIL import Image

brain_dir = r"C:\Users\dahao\.gemini\antigravity-ide\brain\d045454d-012c-4ba0-bf36-f58a4e6e45db"
img_black = os.path.join(brain_dir, "media__1780782925499.png")

with Image.open(img_black) as img:
    alpha = img.getchannel('A')
    extrema = alpha.getextrema()
    print(f"Alpha channel range: {extrema}")
