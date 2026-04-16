package com.dbee.config;

import com.dbee.model.SshTunnelInfo;
import com.dbee.util.CryptoUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public class SshTunnelConfig {
    private static final Logger log = LoggerFactory.getLogger(SshTunnelConfig.class);
    private static final Path CONFIG_DIR = Path.of(System.getProperty("user.home"), ".dbee");
    private static final Path LEGACY_CONFIG_DIR = Path.of(System.getProperty("user.home"), ".dbclient");
    private static final Path CONFIG_FILE = CONFIG_DIR.resolve("ssh-tunnels.json");
    private static final String FILE_NAME = "ssh-tunnels.json";
    private final ObjectMapper mapper;

    public SshTunnelConfig() {
        this.mapper = new ObjectMapper();
        this.mapper.enable(SerializationFeature.INDENT_OUTPUT);
        migrateFromLegacy();
    }

    private void migrateFromLegacy() {
        Path legacyFile = LEGACY_CONFIG_DIR.resolve(FILE_NAME);
        if (Files.exists(legacyFile) && !Files.exists(CONFIG_FILE)) {
            try {
                Files.createDirectories(CONFIG_DIR);
                Files.copy(legacyFile, CONFIG_FILE);
                log.info("Migrated ssh-tunnels.json from ~/.dbclient/ to ~/.dbee/");
            } catch (IOException e) {
                log.warn("Failed to migrate ssh-tunnels.json from legacy directory", e);
            }
        }
    }

    public List<SshTunnelInfo> load() {
        if (!Files.exists(CONFIG_FILE)) return new ArrayList<>();
        try {
            List<SshTunnelInfo> tunnels = mapper.readValue(CONFIG_FILE.toFile(), new TypeReference<>() {});
            // Decrypt passwords on load
            for (SshTunnelInfo t : tunnels) {
                t.setPassword(CryptoUtil.decrypt(t.getPassword()));
                t.setKeyPassphrase(CryptoUtil.decrypt(t.getKeyPassphrase()));
            }
            return tunnels;
        } catch (IOException e) {
            log.error("Failed to load SSH tunnels", e);
            return new ArrayList<>();
        }
    }

    public void save(List<SshTunnelInfo> tunnels) {
        try {
            Files.createDirectories(CONFIG_DIR);
            // Encrypt passwords before saving
            List<SshTunnelInfo> toSave = new ArrayList<>();
            for (SshTunnelInfo t : tunnels) {
                SshTunnelInfo copy = new SshTunnelInfo();
                copy.setId(t.getId());
                copy.setName(t.getName());
                copy.setHost(t.getHost());
                copy.setPort(t.getPort());
                copy.setUsername(t.getUsername());
                copy.setAuthType(t.getAuthType());
                copy.setPassword(CryptoUtil.encrypt(t.getPassword()));
                copy.setKeyPath(t.getKeyPath());
                copy.setKeyPassphrase(CryptoUtil.encrypt(t.getKeyPassphrase()));
                toSave.add(copy);
            }
            mapper.writeValue(CONFIG_FILE.toFile(), toSave);
        } catch (IOException e) {
            log.error("Failed to save SSH tunnels", e);
        }
    }
}
