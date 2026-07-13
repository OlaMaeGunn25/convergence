import os
from PIL import Image

# Paths
workspace_dir = r"c:\Users\dahao\.gemini\antigravity\scratch\aiwx-social-media-agent"
brain_dir = r"C:\Users\dahao\.gemini\antigravity-ide\brain\d045454d-012c-4ba0-bf36-f58a4e6e45db"
img_white_path = os.path.join(brain_dir, "media__1780782925776.png")

output_logo_path = os.path.join(workspace_dir, "aiwx_logo_white_bg.png")
brain_output_path = os.path.join(brain_dir, "aiwx_logo_white_bg.png")
output_logo_path_50 = os.path.join(workspace_dir, "aiwx_logo_white_bg_50pct.png")
brain_output_path_50 = os.path.join(brain_dir, "aiwx_logo_white_bg_50pct.png")

def extract_logo():
    if not os.path.exists(img_white_path):
        print(f"Error: White logo image not found at {img_white_path}")
        return
    
    img = Image.open(img_white_path).convert("RGB")
    width, height = img.size
    
    # Check rows that have non-white pixels (threshold: any pixel where R < 245 or G < 245 or B < 245)
    non_white_rows = []
    for y in range(height):
        has_non_white = False
        for x in range(width):
            r, g, b = img.getpixel((x, y))
            if r < 245 or g < 245 or b < 245:
                has_non_white = True
                break
        non_white_rows.append(has_non_white)
        
    # Find the y-split: we want to find where the logo ends and where the white gap begins
    # We scan from top to bottom.
    # The logo starts at some row, ends at some row, followed by a gap of False rows (all white),
    # followed by the tagline rows.
    
    # Find the first True (logo start)
    logo_start_y = -1
    for y in range(height):
        if non_white_rows[y]:
            logo_start_y = y
            break
            
    # Find the end of the logo (first long sequence of all-white rows after logo start)
    # Let's find the first row y > logo_start_y where there are at least 15 consecutive all-white rows
    logo_end_y = -1
    for y in range(logo_start_y, height - 15):
        if not any(non_white_rows[y:y+15]):
            logo_end_y = y
            break
            
    if logo_end_y == -1:
        # Fallback to 70% of height if gap not found
        logo_end_y = int(height * 0.7)
        
    print(f"Detected logo vertical range: {logo_start_y} to {logo_end_y}")
    
    # Now let's crop the image vertically from 0 to logo_end_y
    logo_crop_v = img.crop((0, 0, width, logo_end_y))
    
    # Now crop horizontally to content (remove white space on left/right)
    # Find bounding box of non-white pixels in the cropped image
    bbox = logo_crop_v.getbbox()
    # Let's add a small margin (e.g. 40 pixels) around it for breathing room,
    # but ensure it stays within bounds
    margin = 40
    if bbox:
        left = max(0, bbox[0] - margin)
        top = max(0, bbox[1] - margin)
        right = min(width, bbox[2] + margin)
        bottom = min(logo_end_y, bbox[3] + margin)
        
        final_logo = img.crop((left, top, right, bottom))
        
        # Scale down by 50%
        w, h = final_logo.size
        final_logo = final_logo.resize((w // 2, h // 2), Image.Resampling.LANCZOS)
        
        # Save to workspace and brain folder (both original name and cached-bypassed name)
        final_logo.save(output_logo_path)
        final_logo.save(brain_output_path)
        final_logo.save(output_logo_path_50)
        final_logo.save(brain_output_path_50)
        print(f"Successfully saved clean white background logo (scaled 50% to {final_logo.size}) to:")
        print(f" - {output_logo_path}")
        print(f" - {output_logo_path_50}")
    else:
        print("Error: Could not calculate bounding box.")

if __name__ == "__main__":
    extract_logo()
