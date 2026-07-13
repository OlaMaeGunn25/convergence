import os
import pickle
import google.auth
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# If modifying these scopes, delete the file token.pickle.
SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/calendar'
]

def get_credentials():
    creds = None
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists('credentials.json'):
                print("[-] Error: 'credentials.json' not found in the workspace!")
                print("[-] Please download your OAuth 2.0 client credentials from Google Cloud Console and place them in this folder.")
                return None
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        # Save the credentials for the next run
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)
    return creds

def create_drive_folder(drive_service):
    file_metadata = {
        'name': 'AiWorXmiths Social Media Assets',
        'mimeType': 'application/vnd.google-apps.folder'
    }
    file = drive_service.files().create(body=file_metadata, fields='id').execute()
    print(f"[+] Created Google Drive Folder. Folder ID: {file.get('id')}")
    return file.get('id')

def upload_image(drive_service, folder_id, file_name, file_path):
    if not os.path.exists(file_path):
        print(f"[-] Image not found locally: {file_path}")
        return None
    file_metadata = {
        'name': file_name,
        'parents': [folder_id]
    }
    media = MediaFileUpload(file_path, mimetype='image/png')
    file = drive_service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    print(f"[+] Uploaded Visual Asset: {file_name} (ID: {file.get('id')})")
    return file.get('id')

def create_google_doc(docs_service, posts_data):
    # Create an empty Google Doc
    title = 'AiWorXmiths Social Media Post Copies'
    body = {
        'title': title
    }
    doc = docs_service.documents().create(body=body).execute()
    doc_id = doc.get('documentId')
    print(f"[+] Created Google Doc: '{title}' (ID: {doc_id})")
    
    # Write the content
    requests = []
    text = "AiWorXmiths™ AI Strategy & Operations - Social Media Posts\n"
    text += "======================================================\n\n"
    
    for i, post in enumerate(posts_data, 1):
        text += f"POST {i}: {post['title']}\n"
        text += f"Platform: {post['platform']}\n"
        text += f"Keywords: {post['keywords']}\n"
        text += f"Visual Asset: {post['image']}\n"
        text += f"Copy:\n-----------------------------\n{post['copy']}\n-----------------------------\n\n\n"
        
    requests.append({
        'insertText': {
            'location': {
                'index': 1
            },
            'text': text
        }
    })
    
    docs_service.documents().batchUpdate(documentId=doc_id, body={'requests': requests}).execute()
    print("[+] Wrote all 20 post copies successfully to Google Docs.")
    return doc_id

def create_google_sheet(sheets_service, calendar_rows):
    # Create an empty Spreadsheet
    spreadsheet_body = {
        'properties': {
            'title': 'AiWorXmiths Social Media Calendar'
        }
    }
    request = sheets_service.spreadsheets().create(body=spreadsheet_body, fields='spreadsheetId')
    response = request.execute()
    sheet_id = response.get('spreadsheetId')
    print(f"[+] Created Google Sheet: 'AiWorXmiths Social Media Calendar' (ID: {sheet_id})")
    
    # Write the calendar table
    values = [
        ["Week", "Date", "Platform", "Content Type (Branding)", "Focus / Target", "QA Action", "Call to Action (CTA)"]
    ]
    for row in calendar_rows:
        values.append(row)
        
    body = {
        'values': values
    }
    
    sheets_service.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range="Sheet1!A1",
        valueInputOption="RAW",
        body=body
    ).execute()
    print("[+] Wrote complete 4-week calendar schedule successfully to Google Sheets.")
    return sheet_id

def add_calendar_events(calendar_service, posts_data):
    print("[+] Adding 20 scheduled posts to your Aiworxmiths@gmail.com calendar...")
    for post in posts_data:
        # Formulate description
        description = f"Platform: {post['platform']}\n"
        description += f"Visual Asset: {post['image']}\n"
        description += f"Keywords: {post['keywords']}\n\n"
        description += f"--- POST COPY ---\n{post['copy']}"
        
        event = {
            'summary': f"[{post['platform'].upper()}] {post['title']}",
            'description': description,
            'start': {
                'dateTime': f"{post['date']}T10:00:00-04:00",
                'timeZone': 'America/New_York',
            },
            'end': {
                'dateTime': f"{post['date']}T10:30:00-04:00",
                'timeZone': 'America/New_York',
            },
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'email', 'minutes': 24 * 60},
                    {'method': 'popup', 'minutes': 30},
                ],
            },
        }
        
        event = calendar_service.events().insert(calendarId='primary', body=event).execute()
        print(f"    - Scheduled: {post['title']} on {post['date']}")
    print("[+] Calendar scheduling completed successfully.")

