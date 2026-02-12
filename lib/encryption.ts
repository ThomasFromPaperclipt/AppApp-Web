// Client-side encryption utility for HAC credentials
// Uses Web Crypto API for AES-256-GCM encryption

const ENCRYPTION_KEY_STRING = 'your-32-character-encryption-key-here-change-this!'; // Must match server

async function getEncryptionKey(): Promise<CryptoKey> {
    const keyMaterial = new TextEncoder().encode(ENCRYPTION_KEY_STRING.substring(0, 32));
    return await crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptCredential(text: string): Promise<string> {
    try {
        const key = await getEncryptionKey();
        const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for GCM
        const encoded = new TextEncoder().encode(text);
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoded
        );
        
        // Combine IV and encrypted data
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);
        
        // Convert to hex string
        return Array.from(combined)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt credential');
    }
}

export async function decryptCredential(encryptedHex: string): Promise<string> {
    try {
        const key = await getEncryptionKey();
        
        // Convert hex string to bytes
        const combined = new Uint8Array(
            encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
        );
        
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);
        
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encrypted
        );
        
        return new TextDecoder().decode(decrypted);
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt credential');
    }
}
