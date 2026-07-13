import os
import urllib.request
from PIL import Image

# Directories
workspace_dir = r"c:\Users\dahao\.gemini\antigravity\scratch\aiwx-social-media-agent"
brain_dir = r"C:\Users\dahao\.gemini\antigravity-ide\brain\d045454d-012c-4ba0-bf36-f58a4e6e45db"
img_black_path = os.path.join(brain_dir, "media__1780782925499.png")

# 1. Download fonts
syne_bold_url = "https://github.com/google/fonts/raw/main/ofl/syne/Syne-Bold.ttf"
dm_sans_medium_url = "https://github.com/google/fonts/raw/main/ofl/dmsans/DMSans-Medium.ttf"

syne_font_path = os.path.join(workspace_dir, "Syne-Bold.ttf")
dm_sans_font_path = os.path.join(workspace_dir, "DMSans-Medium.ttf")

print("Downloading Syne-Bold...")
try:
    urllib.request.urlretrieve(syne_bold_url, syne_font_path)
    print("Syne-Bold downloaded successfully.")
except Exception as e:
    print(f"Error downloading Syne-Bold: {e}")

print("Downloading DM Sans...")
try:
    urllib.request.urlretrieve(dm_sans_medium_url, dm_sans_font_path)
    print("DM Sans downloaded successfully.")
except Exception as e:
    print(f"Error downloading DM Sans: {e}")

# 2. Extract logo transparency
print("Processing black logo to make background transparent...")
if os.path.exists(img_black_path):
    img = Image.open(img_black_path).convert("RGBA")
    datas = img.getdata()
    
    new_data = []
    for item in datas:
        # Check if the pixel is black or near black
        # item is (R, G, B, A)
        r, g, b, a = item
        brightness = (r + g + b) / 3
        if r < 20 and g < 20 and b < 20:
            # Fully transparent for pure dark pixels
            new_data.append((0, 0, 0, 0))
        else:
            # Keep original pixel
            new_data.append((r, g, b, 255))
            
    img.putdata(new_data)
    
    # Let's crop to content
    # Get the bounding box of non-zero alpha pixels
    bbox = img.getbbox()
    if bbox:
        cropped_img = img.crop(bbox)
        logo_out_path = os.path.join(workspace_dir, "aiwx_logo_transparent.png")
        cropped_img.save(logo_out_path)
        print(f"Transparent logo saved to {logo_out_path} with size {cropped_img.size}")
    else:
        print("Error: Could not find bounding box for cropped image.")
else:
    print("Black logo image not found.")
