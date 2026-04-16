package com.dbee.util;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CryptoUtilTest {

    @Test
    void encryptAndDecrypt() {
        String original = "mySecretPassword123!";
        String encrypted = CryptoUtil.encrypt(original);

        assertNotNull(encrypted);
        assertTrue(encrypted.startsWith("ENC("));
        assertTrue(encrypted.endsWith(")"));
        assertNotEquals(original, encrypted);

        String decrypted = CryptoUtil.decrypt(encrypted);
        assertEquals(original, decrypted);
    }

    @Test
    void decryptPlaintextReturnsAsIs() {
        String plain = "notEncrypted";
        assertEquals(plain, CryptoUtil.decrypt(plain));
    }

    @Test
    void encryptNullReturnsNull() {
        assertNull(CryptoUtil.encrypt(null));
    }

    @Test
    void encryptEmptyReturnsEmpty() {
        assertEquals("", CryptoUtil.encrypt(""));
    }

    @Test
    void isEncryptedDetectsFormat() {
        assertTrue(CryptoUtil.isEncrypted("ENC(abc123)"));
        assertFalse(CryptoUtil.isEncrypted("plaintext"));
        assertFalse(CryptoUtil.isEncrypted(null));
    }

    @Test
    void doubleEncryptIsIdempotent() {
        String encrypted = CryptoUtil.encrypt("test");
        String doubleEncrypted = CryptoUtil.encrypt(encrypted);
        assertEquals(encrypted, doubleEncrypted); // should not re-encrypt
    }
}
