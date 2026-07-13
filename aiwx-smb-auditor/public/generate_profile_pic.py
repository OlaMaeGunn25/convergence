import os
from PIL import Image

# Paths
workspace_dir = r"c:\Users\dahao\.gemini\antigravity\scratch\aiwx-social-media-agent"
brain_dir = r"C:\Users\dahao\.gemini\antigravity-ide\brain\d045454d-012c-4ba0-bf36-f58a4e6e45db"
img_white_path = os.path.join(brain_dir, "media__1780782925776.png")

output_profile_path = os.path.join(workspace_dir, "aiwx_linkedin_profile.png")
scratch_dir = os.path.join(brain_dir, "scratch")
os.makedirs(scratch_dir, exist_ok=True)
brain_output_path = os.path.join(scratch_dir, "aiwx_linkedin_profile.png")

def generate_profile_pic():
    if not os.path.exists(img_white_path):
        print(f"Error: White logo image not found at {img_white_path}")
        return
    
    img = Image.open(img_white_path).convert("RGB")
    width, height = img.size
    
    # 1. Detect logo vertical range (excluding tagline)
    non_white_rows = []
    for y in range(height):
        has_non_white = False
        for x in range(width):
            r, g, b = img.getpixel((x, y))
            if r < 245 or g < 245 or b < 245:
                has_non_white = True
                break
        non_white_rows.append(has_non_white)
        
    logo_start_y = -1
    for y in range(height):
        if non_white_rows[y]:
            logo_start_y = y
            break
            
    logo_end_y = -1
    for y in range(logo_start_y, height - 15):
        if not any(non_white_rows[y:y+15]):
            logo_end_y = y
            break
            
    if logo_end_y == -1:
        logo_end_y = int(height * 0.7)
        
    print(f"Detected logo vertical range: {logo_start_y} to {logo_end_y}")
    
    # 2. Crop logo horizontally & vertically to content bounds
    logo_crop_v = img.crop((0, 0, width, logo_end_y))
    bbox = logo_crop_v.getbbox()
    
    margin = 40
    if not bbox:
        print("Error: Bounding box not found.")
        return
        
    left = max(0, bbox[0] - margin)
    top = max(0, bbox[1] - margin)
    right = min(width, bbox[2] + margin)
    bottom = min(logo_end_y, bbox[3] + margin)
    
    cropped_logo = img.crop((left, top, right, bottom))
    crop_w, crop_h = cropped_logo.size
    print(f"Cropped logo size: {crop_w} x {crop_h}")
    
    # 3. Create high-resolution square canvas for LinkedIn (1000x1000)
    canvas_size = 1000
    canvas = Image.new("RGB", (canvas_size, canvas_size), (255, 255, 255))
    
    # 4. Scale logo down relative to the canvas to fit circular crop
    # Bounding box width = 640px, which leaves ample safety margin for circular crop (R=500px)
    target_w = 640
    target_h = int(crop_h * (target_w / crop_w))
    
    resized_logo = cropped_logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    print(f"Resized logo for canvas: {target_w} x {target_h}")
    
    # 5. Paste logo in the center of the canvas
    paste_x = (canvas_size - target_w) // 2
    paste_y = (canvas_size - target_h) // 2
    canvas.paste(resized_logo, (paste_x, paste_y))
    
    # 6. Save final high-quality lossless PNG image
    canvas.save(output_profile_path, "PNG")
    canvas.save(brain_output_path, "PNG")
    
    # Save to the general scratch folder: C:\Users\dahao\.gemini\antigravity\scratch
    gen_scratch_dir = r"C:\Users\dahao\.gemini\antigravity\scratch"
    gen_scratch_path = os.path.join(gen_scratch_dir, "aiwx_linkedin_profile.png")
    try:
        os.makedirs(gen_scratch_dir, exist_ok=True)
        canvas.save(gen_scratch_path, "PNG")
        print(f"Saved to general scratch folder: {gen_scratch_path}")
    except Exception as e:
        print(f"Warning: Could not save to general scratch folder: {e}")
        
    print(f"Successfully generated high-quality LinkedIn profile image.")

if __name__ == "__main__":
    generate_profile_pic()
