import urllib.request
import re
import os
from PIL import ImageFont

workspace_dir = r"c:\Users\dahao\.gemini\antigravity\scratch\aiwx-social-media-agent"

# Android 2.2 UA forces Google Fonts to return standard TTF URLs
android_ua = 'Mozilla/5.0 (Linux; U; Android 2.2; en-us; Nexus One Build/FRF91) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1'

def download_and_verify(font_family, weight, out_name):
    url = f"https://fonts.googleapis.com/css2?family={font_family.replace(' ', '+')}:wght@{weight}"
    print(f"Requesting CSS for {font_family} ({weight}) from: {url}")
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': android_ua})
        with urllib.request.urlopen(req) as response:
            css_content = response.read().decode('utf-8')
        
        # Search for src: url(https://.../something.ttf)
        match = re.search(r'src:\s*url\((https://[^)]+\.ttf)\)', css_content)
        
        if match:
            font_url = match.group(1)
            print(f"Found TTF URL: {font_url}")
            out_path = os.path.join(workspace_dir, out_name)
            urllib.request.urlretrieve(font_url, out_path)
            print(f"Downloaded to {out_path}")
            
            # Verify with Pillow
            font = ImageFont.truetype(out_path, 20)
            print(f"Verified: Loaded {out_name} successfully!")
            return True
        else:
            print(f"Could not find TTF URL in CSS. Response:\n{css_content[:300]}")
            return False
    except Exception as e:
        print(f"Error for {out_name}: {e}")
        return False

# Download and verify the required fonts
print("Downloading DM Sans Regular (400)...")
download_and_verify("DM Sans", "400", "DMSans-Regular.ttf")

print("\nDownloading DM Sans Medium (500)...")
download_and_verify("DM Sans", "500", "DMSans-Medium.ttf")

print("\nDownloading DM Sans Bold (700)...")
download_and_verify("DM Sans", "700", "DMSans-Bold.ttf")

print("\nDownloading Syne Bold (700)...")
download_and_verify("Syne", "700", "Syne-Bold.ttf")
