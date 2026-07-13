import urllib.request
import re
import os

workspace_dir = r"c:\Users\dahao\.gemini\antigravity\scratch\aiwx-social-media-agent"

def download_font_from_google(font_family, weight, out_name):
    # Format URL
    url = f"https://fonts.googleapis.com/css2?family={font_family.replace(' ', '+')}:wght@{weight}"
    print(f"Requesting CSS for {font_family} ({weight}) from: {url}")
    
    try:
        # Default python User-Agent will get TTF
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)'} # Old IE gets TTF
        )
        with urllib.request.urlopen(req) as response:
            css_content = response.read().decode('utf-8')
        
        # Search for src: url(https://...)
        match = re.search(r'src:\s*url\((https://[^)]+)\)', css_content)
        
        if match:
            font_url = match.group(1)
            print(f"Found font URL: {font_url}")
            out_path = os.path.join(workspace_dir, out_name)
            
            # Download the font file
            urllib.request.urlretrieve(font_url, out_path)
            print(f"Downloaded and saved to {out_path}")
            return True
        else:
            print("Could not find font URL in CSS:")
            print(css_content[:500])
            return False
    except Exception as e:
        print(f"Error downloading font: {e}")
        return False

download_font_from_google("Syne", "700", "Syne-Bold.ttf")
download_font_from_google("DM Sans", "500", "DMSans-Medium.ttf")
download_font_from_google("DM Sans", "400", "DMSans-Regular.ttf")
