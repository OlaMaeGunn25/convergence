import os
import re
import shutil
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Constants & Paths
WORKSPACE_DIR = r"c:\Users\dahao\.gemini\antigravity\scratch\aiwx-social-media-agent"
LIBRARY_MD_PATH = os.path.join(WORKSPACE_DIR, "social_media_posts_library.md")
PLAN_MD_PATH = os.path.join(WORKSPACE_DIR, "aiwx_social_media_posting_plan.md")
POSTS_PDF_PATH = os.path.join(WORKSPACE_DIR, "social_media_posts_review.pdf")
CALENDAR_PDF_PATH = os.path.join(WORKSPACE_DIR, "editorial_calendar.pdf")

def register_fonts():
    """Register custom Google fonts for a premium aesthetic."""
    print("--- Registering TrueType Fonts ---")
    font_paths = {
        'DMSans-Regular': os.path.join(WORKSPACE_DIR, 'DMSans-Regular.ttf'),
        'DMSans-Bold': os.path.join(WORKSPACE_DIR, 'DMSans-Bold.ttf'),
        'DMSans-Medium': os.path.join(WORKSPACE_DIR, 'DMSans-Medium.ttf'),
        'Syne-Bold': os.path.join(WORKSPACE_DIR, 'Syne-Bold.ttf')
    }
    
    for name, path in font_paths.items():
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(name, path))
                print(f"Successfully registered font: {name}")
            except Exception as e:
                print(f"Warning: Failed to register {name} from {path}: {e}")
        else:
            print(f"Warning: Font file not found at {path}. Falling back to default fonts.")

def md_to_html(text):
    """Converts basic markdown bold and code ticks to HTML tags for ReportLab Paragraphs."""
    if not text:
        return ""
    # Escape HTML entities first to avoid parsing issues
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Convert **bold** to <b>bold</b>
    text = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", text)
    # Convert `code` to <code>code</code>
    text = re.sub(r"`(.*?)`", r"<font face='Courier' color='#0b57d0'>\1</font>", text)
    # Restore escaped tags
    text = text.replace("&lt;b&gt;", "<b>").replace("&lt;/b&gt;", "</b>")
    text = text.replace("&lt;font face='Courier' color='#0b57d0'&gt;", "<font face='Courier' color='#0b57d0'>").replace("&lt;/font&gt;", "</font>")
    # Replace newlines with break tags
    text = text.replace("\n", "<br/>")
    return text

def parse_library(file_path):
    """Parses social_media_posts_library.md to extract posts, metadata, and copy."""
    print(f"--- Parsing Content Library: {os.path.basename(file_path)} ---")
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Content library file not found: {file_path}")
        
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Split by post headers
    posts = re.split(r"### Post (\d+):\s*(.*?)\n", content)
    post_blocks = posts[1:]

    parsed_posts = []
    for i in range(0, len(post_blocks), 3):
        if i + 2 >= len(post_blocks):
            break
        post_num = post_blocks[i]
        header_meta = post_blocks[i+1] # e.g. "Mon Jun 8 - The Silent Cost of Disconnected Operations"
        body = post_blocks[i+2]
        
        # Extract metadata
        metadata = {}
        metadata_lines = re.findall(r"\*\s+\*\*(.*?):\*\*\s+`(.*?)`|\*\s+\*\*(.*?):\*\*\s+(.*)", body)
        for match in metadata_lines:
            key = match[0] or match[2]
            val = match[1] or match[3]
            if key and val:
                metadata[key.strip()] = val.strip()
                
        # Extract platform copies
        sections = re.split(r"#### 📝 (.*?)\n", body)
        copies = {}
        for j in range(1, len(sections), 2):
            sec_name = sections[j].strip()
            sec_body = sections[j+1].strip()
            
            lines = []
            for line in sec_body.split("\n"):
                line_strip = line.strip()
                if line_strip.startswith(">"):
                    clean_line = re.sub(r"^>\s?", "", line_strip)
                    lines.append(clean_line)
                elif line_strip == "---":
                    break
                elif not line_strip and lines:
                    lines.append("")
            
            copies[sec_name] = "\n".join(lines).strip()
            
        parsed_posts.append({
            "number": post_num,
            "header": header_meta,
            "metadata": metadata,
            "copies": copies
        })
        
    print(f"Successfully parsed {len(parsed_posts)} posts.")
    return parsed_posts

def parse_calendar(file_path):
    """Parses the markdown campaign calendar table from aiwx_social_media_posting_plan.md."""
    print(f"--- Parsing Campaign Plan Table: {os.path.basename(file_path)} ---")
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Posting plan file not found: {file_path}")
        
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Find the markdown table rows
    table_rows = []
    for line in content.split("\n"):
        line_strip = line.strip()
        if line_strip.startswith("|") and not re.search(r"^[|\s:-]+$", line_strip):
            cols = [c.strip() for c in line_strip.split("|")[1:-1]]
            table_rows.append(cols)
            
    print(f"Successfully parsed calendar table with {len(table_rows)} rows (including headers).")
    return table_rows

