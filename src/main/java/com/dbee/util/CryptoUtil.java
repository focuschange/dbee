package com.dbee.util;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.util.Base64;

/**
 * AES-256-GCM encryption utility for password storage.
 * Format: ENC(base64(iv + ciphertext + tag))
 */
public class CryptoUtil {
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;
    private static final int KEY_LENGTH = 256;
    private static final int ITERATIONS = 65536;
    private static final String PREFIX = "ENC(";
    private static final String SUFFIX = ")";

    // Load or generate a random master key stored in ~/.dbee/.master-key
    private static final SecretKey SECRET_KEY = loadOrCreateMasterKey();

    private static SecretKey loadOrCreateMasterKey() {
        try {
            java.nio.file.Path keyFile = java.nio.file.Path.of(
                    System.getProperty("user.home"), ".dbee", ".master-key");
            java.nio.file.Files.createDirectories(keyFile.getParent());

            byte[] keyBytes;
            if (java.nio.file.Files.exists(keyFile)) {
                // Load existing key
                keyBytes = Base64.getDecoder().decode(
                        java.nio.file.Files.readString(keyFile).trim());
            } else {
                // Generate new random 256-bit key
                keyBytes = new byte[32];
                new SecureRandom().nextBytes(keyBytes);
                java.nio.file.Files.writeString(keyFile,
                        Base64.getEncoder().encodeToString(keyBytes));
                // Restrict file permissions (best-effort on supported OS)
                try {
                    keyFile.toFile().setReadable(false, false);
                    keyFile.toFile().setReadable(true, true);
                    keyFile.toFile().setWritable(false, false);
                    keyFile.toFile().setWritable(true, true);
                } catch (Exception ignored) {}
            }
            return new SecretKeySpec(keyBytes, "AES");
        } catch (Exception e) {
            throw new RuntimeException("Failed to load/create master encryption key", e);
        }
    }

    /**
     * Encrypt a plaintext string. Returns ENC(base64) format.
     */
    public static String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isEmpty()) return plaintext;
        if (isEncrypted(plaintext)) return plaintext; // already encrypted

        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.ENCRYPT_MODE, SECRET_KEY, gcmSpec);

            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            // Combine iv + ciphertext
            byte[] combined = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);

            return PREFIX + Base64.getEncoder().encodeToString(combined) + SUFFIX;
        } catch (Exception e) {
            throw new RuntimeException("Encryption failed", e);
        }
    }

    /**
     * Decrypt an ENC(base64) string back to plaintext.
     * If the input is not encrypted (no ENC prefix), returns as-is for backward compatibility.
     */
    public static String decrypt(String encrypted) {
        if (encrypted == null || encrypted.isEmpty()) return encrypted;
        if (!isEncrypted(encrypted)) return encrypted; // plaintext, backward compatible

        try {
            String base64 = encrypted.substring(PREFIX.length(), encrypted.length() - SUFFIX.length());
            byte[] combined = Base64.getDecoder().decode(base64);

            byte[] iv = new byte[GCM_IV_LENGTH];
            byte[] ciphertext = new byte[combined.length - GCM_IV_LENGTH];
            System.arraycopy(combined, 0, iv, 0, iv.length);
            System.arraycopy(combined, iv.length, ciphertext, 0, ciphertext.length);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.DECRYPT_MODE, SECRET_KEY, gcmSpec);

            byte[] plaintext = cipher.doFinal(ciphertext);
            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (Exception e) {
            // If decryption fails (e.g., key changed), return empty string
            // The password will need to be re-entered
            return "";
        }
    }

    /**
     * Check if a string is in encrypted format.
     */
    public static boolean isEncrypted(String value) {
        return value != null && value.startsWith(PREFIX) && value.endsWith(SUFFIX);
    }
}
