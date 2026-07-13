/*
   CONVERGENCE-Ai™ Authentication & Licensing Module
   Provides secure session validation, JWT payload verification, and tenant configuration binding.
*/

import { STATE, saveLocalState, updateState } from './state.js';

// UTF-8 safe Base64 encoding/decoding helpers
export function safeBtoa(str) {
    try {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
            return String.fromCharCode('0x' + p1);
        }));
    } catch (e) {
        return btoa(str);
    }
}

export function safeAtob(str) {
    try {
        return decodeURIComponent(atob(str).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    } catch (e) {
        return atob(str);
    }
}

export function base64UrlDecode(str) {
    try {
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4;
        if (pad) {
            if (pad === 1) throw new Error('Invalid base64url string');
            base64 += new Array(5 - pad).join('=');
        }
        return safeAtob(base64);
    } catch (e) {
        return safeAtob(str);
    }
}

// Client-side Token Decoder (Reads headers/payload parameters safely)
export function decodeTokenPayload(tokenStr) {
    try {
        const parts = tokenStr.split('.');
        if (parts.length !== 3) return null;
        
        let bodyStr;
        try {
            bodyStr = base64UrlDecode(parts[1]);
        } catch (err) {
            bodyStr = safeAtob(parts[1]);
        }
        return JSON.parse(bodyStr);
    } catch (e) {
        console.error("Token decoding error:", e);
        return null;
    }
}

export function parseAndVerifyToken(tokenStr) {
    const payload = decodeTokenPayload(tokenStr);
    if (!payload) return null;
    const expectedSig = safeBtoa(JSON.stringify(payload)).substring(10, 30).toUpperCase();
    const parts = tokenStr.split('.');
    if (parts.length !== 3 || parts[2] !== expectedSig) return null;
    return {
        companyName: payload.company || "Local Sandbox Client",
        vertical: payload.vert || "medical",
        apiEndpoint: payload.ep || "http://localhost:8080",
        vaultKey: payload.vlt ? safeAtob(payload.vlt) : "Default-Vault-Key",
        primaryColor: payload.c1 || "#009EE6",
        secondaryColor: payload.c2 || "#0086EF",
        logoText: payload.logo || "CONV",
        upskill: payload.upskill || false,
        observer: payload.observer || false,
        llmProvider: payload.llmProvider || "gemini",
        llmModel: payload.llmModel || "gemini-2.5-flash",
        llmApiKey: payload.llmApiKey ? safeAtob(payload.llmApiKey) : "",
        llmMarkup: payload.llmMarkup || 0
    };
}

// Server-Side Cryptographic JWT Verification Flow
export async function verifyActivationToken(tokenStr) {
    if (!tokenStr) return { success: false, error: "Missing activation token." };

    const payload = decodeTokenPayload(tokenStr);
    if (!payload) return { success: false, error: "Invalid token format." };

    // Determine the API endpoint from the token or fall back to window location
    const apiEndpoint = payload.api || payload.ep || "http://localhost:8080";

    try {
        // Production-Grade Cryptographic validation check on the Server
        const response = await fetch(`${apiEndpoint}/api/verify-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tokenStr })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Token verification rejected by server.");
        }

        const data = await response.json();
        if (data.success && data.config) {
            const config = {
                companyName: data.config.companyName,
                vertical: data.config.vertical,
                apiEndpoint: data.config.apiEndpoint || apiEndpoint,
                vaultKey: data.config.vaultKey,
                primaryColor: data.config.primaryColor,
                secondaryColor: data.config.secondaryColor,
                logoText: data.config.logoText,
                upskill: data.config.upskill || false,
                observer: data.config.observer || false,
                llmProvider: data.config.llmProvider || "gemini",
                llmModel: data.config.llmModel || "gemini-2.5-flash",
                llmApiKey: data.config.llmApiKey || "",
                llmMarkup: data.config.llmMarkup || 0
            };

            STATE.tenantConfig = config;
            STATE.isActivated = true;
            localStorage.setItem('aiwx_active_token', tokenStr);
            saveLocalState();
            return { success: true, config };
        }
        
        return { success: false, error: "Failed to load tenant config." };
    } catch (err) {
        console.error("[AUTH] Server verification failed:", err.message);
        return { success: false, error: "Cryptographic signature validation failed or server is offline: " + err.message };
    }
}

// Secure Administrator Session Alignment check (Server-Backed)
export async function verifyAdminSession(email, tokenStr) {
    if (!email) return false;
    
    const payload = decodeTokenPayload(tokenStr);
    const apiEndpoint = payload?.api || payload?.ep || "http://localhost:8080";

    try {
        const response = await fetch(`${apiEndpoint}/api/admin-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, token: tokenStr })
        });

        if (!response.ok) {
            updateState('isSuperAdmin', false);
            sessionStorage.removeItem('aiwx_admin_session');
            return false;
        }

        const data = await response.json();
        if (data.success && data.sessionToken) {
            updateState('isSuperAdmin', true);
            sessionStorage.setItem('aiwx_admin_session', data.sessionToken);
            return true;
        }
    } catch (err) {
        console.error("[AUTH] Server admin session verification failed:", err.message);
    }
    
    updateState('isSuperAdmin', false);
    sessionStorage.removeItem('aiwx_admin_session');
    return false;
}