def make_blockquote(text, style):
    """Wraps blockquote text inside a single-cell ReportLab table with background and borders."""
    html_text = md_to_html(text)
    p = Paragraph(html_text, style)
    t = Table([[p]], colWidths=[504])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8f9fa')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#dadce0')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ]))
    return t

def make_meta_table(metadata):
    """Creates a beautifully aligned key-value table for post metadata."""
    data = []
    
    # Key paragraph style
    k_style = ParagraphStyle(
        'MetaK',
        fontName='DMSans-Bold' if pdfmetrics.getRegisteredFontNames() else 'Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#5f6368')
    )
    # Value paragraph style
    v_style = ParagraphStyle(
        'MetaV',
        fontName='DMSans-Regular' if pdfmetrics.getRegisteredFontNames() else 'Helvetica',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#202124')
    )
    
    for k, v in metadata.items():
        data.append([
            Paragraph(f"{k}:", k_style),
            Paragraph(md_to_html(v), v_style)
        ])
        
    t = Table(data, colWidths=[120, 384])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#f1f3f4')),
    ]))
    return t

def generate_posts_pdf(posts, output_path):
    """Generates the high-fidelity social_media_posts_review.pdf file."""
    print(f"--- Generating Posts Review PDF: {output_path} ---")
    
    # Setup document
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    # Check registered fonts for styling
    has_custom_fonts = 'DMSans-Regular' in pdfmetrics.getRegisteredFontNames()
    title_font = 'Syne-Bold' if has_custom_fonts else 'Helvetica-Bold'
    body_bold_font = 'DMSans-Bold' if has_custom_fonts else 'Helvetica-Bold'
    body_medium_font = 'DMSans-Medium' if has_custom_fonts else 'Helvetica-Bold'
    body_regular_font = 'DMSans-Regular' if has_custom_fonts else 'Helvetica'
    
    # Define styles
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName=title_font,
        fontSize=26,
        leading=30,
        textColor=colors.HexColor('#0b57d0'),
        spaceAfter=10
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName=body_medium_font,
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#5f6368'),
        spaceAfter=30
    )
    
    section_title_style = ParagraphStyle(
        'SecTitle',
        parent=styles['Heading2'],
        fontName=title_font,
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#0b57d0'),
        spaceBefore=15,
        spaceAfter=10,
        keepWithNext=True
    )
    
    platform_label_style = ParagraphStyle(
        'PlatformLabel',
        parent=styles['Heading3'],
        fontName=body_bold_font,
        fontSize=10,
        leading=12,
        textColor=colors.HexColor('#1a73e8'),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )
    
    copy_text_style = ParagraphStyle(
        'CopyText',
        parent=styles['Normal'],
        fontName=body_regular_font,
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor('#171717')
    )
    
    intro_style = ParagraphStyle(
        'IntroText',
        parent=styles['Normal'],
        fontName=body_regular_font,
        fontSize=10,
        leading=15,
        textColor=colors.HexColor('#202124')
    )

    story = []
    
    # ----------------------------------------------------
    # TITLE PAGE
    # ----------------------------------------------------
    story.append(Paragraph("AiWorXmiths™", title_style))
    story.append(Paragraph("Go-To-Market Social Media & Blog Campaigns", subtitle_style))
    story.append(Spacer(1, 20))
    
    # Brief intro block
    intro_text = (
        "<b>Campaign Overview & Routing Brief</b><br/><br/>"
        "This packet contains the complete content library of 18 pre-approved posts "
        "designed to drive targeted traffic to our specific marketing pipelines. "
        "Each post has been framed to address core customer pain points while strictly "
        "following segment-specific routing constraints:<br/><br/>"
        "• <b>SMB Business Owners:</b> Routed to Main Homepage (aiworxmiths.com) to schedule "
        "diagnostic audits and Problem Zero™ sprints.<br/>"
        "• <b>Service-Based Small Businesses:</b> Routed to the SMB Portal (aiworxmiths.com/smb) "
        "focusing on ready-to-deploy back-office CRM/Hub software.<br/>"
        "• <b>Solopreneurs & Administrative Professionals:</b> Routed to the Solopreneur Portal "
        "(aiworxmiths.com/solopreneur) for capacity calculator tools and white-label reseller licensing.<br/><br/>"
        "<b>Core Pillars Highlighted:</b> Problems Before Solutions, Human-in-the-Loop (HITL) Security Gates, "
        "and Workforce Upskilling Roadmaps."
    )
    
    # Wrap intro in a clean container
    intro_box = Table([[Paragraph(intro_text, intro_style)]], colWidths=[504])
    intro_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f1f3f4')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#dadce0')),
        ('TOPPADDING', (0,0), (-1,-1), 15),
        ('BOTTOMPADDING', (0,0), (-1,-1), 15),
        ('LEFTPADDING', (0,0), (-1,-1), 15),
        ('RIGHTPADDING', (0,0), (-1,-1), 15),
    ]))
    story.append(intro_box)
    
    story.append(Spacer(1, 40))
    
    # Authors info
    founders_text = (
        "<b>Founders & Principal Consultants:</b><br/>"
        "Dahaomine Moody-Ward (CEO & Lead AI Consultant)<br/>"
        "Josette C. Kelley (CFO & AI Consultant)<br/><br/>"
        "<b>System Engine:</b> AiWorXmiths Operations Administrator™"
    )
    story.append(Paragraph(founders_text, intro_style))
    story.append(PageBreak())
    
    # ----------------------------------------------------
    # POSTS CONTENT REVIEW (One Post per Page)
    # ----------------------------------------------------
    for post in posts:
        # Section title: Post X: Mon Jun 8 - The Silent Cost...
        story.append(Paragraph(f"Post {post['number']}: {post['header']}", section_title_style))
        story.append(Spacer(1, 5))
        
        # Metadata table
        story.append(make_meta_table(post['metadata']))
        story.append(Spacer(1, 12))
        
        # Copies
        for platform, copy_content in post['copies'].items():
            if copy_content.strip():
                story.append(Paragraph(platform, platform_label_style))
                story.append(make_blockquote(copy_content, copy_text_style))
                story.append(Spacer(1, 8))
                
        # PageBreak after each post, except the last
        if post != posts[-1]:
            story.append(PageBreak())
            
    doc.build(story)
    print("Posts Review PDF generation complete.")