def run_sync():
    creds = get_credentials()
    if not creds:
        return
        
    drive_service = build('drive', 'v3', credentials=creds)
    docs_service = build('docs', 'v1', credentials=creds)
    sheets_service = build('sheets', 'v4', credentials=creds)
    calendar_service = build('calendar', 'v3', credentials=creds)
    
    # 1. Create Folder
    folder_id = create_drive_folder(drive_service)
    
    # 2. Upload images
    workspace_dir = r"c:\Users\dahao\.gemini\antigravity\scratch\aiwx-social-media-agent"
    images = {
        "1_aiwx_consultants_team.png": os.path.join(workspace_dir, "1_aiwx_consultants_team.png"),
        "2_operations_director_smb.png": os.path.join(workspace_dir, "2_operations_director_smb.png"),
        "3_empowered_systems_consultant.png": os.path.join(workspace_dir, "3_empowered_systems_consultant.png"),
        "lead_architect_presenting_1779798767831.png": os.path.join(workspace_dir, "lead_architect_presenting_1779798767831.png"),
        "diverse_male_entrepreneur_1779798785119.png": os.path.join(workspace_dir, "diverse_male_entrepreneur_1779798785119.png"),
        "collaborative_scoping_1779798801153.png": os.path.join(workspace_dir, "collaborative_scoping_1779798801153.png")
    }
    for file_name, file_path in images.items():
        upload_image(drive_service, folder_id, file_name, file_path)
        
    # Dynamically load all posts and calendar rows from the Javascript sync script
    def load_posts_from_js():
        import re
        js_path = os.path.join(workspace_dir, 'aiwx_google_workspace_sync.js')
        if not os.path.exists(js_path):
            print(f"[-] Error: Could not find '{js_path}' to parse posts!")
            return [], []
            
        with open(js_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Extract the postsData block
        match = re.search(r'var postsData\s*=\s*\[(.*?)\];\s*//\s*2\.\s*CREATE GOOGLE DOC', content, re.DOTALL)
        if not match:
            print("[-] Error: Could not parse postsData block in JS file!")
            return [], []
            
        block = match.group(1)
        # Split block by JS object boundaries
        object_strings = re.split(r'\}\s*,\s*\n\s*\{|\n\s*\}\s*,\s*\{', block)
        posts = []
        
        def get_val(obj_str, key):
            pattern = rf'{key}:\s*"((?:[^"\\]|\\.)*)"'
            m = re.search(pattern, obj_str, re.DOTALL)
            if m:
                val = m.group(1)
                return val.replace('\\n', '\n').replace('\\"', '"').replace("\\'", "'")
            return ""
            
        for obj in object_strings:
            obj = obj.strip()
            if not obj.startswith('{'):
                obj = '{' + obj
            if not obj.endswith('}'):
                obj = obj + '}'
                
            week_match = re.search(r'week:\s*"(\d+)"', obj)
            week = week_match.group(1) if week_match else "1"
            
            date = get_val(obj, 'date')
            platform = get_val(obj, 'platform')
            type_ = get_val(obj, 'type')
            target = get_val(obj, 'target')
            keywords = get_val(obj, 'keywords')
            image = get_val(obj, 'image')
            title = get_val(obj, 'title')
            copy = get_val(obj, 'copy')
            
            if title:
                posts.append({
                    'week': week,
                    'date': date,
                    'platform': platform,
                    'type': type_,
                    'target': target,
                    'keywords': keywords,
                    'image': image,
                    'title': title,
                    'copy': copy
                })
                
        calendar_rows_data = []
        for post in posts:
            cta = "[Product URL]" if (post['platform'] == "LinkedIn" and post['type'] == "Product Focus") else "Visit aiworxmiths.com"
            calendar_rows_data.append([
                post['week'],
                post['date'],
                post['platform'],
                post['type'],
                post['target'],
                post['keywords'],
                cta
            ])
            
        return posts, calendar_rows_data

    posts_data, calendar_rows = load_posts_from_js()
    if not posts_data:
        print("[-] No posts parsed. Aborting sync.")
        return
        

    # 3. Create Google Doc
    create_google_doc(docs_service, posts_data)
    
    # 4. Create Google Sheet
    create_google_sheet(sheets_service, calendar_rows)
    
    # 5. Add Calendar Events
    add_calendar_events(calendar_service, posts_data)

if __name__ == '__main__':
    run_sync()
