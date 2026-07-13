import os
import json
import base64
import sqlite3
import shutil
import ctypes
from ctypes import wintypes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# DPAPI decryption setup
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
    if not os.path.exists(local_state_path):
        raise FileNotFoundError(f"Local State not found at {local_state_path}")
        
    with open(local_state_path, "r", encoding="utf-8") as f:
        local_state = json.load(f)
        
    encrypted_key = base64.b64decode(local_state["os_crypt"]["encrypted_key"])
    # Remove prefix 'DPAPI'
    encrypted_key = encrypted_key[5:]
    # Decrypt key
    decrypted_key = decrypt_dpapi(encrypted_key)
    return decrypted_key

def chrome_time_to_unix(expires_utc):
    if expires_utc > 0:
        return (expires_utc / 1000000.0) - 11644473600.0
    return -1

def decrypt_cookie(value, aes_key):
    if not value:
        return ""
    try:
        if value.startswith(b'v10') or value.startswith(b'v11'):
            nonce = value[3:15]
            ciphertext = value[15:]
            aesgcm = AESGCM(aes_key)
            decrypted = aesgcm.decrypt(nonce, ciphertext, None)
            return decrypted.decode('utf-8')
        else:
            # DPAPI encrypted (older Chrome versions)
            return decrypt_dpapi(value).decode('utf-8')
    except Exception as e:
        # Print just the first error to avoid terminal spam
        if not hasattr(decrypt_cookie, "error_printed"):
            print(f"    [!] Decryption failed for cookie of length {len(value)}, prefix {value[:5]}: {e}")
            decrypt_cookie.error_printed = True
        return None

def scan_profile_cookies(profile_dir, profile_name, aes_key):
    cookie_paths = [
        os.path.join(profile_dir, "Network", "Cookies"),
        os.path.join(profile_dir, "Cookies")
    ]
    
    cookie_path = None
    for p in cookie_paths:
        if os.path.exists(p):
            cookie_path = p
            break
            
    if not cookie_path:
        return None
        
    # Copy to temp file to avoid lock issues
    temp_db_path = f"temp_cookies_{profile_name}.db"
    try:
        shutil.copyfile(cookie_path, temp_db_path)
    except Exception as e:
        print(f"    [-] Could not copy database for {profile_name}: {e}")
        return None
        
    cookies_list = []
    try:
        conn = sqlite3.connect(temp_db_path)
        cursor = conn.cursor()
        
        # Query all columns we need
        cursor.execute("""
            SELECT host_key, name, path, encrypted_value, expires_utc, is_secure, is_httponly, samesite
            FROM cookies
        """)
        
        rows = cursor.fetchall()
        for row in rows:
            host_key, name, path_val, encrypted_value, expires_utc, is_secure, is_httponly, samesite = row
            
            decrypted_val = decrypt_cookie(encrypted_value, aes_key)
            if decrypted_val is None:
                continue
                
            # Convert samesite value
            samesite_str = "Lax"
            if samesite == -1: samesite_str = "None"
            elif samesite == 0: samesite_str = "None"
            elif samesite == 1: samesite_str = "Lax"
            elif samesite == 2: samesite_str = "Strict"
            
            cookies_list.append({
                "name": name,
                "value": decrypted_val,
                "domain": host_key,
                "path": path_val,
                "expires": chrome_time_to_unix(expires_utc),
                "httpOnly": bool(is_httponly),
                "secure": bool(is_secure),
                "sameSite": samesite_str
            })
            
        conn.close()
    except Exception as e:
        print(f"    [-] Error reading database for {profile_name}: {e}")
    finally:
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)
            
    return cookies_list

def main():
    user_data_dir = "C:\\Users\\dahao\\AppData\\Local\\Google\\Chrome\\User Data"
    config_dir = os.path.join(os.path.dirname(__file__), "config")
    os.makedirs(config_dir, exist_ok=True)
    
    print("[+] Extracting Chrome AES encryption key...")
    try:
        aes_key = get_aes_key(user_data_dir)
        print(f"[+] Successfully retrieved AES key ({len(aes_key)} bytes).")
    except Exception as e:
        print(f"[-] Failed to get AES key: {e}")
        return
        
    # Find all profile directories
    profiles = []
    for item in os.listdir(user_data_dir):
        item_path = os.path.join(user_data_dir, item)
        if os.path.isdir(item_path):
            if item == "Default" or item.startswith("Profile "):
                profiles.append((item, item_path))
                
    print(f"[+] Found {len(profiles)} potential Chrome profiles.")
    
    facebook_cookies = []
    instagram_cookies = []
    threads_cookies = []
    
    best_profile_fb = None
    best_profile_ig = None
    best_profile_th = None
    
    for profile_name, profile_path in profiles:
        print(f"[+] Scanning profile: {profile_name}...")
        cookies = scan_profile_cookies(profile_path, profile_name, aes_key)
        if cookies is None:
            print(f"    [-] No cookie database file found or access error.")
            continue
            
        print(f"    - Total cookies decrypted: {len(cookies)}")
        if len(cookies) == 0:
            continue
            
        # Filter cookies for platforms
        fb = [c for c in cookies if "facebook.com" in c["domain"]]
        ig = [c for c in cookies if "instagram.com" in c["domain"]]
        th = [c for c in cookies if "threads.net" in c["domain"]]
        
        # Check active session indicators
        has_fb_session = any(c["name"] == "c_user" for c in fb)
        has_ig_session = any(c["name"] == "sessionid" for c in ig)
        has_th_session = any(c["name"] == "token" or c["name"] == "sessionid" for c in th) or len(th) > 3
        
        print(f"    - Facebook: {len(fb)} cookies (Session: {has_fb_session})")
        print(f"    - Instagram: {len(ig)} cookies (Session: {has_ig_session})")
        print(f"    - Threads: {len(th)} cookies (Session: {has_th_session})")
        
        if has_fb_session and (not facebook_cookies or len(fb) > len(facebook_cookies)):
            facebook_cookies = fb
            best_profile_fb = profile_name
            
        if has_ig_session and (not instagram_cookies or len(ig) > len(instagram_cookies)):
            instagram_cookies = ig
            best_profile_ig = profile_name
            
        if has_th_session and (not threads_cookies or len(th) > len(threads_cookies)):
            threads_cookies = th
            best_profile_th = profile_name

    # Write out cookies files
    if facebook_cookies:
        out_path = os.path.join(config_dir, "cookies_facebook.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(facebook_cookies, f, indent=2)
        print(f"\n[+] Saved {len(facebook_cookies)} Facebook cookies from {best_profile_fb} to cookies_facebook.json")
    else:
        print("\n[-] Warning: No active Facebook session cookie (c_user) found.")
        
    if instagram_cookies:
        out_path = os.path.join(config_dir, "cookies_instagram.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(instagram_cookies, f, indent=2)
        print(f"[+] Saved {len(instagram_cookies)} Instagram cookies from {best_profile_ig} to cookies_instagram.json")
    else:
        print("[-] Warning: No active Instagram session cookie (sessionid) found.")
        
    if threads_cookies:
        out_path = os.path.join(config_dir, "cookies_threads.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(threads_cookies, f, indent=2)
        print(f"[+] Saved {len(threads_cookies)} Threads cookies from {best_profile_th} to cookies_threads.json")
    else:
        print("[-] Warning: No active Threads session cookie found.")

if __name__ == "__main__":
    main()
