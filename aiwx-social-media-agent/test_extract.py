import os
import json
import base64
import sqlite3
import subprocess
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import ctypes
from ctypes import wintypes

class DATA_BLOB(ctypes.Structure):
    _fields_ = [
        ('cbData', wintypes.DWORD),
        ('pbData', ctypes.POINTER(ctypes.c_byte))
    ]

def decrypt_dpapi(encrypted_data):
    crypt32 = ctypes.windll.crypt32
    in_blob = DATA_BLOB()
    in_blob.cbData = len(encrypted_data)
    in_blob.pbData = (ctypes.c_byte * len(encrypted_data))(*encrypted_data)
    out_blob = DATA_BLOB()
    
    success = crypt32.CryptUnprotectData(
        ctypes.byref(in_blob),
        None,
        None,
        None,
        None,
        0,
        ctypes.byref(out_blob)
    )
    if not success:
        raise Exception("DPAPI decryption failed.")
    
    decrypted_bytes = bytes(ctypes.string_at(out_blob.pbData, out_blob.cbData))
    ctypes.windll.kernel32.LocalFree(out_blob.pbData)
    return decrypted_bytes

def get_aes_key(user_data_dir):
    local_state_path = os.path.join(user_data_dir, "Local State")
    with open(local_state_path, "r", encoding="utf-8") as f:
        local_state = json.load(f)
    encrypted_key = base64.b64decode(local_state["os_crypt"]["encrypted_key"])
    encrypted_key = encrypted_key[5:] # Remove 'DPAPI' prefix
    return decrypt_dpapi(encrypted_key)

def decrypt_cookie(value, aes_key):
    if not value:
        return ""
    try:
        if value.startswith(b'v10') or value.startswith(b'v11'):
            nonce = value[3:15]
            ciphertext = value[15:]
            aesgcm = AESGCM(aes_key)
            decrypted = aesgcm.decrypt(nonce, ciphertext, None)
            try:
                return decrypted.decode('utf-8')
            except UnicodeDecodeError:
                # If UTF-8 fails, try latin1 or hex representation
                return decrypted.decode('latin1')
        else:
            return decrypt_dpapi(value).decode('utf-8')
    except Exception as e:
        return f"__DECRYPT_FAILED__: {str(e)}"

def check_profile(profile_path, profile_name, aes_key):
    cookie_paths = [
        os.path.join(profile_path, "Network", "Cookies"),
        os.path.join(profile_path, "Cookies")
    ]
    src = None
    for p in cookie_paths:
        if os.path.exists(p):
            src = p
            break
    if not src:
        return
    
    dest = f"temp_cookies_{profile_name}.db"
    # Copy using system command to bypass file lock
    try:
        # On Windows, cmd.exe /c copy will fail with error if file is open and locked by another process with exclusive share mode.
        # But we can try Copy-Item in PowerShell or standard cmd copy. Let's try PowerShell first.
        subprocess.run(['powershell', '-Command', f"Copy-Item -Path '{src}' -Destination '{dest}' -Force"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        print(f"Failed to copy {profile_name}: {e}")
        return
        
    if not os.path.exists(dest):
        return

    try:
        conn = sqlite3.connect(dest)
        cursor = conn.cursor()
        cursor.execute("SELECT host_key, name, encrypted_value FROM cookies")
        rows = cursor.fetchall()
        
        fb = []
        ig = []
        th = []
        li = []
        
        for host_key, name, enc_val in rows:
            dec = decrypt_cookie(enc_val, aes_key)
            if "__DECRYPT_FAILED__" in dec:
                continue
            
            domain = host_key.lower()
            cookie_data = {"name": name, "value": dec, "domain": host_key}
            
            if "facebook.com" in domain:
                fb.append(cookie_data)
            elif "instagram.com" in domain:
                ig.append(cookie_data)
            elif "threads.net" in domain:
                th.append(cookie_data)
            elif "linkedin.com" in domain:
                li.append(cookie_data)
                
        if fb or ig or th or li:
            print(f"Profile: {profile_name}")
            if fb:
                has_session = any(c["name"] == "c_user" for c in fb)
                print(f"  - Facebook: {len(fb)} cookies, session={has_session}")
            if ig:
                has_session = any(c["name"] == "sessionid" for c in ig)
                print(f"  - Instagram: {len(ig)} cookies, session={has_session}")
            if th:
                has_session = any(c["name"] == "token" or c["name"] == "sessionid" for c in th)
                print(f"  - Threads: {len(th)} cookies, session={has_session}")
            if li:
                has_session = any(c["name"] == "li_at" for c in li)
                print(f"  - LinkedIn: {len(li)} cookies, session={has_session}")
                
        conn.close()
    except Exception as e:
        print(f"Error reading {profile_name}: {e}")
    finally:
        if os.path.exists(dest):
            os.remove(dest)

def main():
    user_data_dir = "C:\\Users\\dahao\\AppData\\Local\\Google\\Chrome\\User Data"
    aes_key = get_aes_key(user_data_dir)
    print("AES key retrieved. Scanning profiles...")
    for item in os.listdir(user_data_dir):
        item_path = os.path.join(user_data_dir, item)
        if os.path.isdir(item_path) and (item == "Default" or item.startswith("Profile ")):
            check_profile(item_path, item, aes_key)

if __name__ == "__main__":
    main()
