# Google Apps Script Setup & Sync Instructions

This folder contains a fully compiled Google Apps Script (GAS) that will autonomously synchronize your **editorial calendar**, **post copy**, and **calendar schedules** directly into your **Google Docs**, **Google Sheets**, and **Google Calendar** (for `Aiworxmiths@gmail.com`).

Because this script runs natively inside your own Google Drive account, **it requires ZERO developer credentials, client secrets, or complex setup.**

---

### Step-by-Step Setup Guide (Takes 30 Seconds)

1. **Open Google Drive**:
   Go to [drive.google.com](https://drive.google.com) and log in with your `Aiworxmiths@gmail.com` account.

2. **Create Apps Script**:
   * Click the **`+ New`** button in the top left.
   * Hover over **`More`** and select **`Google Apps Script`**.
   * *(Note: If you don't see it, go to [script.google.com](https://script.google.com) and click **New Project**)*.

3. **Paste the Script**:
   * Delete any default placeholder code inside the `Code.gs` editor window.
   * Open the local file [aiwx_google_workspace_sync.js](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/aiwx_google_workspace_sync.js) inside this workspace, copy the **ENTIRE** contents, and paste them into the Google editor.

4. **Save and Name Your Project**:
   * Click **`Untitled project`** at the top left and rename it to **"CONVERGENCE-Ai Social Media Sync"**.
   * Click the **`Save`** icon (floppy disk) or press `Ctrl + S`.

5. **Run the Script**:
   * Ensure `runCONVERGENCE-AiSync` is selected in the function dropdown at the top, and click the **`Run`** button.

6. **Authorize the Application**:
   * A pop-up will ask you to authorize permissions. Click **`Review Permissions`**.
   * Select your `Aiworxmiths@gmail.com` account.
   * Click **`Advanced`** (in small text on the left) and select **`Go to CONVERGENCE-Ai Social Media Sync (unsafe)`** (Google displays this warning for custom personal scripts).
   * Click **`Allow`**.

7. **Enjoy Instant Synchronization!**:
   * The Apps Script execution log will output:
     `[+] Created Google Doc successfully. Name: 'CONVERGENCE-Ai Social Media Post Copies'`
     `[+] Created Google Sheet successfully. Name: 'CONVERGENCE-Ai Social Media Calendar'`
     `[+] Adding 20 scheduled posts to your Primary Calendar...`
     `[+] Google Workspace Synchronization successfully completed!`
   * Go back to Google Drive and your Google Calendar to see your new visual calendar, post copies, and automatic 10:00 AM calendar events successfully configured!

---

### Local Python Script Alternative:
If you prefer to run it locally via terminal, we have also pre-configured a complete [google_sync.py](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/google_sync.py) script in this folder. Simply download your Google Cloud `credentials.json` OAuth secret file into this directory and execute `python google_sync.py`.
