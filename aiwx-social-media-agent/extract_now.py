import os
import json
import base64
import sqlite3
import shutil
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
                return decrypted.decode('latin1')
        else:
            return decrypt_dpapi(value).decode('utf-8')
    except Exception as e:
        return f"__DECRYPT_FAILED__: {str(e)}"

def extract_profile_cookies(profile_path, profile_name, aes_key):
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
        return None
    
    dest = f"temp_{profile_name}_cookies.db"
    try:
        if os.name == 'nt':
            import subprocess
            cmd = f'powershell -Command "Copy-Item -Path \'{src}\' -Destination \'{dest}\' -Force"'
            subprocess.run(cmd, shell=True, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            shutil.copyfile(src, dest)
    except Exception as e:
        print(f"[-] Failed to copy {profile_name}: {e}")
        return None

    cookies_list = []
    try:
        conn = sqlite3.connect(dest)
        cursor = conn.cursor()
        cursor.execute("SELECT host_key, name, path, encrypted_value, expires_utc, is_secure, is_httponly FROM cookies")
        rows = cursor.fetchall()
        
        for host_key, name, path_val, encrypted_value, expires_utc, is_secure, is_httponly in rows:
            decrypted_val = decrypt_cookie(encrypted_value, aes_key)
            if decrypted_val is None or "__DECRYPT_FAILED__" in decrypted_val:
                continue
                
            cookies_list.append({
                "name": name,
                "value": decrypted_val,
                "domain": host_key,
                "path": path_val,
                "expires": expires_utc,
                "httpOnly": bool(is_httponly),
                "secure": bool(is_secure)
            })
        conn.close()
    except Exception as e:
        print(f"[-] Error reading {profile_name}: {e}")
    finally:
        if os.path.exists(dest):
            os.remove(dest)
            
    return cookies_list

def main():
    user_data_dir = "C:\\Users\\dahao\\AppData\\Local\\Google\\Chrome\\User Data"
    config_dir = os.path.join(os.path.dirname(__file__), "config")
    os.makedirs(config_dir, exist_ok=True)

    print("[+] Extracting cookies now...")

    try:
        aes_key = get_aes_key(user_data_dir)
    except Exception as e:
        print(f"[-] Failed to retrieve AES key: {e}")
        return

    # Find profiles
    profiles = []
    for item in os.listdir(user_data_dir):
        item_path = os.path.join(user_data_dir, item)
        if os.path.isdir(item_path) and (item == "Default" or item.startswith("Profile ")):
            profiles.append((item, item_path))

    facebook_cookies = []
    instagram_cookies = []
    threads_cookies = []
    linkedin_cookies = []
    
    best_profile_fb = None
    best_profile_ig = None
    best_profile_th = None
    best_profile_li = None

    # Strict business profile whitelist to prevent mixup with personal accounts
    allowed_profiles = ["Profile 2", "Profile 27", "Profile 28"]
    for profile_name, profile_path in profiles:
        if profile_name not in allowed_profiles:
            print(f"[-] Skipping profile {profile_name} (Not in business profile whitelist)")
            continue
        cookies = extract_profile_cookies(profile_path, profile_name, aes_key)
        if not cookies:
            continue
            
        fb = [c for c in cookies if "facebook.com" in c["domain"]]
        ig = [c for c in cookies if "instagram.com" in c["domain"]]
        th = [c for c in cookies if "threads.net" in c["domain"]]
        li = [c for c in cookies if "linkedin.com" in c["domain"]]
        
        has_fb = any(c["name"] == "c_user" for c in fb)
        has_ig = any(c["name"] == "sessionid" for c in ig)
        has_th = any(c["name"] == "token" or c["name"] == "sessionid" for c in th) or len(th) > 3
        has_li = any(c["name"] == "li_at" for c in li)

        print(f"Profile {profile_name}: FB={len(fb)} (session={has_fb}), IG={len(ig)} (session={has_ig}), TH={len(th)} (session={has_th}), LI={len(li)} (session={has_li})")

        if has_fb and (not facebook_cookies or len(fb) > len(facebook_cookies)):
            facebook_cookies = fb
            best_profile_fb = profile_name
        if has_ig and (not instagram_cookies or len(ig) > len(instagram_cookies)):
            instagram_cookies = ig
            best_profile_ig = profile_name
        if has_th and (not threads_cookies or len(th) > len(threads_cookies)):
            threads_cookies = th
            best_profile_th = profile_name
        if has_li and (not linkedin_cookies or len(li) > len(linkedin_cookies)):
            linkedin_cookies = li
            best_profile_li = profile_name

    # Save
    if facebook_cookies:
        with open(os.path.join(config_dir, "cookies_facebook.json"), "w", encoding="utf-8") as f:
            json.dump(facebook_cookies, f, indent=2)
        print(f"[+] Saved Facebook cookies from {best_profile_fb}")
    if instagram_cookies:
        with open(os.path.join(config_dir, "cookies_instagram.json"), "w", encoding="utf-8") as f:
            json.dump(instagram_cookies, f, indent=2)
        print(f"[+] Saved Instagram cookies from {best_profile_ig}")
    if threads_cookies:
        with open(os.path.join(config_dir, "cookies_threads.json"), "w", encoding="utf-8") as f:
            json.dump(threads_cookies, f, indent=2)
        print(f"[+] Saved Threads cookies from {best_profile_th}")
    if linkedin_cookies:
        with open(os.path.join(config_dir, "cookies_linkedin.json"), "w", encoding="utf-8") as f:
            json.dump(linkedin_cookies, f, indent=2)
        print(f"[+] Saved LinkedIn cookies from {best_profile_li}")

    print("\n[+] Done!")

if __name__ == "__main__":
    main()
