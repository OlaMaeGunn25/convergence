import os
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter

# Paths
workspace_dir = r"c:\Users\dahao\.gemini\antigravity\scratch\aiwx-social-media-agent"
brain_dir = r"C:\Users\dahao\.gemini\antigravity-ide\brain\d045454d-012c-4ba0-bf36-f58a4e6e45db"

bg_image_path = os.path.join(brain_dir, "tech_bg_abstract_1780841533475.png")
logo_path = os.path.join(workspace_dir, "aiwx_logo_transparent.png")
syne_font_path = os.path.join(workspace_dir, "Syne-Bold.ttf")
dm_sans_medium_path = os.path.join(workspace_dir, "DMSans-Medium.ttf")
dm_sans_regular_path = os.path.join(workspace_dir, "DMSans-Medium.ttf")

output_path = os.path.join(workspace_dir, "aiwx_linkedin_cover.png")

# LinkedIn dimensions
banner_width = 1584
banner_height = 396

def compose_banner():
    print("Composing LinkedIn banner with 3x supersampling...")
    
    # 3x supersampling scale
    SCALE = 3
    canvas_w = banner_width * SCALE
    canvas_h = banner_height * SCALE
    
    # 1. Load background and resize
    if not os.path.exists(bg_image_path):
        print(f"Error: Background image not found at {bg_image_path}")
        return
    
    bg = Image.open(bg_image_path).convert("RGBA")
    
    # Resize background to cover banner size at SCALE (keeping aspect ratio, then cropping)
    bg_w, bg_h = bg.size
    aspect_ratio_banner = banner_width / banner_height
    aspect_ratio_bg = bg_w / bg_h
    
    if aspect_ratio_bg > aspect_ratio_banner:
        # BG is wider, scale by height
        new_h = canvas_h
        new_w = int(bg_w * (canvas_h / bg_h))
    else:
        # BG is taller, scale by width
        new_w = canvas_w
        new_h = int(bg_h * (canvas_w / bg_w))
        
    bg_resized = bg.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Crop center
    left = (new_w - canvas_w) // 2
    top = (new_h - canvas_h) // 2
    right = left + canvas_w
    bottom = top + canvas_h
    canvas = bg_resized.crop((left, top, right, bottom))
    
    # 1.5 Dim the background image to 40% brightness to make the white text pop
    enhancer = ImageEnhance.Brightness(canvas)
    canvas = enhancer.enhance(0.40)
    print("Dimmed background to 40% brightness.")
    
    # 2. Add a dark gradient / vignette on the left to ensure high readability
    # Let's create a transparent black layer that fades from left to right
    overlay = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    draw_overlay = ImageDraw.Draw(overlay)
    
    # Fade from 85% opacity (alpha=216) on the left to 0% opacity on the right
    # At 3x scale: fade starts at x = 400 * 3 = 1200, ends at x = 1000 * 3 = 3000
    fade_start = 400 * SCALE
    fade_end = 1000 * SCALE
    fade_width = fade_end - fade_start
    
    for x in range(canvas_w):
        if x < fade_start:
            alpha = 216 # 85% opacity
        elif x < fade_end:
            # Linear transition from 216 to 0
            alpha = int(216 * (1 - (x - fade_start) / fade_width))
        else:
            alpha = 0
        
        # Draw 1-pixel wide line
        draw_overlay.line([(x, 0), (x, canvas_h)], fill=(11, 14, 20, alpha))
        
    # Alpha composite the overlay onto the canvas
    canvas = Image.alpha_composite(canvas, overlay)
    
    # 3. Add Logo on the right side
    if os.path.exists(logo_path):
        logo = Image.open(logo_path).convert("RGBA")
        
        # Target logo height is 135 pixels (405 pixels at 3x scale) for cleaner layout and zero text overlap
        logo_target_h = 135 * SCALE
        logo_w, logo_h = logo.size
        logo_target_w = int(logo_w * (logo_target_h / logo_h))
        logo_resized = logo.resize((logo_target_w, logo_target_h), Image.Resampling.LANCZOS)
        
        # Paste logo on the right side (centered vertically)
        logo_x = canvas_w - logo_target_w - (60 * SCALE) # 60px margin from right at 3x
        logo_y = (canvas_h - logo_target_h) // 2 - (10 * SCALE) # slightly elevated
        
        # Paste with transparency mask
        canvas.paste(logo_resized, (logo_x, logo_y), logo_resized)
        print(f"Pasted logo at ({logo_x}, {logo_y})")
    else:
        print("Error: Logo not found.")
        
    # 3.5 Add a very subtle white glow behind the text block to improve visibility
    glow_layer = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    
    # Draw a soft white ellipse behind the copy area (x=220 to x=980, y=40 to y=330 at 3x scale)
    # Reduced alpha to 15 (6% opacity) since the background is already dimmed, preventing contrast loss
    glow_draw.ellipse(
        [220 * SCALE, 40 * SCALE, 980 * SCALE, 330 * SCALE], 
        fill=(255, 255, 255, 15)
    )
    
    # Apply Gaussian blur scaled to 3x (radius = 60 * 3 = 180)
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=60 * SCALE))
    
    # Composite the glow layer onto the canvas
    canvas = Image.alpha_composite(canvas, glow_layer)
    print("Added subtle white glow behind text block.")
        
    # 4. Draw Typography
    draw = ImageDraw.Draw(canvas)
    
    # Load fonts (Scaled to 3x)
    dm_sans_bold_path = os.path.join(workspace_dir, "DMSans-Bold.ttf")
    try:
        font_headline = ImageFont.truetype(syne_font_path, 38 * SCALE) # Reduced from 44 to 38 to fit perfectly
        font_subhead = ImageFont.truetype(dm_sans_bold_path, 24 * SCALE) # DM Sans Bold, size 24
        font_quote = ImageFont.truetype(dm_sans_medium_path, 20 * SCALE) # DM Sans Medium, size 20 for better legibility
        font_services = ImageFont.truetype(dm_sans_medium_path, 18 * SCALE) # DM Sans Medium, size 18
        font_cta = ImageFont.truetype(dm_sans_bold_path, 25 * SCALE) # DM Sans Bold, size 25
        print("Loaded fonts successfully.")
    except Exception as e:
        print(f"Error loading fonts: {e}. Falling back to default font.")
        font_headline = ImageFont.load_default()
        font_subhead = ImageFont.load_default()
        font_quote = ImageFont.load_default()
        font_services = ImageFont.load_default()
        font_cta = ImageFont.load_default()
 
    # Draw text (Scaled coordinates)
    text_x = 290 * SCALE # Starts at 290px margin (safe for typical profile picture clearance, but gives more space)
    
    # Helper to get text width
    def get_text_width(text, font):
        bbox = draw.textbbox((0, 0), text, font=font)
        return bbox[2] - bbox[0]
        
    # Helper to draw text with drop shadow for extreme sharpness & pop
    def draw_text_with_shadow(position, text, font, fill_color, shadow_opacity=180, offset_px=1):
        # Draw shadow
        off = offset_px * SCALE
        draw.text((position[0] + off, position[1] + off), text, font=font, fill=(0, 0, 0, shadow_opacity))
        # Draw main text
        draw.text(position, text, font=font, fill=fill_color)
        
    # Line 1: Headline (Consultancy Value Prop)
    headline_text = "We fix the bottlenecks slowing your business."
    draw_text_with_shadow((text_x, 70 * SCALE), headline_text, font=font_headline, fill_color=(255, 255, 255, 255))
    
    # Line 2: Sub-headline (Consultancy & Target Segments)
    subhead_text = "AI Strategy & Operations for Solopreneurs, SMBs, and Resellers"
    # Primary Brand Cyan/Glow Blue: #00d2ff (RGB: 0, 210, 255)
    draw_text_with_shadow((text_x, 120 * SCALE), subhead_text, font=font_subhead, fill_color=(0, 210, 255, 255))
    
    # Line 3: Delivery & Growth Features
    features_text = "Human-in-the-Loop   •   Employee Upskilling for AI-Driven Growth"
    # Ice-blue / slate white for clean contrast against dark navy
    draw_text_with_shadow((text_x, 162 * SCALE), features_text, font=font_quote, fill_color=(210, 218, 230, 255))
    
    # Line 4: Engagement Roadmap & Scope
    roadmap_text = "Quick-Wins to Operations Overhauling   •   7 - 90 Day Roadmaps"
    draw_text_with_shadow((text_x, 198 * SCALE), roadmap_text, font=font_quote, fill_color=(210, 218, 230, 255))
    
    # Line 5: Website & CTA (with shadow support)
    y_pos_cta = 238 * SCALE
    
    web_part = "AiWorXmiths.com"
    div_part = "   •   "
    cta_part = "Book a Free Consultation"
    
    w_web = get_text_width(web_part, font_cta)
    w_div = get_text_width(div_part, font_cta)
    
    # Draw Shadows first
    off = 1 * SCALE
    draw.text((text_x + off, y_pos_cta - (4 * SCALE) + off), web_part, font=font_cta, fill=(0, 0, 0, 180))
    draw.text((text_x + w_web + off, y_pos_cta - (4 * SCALE) + off), div_part, font=font_cta, fill=(0, 0, 0, 180))
    draw.text((text_x + w_web + w_div + off, y_pos_cta - (4 * SCALE) + off), cta_part, font=font_cta, fill=(0, 0, 0, 180))
    
    # Draw Main Text
    draw.text((text_x, y_pos_cta - (4 * SCALE)), web_part, font=font_cta, fill=(255, 255, 255, 255))
    draw.text((text_x + w_web, y_pos_cta - (4 * SCALE)), div_part, font=font_cta, fill=(255, 255, 255, 80))
    draw.text((text_x + w_web + w_div, y_pos_cta - (4 * SCALE)), cta_part, font=font_cta, fill=(0, 210, 255, 255))
    
    # Line 6: Divider line (drawn with a subtle drop shadow as well)
    # Shadow
    draw.line(
        [(text_x + off, 280 * SCALE + off), (text_x + (720 * SCALE) + off, 280 * SCALE + off)], 
        fill=(0, 0, 0, 100), 
        width=1 * SCALE
    )
    # Line
    draw.line(
        [(text_x, 280 * SCALE), (text_x + (720 * SCALE), 280 * SCALE)], 
        fill=(255, 255, 255, 30), 
        width=1 * SCALE
    )
    
    # Line 7: Tiers/Services
    services_text = "AI Starter Sprint™   •   Problem Zero™   •   Signal & Leverage™   •   Momentum Engine™"
    # Brighter slate gray for services line
    draw_text_with_shadow((text_x, 298 * SCALE), services_text, font=font_services, fill_color=(150, 168, 190, 255))
    
    # 5. Downsample to target banner size (1584 x 396) for maximum sharpness
    print(f"Downsampling canvas from {canvas_w}x{canvas_h} to {banner_width}x{banner_height}...")
    canvas_final = canvas.resize((banner_width, banner_height), Image.Resampling.LANCZOS)
    
    # Convert to RGB to save
    canvas_final = canvas_final.convert("RGB")
    canvas_final.save(output_path, "PNG")
    print(f"Successfully generated LinkedIn cover banner at: {output_path}")
    
    # Save to the general scratch folder: C:\Users\dahao\.gemini\antigravity\scratch
    gen_scratch_dir = r"C:\Users\dahao\.gemini\antigravity\scratch"
    gen_scratch_path = os.path.join(gen_scratch_dir, "aiwx_linkedin_cover.png")
    try:
        os.makedirs(gen_scratch_dir, exist_ok=True)
        canvas_final.save(gen_scratch_path, "PNG")
        print(f"Saved to general scratch folder: {gen_scratch_path}")
    except Exception as e:
        print(f"Warning: Could not save to general scratch folder: {e}")
        
    # Save directly to brain scratch folder as well
    scratch_dir = os.path.join(brain_dir, "scratch")
    try:
        os.makedirs(scratch_dir, exist_ok=True)
        brain_output_path = os.path.join(scratch_dir, "aiwx_linkedin_cover.png")
        canvas_final.save(brain_output_path, "PNG")
        print(f"Directly saved to brain scratch folder: {brain_output_path}")
    except Exception as e:
        print(f"Warning: Could not save to brain scratch folder: {e}")

if __name__ == "__main__":
    compose_banner()
