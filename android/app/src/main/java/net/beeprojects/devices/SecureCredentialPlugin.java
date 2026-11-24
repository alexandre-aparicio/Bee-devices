package net.beeprojects.devices;

import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "SecureCredential")
public class SecureCredentialPlugin extends Plugin {
    private static final String KEY_ALIAS = "bee_devices_credential_key_v1";
    private static final String PREFS_NAME = "bee_devices_secure_storage";
    private static final String IV_KEY = "credential_iv";
    private static final String DATA_KEY = "credential_ciphertext";
    private static final String ANDROID_KEY_STORE = "AndroidKeyStore";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";

    @PluginMethod
    public void save(PluginCall call) {
        String credential = call.getString("credential");
        if (credential == null || credential.length() < 40 || credential.length() > 256) {
            call.reject("Invalid device credential.");
            return;
        }
        try {
            SecretKey key = getOrCreateKey();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] encrypted = cipher.doFinal(credential.getBytes(StandardCharsets.UTF_8));
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE);
            boolean saved = prefs.edit()
                .putString(IV_KEY, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .putString(DATA_KEY, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .commit();
            if (!saved) {
                call.reject("Could not persist the encrypted device credential.");
                return;
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("Secure credential storage failed.", error);
        }
    }

    @PluginMethod
    public void get(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE);
        String ivValue = prefs.getString(IV_KEY, null);
        String dataValue = prefs.getString(DATA_KEY, null);
        JSObject result = new JSObject();
        if (ivValue == null || dataValue == null) {
            result.put("credential", (String) null);
            call.resolve(result);
            return;
        }
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEY_STORE);
            keyStore.load(null);
            Key key = keyStore.getKey(KEY_ALIAS, null);
            if (!(key instanceof SecretKey)) throw new IllegalStateException("Encryption key is unavailable.");
            byte[] iv = Base64.decode(ivValue, Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(dataValue, Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
            String credential = new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
            if (credential.length() < 40 || credential.length() > 256) throw new IllegalStateException("Stored credential is invalid.");
            result.put("credential", credential);
            call.resolve(result);
        } catch (Exception error) {
            clearStorageAndKey();
            result.put("credential", (String) null);
            call.resolve(result);
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        clearStorageAndKey();
        call.resolve();
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEY_STORE);
        keyStore.load(null);
        Key existing = keyStore.getKey(KEY_ALIAS, null);
        if (existing instanceof SecretKey) return (SecretKey) existing;

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE);
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .setKeySize(256)
            .build();
        generator.init(spec);
        return generator.generateKey();
    }

    private void clearStorageAndKey() {
        getContext().getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
            .edit().clear().commit();
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEY_STORE);
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) keyStore.deleteEntry(KEY_ALIAS);
        } catch (Exception ignored) {
            // The next read will treat missing or unreadable data as an unpaired device.
        }
    }
}