def generate_calendar_pdf(calendar_data, output_path):
    """Generates the landscape editorial_calendar.pdf file."""
    print(f"--- Generating Editorial Calendar PDF: {output_path} ---")
    
    # Setup document in landscape
    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(letter),
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    # Check fonts
    has_custom_fonts = 'DMSans-Regular' in pdfmetrics.getRegisteredFontNames()
    title_font = 'Syne-Bold' if has_custom_fonts else 'Helvetica-Bold'
    body_bold_font = 'DMSans-Bold' if has_custom_fonts else 'Helvetica-Bold'
    body_regular_font = 'DMSans-Regular' if has_custom_fonts else 'Helvetica'
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CalTitle',
        parent=styles['Heading1'],
        fontName=title_font,
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0b57d0'),
        spaceAfter=15
    )
    
    cell_header_style = ParagraphStyle(
        'CellHeader',
        parent=styles['Normal'],
        fontName=body_bold_font,
        fontSize=8.5,
        leading=10,
        textColor=colors.white
    )
    
    cell_body_style = ParagraphStyle(
        'CellBody',
        parent=styles['Normal'],
        fontName=body_regular_font,
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#202124')
    )
    
    cell_bold_style = ParagraphStyle(
        'CellBold',
        parent=styles['Normal'],
        fontName=body_bold_font,
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#202124')
    )

    story = []
    story.append(Paragraph("AiWorXmiths™ Go-To-Market Social Media Calendar (June - July 2026)", title_style))
    story.append(Spacer(1, 5))
    
    # Separating headers and data
    headers = calendar_data[0]
    data_rows = calendar_data[1:]
    
    # We will format text cells to preserve HTML highlights
    table_data = []
    # Add Header Row
    table_data.append([Paragraph(f"<b>{h}</b>", cell_header_style) for h in headers])
    
    # Add Data Rows
    for row in data_rows:
        formatted_row = []
        for idx, col in enumerate(row):
            # Clean Markdown bold / code ticks
            clean_text = md_to_html(col)
            
            # Select proper style
            if idx == 0 or idx == 1:
                # Week and Date are bold
                formatted_row.append(Paragraph(clean_text, cell_bold_style))
            elif idx == 3:
                # Content Type: Highlight Product Focus in blue
                if "Product" in col or "Twilio" in col or "Reseller" in col or "Security" in col:
                    highlighted = f"<b><font color='#0b57d0'>{clean_text}</font></b>"
                    formatted_row.append(Paragraph(highlighted, cell_bold_style))
                else:
                    formatted_row.append(Paragraph(clean_text, cell_body_style))
            else:
                formatted_row.append(Paragraph(clean_text, cell_body_style))
                
        table_data.append(formatted_row)
        
    # Column widths (Total: 720 points)
    # Columns: Week (30), Date (65), Platform (55), Content Type (110), Target Segment (110), Destination URL (140), Focus & Messaging (210)
    col_widths = [30, 65, 55, 110, 110, 140, 210]
    
    cal_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    
    # Style Table
    cal_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0b57d0')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#dadce0')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8f9fa')])
    ]))
    
    story.append(cal_table)
    doc.build(story)
    print("Calendar PDF generation complete.")

if __name__ == "__main__":
    register_fonts()
    try:
        # Parse content from markdown files
        posts_data = parse_library(LIBRARY_MD_PATH)
        calendar_data = parse_calendar(PLAN_MD_PATH)
        
        # Generate PDFs
        generate_posts_pdf(posts_data, POSTS_PDF_PATH)
        generate_calendar_pdf(calendar_data, CALENDAR_PDF_PATH)
        
        print("\n--- All Assets Successfully Generated ---")
    except Exception as e:
        print(f"\nFatal Error during asset generation: {e}")
        import traceback
        traceback.print_exc()
