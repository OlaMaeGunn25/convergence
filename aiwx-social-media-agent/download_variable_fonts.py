import urllib.request
import os
from PIL import ImageFont

workspace_dir = r"c:\Users\dahao\.gemini\antigravity\scratch\aiwx-social-media-agent"

syne_url = "https://github.com/google/fonts/raw/main/ofl/syne/Syne%5Bwght%5D.ttf"
dmsans_url = "https://github.com/google/fonts/raw/main/ofl/dmsans/DMSans%5Bopsz%2Cwght%5D.ttf"

syne_path = os.path.join(workspace_dir, "Syne-Bold.ttf")
dmsans_path = os.path.join(workspace_dir, "DMSans-Medium.ttf")

print("Downloading Syne variable font...")
try:
    urllib.request.urlretrieve(syne_url, syne_path)
    print("Downloaded Syne.")
    font = ImageFont.truetype(syne_path, 40)
    print("Syne is a valid font and was loaded successfully!")
except Exception as e:
    print(f"Error for Syne: {e}")

print("Downloading DM Sans variable font...")
try:
    urllib.request.urlretrieve(dmsans_url, dmsans_path)
    print("Downloaded DM Sans.")
    font = ImageFont.truetype(dmsans_path, 24)
    print("DM Sans is a valid font and was loaded successfully!")
except Exception as e:
    print(f"Error for DM Sans: {e}")
