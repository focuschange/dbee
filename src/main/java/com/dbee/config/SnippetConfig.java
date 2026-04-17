package com.dbee.config;

import com.dbee.model.SnippetInfo;
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

public class SnippetConfig {
    private static final Logger log = LoggerFactory.getLogger(SnippetConfig.class);
    private static final Path CONFIG_DIR = Path.of(System.getProperty("user.home"), ".dbee");
    private static final Path CONFIG_FILE = CONFIG_DIR.resolve("snippets.json");
    private final ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

    public SnippetConfig() {
        // Create default snippets if none exist
        if (!Files.exists(CONFIG_FILE)) {
            save(defaultSnippets());
        }
    }

    public List<SnippetInfo> load() {
        if (!Files.exists(CONFIG_FILE)) return new ArrayList<>(defaultSnippets());
        try {
            return mapper.readValue(CONFIG_FILE.toFile(), new TypeReference<>() {});
        } catch (IOException e) {
            log.error("Failed to load snippets", e);
            return new ArrayList<>();
        }
    }

    public void save(List<SnippetInfo> snippets) {
        try {
            Files.createDirectories(CONFIG_DIR);
            mapper.writeValue(CONFIG_FILE.toFile(), snippets);
        } catch (IOException e) {
            log.error("Failed to save snippets", e);
        }
    }

    private List<SnippetInfo> defaultSnippets() {
        List<SnippetInfo> list = new ArrayList<>();
        list.add(snippet("sel", "SELECT ALL", "SELECT * FROM ${1:table} LIMIT 100;", "Select all from table"));
        list.add(snippet("selw", "SELECT WHERE", "SELECT * FROM ${1:table} WHERE ${2:condition};", "Select with WHERE"));
        list.add(snippet("selj", "SELECT JOIN", "SELECT a.*, b.*\nFROM ${1:table1} a\nJOIN ${2:table2} b ON a.${3:col} = b.${4:col};", "Select with JOIN"));
        list.add(snippet("ins", "INSERT INTO", "INSERT INTO ${1:table} (${2:columns})\nVALUES (${3:values});", "Insert row"));
        list.add(snippet("upd", "UPDATE", "UPDATE ${1:table}\nSET ${2:column} = ${3:value}\nWHERE ${4:condition};", "Update rows"));
        list.add(snippet("del", "DELETE", "DELETE FROM ${1:table}\nWHERE ${2:condition};", "Delete rows"));
        list.add(snippet("crt", "CREATE TABLE", "CREATE TABLE ${1:name} (\n  id INT PRIMARY KEY AUTO_INCREMENT,\n  ${2:column} VARCHAR(255),\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);", "Create table"));
        list.add(snippet("cnt", "COUNT", "SELECT COUNT(*) AS cnt FROM ${1:table};", "Count rows"));
        list.add(snippet("grp", "GROUP BY", "SELECT ${1:column}, COUNT(*) AS cnt\nFROM ${2:table}\nGROUP BY ${1:column}\nORDER BY cnt DESC;", "Group by with count"));
        return list;
    }

    private SnippetInfo snippet(String prefix, String name, String body, String desc) {
        SnippetInfo s = new SnippetInfo();
        s.setPrefix(prefix);
        s.setName(name);
        s.setBody(body);
        s.setDescription(desc);
        return s;
    }
}
