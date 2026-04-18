// ============================================================
// DBee - Web Application
// ============================================================

const DEFAULT_PORTS = {
    MYSQL: 3306, POSTGRESQL: 5432, ORACLE: 1521,
    SQLITE: 0, MSSQL: 1433, ATHENA: 443,
    ELASTICSEARCH: 9200
};

function isEsConnection(connId) {
    if (!connId || !state || !state.connections) return false;
    const conn = state.connections.find(c => c.id === connId);
    return conn && conn.databaseType === 'ELASTICSEARCH';
}

function buildSelectAll(connId, schema, table, limit = 100) {
    if (isEsConnection(connId)) {
        return `SELECT * FROM ${table} LIMIT ${limit};`;
    }
    return `SELECT * FROM ${schema ? schema + '.' : ''}${table} LIMIT ${limit};`;
}

// ============================================================
// API Client
// ============================================================
const api = {
    async request(method, url, body) {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(url, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || res.statusText);
        }
        if (res.status === 204) return null;
        return res.json();
    },
    connections: {
        list: () => api.request('GET', '/api/connections'),
        create: (info) => api.request('POST', '/api/connections', info),
        update: (id, info) => api.request('PUT', `/api/connections/${id}`, info),
        delete: (id) => api.request('DELETE', `/api/connections/${id}`),
        test: (info) => api.request('POST', '/api/connections/test', info),
        connect: (id) => api.request('POST', `/api/connections/${id}/connect`),
        disconnect: (id) => api.request('POST', `/api/connections/${id}/disconnect`),
    },
    query: {
        execute: (connectionId, sql, maxRows = 1000, executionId = null) =>
            api.request('POST', '/api/query/execute', { connectionId, sql, maxRows, executionId }),
        cancel: (executionId) => api.request('POST', `/api/query/cancel/${executionId}`),
        explain: (connectionId, sql, analyze = false) =>
            api.request('POST', '/api/query/explain', { connectionId, sql, analyze }),
        updateCell: (connectionId, schema, table, primaryKeys, column, value) =>
            api.request('POST', '/api/query/update-cell', { connectionId, schema, table, primaryKeys, column, value }),
        deleteRow: (connectionId, schema, table, primaryKeys) =>
            api.request('POST', '/api/query/delete-row', { connectionId, schema, table, primaryKeys }),
        insertRow: (connectionId, schema, table, values) =>
            api.request('POST', '/api/query/insert-row', { connectionId, schema, table, values }),
    },
    metadata: {
        schemas: (connId) => api.request('GET', `/api/metadata/${connId}/schemas`),
        tables: (connId, schema) => api.request('GET', `/api/metadata/${connId}/schemas/${encodeURIComponent(schema)}/tables`),
        columns: (connId, schema, table) => api.request('GET', `/api/metadata/${connId}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/columns`),
        routines: (connId, schema) => api.request('GET', `/api/metadata/${connId}/schemas/${encodeURIComponent(schema)}/routines`),
        events: (connId, schema) => api.request('GET', `/api/metadata/${connId}/schemas/${encodeURIComponent(schema)}/events`),
        autocomplete: (connId) => api.request('GET', `/api/metadata/${connId}/autocomplete`),
        primaryKeys: (connId, schema, table) => api.request('GET', `/api/metadata/${connId}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/primarykeys`),
        ddl: (connId, schema, table) => api.request('GET', `/api/metadata/${connId}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/ddl`),
        indexes: (connId, schema, table) => api.request('GET', `/api/metadata/${connId}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/indexes`),
        erDiagram: (connId, schema) => api.request('GET', `/api/metadata/${connId}/schemas/${encodeURIComponent(schema)}/er-diagram`),
        erGraph: (connId, schema) => api.request('GET', `/api/metadata/${connId}/schemas/${encodeURIComponent(schema)}/er-graph`),
        erExport: (connId, schema, format) => api.request('GET', `/api/metadata/${connId}/schemas/${encodeURIComponent(schema)}/er-export/${format}`),
        documentation: (connId, schema) => api.request('GET', `/api/metadata/${connId}/schemas/${encodeURIComponent(schema)}/documentation`),
    },
    llm: {
        getSettings: () => api.request('GET', '/api/llm/settings'),
        saveSettings: (settings) => api.request('POST', '/api/llm/settings', settings),
        testConnection: (settings) => api.request('POST', '/api/llm/test', settings),
        getProviders: () => api.request('GET', '/api/llm/providers'),
        chat: (connectionId, message) => api.request('POST', '/api/llm/chat', { connectionId, message }),
        fixSql: (connectionId, sql, errorMessage) => api.request('POST', '/api/llm/fix-sql', { connectionId, sql, errorMessage }),
        explainSql: (sql) => api.request('POST', '/api/llm/explain-sql', { connectionId: null, message: sql }),
        optimizeSql: (connectionId, sql) => api.request('POST', '/api/llm/optimize-sql', { connectionId, message: sql }),
        analyzeResult: (message) => api.request('POST', '/api/llm/analyze-result', { connectionId: null, message }),
        indexHint: (connectionId, sql) => api.request('POST', '/api/llm/index-hint', { connectionId, message: sql }),
        ollamaModels: (baseUrl) => api.request('GET', `/api/llm/ollama-models?baseUrl=${encodeURIComponent(baseUrl)}`),
        schemaReview: (connectionId, msg) => api.request('POST', '/api/llm/schema-review', { connectionId, message: msg }),
        alterSql: (connectionId, msg) => api.request('POST', '/api/llm/alter-sql', { connectionId, message: msg }),
    },
    erdLayout: {
        get: async (connId, schema) => {
            const res = await fetch(`/api/erd/layout/${connId}/${encodeURIComponent(schema)}`);
            if (res.status === 204) return null;
            if (!res.ok) throw new Error('Failed to load layout');
            return res.json();
        },
        save: (connId, schema, layout) => api.request('PUT', `/api/erd/layout/${connId}/${encodeURIComponent(schema)}`, layout),
        delete: (connId, schema) => api.request('DELETE', `/api/erd/layout/${connId}/${encodeURIComponent(schema)}`),
    },
    snippets: {
        list: () => api.request('GET', '/api/snippets'),
        create: (s) => api.request('POST', '/api/snippets', s),
        delete: (id) => api.request('DELETE', `/api/snippets/${id}`),
    },
    savedQueries: {
        list: () => api.request('GET', '/api/saved-queries'),
        create: (query) => api.request('POST', '/api/saved-queries', query),
        update: (id, query) => api.request('PUT', `/api/saved-queries/${id}`, query),
        delete: (id) => api.request('DELETE', `/api/saved-queries/${id}`),
    },
    tunnels: {
        list: () => api.request('GET', '/api/tunnels'),
        create: (info) => api.request('POST', '/api/tunnels', info),
        update: (id, info) => api.request('PUT', `/api/tunnels/${id}`, info),
        delete: (id) => api.request('DELETE', `/api/tunnels/${id}`),
        test: (info) => api.request('POST', '/api/tunnels/test', info),
    },
    notes: {
        list: () => api.request('GET', '/api/notes'),
        get: (id) => api.request('GET', `/api/notes/${id}`),
        create: (info) => api.request('POST', '/api/notes', info),
        update: (id, info) => api.request('PUT', `/api/notes/${id}`, info),
        delete: (id) => api.request('DELETE', `/api/notes/${id}`),
    },
    history: {
        list: (search, limit = 100) => {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            params.set('limit', String(limit));
            return api.request('GET', `/api/history?${params}`);
        },
        delete: (id) => api.request('DELETE', `/api/history/${id}`),
        clear: () => api.request('DELETE', '/api/history'),
        stats: () => api.request('GET', '/api/history/stats'),
    },
    export: {
        download: async (format, connectionId, sql, extra = '') => {
            const url = `/api/export/${format}${extra}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connectionId, sql, maxRows: 50000 })
            });
            if (!res.ok) {
                let detail = res.statusText;
                try {
                    const body = await res.text();
                    if (body) detail = body.slice(0, 200);
                } catch (e) {}
                throw new Error(`HTTP ${res.status}: ${detail}`);
            }
            const blob = await res.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            const ext = format === 'insert' ? 'sql' : format;
            link.download = `export.${ext}`;
            link.click();
            URL.revokeObjectURL(link.href);
        },
        csv: (connId, sql) => api.export.download('csv', connId, sql),
        json: (connId, sql) => api.export.download('json', connId, sql),
        insert: (connId, sql, tableName) => api.export.download('insert', connId, sql, `?tableName=${encodeURIComponent(tableName || 'my_table')}`),
        xlsx: (connId, sql) => api.export.download('xlsx', connId, sql),
        xml: (connId, sql) => api.export.download('xml', connId, sql),
    }
};

// ============================================================
// State
// ============================================================
const state = {
    connections: [],
    tunnels: [],
    activeConnectionId: null,
    editors: [],     // { id, name, model }
    activeEditorId: null,
    lastResult: null,
    editingConnectionId: null,
    editingTunnelId: null,
    notes: [],
    activeNoteId: null,
    autocompleteCache: null, // { connectionId, schemas: [{ name, tables: [{ name, type, columns: [{ name, typeName }] }] }] }
    resultData: null, // { columnNames, columnTypes, rows (original), executionTimeMs }
    sortState: { columnIndex: -1, direction: null }, // direction: 'asc' | 'desc' | null
    filterKeyword: '', // result filter keyword
};

let monacoEditor = null;
let toastuiEditor = null;
let editorCounter = 0;

// ============================================================
// Active tab / connection helpers (#123 Phase A)
// Each editor tab owns its own connection (tab.connId). These helpers
// provide a single read/write surface so callers no longer touch the
// legacy `state.activeConnectionId` global.
// ============================================================
function getActiveTab() {
    return state.editors.find(e => e.id === state.activeEditorId) || null;
}

function getActiveConnectionId() {
    const t = getActiveTab();
    return t && t.connId ? t.connId : null;
}

function setActiveTabConnection(connId, connName) {
    const t = getActiveTab();
    if (!t) return;
    t.connId = connId || null;
    t.connName = connName || null;
    // Keep the legacy global in sync so code paths that still read it
    // (e.g. Phase A intermediate state) behave identically.
    state.activeConnectionId = t.connId;
    try { saveEditorSession(); } catch (e) {}
    try { renderTabs(); } catch (e) {}
    try { refreshConnectionIndicators(t); } catch (e) {}
    try { refreshTreeConnectionBadges(); } catch (e) {}
}

// Clear any tab (SQL or ERD) still referencing a connection that went away.
function detachConnectionFromTabs(connId) {
    if (!connId) return;
    for (const t of state.editors) {
        if (t.connId === connId) {
            t.connId = null;
            t.connName = null;
        }
    }
    if (state.activeConnectionId === connId) state.activeConnectionId = null;
    try { saveEditorSession(); } catch (e) {}
    try { refreshTreeConnectionBadges(); } catch (e) {}
}

// Refresh the tab-usage badge + active highlight on every connection tree node.
// Called after any change to tab.connId, tab lifecycle, or active tab switch.
// (#125 Phase C) — does a partial DOM update, not a full tree re-render.
function refreshTreeConnectionBadges() {
    const activeConnId = getActiveConnectionId();
    const counts = new Map();
    for (const t of (state.editors || [])) {
        if (t.connId) counts.set(t.connId, (counts.get(t.connId) || 0) + 1);
    }
    document.querySelectorAll('.tree-node[data-type="connection"]').forEach(node => {
        const cid = node.dataset.connId;
        const count = counts.get(cid) || 0;
        const badge = node.querySelector('.conn-tab-usage-badge');
        if (badge) {
            if (count >= 2) {
                badge.textContent = `×${count}`;
                badge.style.display = '';
                badge.title = `${count} tab(s) use this connection`;
            } else {
                badge.textContent = '';
                badge.style.display = 'none';
            }
        }
        node.classList.toggle('tree-conn-active', !!activeConnId && cid === activeConnId);
    });
}

// ============================================================
// Monaco Editor
// ============================================================
function initMonaco() {
    require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });
    require(['vs/editor/editor.main'], function () {
        monacoEditor = monaco.editor.create(document.getElementById('editor-container'), {
            language: 'sql',
            theme: MONACO_THEMES[localStorage.getItem('dbee-theme') || 'normal'] || 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 8 },
        });

        // Ctrl+Enter: run current statement (cursor) or selection
        monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            executeQuery(false);
        });

        // Ctrl+Shift+Enter: run entire editor
        monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
            executeQuery(true);
        });

        // Ctrl+E to EXPLAIN
        monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyE, () => {
            executeExplain(false);
        });

        // Ctrl+Shift+E to EXPLAIN ANALYZE
        monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE, () => {
            executeExplain(true);
        });

        // Ctrl+Shift+A to toggle AI Chat
        monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyA, () => {
            toggleAiChatPanel();
        });

        // Ctrl+Shift+R to toggle Right Panel
        monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyR, () => {
            if (typeof RightPanel !== 'undefined') RightPanel.toggle();
        });

        // Ctrl+Shift+K — open the active tab's connection dropdown (#124)
        monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyK, () => {
            openActiveTabConnectionMenu();
        });

        // Add AI context menu actions
        monacoEditor.addAction({ id: 'ai-explain', label: 'AI: Explain SQL', contextMenuGroupId: 'ai', run: aiExplainSql });
        monacoEditor.addAction({ id: 'ai-optimize', label: 'AI: Optimize SQL', contextMenuGroupId: 'ai', run: aiOptimizeSql });
        monacoEditor.addAction({ id: 'ai-analyze', label: 'AI: Analyze Results', contextMenuGroupId: 'ai', run: aiAnalyzeResult });
        monacoEditor.addAction({ id: 'ai-index-hint', label: 'AI: Suggest Indexes', contextMenuGroupId: 'ai', run: aiIndexHint });

        // Register SQL autocomplete provider
        registerSqlCompletionProvider();

        // Restore session or create first tab
        if (!restoreEditorSession()) {
            addEditorTab();
        }

        // Restore editor settings
        restoreEditorSettings();

        // Auto-save session periodically
        setInterval(saveEditorSession, 5000);
    });
}

// ============================================================
// SQL Autocomplete
// ============================================================
const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE',
    'IS', 'NULL', 'AS', 'ON', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL', 'CROSS',
    'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'ALTER', 'DROP',
    'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA', 'IF', 'NOT EXISTS',
    'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'DISTINCT',
    'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST', 'WITH', 'RECURSIVE',
    'GRANT', 'REVOKE', 'COMMIT', 'ROLLBACK', 'BEGIN', 'TRANSACTION',
    'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK', 'DEFAULT',
    'CASCADE', 'RESTRICT', 'TRUNCATE', 'EXPLAIN', 'ANALYZE',
    'VARCHAR', 'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'DECIMAL', 'NUMERIC',
    'FLOAT', 'DOUBLE', 'BOOLEAN', 'DATE', 'TIME', 'TIMESTAMP', 'TEXT', 'BLOB', 'JSON',
    'TRUE', 'FALSE', 'COALESCE', 'IFNULL', 'CAST', 'CONVERT', 'CONCAT',
    'SUBSTRING', 'TRIM', 'UPPER', 'LOWER', 'LENGTH', 'REPLACE', 'NOW', 'CURRENT_TIMESTAMP',
];

const SCHEMA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function loadAutoCompleteCache(connectionId) {
    // Return cached if still valid
    if (state.autocompleteCache && state.autocompleteCache.connectionId === connectionId
        && state.autocompleteCache._ts && Date.now() - state.autocompleteCache._ts < SCHEMA_CACHE_TTL) {
        return;
    }
    try {
        const data = await api.metadata.autocomplete(connectionId);
        state.autocompleteCache = { connectionId, ...data, _ts: Date.now() };
    } catch (e) {
        console.warn('Failed to load autocomplete metadata:', e);
        state.autocompleteCache = null;
    }
}

function clearAutoCompleteCache() {
    state.autocompleteCache = null;
}

function registerSqlCompletionProvider() {
    monaco.languages.registerCompletionItemProvider('sql', {
        triggerCharacters: ['.', ' '],
        provideCompletionItems: function (model, position) {
            const textUntilPosition = model.getValueInRange({
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
            });

            const lineContent = model.getLineContent(position.lineNumber);
            const textBeforeCursor = lineContent.substring(0, position.column - 1);

            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endLineNumber: position.lineNumber,
                endColumn: word.endColumn,
            };

            // Dot completion: schema.table or table.column
            const dotMatch = textBeforeCursor.match(/(\w+)\.\s*$/);
            if (dotMatch) {
                const prefix = dotMatch[1].toLowerCase();
                const dotRange = {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                };
                return { suggestions: getDotCompletions(prefix, dotRange, textUntilPosition) };
            }

            const suggestions = [];

            // SQL keywords
            SQL_KEYWORDS.forEach(kw => {
                suggestions.push({
                    label: kw,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: kw,
                    range: range,
                    sortText: '3_' + kw,
                });
            });

            // Schema-aware suggestions
            if (state.autocompleteCache) {
                const context = parseSqlContext(textUntilPosition);
                const cache = state.autocompleteCache;

                // Schema names
                cache.schemas.forEach(schema => {
                    suggestions.push({
                        label: schema.name,
                        kind: monaco.languages.CompletionItemKind.Module,
                        insertText: schema.name,
                        detail: 'Schema',
                        range: range,
                        sortText: '2_' + schema.name,
                    });
                });

                // Table/view names from all schemas
                cache.schemas.forEach(schema => {
                    schema.tables.forEach(table => {
                        const isView = table.type === 'VIEW';
                        suggestions.push({
                            label: table.name,
                            kind: isView ? monaco.languages.CompletionItemKind.Interface : monaco.languages.CompletionItemKind.Struct,
                            insertText: table.name,
                            detail: `${isView ? 'View' : 'Table'} (${schema.name})`,
                            range: range,
                            sortText: context.expectsTable ? '0_' + table.name : '1_' + table.name,
                        });
                    });
                });

                // Column names — prioritize if context expects columns, or always include for convenience
                const contextTables = getTablesFromContext(textUntilPosition, cache);
                if (contextTables.length > 0) {
                    contextTables.forEach(({ table, alias, schema }) => {
                        table.columns.forEach(col => {
                            suggestions.push({
                                label: col.name,
                                kind: monaco.languages.CompletionItemKind.Field,
                                insertText: col.name,
                                detail: `${col.typeName} — ${alias || table.name}`,
                                range: range,
                                sortText: context.expectsColumn ? '0_' + col.name : '1_' + col.name,
                            });
                        });
                    });
                }
            }

            // Snippet suggestions
            if (state.snippetsCache) {
                state.snippetsCache.forEach(s => {
                    suggestions.push({
                        label: s.prefix,
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: s.body.replace(/\$\{\d+:([^}]+)\}/g, '$1'),
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        detail: s.name,
                        documentation: s.description,
                        range: range,
                        sortText: '0_' + s.prefix,
                    });
                });
            }

            return { suggestions: deduplicateSuggestions(suggestions) };
        }
    });
}

async function loadSnippetsCache() {
    try {
        state.snippetsCache = await api.snippets.list();
    } catch (e) {
        state.snippetsCache = [];
    }
}

function getDotCompletions(prefix, range, fullText) {
    if (!state.autocompleteCache) return [];
    const cache = state.autocompleteCache;
    const suggestions = [];

    // Check if prefix is a schema name → suggest tables
    const matchedSchema = cache.schemas.find(s => s.name.toLowerCase() === prefix);
    if (matchedSchema) {
        matchedSchema.tables.forEach(table => {
            const isView = table.type === 'VIEW';
            suggestions.push({
                label: table.name,
                kind: isView ? monaco.languages.CompletionItemKind.Interface : monaco.languages.CompletionItemKind.Struct,
                insertText: table.name,
                detail: isView ? 'View' : 'Table',
                range: range,
                sortText: '0_' + table.name,
            });
        });
        return suggestions;
    }

    // Check if prefix is a table name or alias → suggest columns
    const resolved = resolveTableOrAlias(prefix, fullText, cache);
    if (resolved) {
        resolved.columns.forEach(col => {
            suggestions.push({
                label: col.name,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: col.name,
                detail: col.typeName,
                range: range,
                sortText: '0_' + col.name,
            });
        });
    }

    return suggestions;
}

function resolveTableOrAlias(name, fullText, cache) {
    const lowerName = name.toLowerCase();

    // Check direct table name match
    for (const schema of cache.schemas) {
        for (const table of schema.tables) {
            if (table.name.toLowerCase() === lowerName) return table;
        }
    }

    // Check alias mapping from SQL text
    const aliases = extractAliases(fullText);
    const aliasEntry = aliases.find(a => a.alias.toLowerCase() === lowerName);
    if (aliasEntry) {
        const tableName = aliasEntry.table.toLowerCase();
        for (const schema of cache.schemas) {
            for (const table of schema.tables) {
                if (table.name.toLowerCase() === tableName) return table;
            }
        }
    }

    return null;
}

function extractAliases(sql) {
    const aliases = [];
    // Patterns: FROM table alias, FROM table AS alias, JOIN table alias, JOIN table AS alias
    const pattern = /(?:FROM|JOIN)\s+(?:(\w+)\.)?(\w+)(?:\s+AS\s+(\w+)|\s+(?!WHERE|ON|SET|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|JOIN|GROUP|ORDER|HAVING|LIMIT|UNION|INTO|VALUES)(\w+))?/gi;
    let match;
    while ((match = pattern.exec(sql)) !== null) {
        const table = match[2];
        const alias = match[3] || match[4] || null;
        aliases.push({ table, alias: alias || table, schema: match[1] || null });
    }
    return aliases;
}

function getTablesFromContext(sql, cache) {
    const aliases = extractAliases(sql);
    const result = [];
    for (const entry of aliases) {
        const tableName = entry.table.toLowerCase();
        for (const schema of cache.schemas) {
            const table = schema.tables.find(t => t.name.toLowerCase() === tableName);
            if (table) {
                result.push({ table, alias: entry.alias, schema: schema.name });
                break;
            }
        }
    }
    return result;
}

function parseSqlContext(textUntilPosition) {
    const upper = textUntilPosition.toUpperCase().trimEnd();
    // Check what keyword precedes the cursor position
    const expectsTable = /(?:FROM|JOIN|UPDATE|INTO|TABLE)\s+\w*$/i.test(upper);
    const expectsColumn = /(?:SELECT|WHERE|AND|OR|ON|SET|BY|HAVING)\s+\w*$/i.test(upper) ||
                          /,\s*\w*$/i.test(upper);
    return { expectsTable, expectsColumn };
}

function deduplicateSuggestions(suggestions) {
    const seen = new Map();
    return suggestions.filter(s => {
        const key = s.label + '_' + s.kind;
        if (seen.has(key)) return false;
        seen.set(key, true);
        return true;
    });
}

// ============================================================
// Editor Tabs
// ============================================================
function addEditorTab() {
    editorCounter++;
    const id = 'tab-' + editorCounter;
    const model = monaco.editor.createModel('', 'sql');
    // New SQL tabs inherit the connection from the currently active tab
    // so the user can keep querying the same DB without re-selecting.
    const prev = getActiveTab();
    const inheritedConnId = prev && prev.connId ? prev.connId : (state.activeConnectionId || null);
    const inheritedConnName = prev && prev.connName ? prev.connName : null;
    const tab = { id, type: 'sql', name: 'Query ' + editorCounter, model, savedContent: '',
                  connId: inheritedConnId, connName: inheritedConnName };
    // Track dirty state
    model.onDidChangeContent(() => {
        tab.dirty = model.getValue() !== tab.savedContent;
        renderTabs();
    });
    state.editors.push(tab);
    renderTabs();
    switchTab(id);
    try { refreshTreeConnectionBadges(); } catch (e) {}
}

/**
 * Open (or focus) an ERD tab for a given connection + schema.
 * Returns the tab id.
 */
function addOrFocusErdTab(connId, connName, schema) {
    // If an ERD tab for this conn+schema exists, just switch to it
    const existing = state.editors.find(t => t.type === 'erd' && t.connId === connId && t.schema === schema);
    if (existing) { switchTab(existing.id); return existing.id; }

    editorCounter++;
    const id = 'tab-' + editorCounter;
    const tab = {
        id, type: 'erd',
        name: `ERD: ${connName || 'conn'}.${schema}`,
        connId, connName, schema,
        cy: null,       // Cytoscape instance (lazy init)
        options: {},    // view options
    };
    state.editors.push(tab);
    renderTabs();
    switchTab(id);
    return id;
}

function saveEditorSession() {
    try {
        const session = state.editors.map(t => {
            if (t.type === 'erd') {
                return { id: t.id, type: 'erd', name: t.name,
                         connId: t.connId, connName: t.connName, schema: t.schema };
            }
            return { id: t.id, type: 'sql', name: t.name,
                     content: t.model ? t.model.getValue() : '',
                     connId: t.connId || null, connName: t.connName || null };
        });
        localStorage.setItem('dbee-editor-session', JSON.stringify({
            tabs: session, activeId: state.activeEditorId, counter: editorCounter
        }));
    } catch (e) {}
}

function restoreEditorSession() {
    try {
        const data = JSON.parse(localStorage.getItem('dbee-editor-session'));
        if (!data || !data.tabs || data.tabs.length === 0) return false;
        editorCounter = data.counter || data.tabs.length;
        data.tabs.forEach(t => {
            const type = t.type || 'sql';
            if (type === 'erd') {
                const tab = { id: t.id, type: 'erd', name: t.name,
                              connId: t.connId, connName: t.connName, schema: t.schema,
                              cy: null, options: {} };
                state.editors.push(tab);
            } else {
                const model = monaco.editor.createModel(t.content || '', 'sql');
                const tab = { id: t.id, type: 'sql', name: t.name, model, savedContent: t.content || '',
                              connId: t.connId || null, connName: t.connName || null };
                model.onDidChangeContent(() => {
                    tab.dirty = model.getValue() !== tab.savedContent;
                    renderTabs();
                });
                state.editors.push(tab);
            }
        });
        renderTabs();
        switchTab(data.activeId || data.tabs[0].id);
        return true;
    } catch (e) { return false; }
}

function switchTab(id) {
    const prevTabId = state.activeEditorId;
    const prevTab = state.editors.find(e => e.id === prevTabId);
    state.activeEditorId = id;
    const tab = state.editors.find(e => e.id === id);
    if (!tab) { renderTabs(); return; }

    // Phase A: mirror the new tab's connection into the legacy global so
    // visual cues (tree highlight, status bar) remain consistent until
    // Phase B's UI changes land.
    state.activeConnectionId = tab.connId || null;

    const editorContainer = document.getElementById('editor-container');
    const erdView = document.getElementById('erd-view');

    // If leaving an ERD tab, destroy the React Flow root (container is shared)
    if (prevTab && prevTab.type === 'erd' && prevTab !== tab && window.erdReact) {
        try { window.erdReact.destroy(); } catch (e) {}
    }

    if (tab.type === 'erd') {
        if (editorContainer) editorContainer.style.display = 'none';
        if (erdView) erdView.style.display = 'flex';
        // Always (re)mount on switch — React Flow lives in the shared container
        initErdTab(tab);
    } else {
        if (editorContainer) editorContainer.style.display = '';
        if (erdView) erdView.style.display = 'none';
        if (monacoEditor && tab.model) monacoEditor.setModel(tab.model);
    }
    renderTabs();
    refreshConnectionIndicators(tab);
    try { refreshTreeConnectionBadges(); } catch (e) {}
}

// Sync the status bar + toolbar connection badge with the tab's own connection.
// Called on tab switch so the UI reflects per-tab state instead of the legacy global.
function refreshConnectionIndicators(tab) {
    const conn = tab && tab.connId
        ? state.connections.find(c => c.id === tab.connId)
        : null;
    const name = conn ? conn.name : (tab && tab.connName) || '';
    if (name) {
        updateStatus(`Connected: ${name}`);
    } else {
        const connEl = document.getElementById('status-connection');
        const dot = document.getElementById('status-dot');
        const badge = document.getElementById('toolbar-conn-badge');
        const badgeDot = badge ? badge.querySelector('.badge-dot') : null;
        const badgeText = badge ? badge.querySelector('.badge-text') : null;
        if (connEl) connEl.textContent = 'Not connected';
        if (dot) dot.className = 'status-indicator';
        if (badgeDot) badgeDot.classList.remove('connected');
        if (badgeText) badgeText.textContent = 'No connection';
    }
}

function closeTab(id) {
    const idx = state.editors.findIndex(e => e.id === id);
    if (idx === -1 || state.editors.length <= 1) return;

    const tab = state.editors[idx];
    // For ERD tabs: if currently mounted, destroy React Flow root
    if (tab.type === 'erd') {
        if (tab.id === state.activeEditorId && window.erdReact) {
            try { window.erdReact.destroy(); } catch (e) {}
        }
    } else if (tab.model && tab.model.dispose) {
        tab.model.dispose();
    }
    state.editors.splice(idx, 1);

    if (state.activeEditorId === id) {
        const newIdx = Math.min(idx, state.editors.length - 1);
        switchTab(state.editors[newIdx].id);
    }
    renderTabs();
    try { refreshTreeConnectionBadges(); } catch (e) {}
}

function renderTabs() {
    const tabList = document.getElementById('tab-list');
    tabList.innerHTML = '';
    state.editors.forEach(tab => {
        const div = document.createElement('div');
        const typeClass = tab.type === 'erd' ? ' tab-erd' : '';
        div.className = 'tab' + (tab.id === state.activeEditorId ? ' active' : '') + (tab.dirty ? ' dirty' : '') + typeClass;
        const dirtyDot = tab.dirty ? '<span class="tab-dirty-dot">●</span>' : '';

        // Connection chip — shows which DB this tab talks to (#124 Phase B)
        const chipHtml = renderTabConnectionChip(tab);

        div.innerHTML = `
            ${chipHtml}
            <span class="tab-label">${escapeHtml(tab.name)}${dirtyDot}</span>
            ${state.editors.length > 1 ? '<span class="tab-close">&times;</span>' : ''}
        `;
        div.querySelector('.tab-label').onclick = () => {
            // Only switch if needed — skipping renderTabs() preserves DOM identity
            // so the browser's dblclick-for-rename can fire.
            if (tab.id !== state.activeEditorId) switchTab(tab.id);
        };
        // Double-click to rename tab
        div.querySelector('.tab-label').ondblclick = (e) => {
            e.stopPropagation();
            const label = e.currentTarget;
            const input = document.createElement('input');
            input.className = 'tab-rename-input';
            input.value = tab.name;
            label.replaceWith(input);
            input.focus();
            input.select();
            const finish = () => {
                tab.name = input.value.trim() || tab.name;
                renderTabs();
            };
            input.onblur = finish;
            input.onkeydown = (ke) => { if (ke.key === 'Enter') input.blur(); if (ke.key === 'Escape') { input.value = tab.name; input.blur(); } };
        };
        const chipEl = div.querySelector('.tab-conn-chip');
        if (chipEl) {
            chipEl.onclick = (e) => {
                e.stopPropagation();
                const wasActive = tab.id === state.activeEditorId;
                if (!wasActive) switchTab(tab.id); // renderTabs() runs → old chipEl becomes detached
                // Re-query the chip anchor from the freshly rendered tab list
                openActiveTabConnectionMenu();
            };
            attachTabChipTooltip(chipEl);
        }
        const closeBtn = div.querySelector('.tab-close');
        if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); closeTab(tab.id); };

        // Drag-to-reorder
        div.draggable = true;
        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', tab.id);
            e.dataTransfer.effectAllowed = 'move';
            div.classList.add('dragging');
        });
        div.addEventListener('dragend', () => {
            div.classList.remove('dragging');
            document.querySelectorAll('.tab.drop-before, .tab.drop-after')
                .forEach(el => el.classList.remove('drop-before', 'drop-after'));
        });
        div.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const rect = div.getBoundingClientRect();
            const before = e.clientX < rect.left + rect.width / 2;
            div.classList.toggle('drop-before', before);
            div.classList.toggle('drop-after', !before);
        });
        div.addEventListener('dragleave', () => {
            div.classList.remove('drop-before', 'drop-after');
        });
        div.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData('text/plain');
            div.classList.remove('drop-before', 'drop-after');
            if (!draggedId || draggedId === tab.id) return;
            const rect = div.getBoundingClientRect();
            const before = e.clientX < rect.left + rect.width / 2;
            reorderEditorTab(draggedId, tab.id, before);
        });

        tabList.appendChild(div);
    });
}

function reorderEditorTab(dragId, targetId, placeBefore) {
    const arr = state.editors;
    const dragIdx = arr.findIndex(t => t.id === dragId);
    if (dragIdx < 0) return;
    const [item] = arr.splice(dragIdx, 1);
    const targetIdx = arr.findIndex(t => t.id === targetId);
    if (targetIdx < 0) { arr.splice(dragIdx, 0, item); return; } // safety
    const insertAt = placeBefore ? targetIdx : targetIdx + 1;
    arr.splice(insertAt, 0, item);
    renderTabs();
    try { saveEditorSession(); } catch (e) {}
}

function renderTabConnectionChip(tab) {
    const conn = tab.connId ? state.connections.find(c => c.id === tab.connId) : null;
    const name = conn ? conn.name : (tab.connName || null);
    const color = conn?.properties?.color || '';
    const readonly = tab.type === 'erd';
    const connected = conn && state.autocompleteCache?.connectionId === conn.id;
    const cls = 'tab-conn-chip' + (name ? ' has-conn' : ' no-conn') + (readonly ? ' readonly' : '');
    const style = color ? ` style="--chip-color:${escapeHtml(color)}"` : '';

    // Tooltip: detailed info shown on hover (user explicitly wants the chip itself icon-only).
    const lines = [];
    lines.push(`Connection: ${name || '(none)'}`);
    if (conn) {
        if (conn.dbType) lines.push(`Type: ${conn.dbType}`);
        lines.push(`Status: ${connected ? 'connected' : 'not connected'}`);
    }
    lines.push(readonly
        ? '(locked for ERD tabs)'
        : 'Click to change · Cmd/Ctrl+Shift+K');
    const title = lines.join('\n');

    return `<span class="${cls}"${style} data-tooltip="${escapeHtml(title)}"><span class="chip-dot"></span></span>`;
}

// Custom tooltip for the tab connection chip — the browser's built-in
// `title` tooltip has no position control and gets clipped near the top edge.
function attachTabChipTooltip(chipEl) {
    const show = () => {
        hideTabChipTooltip();
        const text = chipEl.getAttribute('data-tooltip');
        if (!text) return;
        const tip = document.createElement('div');
        tip.className = 'tab-chip-tooltip';
        tip.id = 'tab-chip-tooltip';
        tip.textContent = text;
        document.body.appendChild(tip);

        const rect = chipEl.getBoundingClientRect();
        const tipRect = tip.getBoundingClientRect();
        const gap = 6;
        // Default below the chip; flip above if it would overflow the viewport.
        let top = rect.bottom + gap;
        if (top + tipRect.height > window.innerHeight - 4) top = rect.top - tipRect.height - gap;
        let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
        if (left < 4) left = 4;
        if (left + tipRect.width > window.innerWidth - 4) left = window.innerWidth - tipRect.width - 4;
        tip.style.top = `${Math.max(4, top)}px`;
        tip.style.left = `${left}px`;
    };
    chipEl.addEventListener('mouseenter', show);
    chipEl.addEventListener('mouseleave', hideTabChipTooltip);
    chipEl.addEventListener('mousedown', hideTabChipTooltip);
}

function hideTabChipTooltip() {
    const t = document.getElementById('tab-chip-tooltip');
    if (t) t.remove();
}

// ============================================================
// Tab connection dropdown (#124 Phase B)
// ============================================================
function showTabConnectionMenu(tabId, anchorEl) {
    const tab = state.editors.find(t => t.id === tabId);
    if (!tab) return;
    if (tab.type === 'erd') return; // ERD tabs are readonly

    hideTabConnectionMenu();

    const menu = document.createElement('div');
    menu.className = 'tab-conn-menu';
    menu.id = 'tab-conn-menu';

    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'tab-conn-menu-search';
    search.placeholder = 'Search connection…';
    menu.appendChild(search);

    const list = document.createElement('div');
    list.className = 'tab-conn-menu-list';
    menu.appendChild(list);

    const setActive = (idx) => {
        const items = list.querySelectorAll('.tab-conn-menu-item');
        items.forEach((el, i) => el.classList.toggle('active', i === idx));
        if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
    };

    const currentActiveIdx = () => {
        const items = list.querySelectorAll('.tab-conn-menu-item');
        for (let i = 0; i < items.length; i++) if (items[i].classList.contains('active')) return i;
        return -1;
    };

    const renderList = (filter) => {
        list.innerHTML = '';
        const q = (filter || '').trim().toLowerCase();

        // (None) option — clears the tab's connection
        const none = document.createElement('div');
        none.className = 'tab-conn-menu-item' + (!tab.connId ? ' selected' : '');
        none.innerHTML = `<span class="chip-dot none"></span><span class="menu-item-text">(None)</span>`;
        none.onclick = () => { pickConnectionForActiveTab(null); hideTabConnectionMenu(); };
        list.appendChild(none);

        const items = (state.connections || []).filter(c => !q || c.name.toLowerCase().includes(q));
        items.forEach(conn => {
            const isSelected = tab.connId === conn.id;
            const connected = state.autocompleteCache?.connectionId === conn.id;
            const color = conn.properties?.color || '';
            const item = document.createElement('div');
            item.className = 'tab-conn-menu-item' + (isSelected ? ' selected' : '');
            const dotStyle = color ? ` style="background:${escapeHtml(color)}"` : '';
            const statusCls = connected ? ' connected' : '';
            item.innerHTML = `
                <span class="chip-dot${statusCls}"${dotStyle}></span>
                <span class="menu-item-text">${escapeHtml(conn.name)}</span>
                ${connected ? '<span class="menu-item-badge">●</span>' : ''}
            `;
            item.onclick = () => { pickConnectionForActiveTab(conn.id); hideTabConnectionMenu(); };
            list.appendChild(item);
        });

        if (items.length === 0 && q) {
            const empty = document.createElement('div');
            empty.className = 'tab-conn-menu-empty';
            empty.textContent = 'No matching connection';
            list.appendChild(empty);
        }

        // Auto-highlight first item so Enter always has a target.
        // Prefer a connection row (skip "(None)" when the user is searching).
        const rendered = list.querySelectorAll('.tab-conn-menu-item');
        if (rendered.length) {
            const firstIdx = (q && rendered.length > 1) ? 1 : 0;
            setActive(firstIdx);
        }
    };
    renderList('');

    // Hover should follow keyboard highlight so the two don't desync.
    list.addEventListener('mousemove', (e) => {
        const item = e.target.closest('.tab-conn-menu-item');
        if (!item) return;
        const items = Array.from(list.querySelectorAll('.tab-conn-menu-item'));
        setActive(items.indexOf(item));
    });

    search.addEventListener('input', () => renderList(search.value));
    search.addEventListener('keydown', (e) => {
        const items = list.querySelectorAll('.tab-conn-menu-item');
        if (e.key === 'Escape') { e.preventDefault(); hideTabConnectionMenu(); return; }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!items.length) return;
            const next = Math.min(currentActiveIdx() + 1, items.length - 1);
            setActive(Math.max(0, next));
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!items.length) return;
            const next = Math.max(currentActiveIdx() - 1, 0);
            setActive(next);
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            const idx = currentActiveIdx();
            const target = idx >= 0 ? items[idx] : items[0];
            if (target) target.click();
            return;
        }
    });

    document.body.appendChild(menu);

    // Position under the anchor (chip element). Fall back to tab list area.
    const anchor = anchorEl || document.querySelector(`[data-tab-anchor="${tabId}"]`) || document.getElementById('tab-list');
    const rect = anchor.getBoundingClientRect();
    const top = rect.bottom + 4;
    let left = rect.left;
    const menuWidth = 260;
    if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 8;
    menu.style.top = `${top}px`;
    menu.style.left = `${Math.max(8, left)}px`;

    setTimeout(() => search.focus(), 0);

    const onDocClick = (e) => { if (!menu.contains(e.target)) hideTabConnectionMenu(); };
    const onEsc = (e) => { if (e.key === 'Escape') hideTabConnectionMenu(); };
    menu._cleanup = () => {
        document.removeEventListener('mousedown', onDocClick, true);
        document.removeEventListener('keydown', onEsc, true);
    };
    document.addEventListener('mousedown', onDocClick, true);
    document.addEventListener('keydown', onEsc, true);
}

function hideTabConnectionMenu() {
    const existing = document.getElementById('tab-conn-menu');
    if (!existing) return;
    try { existing._cleanup && existing._cleanup(); } catch (e) {}
    existing.remove();
}

// Called when the user picks a connection from the tab chip dropdown.
// If the connection isn't open yet, connect first so queries work immediately.
async function pickConnectionForActiveTab(connId) {
    if (connId === null) {
        setActiveTabConnection(null, null);
        refreshConnectionIndicators(getActiveTab());
        renderTabs();
        updateStatus('Connection detached from tab');
        return;
    }
    const conn = state.connections.find(c => c.id === connId);
    if (!conn) return;
    try {
        await api.connections.connect(conn.id);
        setActiveTabConnection(conn.id, conn.name);
        refreshConnectionIndicators(getActiveTab());
        renderTabs();
        updateStatus(`Connected: ${conn.name}`);
        loadAutoCompleteCache(conn.id);
    } catch (e) {
        updateStatus(`Connection failed: ${e.message}`, true);
    }
}

// Keyboard shortcut entry point — opens the dropdown anchored to the active tab's chip.
function openActiveTabConnectionMenu() {
    const tab = getActiveTab();
    if (!tab) return;
    if (tab.type === 'erd') { updateStatus('ERD tab connection is locked', true); return; }
    const tabEls = document.querySelectorAll('#tab-list .tab');
    let anchor = null;
    state.editors.forEach((t, idx) => { if (t.id === tab.id) anchor = tabEls[idx]?.querySelector('.tab-conn-chip') || tabEls[idx]; });
    showTabConnectionMenu(tab.id, anchor);
}

function getCurrentSql() {
    if (!monacoEditor) return '';
    // If the active tab is not an SQL tab, no SQL context available
    const activeTab = state.editors.find(t => t.id === state.activeEditorId);
    if (activeTab && activeTab.type !== 'sql') return '';
    const selection = monacoEditor.getModel().getValueInRange(monacoEditor.getSelection());
    if (selection.trim()) return selection;
    return getSqlAtCursor();
}

function getAllSql() {
    if (!monacoEditor) return '';
    const activeTab = state.editors.find(t => t.id === state.activeEditorId);
    if (activeTab && activeTab.type !== 'sql') return '';
    return monacoEditor.getValue();
}

// Returns the SQL statement containing the current cursor, split by ';'.
// Strips block/line comments during splitting so a ';' inside a comment is ignored.
function getSqlAtCursor() {
    if (!monacoEditor) return '';
    const model = monacoEditor.getModel();
    const pos = monacoEditor.getPosition();
    if (!model || !pos) return monacoEditor.getValue();
    const full = model.getValue();
    const cursorOffset = model.getOffsetAt(pos);

    const boundaries = findStatementBoundaries(full);
    for (const { start, end } of boundaries) {
        if (cursorOffset >= start && cursorOffset <= end) {
            return full.substring(start, end).trim();
        }
    }
    // Fallback: last statement if cursor is past everything
    if (boundaries.length > 0) {
        const last = boundaries[boundaries.length - 1];
        return full.substring(last.start, last.end).trim();
    }
    return full.trim();
}

function findStatementBoundaries(sql) {
    const result = [];
    let start = 0;
    let i = 0;
    const n = sql.length;
    while (i < n) {
        const ch = sql[i];
        const next = sql[i + 1];
        // line comment
        if (ch === '-' && next === '-') {
            while (i < n && sql[i] !== '\n') i++;
            continue;
        }
        // block comment
        if (ch === '/' && next === '*') {
            i += 2;
            while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
            if (i < n) i += 2;
            continue;
        }
        // single / double quoted string
        if (ch === "'" || ch === '"' || ch === '`') {
            const quote = ch;
            i++;
            while (i < n) {
                if (sql[i] === '\\' && i + 1 < n) { i += 2; continue; }
                if (sql[i] === quote) { i++; break; }
                i++;
            }
            continue;
        }
        if (ch === ';') {
            result.push({ start, end: i + 1 });
            start = i + 1;
        }
        i++;
    }
    if (start < n && sql.substring(start).trim()) {
        result.push({ start, end: n });
    }
    return result;
}

// ============================================================
// Schema Tree
// ============================================================
function renderTree() {
    const container = document.getElementById('schema-tree');
    container.innerHTML = '';

    // Group connections by their group property
    const groups = {};
    const ungrouped = [];
    state.connections.forEach(conn => {
        const group = conn.properties?.group;
        if (group) {
            if (!groups[group]) groups[group] = [];
            groups[group].push(conn);
        } else {
            ungrouped.push(conn);
        }
    });

    // Render grouped connections
    for (const [groupName, conns] of Object.entries(groups).sort()) {
        const groupNode = document.createElement('div');
        groupNode.className = 'tree-node tree-group-node';
        groupNode.innerHTML = `
            <div class="tree-node-content tree-group-header">
                <span class="tree-arrow">&#9654;</span>
                <span class="tree-icon icon-group">&#9830;</span>
                <span class="tree-label tree-group-label">${escapeHtml(groupName)}</span>
                <span class="tree-badge group-count">${conns.length}</span>
            </div>
            <div class="tree-children"></div>
        `;
        const children = groupNode.querySelector('.tree-children');
        conns.forEach(conn => children.appendChild(createConnectionNode(conn)));

        const header = groupNode.querySelector('.tree-group-header');
        header.onclick = () => groupNode.classList.toggle('expanded');
        groupNode.classList.add('expanded'); // start expanded
        container.appendChild(groupNode);
    }

    // Render ungrouped connections
    ungrouped.forEach(conn => {
        container.appendChild(createConnectionNode(conn));
    });

    // Apply tab-usage badges + active highlight after rebuilding the tree
    try { refreshTreeConnectionBadges(); } catch (e) {}
}

function createConnectionNode(conn) {
    const node = document.createElement('div');
    node.className = 'tree-node';
    node.dataset.connId = conn.id;
    node.dataset.type = 'connection';

    const hasSsh = !!conn.properties?.sshTunnelId;
    const sshBadge = hasSsh ? '<span class="tree-badge ssh-badge" title="SSH Tunnel">SSH</span>' : '';
    const connColor = conn.properties?.color;
    const colorDot = connColor ? `<span class="conn-color-dot" style="background:${connColor}"></span>` : '';

    node.innerHTML = `
        <div class="tree-node-content"${connColor ? ` style="border-left:3px solid ${connColor};padding-left:4px;"` : ''}>
            <span class="tree-arrow">&#9654;</span>
            <span class="tree-icon icon-db">&#9711;</span>
            <span class="tree-label">${colorDot}${escapeHtml(conn.name || conn.databaseType)}${sshBadge}</span>
            <span class="conn-tab-usage-badge" style="display:none"></span>
        </div>
        <div class="tree-children"></div>
    `;

    const content = node.querySelector('.tree-node-content');
    content.ondblclick = () => activateConnection(conn, node);
    content.onclick = () => selectTreeNode(content);
    content.oncontextmenu = (e) => showContextMenu(e, conn, node);
    node.querySelector('.tree-arrow').onclick = (e) => {
        e.stopPropagation();
        if (node.classList.contains('expanded')) {
            node.classList.remove('expanded');
        } else {
            activateConnection(conn, node);
        }
    };

    return node;
}

// Schema visibility persistence
function getHiddenSchemas(connId) {
    try {
        return JSON.parse(localStorage.getItem(`dbee-hidden-schemas-${connId}`) || '[]');
    } catch { return []; }
}

function setHiddenSchemas(connId, hidden) {
    localStorage.setItem(`dbee-hidden-schemas-${connId}`, JSON.stringify(hidden));
}

function toggleSchemaVisibility(connId, schemaName, node) {
    const hidden = getHiddenSchemas(connId);
    const idx = hidden.indexOf(schemaName);
    if (idx >= 0) {
        hidden.splice(idx, 1);
        node.classList.remove('schema-hidden');
        node.querySelector('.tree-visibility').innerHTML = SVG_EYE;
        node.querySelector('.tree-visibility').title = 'Hide schema';
    } else {
        hidden.push(schemaName);
        node.classList.add('schema-hidden');
        node.querySelector('.tree-visibility').innerHTML = SVG_EYE_OFF;
        node.querySelector('.tree-visibility').title = 'Show schema';
    }
    setHiddenSchemas(connId, hidden);
}

const SVG_EYE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const SVG_EYE_OFF = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

// Show/hide hidden schemas toggle
let showHiddenSchemas = false;

async function activateConnection(conn, node) {
    // Phase A: assign the selected connection to the currently active editor tab.
    // `setActiveTabConnection` also mirrors to `state.activeConnectionId` for
    // back-compat with any intermediate callers that still read the global.
    setActiveTabConnection(conn.id, conn.name);
    updateStatus(`Connecting to ${conn.name}...`);

    try {
        await api.connections.connect(conn.id);
        const schemas = await api.metadata.schemas(conn.id);
        const childrenEl = node.querySelector('.tree-children');
        childrenEl.innerHTML = '';

        const hidden = getHiddenSchemas(conn.id);

        // Toggle button to show/hide hidden schemas
        if (schemas.length > 0) {
            const toggleBar = document.createElement('div');
            toggleBar.className = 'schema-filter-bar';
            toggleBar.innerHTML = `
                <button class="schema-filter-btn" id="toggle-hidden-${conn.id}" title="Toggle hidden schemas">
                    ${SVG_EYE_OFF}
                    <span>${hidden.length} hidden</span>
                </button>
            `;
            childrenEl.appendChild(toggleBar);

            toggleBar.querySelector('button').onclick = (e) => {
                e.stopPropagation();
                showHiddenSchemas = !showHiddenSchemas;
                childrenEl.querySelectorAll('.schema-hidden').forEach(n => {
                    n.style.display = showHiddenSchemas ? '' : 'none';
                });
                toggleBar.querySelector('button').classList.toggle('active', showHiddenSchemas);
            };

            if (hidden.length === 0) toggleBar.style.display = 'none';
            // Store reference to update count later
            node._filterBar = toggleBar;
            node._connId = conn.id;
        }

        schemas.forEach(schema => {
            const schemaNode = createSchemaNode(conn.id, schema, hidden.includes(schema.name));
            childrenEl.appendChild(schemaNode);
        });

        if (schemas.length === 0) {
            childrenEl.innerHTML = '<div class="tree-node"><div class="tree-node-content"><span class="tree-label" style="color:var(--text-secondary)">(no schemas)</span></div></div>';
        }

        node.classList.add('expanded');
        updateStatus(`Connected: ${conn.name}`);

        // Load autocomplete metadata in background
        loadAutoCompleteCache(conn.id);
    } catch (e) {
        updateStatus(`Connection failed: ${e.message}`, true);
    }
}

function updateFilterBar(connNode) {
    if (!connNode._filterBar || !connNode._connId) return;
    const hidden = getHiddenSchemas(connNode._connId);
    const bar = connNode._filterBar;
    bar.querySelector('span').textContent = `${hidden.length} hidden`;
    bar.style.display = hidden.length > 0 ? '' : 'none';
}

function createSchemaNode(connId, schema, isHidden) {
    const node = document.createElement('div');
    node.className = 'tree-node' + (isHidden ? ' schema-hidden' : '');
    node.dataset.type = 'schema';
    node.dataset.schemaName = schema.name;
    if (isHidden) node.style.display = showHiddenSchemas ? '' : 'none';

    node.innerHTML = `
        <div class="tree-node-content">
            <span class="tree-arrow">&#9654;</span>
            <span class="tree-icon icon-schema">&#9633;</span>
            <span class="tree-label">${escapeHtml(schema.name)}</span>
            <span class="tree-visibility" title="${isHidden ? 'Show schema' : 'Hide schema'}">${isHidden ? SVG_EYE_OFF : SVG_EYE}</span>
        </div>
        <div class="tree-children"><div class="tree-node"><div class="tree-node-content"><span class="tree-icon icon-loading">&#8987;</span><span class="tree-label">Loading...</span></div></div></div>
    `;

    let loaded = false;
    const content = node.querySelector('.tree-node-content');
    content.onclick = () => selectTreeNode(content);

    // Visibility toggle
    node.querySelector('.tree-visibility').onclick = (e) => {
        e.stopPropagation();
        toggleSchemaVisibility(connId, schema.name, node);
        // Hide if toggling off and not showing hidden
        if (node.classList.contains('schema-hidden') && !showHiddenSchemas) {
            node.style.display = 'none';
        } else {
            node.style.display = '';
        }
        // Update filter bar in parent connection node
        const connNode = node.closest('[data-conn-id]') || node.parentElement?.parentElement;
        if (connNode) updateFilterBar(connNode);
    };

    const toggle = () => {
        if (!loaded) {
            loaded = true;
            loadSchemaChildren(connId, schema.name, node);
        }
        node.classList.toggle('expanded');
    };

    content.ondblclick = toggle;
    content.oncontextmenu = (e) => {
        e.preventDefault();
        let existing = document.getElementById('table-ctx-menu');
        if (existing) existing.remove();
        const menu = document.createElement('div');
        menu.id = 'table-ctx-menu';
        menu.className = 'context-menu';
        menu.style.cssText = `display:block;left:${e.clientX}px;top:${e.clientY}px`;
        menu.innerHTML = '<div class="ctx-item" data-action="er">Show ER Diagram</div><div class="ctx-item" data-action="review">AI: Review Schema</div>';
        document.body.appendChild(menu);
        menu.querySelector('[data-action="er"]').onclick = () => {
            menu.remove();
            const conn = state.connections.find(c => c.id === connId);
            const connName = conn ? conn.name : '';
            addOrFocusErdTab(connId, connName, schema.name);
        };
        menu.querySelector('[data-action="review"]').onclick = async () => {
            menu.remove();
            toggleAiChatPanel();
            appendChatMessage('user', `Review the schema "${schema.name}" for design improvements`);
            const lm = appendChatMessage('loading', '');
            try {
                const r = await api.llm.schemaReview(connId, `Review schema "${schema.name}"`);
                lm.remove();
                appendChatMessage(r.error ? 'error' : 'assistant', r.message, r.sql);
            } catch (e) { lm.remove(); appendChatMessage('error', e.message); }
        };
        setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
    };
    node.querySelector('.tree-arrow').onclick = (e) => { e.stopPropagation(); toggle(); };
    return node;
}

// SVG icons for category folders
const SVG_FOLDER_TABLE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>';
const SVG_FOLDER_ROUTINE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';
const SVG_FOLDER_EVENT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

function loadSchemaChildren(connId, schema, schemaNode) {
    const childrenEl = schemaNode.querySelector('.tree-children');
    childrenEl.innerHTML = '';

    const conn = state.connections.find(c => c.id === connId);
    const isEs = conn && conn.databaseType === 'ELASTICSEARCH';

    // Tables / Indices folder
    const tablesLabel = isEs ? 'Indices' : 'Tables';
    const tablesFolder = createCategoryFolder(tablesLabel, SVG_FOLDER_TABLE, 'icon-table', () => loadTablesIntoFolder(connId, schema, tablesFolder));
    childrenEl.appendChild(tablesFolder);

    // Routines / Events — ES has neither concept
    if (!isEs) {
        const routinesFolder = createCategoryFolder('Routines', SVG_FOLDER_ROUTINE, 'icon-routine', () => loadRoutinesIntoFolder(connId, schema, routinesFolder));
        childrenEl.appendChild(routinesFolder);

        const eventsFolder = createCategoryFolder('Events', SVG_FOLDER_EVENT, 'icon-event', () => loadEventsIntoFolder(connId, schema, eventsFolder));
        childrenEl.appendChild(eventsFolder);
    }

    schemaNode.classList.add('expanded');
}

function createCategoryFolder(label, svgIcon, iconClass, loadFn) {
    const node = document.createElement('div');
    node.className = 'tree-node';
    node.dataset.type = 'category';

    node.innerHTML = `
        <div class="tree-node-content">
            <span class="tree-arrow">&#9654;</span>
            <span class="tree-icon ${iconClass}">${svgIcon}</span>
            <span class="tree-label tree-category-label">${label}</span>
        </div>
        <div class="tree-children"><div class="tree-node"><div class="tree-node-content"><span class="tree-icon icon-loading">&#8987;</span><span class="tree-label">Loading...</span></div></div></div>
    `;

    let loaded = false;
    const content = node.querySelector('.tree-node-content');
    content.onclick = () => selectTreeNode(content);

    const toggle = () => {
        if (!loaded) {
            loaded = true;
            loadFn();
        }
        node.classList.toggle('expanded');
    };

    content.ondblclick = toggle;
    node.querySelector('.tree-arrow').onclick = (e) => { e.stopPropagation(); toggle(); };
    return node;
}

async function loadTablesIntoFolder(connId, schema, folderNode) {
    try {
        const tables = await api.metadata.tables(connId, schema);
        const childrenEl = folderNode.querySelector('.tree-children');
        childrenEl.innerHTML = '';

        tables.forEach(table => {
            childrenEl.appendChild(createTableNode(connId, schema, table));
        });

        if (tables.length === 0) {
            childrenEl.innerHTML = '<div class="tree-node"><div class="tree-node-content"><span class="tree-label" style="color:var(--text-secondary)">(empty)</span></div></div>';
        }

        // Update count badge
        updateCategoryCount(folderNode, tables.length);
        folderNode.classList.add('expanded');
    } catch (e) {
        updateStatus(`Failed to load tables: ${e.message}`, true);
    }
}

async function loadRoutinesIntoFolder(connId, schema, folderNode) {
    try {
        const routines = await api.metadata.routines(connId, schema);
        const childrenEl = folderNode.querySelector('.tree-children');
        childrenEl.innerHTML = '';

        routines.forEach(routine => {
            childrenEl.appendChild(createRoutineNode(connId, schema, routine));
        });

        if (routines.length === 0) {
            childrenEl.innerHTML = '<div class="tree-node"><div class="tree-node-content"><span class="tree-label" style="color:var(--text-secondary)">(empty)</span></div></div>';
        }

        updateCategoryCount(folderNode, routines.length);
        folderNode.classList.add('expanded');
    } catch (e) {
        updateStatus(`Failed to load routines: ${e.message}`, true);
    }
}

async function loadEventsIntoFolder(connId, schema, folderNode) {
    try {
        const events = await api.metadata.events(connId, schema);
        const childrenEl = folderNode.querySelector('.tree-children');
        childrenEl.innerHTML = '';

        events.forEach(evt => {
            childrenEl.appendChild(createEventNode(evt));
        });

        if (events.length === 0) {
            childrenEl.innerHTML = '<div class="tree-node"><div class="tree-node-content"><span class="tree-label" style="color:var(--text-secondary)">(empty)</span></div></div>';
        }

        updateCategoryCount(folderNode, events.length);
        folderNode.classList.add('expanded');
    } catch (e) {
        // Events may not be supported - silently show empty
        const childrenEl = folderNode.querySelector('.tree-children');
        childrenEl.innerHTML = '<div class="tree-node"><div class="tree-node-content"><span class="tree-label" style="color:var(--text-secondary)">(not supported)</span></div></div>';
        folderNode.classList.add('expanded');
    }
}

function updateCategoryCount(folderNode, count) {
    const label = folderNode.querySelector('.tree-category-label');
    if (label) {
        const name = label.textContent.replace(/\s*\(\d+\)$/, '');
        label.innerHTML = `${name} <span class="tree-count">(${count})</span>`;
    }
}

function createRoutineNode(connId, schema, routine) {
    const node = document.createElement('div');
    node.className = 'tree-node';
    const isProcedure = routine.type === 'PROCEDURE';
    const typeLabel = isProcedure ? 'P' : 'F';
    const typeClass = isProcedure ? 'routine-proc' : 'routine-func';

    node.innerHTML = `
        <div class="tree-node-content">
            <span class="tree-arrow" style="visibility:hidden">&#9654;</span>
            <span class="tree-icon icon-routine"><span class="routine-type-badge ${typeClass}">${typeLabel}</span></span>
            <span class="tree-label">${escapeHtml(routine.name)}</span>
        </div>
    `;

    const content = node.querySelector('.tree-node-content');
    content.onclick = () => selectTreeNode(content);
    content.ondblclick = () => {
        if (monacoEditor) {
            const call = isProcedure ? `CALL ${schema}.${routine.name}();` : `SELECT ${schema}.${routine.name}();`;
            monacoEditor.setValue(call);
        }
    };
    return node;
}

function createEventNode(evt) {
    const node = document.createElement('div');
    node.className = 'tree-node';
    const statusClass = evt.status === 'ENABLED' ? 'event-enabled' : 'event-disabled';

    node.innerHTML = `
        <div class="tree-node-content">
            <span class="tree-arrow" style="visibility:hidden">&#9654;</span>
            <span class="tree-icon icon-event"><span class="event-status-dot ${statusClass}"></span></span>
            <span class="tree-label">${escapeHtml(evt.name)} <span style="color:var(--text-muted);font-size:10px">${escapeHtml(evt.status || '')}</span></span>
        </div>
    `;

    const content = node.querySelector('.tree-node-content');
    content.onclick = () => selectTreeNode(content);
    return node;
}

function createTableNode(connId, schema, table) {
    const node = document.createElement('div');
    node.className = 'tree-node';
    node.dataset.type = 'table';

    const icon = table.type === 'VIEW' ? '&#9673;' : '&#9638;';

    node.innerHTML = `
        <div class="tree-node-content">
            <span class="tree-arrow">&#9654;</span>
            <span class="tree-icon icon-table">${icon}</span>
            <span class="tree-label">${escapeHtml(table.name)}</span>
        </div>
        <div class="tree-children"><div class="tree-node"><div class="tree-node-content"><span class="tree-icon icon-loading">&#8987;</span><span class="tree-label">Loading...</span></div></div></div>
    `;

    let loaded = false;
    const content = node.querySelector('.tree-node-content');
    content.onclick = () => {
        selectTreeNode(content);
        if (typeof Inspector !== 'undefined') {
            Inspector.show({ type: 'table', connId, schema, table: table.name });
        }
    };

    content.ondblclick = () => {
        insertSqlSmart(buildSelectAll(connId, schema, table.name));
    };

    // Right-click context for DDL/Indexes
    content.oncontextmenu = (e) => {
        e.preventDefault();
        showTableContextMenu(e, connId, schema, table.name);
    };

    node.querySelector('.tree-arrow').onclick = (e) => {
        e.stopPropagation();
        if (!loaded) {
            loaded = true;
            loadColumns(connId, schema, table.name, node);
        }
        node.classList.toggle('expanded');
    };

    return node;
}

async function loadColumns(connId, schema, table, tableNode) {
    try {
        const columns = await api.metadata.columns(connId, schema, table);
        const childrenEl = tableNode.querySelector('.tree-children');
        childrenEl.innerHTML = '';

        columns.forEach(col => {
            const colNode = document.createElement('div');
            colNode.className = 'tree-node';
            colNode.innerHTML = `
                <div class="tree-node-content">
                    <span class="tree-arrow" style="visibility:hidden">&#9654;</span>
                    <span class="tree-icon icon-column">&#9702;</span>
                    <span class="tree-label">${escapeHtml(col.name)} <span style="color:var(--text-secondary)">(${escapeHtml(col.typeName)})</span></span>
                </div>
            `;
            childrenEl.appendChild(colNode);
        });

        if (columns.length === 0) {
            childrenEl.innerHTML = '<div class="tree-node"><div class="tree-node-content"><span class="tree-label" style="color:var(--text-secondary)">(no columns)</span></div></div>';
        }

        tableNode.classList.add('expanded');
    } catch (e) {
        updateStatus(`Failed to load columns: ${e.message}`, true);
    }
}

let selectedNodeEl = null;
function selectTreeNode(contentEl) {
    if (selectedNodeEl) selectedNodeEl.classList.remove('selected');
    contentEl.classList.add('selected');
    selectedNodeEl = contentEl;
}

async function showErDiagram(connId, schema) {
    const dialog = document.getElementById('er-dialog');
    const content = document.getElementById('er-diagram-content');
    dialog.style.display = 'flex';
    content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Loading ER diagram...</div>';

    document.getElementById('er-dialog-close').onclick = () => dialog.style.display = 'none';
    dialog.querySelector('.modal-backdrop').onclick = () => dialog.style.display = 'none';

    try {
        const result = await api.metadata.erDiagram(connId, schema);
        content.innerHTML = `<div style="margin-bottom:10px;text-align:right;">
            <button class="btn btn-ghost btn-sm" onclick="exportErSvg()">Export SVG</button>
            <button class="btn btn-ghost btn-sm" onclick="exportErPng()">Export PNG</button>
        </div><div class="mermaid">${escapeHtml(result.mermaid)}</div>`;
        if (window.mermaid) {
            mermaid.initialize({ startOnLoad: false, theme: document.body.dataset.theme === 'light' ? 'default' : 'dark' });
            await mermaid.run({ nodes: content.querySelectorAll('.mermaid') });
            attachErDiagramClickHandlers(connId, schema);
        }
    } catch (e) {
        content.innerHTML = `<div style="color:var(--error);padding:20px;">Failed: ${escapeHtml(e.message)}</div>`;
    }
}

function attachErDiagramClickHandlers(connId, schema) {
    // Mermaid renders entity names as text in SVG — make them clickable
    const content = document.getElementById('er-diagram-content');
    const svgEl = content.querySelector('svg');
    if (!svgEl) return;

    // Find entity labels (g.entityLabel text elements)
    svgEl.querySelectorAll('text').forEach(textEl => {
        const name = textEl.textContent.trim();
        if (!name || name.includes(' ') || name.includes('(')) return; // skip type labels
        textEl.style.cursor = 'pointer';
        textEl.onclick = () => {
            insertSqlSmart(buildSelectAll(connId, schema, name));
            document.getElementById('er-dialog').style.display = 'none';
            updateStatus(`Loaded: SELECT * FROM ${name}`);
        };
    });
}

function exportErSvg() {
    const svg = document.querySelector('#er-diagram-content svg');
    if (!svg) { updateStatus('No diagram to export', true); return; }
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'er-diagram.svg';
    a.click();
    URL.revokeObjectURL(a.href);
    updateStatus('ER diagram exported as SVG');
}

function exportErPng() {
    const svg = document.querySelector('#er-diagram-content svg');
    if (!svg) { updateStatus('No diagram to export', true); return; }
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'er-diagram.png';
            a.click();
            URL.revokeObjectURL(a.href);
            updateStatus('ER diagram exported as PNG');
        });
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
}

function showTableContextMenu(e, connId, schema, tableName) {
    // Remove any existing table context menu
    let existing = document.getElementById('table-ctx-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'table-ctx-menu';
    menu.className = 'context-menu';
    menu.style.display = 'block';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.innerHTML = `
        <div class="ctx-item" data-action="select-top">SELECT * (LIMIT 100)</div>
        <div class="ctx-separator"></div>
        <div class="ctx-item" data-action="show-ddl">Show CREATE TABLE</div>
        <div class="ctx-item" data-action="show-indexes">Show Indexes</div>
        <div class="ctx-item" data-action="show-fk">Show Foreign Keys</div>
        <div class="ctx-separator"></div>
        <div class="ctx-item" data-action="create-view">Create View from Table</div>
        <div class="ctx-item" data-action="show-triggers">Show Triggers</div>
        <div class="ctx-separator"></div>
        <div class="ctx-item" data-action="ai-explain-table">AI: Explain Table</div>
    `;
    document.body.appendChild(menu);

    menu.querySelector('[data-action="select-top"]').onclick = () => {
        insertSqlSmart(buildSelectAll(connId, schema, tableName));
        menu.remove();
    };
    menu.querySelector('[data-action="show-ddl"]').onclick = async () => {
        menu.remove();
        await showTableDdl(connId, schema, tableName);
    };
    menu.querySelector('[data-action="show-indexes"]').onclick = async () => {
        menu.remove();
        await showTableIndexes(connId, schema, tableName);
    };
    menu.querySelector('[data-action="show-fk"]').onclick = async () => {
        menu.remove();
        await showTableForeignKeys(connId, schema, tableName);
    };
    menu.querySelector('[data-action="create-view"]').onclick = () => {
        menu.remove();
        if (monacoEditor) {
            monacoEditor.setValue(`CREATE VIEW v_${tableName} AS\nSELECT *\nFROM ${schema}.${tableName};`);
            monacoEditor.focus();
            updateStatus('View template generated — edit and execute');
        }
    };
    menu.querySelector('[data-action="show-triggers"]').onclick = async () => {
        menu.remove();
        await showTableTriggers(connId, schema, tableName);
    };
    menu.querySelector('[data-action="ai-explain-table"]').onclick = async () => {
        menu.remove();
        await aiExplainTable(connId, schema, tableName);
    };

    const close = () => { menu.remove(); document.removeEventListener('click', close); };
    setTimeout(() => document.addEventListener('click', close), 0);
}

async function showTableForeignKeys(connId, schema, tableName) {
    try {
        // Use a simple query to get FK info — or reuse metadata
        const sql = `-- Foreign Keys on ${schema}.${tableName}\n-- (Query INFORMATION_SCHEMA for your database)\nSELECT * FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='${schema}' AND TABLE_NAME='${tableName}' AND REFERENCED_TABLE_NAME IS NOT NULL;`;
        if (monacoEditor) { monacoEditor.setValue(sql); monacoEditor.focus(); }
        updateStatus('FK query loaded — execute to see results');
    } catch (e) { updateStatus('Failed: ' + e.message, true); }
}

async function showTableTriggers(connId, schema, tableName) {
    try {
        const sql = `-- Triggers on ${schema}.${tableName}\nSELECT TRIGGER_NAME, EVENT_MANIPULATION, ACTION_TIMING, ACTION_STATEMENT\nFROM information_schema.TRIGGERS\nWHERE EVENT_OBJECT_SCHEMA='${schema}' AND EVENT_OBJECT_TABLE='${tableName}';`;
        if (monacoEditor) { monacoEditor.setValue(sql); monacoEditor.focus(); }
        updateStatus('Trigger query loaded — execute to see results');
    } catch (e) { updateStatus('Failed: ' + e.message, true); }
}

async function aiExplainTable(connId, schema, tableName) {
    toggleAiChatPanel();
    appendChatMessage('user', `Explain the purpose and structure of table "${schema}.${tableName}"`);
    const loadingMsg = appendChatMessage('loading', '');
    try {
        const result = await api.llm.chat(connId, `Explain the table "${schema}.${tableName}": what it likely stores, its columns, relationships, and typical use cases.`);
        loadingMsg.remove();
        if (result.error) appendChatMessage('error', result.message);
        else appendChatMessage('assistant', result.message, result.sql);
    } catch (e) { loadingMsg.remove(); appendChatMessage('error', e.message); }
}

async function showTableDdl(connId, schema, tableName) {
    try {
        const result = await api.metadata.ddl(connId, schema, tableName);
        if (monacoEditor) {
            monacoEditor.setValue(result.ddl || '-- No DDL available');
            monacoEditor.focus();
            updateStatus(`DDL loaded for ${tableName}`);
        }
    } catch (e) {
        updateStatus('Failed to load DDL: ' + e.message, true);
    }
}

async function showTableIndexes(connId, schema, tableName) {
    try {
        const indexes = await api.metadata.indexes(connId, schema, tableName);
        if (indexes.length === 0) {
            updateStatus(`No indexes found on ${tableName}`);
            return;
        }
        // Display as a formatted list in the editor
        let sql = `-- Indexes on ${schema}.${tableName}\n\n`;
        const grouped = {};
        indexes.forEach(idx => {
            if (!grouped[idx.name]) grouped[idx.name] = { unique: idx.unique, columns: [] };
            grouped[idx.name].columns.push(idx.columnName);
        });
        for (const [name, info] of Object.entries(grouped)) {
            sql += `-- ${info.unique ? 'UNIQUE ' : ''}INDEX: ${name} (${info.columns.join(', ')})\n`;
        }
        if (monacoEditor) {
            monacoEditor.setValue(sql);
            monacoEditor.focus();
        }
    } catch (e) {
        updateStatus('Failed to load indexes: ' + e.message, true);
    }
}

// ============================================================
// Query Execution
// ============================================================
async function executeQuery(runAll = false) {
    const connId = getActiveConnectionId();
    if (!connId) {
        updateStatus('No active connection. Double-click a connection in the tree.', true);
        return;
    }
    const sql = runAll ? getAllSql() : getCurrentSql();
    if (!sql.trim()) {
        updateStatus('No SQL to execute', true);
        return;
    }

    const executionId = 'exec-' + Date.now();
    state.currentExecutionId = executionId;

    updateStatus('Executing...');
    document.getElementById('btn-run').disabled = true;
    showCancelButton(true, executionId);

    try {
        const results = await api.query.execute(connId, sql, 1000, executionId);
        state.lastResult = { connectionId: connId, sql };
        // Multi-query: results is an array
        if (Array.isArray(results) && results.length > 1) {
            displayMultiResult(results);
        } else {
            const result = Array.isArray(results) ? results[0] : results;
            displayResult(result);
        }
    } catch (e) {
        displayError(e.message);
    } finally {
        state.currentExecutionId = null;
        document.getElementById('btn-run').disabled = false;
        showCancelButton(false);
    }
}

function showCancelButton(show, executionId) {
    let cancelBtn = document.getElementById('btn-cancel-query');
    if (show) {
        if (!cancelBtn) {
            cancelBtn = document.createElement('button');
            cancelBtn.id = 'btn-cancel-query';
            cancelBtn.className = 'btn btn-ghost btn-cancel-query';
            cancelBtn.title = 'Cancel Query';
            cancelBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg> Cancel`;
            const runBtn = document.getElementById('btn-run');
            runBtn.parentElement.insertBefore(cancelBtn, runBtn.nextSibling);
        }
        cancelBtn.style.display = '';
        cancelBtn.disabled = false;
        cancelBtn.onclick = () => cancelQuery(executionId);
    } else {
        if (cancelBtn) cancelBtn.style.display = 'none';
    }
}

async function cancelQuery(executionId) {
    try {
        const cancelBtn = document.getElementById('btn-cancel-query');
        if (cancelBtn) cancelBtn.disabled = true;
        await api.query.cancel(executionId);
        updateStatus('Query cancellation requested...');
    } catch (e) {
        console.error('Cancel failed:', e);
    }
}

function formatSql() {
    if (!monacoEditor) return;
    const sql = monacoEditor.getValue();
    if (!sql.trim()) return;
    try {
        const formatted = window.sqlFormatter
            ? sqlFormatter.format(sql, { language: 'sql', tabWidth: 2 })
            : sql;
        monacoEditor.setValue(formatted);
        updateStatus('SQL formatted');
    } catch (e) {
        updateStatus('Format failed: ' + e.message, true);
    }
}

async function executeExplain(analyze = false) {
    const connId = getActiveConnectionId();
    if (!connId) {
        updateStatus('No active connection. Double-click a connection in the tree.', true);
        return;
    }
    const sql = getCurrentSql();
    if (!sql.trim()) {
        updateStatus('No SQL to execute', true);
        return;
    }

    const label = analyze ? 'EXPLAIN ANALYZE' : 'EXPLAIN';
    updateStatus(`Running ${label}...`);
    document.getElementById('btn-run').disabled = true;

    try {
        const result = await api.query.explain(connId, sql, analyze);
        state.lastResult = { connectionId: connId, sql, explain: true };
        displayResult(result, label);
    } catch (e) {
        displayError(e.message);
    } finally {
        document.getElementById('btn-run').disabled = false;
    }
}

// ============================================================
// Results Display
// ============================================================
function displayResult(result, resultLabel) {
    const container = document.getElementById('result-content');

    if (result.error) {
        const sql = state.lastResult?.sql || getCurrentSql();
        container.innerHTML = `<div class="result-error">
            <div class="result-error-msg">${escapeHtml(result.errorMessage)}</div>
            ${getActiveConnectionId() ? `<button class="btn btn-ghost btn-sm ai-fix-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4c0 2.8 4 6 4 6s4-3.2 4-6a4 4 0 0 0-4-4z"/><circle cx="12" cy="6" r="1.5"/></svg>
                Ask AI to Fix
            </button>` : ''}
            <div id="ai-fix-result" style="display:none;"></div>
        </div>`;
        // Safe event binding (no inline onclick)
        const fixBtn = container.querySelector('.ai-fix-btn');
        if (fixBtn) fixBtn.addEventListener('click', () => askAiToFix(result.errorMessage));
        updateStatus(result.errorMessage, true);
        state.resultData = null;
        state.lastError = { sql, errorMessage: result.errorMessage };
        return;
    }

    if (!result.select) {
        container.innerHTML = `<div class="result-message">${result.affectedRows} row(s) affected</div>`;
        updateStatus(`${result.affectedRows} row(s) affected`, false, -1, result.executionTimeMs);
        state.resultData = null;
        return;
    }

    // Store original data for sorting/filtering
    state.resultData = {
        columnNames: result.columnNames,
        columnTypeNames: result.columnTypeNames || [],
        rows: result.rows.map(r => [...r]), // deep copy
        executionTimeMs: result.executionTimeMs,
        tableName: result.tableName || null,
        schemaName: result.schemaName || null,
    };
    state.sortState = { columnIndex: -1, direction: null };
    state.filterKeyword = '';
    state.primaryKeyCache = null; // reset PK cache for new result

    // Show filter bar & reset input
    const filterWrap = document.getElementById('result-filter-wrap');
    const filterInput = document.getElementById('result-filter-input');
    if (filterWrap) filterWrap.style.display = '';
    if (filterInput) filterInput.value = '';

    // Update result header label
    const headerLabel = document.querySelector('#result-header > span:first-of-type');
    if (headerLabel) {
        headerLabel.textContent = resultLabel || 'Results';
    }

    applyFilterAndSort();

    const conn = state.connections.find(c => c.id === getActiveConnectionId());
    updateStatus(`Connected: ${conn ? conn.name : ''}`, false, result.rows.length, result.executionTimeMs);
}

function displayMultiResult(results) {
    const container = document.getElementById('result-content');
    const filterWrap = document.getElementById('result-filter-wrap');
    if (filterWrap) filterWrap.style.display = 'none';
    state.resultData = null;

    // Build tab header + content for each result
    let tabsHtml = '<div class="multi-result-tabs">';
    results.forEach((r, i) => {
        const label = r.select ? `Result ${i + 1}` : (r.error ? `Error ${i + 1}` : `Statement ${i + 1}`);
        tabsHtml += `<button class="multi-tab${i === 0 ? ' active' : ''}" data-idx="${i}">${label}</button>`;
    });
    tabsHtml += '</div><div class="multi-result-content"></div>';
    container.innerHTML = tabsHtml;

    const contentDiv = container.querySelector('.multi-result-content');

    function showMultiTab(idx) {
        container.querySelectorAll('.multi-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
        const r = results[idx];
        if (r.error) {
            contentDiv.innerHTML = `<div class="result-error"><div class="result-error-msg">${escapeHtml(r.errorMessage)}</div></div>`;
        } else if (!r.select) {
            contentDiv.innerHTML = `<div class="result-message">${r.affectedRows} row(s) affected (${r.executionTimeMs}ms)</div>`;
        } else {
            // Render a simple table for this result
            let html = '<table class="result-table"><thead><tr>';
            r.columnNames.forEach(col => { html += `<th><span class="th-label">${escapeHtml(col)}</span></th>`; });
            html += '</tr></thead><tbody>';
            r.rows.forEach(row => {
                html += '<tr>';
                row.forEach(val => {
                    html += val === null ? '<td class="null-value">NULL</td>' : `<td>${escapeHtml(String(val))}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody></table>';
            contentDiv.innerHTML = html;
        }
    }

    container.querySelectorAll('.multi-tab').forEach(tab => {
        tab.onclick = () => showMultiTab(parseInt(tab.dataset.idx));
    });

    showMultiTab(0);

    const totalTime = results.reduce((s, r) => s + (r.executionTimeMs || 0), 0);
    updateStatus(`Executed ${results.length} statements in ${totalTime}ms`);
}

function applyFilterAndSort() {
    if (!state.resultData) return;

    let rows = state.resultData.rows.map(r => [...r]);
    const keyword = state.filterKeyword.toLowerCase();
    const totalRows = rows.length;

    // Filter
    if (keyword) {
        rows = rows.filter(row =>
            row.some(val => val !== null && String(val).toLowerCase().includes(keyword))
        );
    }

    // Sort
    const { columnIndex: sortCol, direction: sortDir } = state.sortState;
    if (sortDir !== null && sortCol >= 0) {
        const dir = sortDir === 'asc' ? 1 : -1;
        rows.sort((a, b) => {
            const va = a[sortCol];
            const vb = b[sortCol];
            if (va === null && vb === null) return 0;
            if (va === null) return 1;
            if (vb === null) return -1;
            if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
            return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' }) * dir;
        });
    }

    renderResultTable(rows, totalRows);
}

function formatCellValue(val, typeName) {
    if (val === null) return { html: 'NULL', cls: 'null-value' };
    const str = String(val);
    const upper = (typeName || '').toUpperCase();

    // Numeric types — right align, thousand separator
    if (/^(INT|BIGINT|SMALLINT|TINYINT|MEDIUMINT|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|NUMBER)/.test(upper)) {
        const num = Number(val);
        if (!isNaN(num) && isFinite(num)) {
            const formatted = upper.includes('DECIMAL') || upper.includes('NUMERIC') || upper.includes('FLOAT') || upper.includes('DOUBLE') || upper.includes('REAL')
                ? num.toLocaleString(undefined, { maximumFractionDigits: 10 })
                : num.toLocaleString();
            return { html: escapeHtml(formatted), cls: 'cell-number' };
        }
    }

    // Boolean
    if (/^(BOOL|BOOLEAN|BIT)/.test(upper)) {
        const b = str === '1' || str.toLowerCase() === 'true';
        return { html: `<span class="cell-bool cell-bool-${b}">${b ? 'true' : 'false'}</span>`, cls: '' };
    }

    // Date/Time
    if (/^(DATE|TIME|DATETIME|TIMESTAMP)/.test(upper)) {
        return { html: escapeHtml(str), cls: 'cell-date' };
    }

    // JSON
    if (/^(JSON|JSONB)/.test(upper)) {
        return { html: escapeHtml(str.length > 100 ? str.substring(0, 100) + '...' : str), cls: 'cell-json' };
    }

    // Binary
    if (str === '[BINARY]') {
        return { html: '<span class="cell-binary">[BINARY]</span>', cls: '' };
    }

    // Long text — truncate
    if (str.length > 200) {
        return { html: escapeHtml(str.substring(0, 200)) + '<span class="cell-truncated">...</span>', cls: '' };
    }

    return { html: escapeHtml(str), cls: '' };
}

const RENDER_PAGE_SIZE = 200;

function renderResultTable(rows, totalRows) {
    const container = document.getElementById('result-content');
    const { columnNames } = state.resultData;
    const { columnIndex: sortCol, direction: sortDir } = state.sortState;
    const keyword = state.filterKeyword.toLowerCase();

    // For large results, render in pages
    const visibleRows = rows.length > RENDER_PAGE_SIZE ? rows.slice(0, RENDER_PAGE_SIZE) : rows;
    state._allFilteredRows = rows;
    state._renderedCount = visibleRows.length;

    let html = '<table class="result-table"><thead><tr>';
    columnNames.forEach((col, idx) => {
        const isActive = sortCol === idx;
        const arrow = isActive ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
        const cls = isActive ? ' class="th-sorted"' : '';
        html += `<th${cls} data-col-idx="${idx}"><span class="th-label">${escapeHtml(col)}</span><span class="th-sort-arrow">${arrow}</span><div class="col-resize-handle"></div></th>`;
    });
    html += '</tr></thead><tbody>';

    const editable = state.resultData.tableName && !keyword;
    const typeNames = state.resultData.columnTypeNames || [];
    visibleRows.forEach((row, rowIdx) => {
        html += `<tr data-row-idx="${rowIdx}">`;
        row.forEach((val, colIdx) => {
            const editAttr = editable ? ` data-col-idx="${colIdx}"` : '';
            if (keyword) {
                // In filter mode, use simple rendering with highlight
                if (val === null) {
                    html += `<td class="null-value"${editAttr}>NULL</td>`;
                } else {
                    html += `<td${editAttr}>${highlightMatch(String(val), keyword)}</td>`;
                }
            } else {
                const cell = formatCellValue(val, typeNames[colIdx]);
                html += `<td class="${cell.cls}"${editAttr}>${cell.html}</td>`;
            }
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    if (rows.length > visibleRows.length) {
        const totalPages = Math.ceil(rows.length / RENDER_PAGE_SIZE);
        const currentPage = Math.ceil(visibleRows.length / RENDER_PAGE_SIZE);
        html += `<div class="load-more-bar">
            <span class="page-info">Page ${currentPage} of ${totalPages} (${visibleRows.length} / ${rows.length} rows)</span>
            <button class="btn btn-ghost btn-sm" id="btn-load-more">Load More</button>
            <button class="btn btn-ghost btn-sm" id="btn-load-all">Load All</button>
        </div>`;
    }
    container.innerHTML = html;

    // Load more / Load all buttons
    const loadMoreBtn = document.getElementById('btn-load-more');
    if (loadMoreBtn) {
        loadMoreBtn.onclick = () => {
            state._renderedCount = Math.min(state._renderedCount + RENDER_PAGE_SIZE, state._allFilteredRows.length);
            const moreRows = state._allFilteredRows.slice(0, state._renderedCount);
            renderResultTable(moreRows.length === state._allFilteredRows.length ? state._allFilteredRows : moreRows, totalRows);
        };
    }
    const loadAllBtn = document.getElementById('btn-load-all');
    if (loadAllBtn) {
        loadAllBtn.onclick = () => {
            state._renderedCount = state._allFilteredRows.length;
            renderResultTable(state._allFilteredRows, totalRows);
        };
    }

    // Attach sort click handlers
    container.querySelectorAll('.result-table th').forEach(th => {
        th.onclick = () => {
            const idx = parseInt(th.dataset.colIdx);
            sortResultByColumn(idx);
        };
    });

    // Right-click copy menu on cells
    container.querySelectorAll('.result-table tbody td').forEach(td => {
        td.oncontextmenu = (e) => {
            e.preventDefault();
            const rowIdx = parseInt(td.parentElement.dataset.rowIdx);
            const colIdx = Array.from(td.parentElement.children).indexOf(td);
            let existing = document.getElementById('table-ctx-menu');
            if (existing) existing.remove();
            const menu = document.createElement('div');
            menu.id = 'table-ctx-menu';
            menu.className = 'context-menu';
            menu.style.cssText = `display:block;left:${e.clientX}px;top:${e.clientY}px`;
            menu.innerHTML = `
                <div class="ctx-item" data-action="copy-cell">Copy Cell</div>
                <div class="ctx-item" data-action="copy-row">Copy Row (TSV)</div>
                <div class="ctx-item" data-action="copy-all">Copy All (TSV)</div>
            `;
            document.body.appendChild(menu);

            menu.querySelector('[data-action="copy-cell"]').onclick = () => {
                const val = state.resultData.rows[rowIdx]?.[colIdx];
                navigator.clipboard.writeText(val === null ? 'NULL' : String(val));
                updateStatus('Cell copied'); menu.remove();
            };
            menu.querySelector('[data-action="copy-row"]').onclick = () => {
                const row = state.resultData.rows[rowIdx];
                if (row) navigator.clipboard.writeText(row.map(v => v === null ? 'NULL' : String(v)).join('\t'));
                updateStatus('Row copied'); menu.remove();
            };
            menu.querySelector('[data-action="copy-all"]').onclick = () => {
                const { columnNames: cols, rows: allRows } = state.resultData;
                const tsv = cols.join('\t') + '\n' + allRows.map(r => r.map(v => v === null ? 'NULL' : String(v)).join('\t')).join('\n');
                navigator.clipboard.writeText(tsv);
                updateStatus(`Copied ${allRows.length} rows`); menu.remove();
            };
            setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
        };
    });

    // Row selection for delete
    container.querySelectorAll('.result-table tbody tr').forEach(tr => {
        tr.onclick = () => {
            container.querySelectorAll('.result-table tbody tr.row-selected').forEach(r => r.classList.remove('row-selected'));
            tr.classList.add('row-selected');
        };
    });

    // Attach cell click for full value viewer
    container.querySelectorAll('.result-table tbody td').forEach(td => {
        td.onclick = (e) => {
            if (td.classList.contains('cell-editing')) return; // skip if editing
            if (e.detail === 2) return; // skip double-click (editing)
            const rowIdx = parseInt(td.parentElement.dataset.rowIdx);
            const colIdx = Array.from(td.parentElement.children).indexOf(td);
            if (isNaN(rowIdx) || colIdx < 0) return;
            const val = state.resultData.rows[rowIdx]?.[colIdx];
            const colName = columnNames[colIdx] || '';
            const typeName = typeNames[colIdx] || '';
            // Only show viewer for long text, JSON, or NULL
            const str = val === null ? null : String(val);
            if (val === null || (str && str.length > 50) || /JSON/i.test(typeName)) {
                showCellViewer(val, colName, typeName);
            }
        };
    });

    // Attach column resize handlers
    container.querySelectorAll('.col-resize-handle').forEach(handle => {
        handle.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const th = handle.parentElement;
            const table = th.closest('table');
            table.style.tableLayout = 'fixed';
            const startX = e.clientX;
            const startW = th.offsetWidth;
            const onMove = (me) => {
                th.style.width = Math.max(40, startW + me.clientX - startX) + 'px';
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        };
    });

    // Attach inline editing (double-click) if editable
    if (editable) {
        container.querySelectorAll('.result-table tbody td[data-col-idx]').forEach(td => {
            td.ondblclick = () => startCellEdit(td);
        });
    }

    // Update summary with filter info
    const summary = document.getElementById('result-summary');
    if (summary && totalRows !== undefined) {
        const timeMs = state.resultData.executionTimeMs;
        if (keyword && rows.length !== totalRows) {
            summary.innerHTML = `${rows.length} / ${totalRows} rows in ${timeMs}ms`;
        } else {
            summary.innerHTML = `${rows.length} rows in ${timeMs}ms`;
        }
        if (editable) {
            summary.innerHTML += ` | <span class="edit-actions"><button class="btn-link" onclick="addNewRow()">+ Add Row</button> <button class="btn-link btn-link-danger" onclick="deleteSelectedRow()">- Delete Row</button></span>`;
        }
    }
}

function highlightMatch(text, keyword) {
    const escaped = escapeHtml(text);
    const escapedKeyword = escapeHtml(keyword);
    if (!escapedKeyword) return escaped;
    const regex = new RegExp(`(${escapedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<mark class="filter-highlight">$1</mark>');
}

function sortResultByColumn(colIndex) {
    if (!state.resultData) return;

    const { sortState } = state;

    // Toggle: none → asc → desc → none
    if (sortState.columnIndex !== colIndex) {
        sortState.columnIndex = colIndex;
        sortState.direction = 'asc';
    } else if (sortState.direction === 'asc') {
        sortState.direction = 'desc';
    } else {
        sortState.columnIndex = -1;
        sortState.direction = null;
    }

    applyFilterAndSort();
}

// ============================================================
// Inline Cell Editing
// ============================================================
function startCellEdit(td) {
    if (td.querySelector('input')) return; // already editing

    const colIdx = parseInt(td.dataset.colIdx);
    const row = td.parentElement;
    const rowIdx = parseInt(row.dataset.rowIdx);
    const isNull = td.classList.contains('null-value');
    const originalValue = isNull ? null : td.textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-edit-input';
    input.value = isNull ? '' : originalValue;
    input.placeholder = 'NULL';

    td.textContent = '';
    td.classList.add('cell-editing');
    td.appendChild(input);
    input.focus();
    input.select();

    const commitEdit = async () => {
        const newValue = input.value;
        const newIsNull = newValue === '' || newValue.toLowerCase() === 'null';
        const displayVal = newIsNull ? null : newValue;

        // Check if value actually changed
        if ((!newIsNull && newValue === originalValue) || (newIsNull && isNull)) {
            cancelEdit();
            return;
        }

        // #25: Preview the SQL before executing
        const previewSql = buildUpdatePreviewSql(rowIdx, colIdx, displayVal);
        if (previewSql && !confirm(`Execute this SQL?\n\n${previewSql}`)) {
            cancelEdit();
            return;
        }

        td.classList.remove('cell-editing');
        td.textContent = newIsNull ? 'NULL' : newValue;
        if (newIsNull) td.classList.add('null-value');
        else td.classList.remove('null-value');
        td.classList.add('cell-dirty');

        // Perform the update
        try {
            const result = await performCellUpdate(rowIdx, colIdx, displayVal);
            if (result && result.error) {
                td.classList.remove('cell-dirty');
                td.classList.add('cell-error');
                td.title = result.errorMessage;
                updateStatus(`Update failed: ${result.errorMessage}`, true);
                // Revert display
                setTimeout(() => {
                    td.textContent = isNull ? 'NULL' : originalValue;
                    if (isNull) td.classList.add('null-value');
                    td.classList.remove('cell-error');
                    td.title = '';
                }, 2000);
            } else {
                td.classList.add('cell-saved');
                td.title = '';
                // Update the stored data
                state.resultData.rows[rowIdx][colIdx] = displayVal;
                updateStatus('Cell updated successfully');
                setTimeout(() => {
                    td.classList.remove('cell-dirty', 'cell-saved');
                }, 1500);
            }
        } catch (e) {
            td.classList.add('cell-error');
            td.title = e.message;
            updateStatus(`Update failed: ${e.message}`, true);
            setTimeout(() => {
                td.textContent = isNull ? 'NULL' : originalValue;
                if (isNull) td.classList.add('null-value');
                td.classList.remove('cell-dirty', 'cell-error');
                td.title = '';
            }, 2000);
        }
    };

    const cancelEdit = () => {
        td.classList.remove('cell-editing');
        td.textContent = isNull ? 'NULL' : originalValue;
        if (isNull) td.classList.add('null-value');
    };

    input.onblur = () => commitEdit();
    input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { e.preventDefault(); input.onblur = null; cancelEdit(); }
        e.stopPropagation(); // prevent Monaco shortcuts
    };
}

function buildUpdatePreviewSql(rowIdx, colIdx, newValue) {
    const { tableName, schemaName, columnNames } = state.resultData;
    if (!tableName || !state.primaryKeyCache) return null;
    const row = state.resultData.rows[rowIdx];
    const col = columnNames[colIdx];
    const valStr = newValue === null ? 'NULL' : `'${newValue}'`;
    const wheres = state.primaryKeyCache.map(pk => {
        const pkIdx = columnNames.indexOf(pk);
        const pkVal = row[pkIdx];
        return `${pk} = ${pkVal === null ? 'NULL' : `'${pkVal}'`}`;
    }).join(' AND ');
    const table = schemaName ? `${schemaName}.${tableName}` : tableName;
    return `UPDATE ${table} SET ${col} = ${valStr} WHERE ${wheres}`;
}

async function performCellUpdate(rowIdx, colIdx, newValue) {
    const { tableName, schemaName, columnNames } = state.resultData;
    if (!tableName) throw new Error('Table name not available');

    const connId = getActiveConnectionId();
    // Get primary keys (cached)
    if (!state.primaryKeyCache) {
        const pks = await api.metadata.primaryKeys(connId, schemaName, tableName);
        if (!pks || pks.length === 0) throw new Error('No primary key found for table ' + tableName);
        state.primaryKeyCache = pks.map(pk => pk.columnName);
    }

    const pkColumns = state.primaryKeyCache;
    const row = state.resultData.rows[rowIdx];

    // Build primary key map
    const primaryKeys = {};
    for (const pkCol of pkColumns) {
        const pkIdx = columnNames.indexOf(pkCol);
        if (pkIdx === -1) throw new Error(`Primary key column "${pkCol}" not in result set. Include all PK columns in your SELECT.`);
        primaryKeys[pkCol] = row[pkIdx];
    }

    const column = columnNames[colIdx];
    return await api.query.updateCell(connId, schemaName, tableName, primaryKeys, column, newValue);
}

async function addNewRow() {
    if (!state.resultData?.tableName) return;
    const { columnNames, schemaName, tableName } = state.resultData;
    const values = {};
    for (const col of columnNames) {
        const val = prompt(`Value for "${col}" (leave empty for NULL):`);
        if (val === null) return; // cancelled
        values[col] = val === '' ? null : val;
    }
    try {
        const result = await api.query.insertRow(getActiveConnectionId(), schemaName, tableName, values);
        if (result.error) {
            updateStatus('Insert failed: ' + result.errorMessage, true);
        } else {
            updateStatus('Row inserted. Re-executing query...');
            executeQuery(); // refresh
        }
    } catch (e) { updateStatus('Insert failed: ' + e.message, true); }
}

async function deleteSelectedRow() {
    if (!state.resultData?.tableName) return;
    const { schemaName, tableName, columnNames } = state.resultData;

    // Find selected row (last clicked)
    const activeRow = document.querySelector('.result-table tbody tr.row-selected');
    if (!activeRow) { updateStatus('Click a row first to select it for deletion', true); return; }
    if (!confirm('Delete the selected row?')) return;

    const rowIdx = parseInt(activeRow.dataset.rowIdx);
    const row = state.resultData.rows[rowIdx];
    if (!row) return;

    const connId = getActiveConnectionId();
    // Get PKs
    if (!state.primaryKeyCache) {
        const pks = await api.metadata.primaryKeys(connId, schemaName, tableName);
        if (!pks || pks.length === 0) { updateStatus('No primary key found', true); return; }
        state.primaryKeyCache = pks.map(pk => pk.columnName);
    }
    const primaryKeys = {};
    for (const pkCol of state.primaryKeyCache) {
        const pkIdx = columnNames.indexOf(pkCol);
        if (pkIdx === -1) { updateStatus(`PK column "${pkCol}" not in result`, true); return; }
        primaryKeys[pkCol] = row[pkIdx];
    }

    try {
        const result = await api.query.deleteRow(connId, schemaName, tableName, primaryKeys);
        if (result.error) {
            updateStatus('Delete failed: ' + result.errorMessage, true);
        } else {
            updateStatus('Row deleted. Re-executing query...');
            executeQuery();
        }
    } catch (e) { updateStatus('Delete failed: ' + e.message, true); }
}

async function askAiToFix(errorMsg) {
    const resultDiv = document.getElementById('ai-fix-result');
    if (!resultDiv) return;

    const sql = state.lastError?.sql || getCurrentSql();
    const error = state.lastError?.errorMessage || errorMsg;

    // Hide the button, show loading
    const fixBtn = document.querySelector('.ai-fix-btn');
    if (fixBtn) fixBtn.style.display = 'none';

    resultDiv.style.display = 'block';
    resultDiv.className = 'ai-fix-result ai-fix-loading';
    resultDiv.innerHTML = '<span class="ai-loading-dots">AI is analyzing<span>...</span></span>';

    try {
        const result = await api.llm.fixSql(getActiveConnectionId(), sql, error);

        if (result.error) {
            resultDiv.className = 'ai-fix-result ai-fix-error';
            resultDiv.innerHTML = `<div class="ai-fix-msg">${escapeHtml(result.message)}</div>`;
        } else {
            let html = `<div class="ai-fix-msg">${formatAiMessage(result.message)}</div>`;
            if (result.sql) {
                html += `<div class="ai-fix-sql">
                    <div class="ai-sql-header">
                        <span>Suggested Fix</span>
                        <button class="btn btn-primary btn-xs" id="btn-apply-fix">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Apply
                        </button>
                    </div>
                    <pre class="ai-sql-code">${escapeHtml(result.sql)}</pre>
                </div>`;
            }
            resultDiv.className = 'ai-fix-result ai-fix-success';
            resultDiv.innerHTML = html;

            // Attach apply button handler
            if (result.sql) {
                const applyBtn = document.getElementById('btn-apply-fix');
                if (applyBtn) {
                    applyBtn.onclick = () => {
                        if (monacoEditor) {
                            monacoEditor.setValue(result.sql);
                            monacoEditor.focus();
                            updateStatus('Fixed SQL applied to editor');
                        }
                    };
                }
            }
        }
    } catch (e) {
        resultDiv.className = 'ai-fix-result ai-fix-error';
        resultDiv.innerHTML = `<div class="ai-fix-msg">AI analysis failed: ${escapeHtml(e.message)}</div>`;
    }
}

function displayError(msg) {
    const container = document.getElementById('result-content');
    const sql = getCurrentSql();
    container.innerHTML = `<div class="result-error">
        <div class="result-error-msg">${escapeHtml(msg)}</div>
        ${getActiveConnectionId() ? `<button class="btn btn-ghost btn-sm ai-fix-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4c0 2.8 4 6 4 6s4-3.2 4-6a4 4 0 0 0-4-4z"/><circle cx="12" cy="6" r="1.5"/></svg>
            Ask AI to Fix
        </button>` : ''}
        <div id="ai-fix-result" style="display:none;"></div>
    </div>`;
    const fixBtn = container.querySelector('.ai-fix-btn');
    if (fixBtn) fixBtn.addEventListener('click', () => askAiToFix(msg));
    updateStatus(msg, true);
    state.lastError = { sql, errorMessage: msg };
}

// ============================================================
// Connection Dialog
// ============================================================
function showConnectionDialog(existing) {
    state.editingConnectionId = existing ? existing.id : null;
    document.getElementById('conn-dialog-title').textContent = existing ? 'Edit Connection' : 'New Connection';

    document.getElementById('conn-name').value = existing ? existing.name : '';
    document.getElementById('conn-group').value = existing?.properties?.group || '';
    document.getElementById('conn-color').value = existing?.properties?.color || '';
    document.getElementById('conn-type').value = existing ? existing.databaseType : 'MYSQL';
    document.getElementById('conn-host').value = existing ? (existing.host || 'localhost') : 'localhost';
    document.getElementById('conn-port').value = existing ? existing.port : DEFAULT_PORTS['MYSQL'];
    document.getElementById('conn-database').value = existing ? (existing.database || '') : '';
    document.getElementById('conn-username').value = existing ? (existing.username || '') : '';
    document.getElementById('conn-password').value = existing ? (existing.password || '') : '';
    document.getElementById('conn-region').value = existing?.properties?.region || 'us-east-1';
    document.getElementById('conn-s3output').value = existing?.properties?.s3Output || '';

    // SSH tunnel dropdown
    populateTunnelDropdown(existing?.properties?.sshTunnelId || '');

    updateDialogFields();
    document.getElementById('conn-dialog').style.display = 'flex';
}

function hideConnectionDialog() {
    document.getElementById('conn-dialog').style.display = 'none';
    state.editingConnectionId = null;
}

function updateDialogFields() {
    const type = document.getElementById('conn-type').value;
    const isSQLite = type === 'SQLITE';
    const isAthena = type === 'ATHENA';
    const isStandard = !isSQLite && !isAthena;

    document.getElementById('row-host').style.display = isStandard ? '' : 'none';
    document.getElementById('row-port').style.display = isStandard ? '' : 'none';
    document.getElementById('row-username').style.display = isStandard ? '' : 'none';
    document.getElementById('row-password').style.display = isStandard ? '' : 'none';
    document.getElementById('row-region').style.display = isAthena ? '' : 'none';
    document.getElementById('row-s3output').style.display = isAthena ? '' : 'none';

    if (isStandard) {
        document.getElementById('conn-port').placeholder = String(DEFAULT_PORTS[type] || '');
    }
}

function populateTunnelDropdown(selectedId) {
    const sel = document.getElementById('conn-ssh-tunnel');
    sel.innerHTML = '<option value="">None (Direct)</option>';
    state.tunnels.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name || (t.username + '@' + t.host);
        if (t.id === selectedId) opt.selected = true;
        sel.appendChild(opt);
    });
}

function buildConnectionInfo() {
    const type = document.getElementById('conn-type').value;
    const info = {
        name: document.getElementById('conn-name').value || type,
        databaseType: type,
        host: document.getElementById('conn-host').value,
        port: parseInt(document.getElementById('conn-port').value) || DEFAULT_PORTS[type],
        database: document.getElementById('conn-database').value,
        username: document.getElementById('conn-username').value,
        password: document.getElementById('conn-password').value,
        properties: {}
    };
    // Group & Color
    const group = document.getElementById('conn-group').value.trim();
    if (group) info.properties.group = group;
    const color = document.getElementById('conn-color').value;
    if (color) info.properties.color = color;

    if (type === 'ATHENA') {
        info.properties.region = document.getElementById('conn-region').value;
        info.properties.s3Output = document.getElementById('conn-s3output').value;
    }
    // SSH tunnel reference
    const tunnelId = document.getElementById('conn-ssh-tunnel').value;
    if (tunnelId) {
        info.properties.sshTunnelId = tunnelId;
    }
    return info;
}

async function saveConnection() {
    const info = buildConnectionInfo();
    try {
        if (state.editingConnectionId) {
            await api.connections.update(state.editingConnectionId, info);
        } else {
            await api.connections.create(info);
        }
        hideConnectionDialog();
        await loadConnections();
    } catch (e) {
        alert('Failed to save: ' + e.message);
    }
}

async function testConnection() {
    const info = buildConnectionInfo();
    const btn = document.getElementById('btn-test-conn');
    btn.textContent = 'Testing...';
    btn.disabled = true;
    try {
        const result = await api.connections.test(info);
        alert(result.success ? 'Connection successful!' : 'Connection failed!');
    } catch (e) {
        alert('Connection failed: ' + e.message);
    } finally {
        btn.textContent = 'Test';
        btn.disabled = false;
    }
}

// ============================================================
// Context Menu
// ============================================================
let contextConn = null;
let contextNode = null;

function showContextMenu(e, conn, node) {
    e.preventDefault();
    contextConn = conn;
    contextNode = node;
    const menu = document.getElementById('context-menu');
    menu.style.display = 'block';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
}

function hideContextMenu() {
    document.getElementById('context-menu').style.display = 'none';
}

async function handleContextAction(action) {
    hideContextMenu();
    if (!contextConn) return;

    switch (action) {
        case 'assign-to-current-tab':
        case 'connect': // legacy alias
            activateConnection(contextConn, contextNode);
            break;
        case 'open-in-new-tab':
            // Spawn a new SQL tab, assign this connection to it, then activate.
            addEditorTab();
            activateConnection(contextConn, contextNode);
            break;
        case 'disconnect':
            await api.connections.disconnect(contextConn.id);
            if (state.autocompleteCache?.connectionId === contextConn.id) clearAutoCompleteCache();
            detachConnectionFromTabs(contextConn.id);
            contextNode.classList.remove('expanded');
            contextNode.querySelector('.tree-children').innerHTML = '';
            updateStatus('Disconnected');
            break;
        case 'refresh':
            activateConnection(contextConn, contextNode);
            break;
        case 'edit':
            showConnectionDialog(contextConn);
            break;
        case 'clone':
            const cloned = { ...contextConn, name: contextConn.name + ' (Copy)', properties: { ...contextConn.properties } };
            delete cloned.id;
            await api.connections.create(cloned);
            await loadConnections();
            updateStatus(`Cloned: ${cloned.name}`);
            break;
        case 'delete':
            if (confirm(`Delete connection "${contextConn.name}"?`)) {
                await api.connections.delete(contextConn.id);
                if (state.autocompleteCache?.connectionId === contextConn.id) clearAutoCompleteCache();
                detachConnectionFromTabs(contextConn.id);
                await loadConnections();
            }
            break;
    }
}

// ============================================================
// Export
// ============================================================
async function exportData(format) {
    if (!getActiveConnectionId() || !state.lastResult) {
        updateStatus('No query result to export', true);
        return;
    }
    try {
        const { connectionId, sql } = state.lastResult;
        if (format === 'insert') {
            const tableName = state.resultData?.tableName || prompt('Table name for INSERT statements:', 'my_table');
            if (!tableName) return;
            await api.export.insert(connectionId, sql, tableName);
        } else if (format === 'json') {
            await api.export.json(connectionId, sql);
        } else if (format === 'xlsx') {
            await api.export.xlsx(connectionId, sql);
        } else if (format === 'xml') {
            await api.export.xml(connectionId, sql);
        } else {
            await api.export.csv(connectionId, sql);
        }
        updateStatus(`Exported as ${format.toUpperCase()}`);
    } catch (e) {
        updateStatus('Export failed: ' + e.message, true);
    }
}

// backward compat alias
async function exportCsv() { return exportData('csv'); }

// ============================================================
// Global Right Panel (#99)
// ============================================================
const RightPanel = (() => {
    const LS_OPEN = 'dbee.rightPanel.open';
    const LS_ACTIVE = 'dbee.rightPanel.activeTab';
    const LS_WIDTH = 'dbee.rightPanel.width';
    const MIN_WIDTH = 240;
    const MAX_WIDTH = 720;
    const DEFAULT_WIDTH = 320;

    const tabs = new Map();
    let panelEl, resizerEl, tabListEl, bodyEl, closeBtn, toggleBtn;
    let activeId = null;
    let isOpen = false;
    let ready = false;

    function readWidth() {
        const v = parseInt(localStorage.getItem(LS_WIDTH), 10);
        if (!isFinite(v)) return DEFAULT_WIDTH;
        return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, v));
    }

    function applyOpenState() {
        if (!panelEl) return;
        if (isOpen) {
            panelEl.classList.remove('grp-hidden');
            resizerEl.classList.remove('grp-hidden');
            toggleBtn && toggleBtn.classList.add('active');
        } else {
            panelEl.classList.add('grp-hidden');
            resizerEl.classList.add('grp-hidden');
            toggleBtn && toggleBtn.classList.remove('active');
        }
        try { localStorage.setItem(LS_OPEN, isOpen ? '1' : '0'); } catch (e) {}
    }

    function renderTabButtons() {
        if (!tabListEl) return;
        tabListEl.innerHTML = '';
        for (const t of tabs.values()) {
            const btn = document.createElement('button');
            btn.className = 'grp-tab' + (t.id === activeId ? ' active' : '');
            btn.setAttribute('role', 'tab');
            btn.setAttribute('data-tab-id', t.id);
            btn.setAttribute('aria-selected', t.id === activeId ? 'true' : 'false');
            btn.title = t.tooltip || t.label;
            if (t.icon) btn.insertAdjacentHTML('beforeend', t.icon);
            const label = document.createElement('span');
            label.textContent = t.label;
            btn.appendChild(label);
            btn.onclick = () => setActive(t.id);
            t.btnEl = btn;
            tabListEl.appendChild(btn);
        }
    }

    function ensurePane(tab) {
        if (!tab.paneEl) {
            const pane = document.createElement('div');
            pane.className = 'grp-tab-pane';
            pane.setAttribute('data-tab-pane', tab.id);
            bodyEl.appendChild(pane);
            tab.paneEl = pane;
        }
        if (!tab.mounted && typeof tab.render === 'function') {
            try { tab.render(tab.paneEl); }
            catch (e) { console.error('[RightPanel] tab render error', tab.id, e); }
            tab.mounted = true;
        }
    }

    function showActivePane() {
        if (!bodyEl) return;
        bodyEl.querySelectorAll('.grp-tab-pane').forEach(p => p.classList.remove('active'));
        tabListEl.querySelectorAll('.grp-tab').forEach(b => {
            const id = b.getAttribute('data-tab-id');
            b.classList.toggle('active', id === activeId);
            b.setAttribute('aria-selected', id === activeId ? 'true' : 'false');
        });
        if (!activeId) return;
        const tab = tabs.get(activeId);
        if (!tab) return;
        ensurePane(tab);
        tab.paneEl.classList.add('active');
    }

    function setActive(tabId) {
        if (!tabs.has(tabId)) return;
        activeId = tabId;
        try { localStorage.setItem(LS_ACTIVE, tabId); } catch (e) {}
        showActivePane();
    }

    function open(tabId) {
        if (!ready) { isOpen = true; return; }
        if (tabId && tabs.has(tabId)) {
            activeId = tabId;
            try { localStorage.setItem(LS_ACTIVE, tabId); } catch (e) {}
        } else if (!activeId && tabs.size > 0) {
            activeId = tabs.keys().next().value;
        }
        isOpen = true;
        applyOpenState();
        showActivePane();
    }

    function close() {
        isOpen = false;
        applyOpenState();
    }

    function toggle() {
        if (isOpen) close(); else open();
    }

    function setWidth(px) {
        const w = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(px)));
        if (panelEl) panelEl.style.width = w + 'px';
        try { localStorage.setItem(LS_WIDTH, String(w)); } catch (e) {}
    }

    function registerTab(tab) {
        if (!tab || !tab.id || !tab.label) {
            throw new Error('RightPanel.registerTab requires {id, label}');
        }
        tabs.set(tab.id, {
            id: tab.id,
            label: tab.label,
            tooltip: tab.tooltip || '',
            icon: tab.icon || '',
            render: tab.render,
            mounted: false,
            paneEl: null,
            btnEl: null,
        });
        if (ready) {
            renderTabButtons();
            if (isOpen) showActivePane();
        }
    }

    function initResize() {
        let resizing = false;
        resizerEl.addEventListener('mousedown', (e) => {
            resizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!resizing) return;
            const w = window.innerWidth - e.clientX;
            setWidth(w);
        });
        document.addEventListener('mouseup', () => {
            if (resizing) {
                resizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }

    function init() {
        panelEl = document.getElementById('global-right-panel');
        resizerEl = document.getElementById('global-right-resizer');
        tabListEl = document.getElementById('grp-tab-list');
        bodyEl = document.getElementById('grp-body');
        closeBtn = document.getElementById('grp-close');
        toggleBtn = document.getElementById('btn-toggle-right-panel');

        if (!panelEl) return;

        panelEl.style.width = readWidth() + 'px';

        const savedActive = localStorage.getItem(LS_ACTIVE);
        if (savedActive) activeId = savedActive;
        const savedOpen = localStorage.getItem(LS_OPEN) === '1';

        closeBtn && (closeBtn.onclick = close);
        initResize();

        // Built-in placeholder tab — future tabs (#100~#107) may replace/extend
        registerTab({
            id: 'inspector',
            label: 'Inspector',
            icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
            render: (el) => {
                el.innerHTML = '<div class="grp-empty">'
                    + '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
                    + '<div>컨텍스트 정보가 여기에 표시됩니다.</div>'
                    + '<div style="font-size:11px;opacity:0.7">테이블·행·쿼리 선택 시 상세 정보 (후속 작업)</div>'
                    + '</div>';
            },
        });

        ready = true;
        renderTabButtons();

        if (savedOpen) {
            open(activeId);
        } else {
            applyOpenState();
        }
    }

    return { init, registerTab, open, close, toggle, setActive, setWidth };
})();

// ============================================================
// Helper: insert SQL into current SQL editor (or open new tab if ERD active)
// ============================================================
function insertSqlSmart(sql) {
    if (!sql) return;
    const active = state.editors ? state.editors.find(t => t.id === state.activeEditorId) : null;
    const isSqlTab = active && active.type === 'sql';
    if (!isSqlTab) {
        addEditorTab();
    }
    if (typeof monacoEditor === 'undefined' || !monacoEditor) return;
    const sel = monacoEditor.getSelection();
    const model = monacoEditor.getModel();
    // If editor is empty, just set; otherwise insert at cursor/selection
    if (!model.getValue().trim()) {
        monacoEditor.setValue(sql);
    } else {
        monacoEditor.executeEdits('smart-insert', [{
            range: sel,
            text: sql,
            forceMoveMarkers: true,
        }]);
    }
    monacoEditor.focus();
}

// ============================================================
// Inspector Tab (#100)
// ============================================================
const Inspector = (() => {
    let rootEl = null;
    let current = null; // { type:'table', connId, schema, table }

    function show(target) {
        current = target;
        if (rootEl) renderContent();
    }

    function clear() {
        current = null;
        if (rootEl) renderContent();
    }

    function renderEmpty() {
        rootEl.innerHTML = `
            <div class="grp-empty">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <div>선택된 대상이 없습니다.</div>
                <div style="font-size:11px;opacity:0.7">Explorer에서 테이블을 클릭하면 컬럼·인덱스 정보가 표시됩니다.</div>
            </div>`;
    }

    function renderLoading(target) {
        rootEl.innerHTML = `
            <div class="insp-header">
                <div class="insp-title">${escapeHtml(target.schema)}.<strong>${escapeHtml(target.table)}</strong></div>
            </div>
            <div class="insp-section"><div class="insp-loading">Loading…</div></div>`;
    }

    async function renderTable(target) {
        renderLoading(target);
        let columns = [], indexes = [];
        try { columns = await api.metadata.columns(target.connId, target.schema, target.table); } catch (e) {}
        try { indexes = await api.metadata.indexes(target.connId, target.schema, target.table); } catch (e) {}
        if (current !== target) return; // target changed during load

        const pkCols = new Set(columns.filter(c => c.primaryKey || c.pk).map(c => c.name));
        const colRows = columns.map(c => {
            const isPk = pkCols.has(c.name) || c.primaryKey || c.pk;
            const nullable = (c.nullable === true || c.nullable === 'YES' || c.isNullable === true) ? 'YES' : 'NO';
            return `<tr>
                <td>${isPk ? '<span class="insp-pk" title="Primary Key">PK</span>' : ''}</td>
                <td>${escapeHtml(c.name || '')}</td>
                <td class="insp-type">${escapeHtml(c.typeName || c.type || '')}</td>
                <td class="insp-nullable">${nullable}</td>
            </tr>`;
        }).join('');

        const idxRows = (indexes || []).map(ix => {
            const cols = (ix.columnNames || ix.columns || []).join(', ');
            const tag = ix.unique ? '<span class="insp-badge insp-badge-uniq">UNIQUE</span>' : '';
            return `<tr>
                <td>${escapeHtml(ix.name || '')}</td>
                <td>${escapeHtml(cols)}</td>
                <td>${tag}</td>
            </tr>`;
        }).join('');

        rootEl.innerHTML = `
            <div class="insp-header">
                <div class="insp-title">${escapeHtml(target.schema)}.<strong>${escapeHtml(target.table)}</strong></div>
                <div class="insp-sub">${columns.length} columns · ${(indexes||[]).length} indexes</div>
                <div class="insp-actions">
                    <button class="btn btn-ghost btn-sm insp-btn-select">SELECT *</button>
                    <button class="btn btn-ghost btn-sm insp-btn-ddl">DDL</button>
                </div>
            </div>
            <div class="insp-section">
                <div class="insp-section-title">Columns</div>
                <table class="insp-table">
                    <thead><tr><th></th><th>Name</th><th>Type</th><th>Nullable</th></tr></thead>
                    <tbody>${colRows || '<tr><td colspan="4" class="insp-empty-row">(no columns)</td></tr>'}</tbody>
                </table>
            </div>
            <div class="insp-section">
                <div class="insp-section-title">Indexes</div>
                <table class="insp-table">
                    <thead><tr><th>Name</th><th>Columns</th><th>Unique</th></tr></thead>
                    <tbody>${idxRows || '<tr><td colspan="3" class="insp-empty-row">(no indexes)</td></tr>'}</tbody>
                </table>
            </div>`;

        rootEl.querySelector('.insp-btn-select').onclick = () => {
            insertSqlSmart(buildSelectAll(target.connId, target.schema, target.table));
        };
        rootEl.querySelector('.insp-btn-ddl').onclick = async () => {
            try {
                const res = await api.metadata.ddl(target.connId, target.schema, target.table);
                if (res && res.ddl) insertSqlSmart(res.ddl);
            } catch (e) {
                updateStatus('Failed to load DDL: ' + e.message, true);
            }
        };
    }

    function renderContent() {
        if (!current) { renderEmpty(); return; }
        if (current.type === 'table') { renderTable(current); return; }
        renderEmpty();
    }

    function render(el) {
        rootEl = el;
        el.classList.add('insp-root');
        renderContent();
    }

    return { render, show, clear };
})();

// ============================================================
// History Tab (#102)
// ============================================================
const HistoryTab = (() => {
    let rootEl = null;
    let section = 'recent'; // 'recent' | 'saved'

    function insertSqlIntoEditor(sql) {
        insertSqlSmart(sql);
    }

    async function refresh() {
        const listEl = rootEl.querySelector('.hist-list');
        if (!listEl) return;
        listEl.innerHTML = '<div class="hist-loading">Loading…</div>';
        try {
            if (section === 'recent') {
                const items = await api.history.list('', 30);
                renderRecent(items || []);
            } else {
                const items = await api.savedQueries.list();
                renderSaved(items || []);
            }
        } catch (e) {
            listEl.innerHTML = `<div class="hist-empty">Failed to load: ${escapeHtml(e.message)}</div>`;
        }
    }

    function renderRecent(items) {
        const listEl = rootEl.querySelector('.hist-list');
        if (items.length === 0) {
            listEl.innerHTML = '<div class="hist-empty">No recent queries.</div>';
            return;
        }
        listEl.innerHTML = '';
        items.forEach(it => {
            const el = document.createElement('div');
            el.className = 'hist-item' + (it.error ? ' hist-item-error' : '');
            el.innerHTML = `
                <div class="hist-item-sql">${escapeHtml((it.sql || '').slice(0, 200))}</div>
                <div class="hist-item-meta">
                    <span>${typeof formatRelativeTime === 'function' ? formatRelativeTime(it.executedAt) : ''}</span>
                    <span>${escapeHtml(it.connectionName || '')}</span>
                    <span>${it.executionTimeMs != null ? it.executionTimeMs + 'ms' : ''}</span>
                </div>`;
            el.onclick = () => insertSqlIntoEditor(it.sql);
            listEl.appendChild(el);
        });
    }

    function renderSaved(items) {
        const listEl = rootEl.querySelector('.hist-list');
        if (items.length === 0) {
            listEl.innerHTML = '<div class="hist-empty">No saved queries.<br><span style="opacity:0.7">Ctrl+S로 현재 쿼리 저장 가능</span></div>';
            return;
        }
        listEl.innerHTML = '';
        items.forEach(it => {
            const el = document.createElement('div');
            el.className = 'hist-item';
            el.innerHTML = `
                <div class="hist-item-name">${escapeHtml(it.name || '(untitled)')}</div>
                <div class="hist-item-sql">${escapeHtml((it.sql || '').slice(0, 200))}</div>`;
            el.onclick = () => insertSqlIntoEditor(it.sql);
            listEl.appendChild(el);
        });
    }

    function setSection(s) {
        section = s;
        rootEl.querySelectorAll('.hist-section-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.section === s);
        });
        refresh();
    }

    function render(el) {
        rootEl = el;
        el.classList.add('hist-root');
        el.innerHTML = `
            <div class="hist-switcher">
                <button class="hist-section-btn active" data-section="recent">Recent</button>
                <button class="hist-section-btn" data-section="saved">Saved</button>
                <button class="hist-refresh-btn" title="Refresh">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                </button>
            </div>
            <div class="hist-list"></div>`;
        el.querySelectorAll('.hist-section-btn').forEach(b => {
            b.onclick = () => setSection(b.dataset.section);
        });
        el.querySelector('.hist-refresh-btn').onclick = () => refresh();
        refresh();
    }

    return { render, refresh };
})();

// ============================================================
// AI Chat Tab (#101) — migrates existing overlay into RightPanel tab
// ============================================================
const AiChatTab = (() => {
    let migrated = false;

    function render(el) {
        if (migrated) {
            // Re-attach existing nodes if rendered before (tab re-mount fallback)
            return;
        }
        const overlay = document.getElementById('ai-chat-panel');
        if (!overlay) return;

        // Hide the close button in the migrated header (panel close handled by grp-close)
        const closeBtn = overlay.querySelector('#btn-ai-chat-close');
        if (closeBtn) closeBtn.style.display = 'none';

        // Move all child nodes from overlay into tab pane
        while (overlay.firstChild) {
            el.appendChild(overlay.firstChild);
        }
        // Hide the now-empty overlay wrapper
        overlay.style.display = 'none';
        el.classList.add('ai-chat-pane');
        migrated = true;

        // Focus input when visible
        const input = document.getElementById('ai-chat-input');
        if (input) setTimeout(() => input.focus(), 50);
    }

    return { render };
})();

// ============================================================
// Resizers
// ============================================================
function initResizers() {
    // Vertical (left-right panel)
    const resizer = document.getElementById('resizer');
    const leftPanel = document.getElementById('left-panel');
    let isResizing = false;

    resizer.onmousedown = (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    };

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        leftPanel.style.width = Math.max(150, Math.min(600, e.clientX)) + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });

    // Horizontal (editor-results)
    const hResizer = document.getElementById('h-resizer');
    const resultPanel = document.getElementById('result-panel');
    let isHResizing = false;

    hResizer.onmousedown = (e) => {
        isHResizing = true;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    };

    document.addEventListener('mousemove', (e) => {
        if (!isHResizing) return;
        const rightPanel = document.getElementById('right-panel');
        const rect = rightPanel.getBoundingClientRect();
        const newHeight = rect.bottom - e.clientY;
        resultPanel.style.height = Math.max(80, Math.min(rect.height - 100, newHeight)) + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isHResizing) {
            isHResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// ============================================================
// Status Bar
// ============================================================
function updateStatus(message, isError = false, rowCount = -1, timeMs = -1) {
    const connEl = document.getElementById('status-connection');
    const dot = document.getElementById('status-dot');
    const badge = document.getElementById('toolbar-conn-badge');
    const badgeDot = badge ? badge.querySelector('.badge-dot') : null;
    const badgeText = badge ? badge.querySelector('.badge-text') : null;

    connEl.textContent = message;

    dot.className = 'status-indicator';
    if (isError) {
        dot.classList.add('error');
    } else if (message.startsWith('Connected')) {
        dot.classList.add('connected');
        if (badgeDot) badgeDot.classList.add('connected');
        if (badgeText) badgeText.textContent = message.replace('Connected: ', '');
    }

    if (isError) {
        connEl.style.color = 'var(--error)';
    } else {
        connEl.style.color = '';
    }

    document.getElementById('status-rows').textContent = rowCount >= 0 ? `${rowCount} rows` : '';
    document.getElementById('status-time').textContent = timeMs >= 0 ? `${timeMs} ms` : '';

    // Update result summary in header
    const summary = document.getElementById('result-summary');
    if (summary) {
        if (rowCount >= 0 && timeMs >= 0) {
            summary.textContent = `${rowCount} rows in ${timeMs}ms`;
        } else {
            summary.textContent = '';
        }
    }
}

// ============================================================
// Utils
// ============================================================
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================================
// Load Connections
// ============================================================
async function loadConnections() {
    try {
        [state.connections, state.tunnels] = await Promise.all([
            api.connections.list(),
            api.tunnels.list()
        ]);
        renderTree();
        // Check for connections that need password re-entry
        checkPasswordReentry();
    } catch (e) {
        console.error('Failed to load connections:', e);
    }
}

async function checkPasswordReentry() {
    try {
        const result = await api.request('GET', '/api/connections/password-reentry-required');
        if (result.required && result.connectionIds.length > 0) {
            const names = result.connectionIds.map(id => {
                const conn = state.connections.find(c => c.id === id);
                return conn ? conn.name : id;
            });
            showPasswordReentryNotification(names, result.connectionIds);
        }
    } catch (e) {
        console.error('Failed to check password re-entry status:', e);
    }
}

function showPasswordReentryNotification(names, ids) {
    // Remove existing notification if any
    const existing = document.getElementById('password-reentry-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'password-reentry-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10000;background:#e74c3c;color:#fff;padding:10px 20px;display:flex;align-items:center;gap:12px;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    banner.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
        </svg>
        <span style="flex:1">
            <strong>Password re-entry required:</strong>
            The encryption key has changed. Please re-enter passwords for:
            <strong>${escapeHtml(names.join(', '))}</strong>
        </span>
        <button onclick="passwordReentryEditFirst('${escapeHtml(ids[0])}')" style="background:#fff;color:#e74c3c;border:none;padding:5px 14px;border-radius:4px;cursor:pointer;font-weight:600;font-size:12px;">
            Edit Connection
        </button>
        <button onclick="this.parentElement.remove()" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.5);padding:5px 10px;border-radius:4px;cursor:pointer;font-size:12px;">
            Dismiss
        </button>
    `;
    document.body.prepend(banner);
}

function passwordReentryEditFirst(connId) {
    const conn = state.connections.find(c => c.id === connId);
    if (conn) {
        showConnectionDialog(conn);
        // Remove the banner
        const banner = document.getElementById('password-reentry-banner');
        if (banner) banner.remove();
    }
}

// ============================================================
// ERD Tab (React Flow via /js/erd-react.js bridge)
// ============================================================
// All heavy-lifting is in erd-react.js (loaded as ES module). This file
// just wires the vanilla toolbar/tab UI to the React Flow instance via
// the `window.erdReact` bridge object.

async function initErdTab(tab) {
    const canvas = document.getElementById('erd-canvas');
    showErdStatus('Loading schema metadata...');
    let graph;
    try {
        graph = await api.metadata.erGraph(tab.connId, tab.schema);
    } catch (e) {
        canvas.innerHTML = `<div style="padding:20px;color:var(--error)">Failed to load ERD: ${escapeHtml(e.message)}</div>`;
        hideErdStatus();
        return;
    }

    // Restore options
    const savedOpts = JSON.parse(localStorage.getItem('dbee-erd-options') || '{}');
    tab.options = Object.assign({
        layout: 'force',
        edgeStyle: 'bezier',
        hideColumns: false,
        hideTypes: false,
        pkFkOnly: false,
        focusMode: false,
        minimap: false,
    }, savedOpts);
    tab.graph = graph;

    // Load saved positions
    let savedLayout = null;
    try { savedLayout = await api.erdLayout.get(tab.connId, tab.schema); } catch (e) {}

    // Wait for erdReact module to finish loading
    if (!window.erdReact) {
        await new Promise(r => {
            const iv = setInterval(() => { if (window.erdReact) { clearInterval(iv); r(); } }, 50);
        });
    }

    // Clear canvas and mount React Flow
    canvas.innerHTML = '';
    await window.erdReact.mount(canvas, {
        graph,
        savedLayout,
        options: tab.options,
        onPositionsChange: (layout) => {
            // Persist to server
            api.erdLayout.save(tab.connId, tab.schema, {
                version: 1,
                zoom: layout.zoom,
                pan: layout.viewport ? { x: layout.viewport.x, y: layout.viewport.y } : { x: 0, y: 0 },
                positions: layout.positions,
            }).then(() => showErdStatus('Layout saved', 1500))
              .catch(() => {});
        },
        onTableDoubleClick: (tableName) => {
            const sql = buildSelectAll(tab.connId, tab.schema, tableName);
            addEditorTab();
            const newTab = state.editors[state.editors.length - 1];
            if (newTab && newTab.model) newTab.model.setValue(sql);
        },
    });

    // Sync toolbar state with stored options
    const layoutSel = document.getElementById('erd-layout-select');
    if (layoutSel) layoutSel.value = tab.options.layout || 'force';
    const edgeSel = document.getElementById('erd-edge-style');
    if (edgeSel) edgeSel.value = tab.options.edgeStyle || 'bezier';
    ['hide-cols','hide-types','pkfk','focus','minimap'].forEach(k => {
        const map = {'hide-cols':'hideColumns','hide-types':'hideTypes','pkfk':'pkFkOnly','focus':'focusMode','minimap':'minimap'};
        const el = document.getElementById('erd-opt-' + k);
        if (el) el.checked = !!tab.options[map[k]];
    });
    updateErdZoomLabel(tab);
    wireErdToolbar();

    hideErdStatus();
}

function saveErdOptions(tab) {
    try { localStorage.setItem('dbee-erd-options', JSON.stringify(tab.options)); } catch (e) {}
}

function getActiveErdTab() {
    const tab = state.editors.find(t => t.id === state.activeEditorId);
    return tab && tab.type === 'erd' ? tab : null;
}

function showErdStatus(msg, autoHideMs = 0) {
    const el = document.getElementById('erd-status');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visible');
    if (autoHideMs > 0) setTimeout(() => el.classList.remove('visible'), autoHideMs);
}
function hideErdStatus() {
    const el = document.getElementById('erd-status');
    if (el) el.classList.remove('visible');
}

async function updateErdZoomLabel(tab) {
    const el = document.getElementById('erd-zoom-label');
    if (!el) return;
    try {
        const z = await window.erdReact.getZoom();
        el.textContent = Math.round(z * 100) + '%';
    } catch (e) {}
}

// Toolbar wiring — runs once, reads the active ERD tab at invocation time.
let _erdToolbarWired = false;
function wireErdToolbar() {
    if (_erdToolbarWired) return;
    _erdToolbarWired = true;

    document.getElementById('erd-layout-select').addEventListener('change', async (e) => {
        const tab = getActiveErdTab();
        if (!tab) return;
        tab.options.layout = e.target.value;
        saveErdOptions(tab);
        await window.erdReact.runLayout(e.target.value);
    });

    document.getElementById('erd-btn-arrange').addEventListener('click', async () => {
        const tab = getActiveErdTab();
        if (!tab) return;
        await window.erdReact.runLayout(tab.options.layout || 'dagre-lr');
    });

    const edgeStyleSel = document.getElementById('erd-edge-style');
    if (edgeStyleSel) {
        edgeStyleSel.addEventListener('change', async (e) => {
            const tab = getActiveErdTab();
            if (!tab) return;
            tab.options.edgeStyle = e.target.value;
            saveErdOptions(tab);
            await window.erdReact.setOptions({ edgeStyle: e.target.value });
        });
    }

    const bindOpt = (id, key) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', async (e) => {
            const tab = getActiveErdTab();
            if (!tab) return;
            tab.options[key] = e.target.checked;
            saveErdOptions(tab);
            await window.erdReact.setOptions({ [key]: e.target.checked });
        });
    };
    bindOpt('erd-opt-hide-cols', 'hideColumns');
    bindOpt('erd-opt-hide-types', 'hideTypes');
    bindOpt('erd-opt-pkfk', 'pkFkOnly');
    bindOpt('erd-opt-focus', 'focusMode');
    bindOpt('erd-opt-minimap', 'minimap');

    // Search
    const searchInput = document.getElementById('erd-search');
    let searchDeb = null;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDeb);
        searchDeb = setTimeout(async () => {
            await window.erdReact.searchHighlight(e.target.value);
        }, 200);
    });

    // Save / Reset / Export / Import
    document.getElementById('erd-btn-save').addEventListener('click', async () => {
        const tab = getActiveErdTab();
        if (!tab) return;
        const layout = await window.erdReact.getPositions();
        if (!layout) return;
        await api.erdLayout.save(tab.connId, tab.schema, {
            version: 1, zoom: layout.zoom,
            pan: layout.viewport ? { x: layout.viewport.x, y: layout.viewport.y } : { x: 0, y: 0 },
            positions: layout.positions,
        });
        showErdStatus('Layout saved', 1500);
    });

    document.getElementById('erd-btn-reset').addEventListener('click', async () => {
        const tab = getActiveErdTab();
        if (!tab) return;
        if (!confirm('Reset layout? Saved positions will be deleted and auto-layout re-run.')) return;
        try {
            await api.erdLayout.delete(tab.connId, tab.schema);
            await window.erdReact.runLayout(tab.options.layout || 'dagre-lr');
            showErdStatus('Layout reset', 1500);
        } catch (e) { showErdStatus('Reset failed: ' + e.message, 2500); }
    });

    // Export menu
    const exportBtn = document.getElementById('erd-btn-export');
    const exportMenu = document.getElementById('erd-export-menu');
    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.style.display = exportMenu.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', () => { exportMenu.style.display = 'none'; });
    exportMenu.querySelectorAll('div[data-fmt]').forEach(item => {
        item.addEventListener('click', async () => {
            exportMenu.style.display = 'none';
            const fmt = item.dataset.fmt;
            const tab = getActiveErdTab();
            if (tab) await erdExport(tab, fmt);
        });
    });

    // Import
    document.getElementById('erd-btn-import').addEventListener('click', () => {
        document.getElementById('erd-import-file').click();
    });
    document.getElementById('erd-import-file').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 1024 * 1024) { alert('File too large (>1MB)'); return; }
        const text = await file.text();
        try {
            const data = JSON.parse(text);
            await erdImport(getActiveErdTab(), data);
        } catch (err) { alert('Import failed: ' + err.message); }
        e.target.value = '';
    });

    // Zoom controls
    document.getElementById('erd-zoom-in').addEventListener('click', async () => {
        await window.erdReact.zoomIn();
        const tab = getActiveErdTab();
        if (tab) updateErdZoomLabel(tab);
    });
    document.getElementById('erd-zoom-out').addEventListener('click', async () => {
        await window.erdReact.zoomOut();
        const tab = getActiveErdTab();
        if (tab) updateErdZoomLabel(tab);
    });
    document.getElementById('erd-zoom-fit').addEventListener('click', async () => {
        await window.erdReact.fitView();
        const tab = getActiveErdTab();
        if (tab) updateErdZoomLabel(tab);
    });
    document.getElementById('erd-zoom-reset').addEventListener('click', async () => {
        await window.erdReact.resetZoom();
        const tab = getActiveErdTab();
        if (tab) updateErdZoomLabel(tab);
    });

    // Update zoom label on any zoom change (poll every 500ms while active)
    setInterval(async () => {
        const tab = getActiveErdTab();
        if (tab) updateErdZoomLabel(tab);
    }, 500);
}

// --------- Export / Import ----------
async function erdExport(tab, format) {
    const safeName = `${(tab.connName || 'conn').replace(/[^a-z0-9]+/gi,'_')}_${tab.schema}`;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    try {
        if (format === 'png' || format === 'svg') {
            // Capture the ERD viewport using dom-to-image via the bridge (HTMLToImage alternative)
            const view = document.querySelector('.rf-erd-wrapper .react-flow__viewport');
            const container = document.querySelector('.rf-erd-wrapper .react-flow');
            if (!view || !container) {
                showErdStatus('Nothing to export', 2000);
                return;
            }
            // Simple approach: serialize SVG via XMLSerializer for edges + inline node HTML
            if (format === 'svg') {
                // Basic SVG export: combine the React Flow SVG (edges) + HTML-foreignObject for nodes
                const rfSvg = container.querySelector('svg');
                if (rfSvg) {
                    const cloned = rfSvg.cloneNode(true);
                    cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                    const blob = new Blob([new XMLSerializer().serializeToString(cloned)],
                        { type: 'image/svg+xml' });
                    downloadBlob(blob, `${safeName}_${ts}.svg`);
                    showErdStatus('Exported SVG (edges only; use PNG for full export)', 2500);
                }
            } else {
                // PNG via canvas screenshot of the wrapper
                await erdPngExport(container, `${safeName}_${ts}.png`);
            }
        } else if (format === 'json') {
            const layout = await window.erdReact.getPositions();
            const positions = layout ? layout.positions : {};
            const graph = await window.erdReact.getGraph();
            const payload = {
                version: '1.0',
                meta: { connectionName: tab.connName, schema: tab.schema, exportedAt: new Date().toISOString() },
                options: tab.options,
                nodes: (graph ? graph.nodes : []).map(n => ({
                    id: n.id, label: n.label, columns: n.columns, comment: n.comment || '',
                    position: positions[n.id] || null,
                })),
                edges: graph ? graph.edges : [],
            };
            downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
                `${safeName}_${ts}.json`);
        } else {
            // Server-side text formats
            const result = await api.metadata.erExport(tab.connId, tab.schema, format);
            const extMap = { mermaid: 'mmd', dbml: 'dbml', ddl: 'sql', plantuml: 'puml' };
            const ext = extMap[format] || 'txt';
            downloadBlob(new Blob([result.content], { type: 'text/plain' }),
                `${safeName}_${ts}.${ext}`);
        }
        showErdStatus(`Exported as ${format.toUpperCase()}`, 2000);
    } catch (e) {
        console.error(e);
        showErdStatus(`Export failed: ${e.message}`, 3000);
    }
}

async function erdPngExport(container, filename) {
    // Minimal PNG export: use html2canvas pattern via SVG foreignObject → canvas
    const rect = container.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);
    // Serialize the container HTML into an SVG foreignObject
    const cloned = container.cloneNode(true);
    // Inline computed styles is complex; use a simpler approach: let browser do it
    const svgData = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <foreignObject width="100%" height="100%">
                <div xmlns="http://www.w3.org/1999/xhtml">${new XMLSerializer().serializeToString(cloned)}</div>
            </foreignObject>
        </svg>`;
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = document.body.dataset.theme === 'light' ? '#ffffff' : '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob(blob => downloadBlob(blob, filename), 'image/png');
}

async function erdImport(tab, data) {
    if (!tab) return;
    if (!data || !data.nodes) { alert('Invalid ERD JSON'); return; }
    const positions = {};
    data.nodes.forEach(n => { if (n.position && n.id) positions[n.id] = n.position; });
    if (data.options && typeof data.options === 'object') {
        tab.options = Object.assign(tab.options, data.options);
        saveErdOptions(tab);
        await window.erdReact.setOptions(data.options);
    }
    await window.erdReact.applyPositions(positions);
    await window.erdReact.fitView();
    showErdStatus(`Imported ${Object.keys(positions).length} positions`, 3000);
}

function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Menubar / toolbar handlers — callable without an ERD tab being focused
// (shows an alert if none is active).
async function menuErdExport(format) {
    const tab = getActiveErdTab();
    if (!tab) {
        alert('Open an ERD tab first (right-click a schema → Show ER Diagram).');
        return;
    }
    await erdExport(tab, format);
}

function menuErdImport() {
    const tab = getActiveErdTab();
    if (!tab) {
        alert('Open an ERD tab first (right-click a schema → Show ER Diagram).');
        return;
    }
    // Reuse the hidden file input already wired to erdImport
    const input = document.getElementById('erd-import-file');
    if (input) input.click();
}

// ============================================================
// Fast Tooltips — migrate native [title] to [data-tooltip] so CSS
// ::after can render without the browser's ~500ms delay.
// ============================================================
function migrateTooltip(el) {
    if (!el || el.nodeType !== 1) return;
    const t = el.getAttribute && el.getAttribute('title');
    if (t && !el.hasAttribute('data-tooltip')) {
        el.setAttribute('data-tooltip', t);
        el.removeAttribute('title');
    }
}

function initFastTooltips() {
    document.querySelectorAll('[title]').forEach(migrateTooltip);
    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            if (m.type === 'attributes' && m.attributeName === 'title') {
                migrateTooltip(m.target);
            } else if (m.type === 'childList') {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    migrateTooltip(node);
                    if (node.querySelectorAll) node.querySelectorAll('[title]').forEach(migrateTooltip);
                });
            }
        }
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['title'],
    });
}

// ============================================================
// Event Handlers
// ============================================================
function initEventHandlers() {
    document.getElementById('btn-add-conn').onclick = () => showConnectionDialog();
    document.getElementById('btn-run').onclick = () => executeQuery(false);
    const btnRunAll = document.getElementById('btn-run-all');
    if (btnRunAll) btnRunAll.onclick = () => executeQuery(true);
    document.getElementById('btn-explain').onclick = () => executeExplain(false);
    document.getElementById('btn-explain-analyze').onclick = () => executeExplain(true);
    document.getElementById('btn-format').onclick = formatSql;
    document.getElementById('btn-new-tab').onclick = () => addEditorTab();
    document.getElementById('btn-add-tab').onclick = () => addEditorTab();
    // Menu bar open/close logic
    let activeMenu = null;
    document.querySelectorAll('.menu-item').forEach(item => {
        const trigger = item.querySelector('.menu-trigger');
        trigger.onclick = (e) => {
            e.stopPropagation();
            if (activeMenu === item) {
                item.classList.remove('open');
                activeMenu = null;
            } else {
                if (activeMenu) activeMenu.classList.remove('open');
                item.classList.add('open');
                activeMenu = item;
            }
        };
        // Hover to switch menus when one is open
        trigger.onmouseenter = () => {
            if (activeMenu && activeMenu !== item) {
                activeMenu.classList.remove('open');
                item.classList.add('open');
                activeMenu = item;
            }
        };
    });
    // Close menu on outside click
    document.addEventListener('click', (e) => {
        if (activeMenu && !e.target.closest('.menu-item')) {
            activeMenu.classList.remove('open');
            activeMenu = null;
        }
    });
    // Close menu after action click
    document.querySelectorAll('.menu-action').forEach(action => {
        const orig = action.onclick;
        action.addEventListener('click', () => {
            if (activeMenu) { activeMenu.classList.remove('open'); activeMenu = null; }
        });
    });
    // Export options within menu
    document.querySelectorAll('.export-option').forEach(opt => {
        opt.onclick = () => exportData(opt.dataset.format);
    });

    // Connection dialog
    document.getElementById('conn-dialog-close').onclick = hideConnectionDialog;
    document.getElementById('btn-cancel-conn').onclick = hideConnectionDialog;
    document.getElementById('btn-save-conn').onclick = saveConnection;
    document.getElementById('btn-test-conn').onclick = testConnection;
    document.getElementById('conn-type').onchange = () => {
        updateDialogFields();
        const type = document.getElementById('conn-type').value;
        document.getElementById('conn-port').value = DEFAULT_PORTS[type] || '';
    };

    // SSH tunnel manager
    document.getElementById('btn-manage-tunnels').onclick = () => showTunnelManager();

    // Close modal on backdrop click
    document.getElementById('conn-dialog').onclick = (e) => {
        if (e.target.id === 'conn-dialog' || e.target.classList.contains('modal-backdrop')) hideConnectionDialog();
    };

    // Context menu
    document.querySelectorAll('.ctx-item').forEach(item => {
        item.onclick = () => handleContextAction(item.dataset.action);
    });
    document.addEventListener('click', hideContextMenu);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        const mod = e.ctrlKey || e.metaKey;

        // Ctrl/Cmd+Enter — Execute query
        if (mod && e.key === 'Enter') {
            e.preventDefault();
            executeQuery();
            return;
        }

        // Ctrl/Cmd+F — Focus result filter
        if (mod && e.key === 'f' && state.resultData) {
            const filterInput = document.getElementById('result-filter-input');
            if (filterInput && filterInput.offsetParent !== null) {
                e.preventDefault();
                filterInput.focus();
                filterInput.select();
                return;
            }
        }

        // Alt+N — New editor tab
        if (e.altKey && e.key === 'n') {
            e.preventDefault();
            addEditorTab();
            return;
        }

        // Alt+W — Close current tab
        if (e.altKey && e.key === 'w') {
            e.preventDefault();
            if (state.activeEditorId && state.editors.length > 1) {
                closeTab(state.activeEditorId);
            }
            return;
        }

        // Alt+1~9 — Switch to tab N
        if (e.altKey && e.key >= '1' && e.key <= '9') {
            e.preventDefault();
            const idx = parseInt(e.key) - 1;
            if (idx < state.editors.length) {
                switchTab(state.editors[idx].id);
            }
            return;
        }

        // Ctrl/Cmd+P — Command Palette
        if (mod && e.key === 'p') {
            e.preventDefault();
            showCommandPalette();
            return;
        }

        // Ctrl/Cmd+Shift+F — Format SQL
        if (mod && e.shiftKey && e.key === 'F') {
            e.preventDefault();
            formatSql();
            return;
        }

        // Ctrl/Cmd+Shift+R — Toggle Right Panel (overrides browser hard-refresh)
        if (mod && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
            e.preventDefault();
            if (typeof RightPanel !== 'undefined') RightPanel.toggle();
            return;
        }

        // Ctrl/Cmd+Shift+K — open active tab's connection dropdown (#124)
        if (mod && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
            e.preventDefault();
            openActiveTabConnectionMenu();
            return;
        }

        // Ctrl/Cmd+S — Save current query
        if (mod && e.key === 's') {
            e.preventDefault();
            saveCurrentQuery();
            return;
        }

        // Alt+S — Show saved queries
        if (e.altKey && e.key === 's') {
            e.preventDefault();
            showSavedQueriesDialog();
            return;
        }

        // Alt+H — Query History
        if (e.altKey && e.key === 'h') {
            e.preventDefault();
            showHistoryDialog();
            return;
        }

        // Alt+X — Export CSV
        if (e.altKey && e.key === 'x') {
            e.preventDefault();
            exportCsv();
            return;
        }

        // Escape — Close open modals/panels
        if (e.key === 'Escape') {
            // Close AI chat panel if open
            const chatPanel = document.getElementById('ai-chat-panel');
            if (chatPanel && chatPanel.style.display !== 'none') {
                closeAiChatPanel();
                return;
            }
            // Close any open modal
            const modals = document.querySelectorAll('.modal[style*="display: flex"], .modal[style*="display:flex"]');
            modals.forEach(m => m.style.display = 'none');
        }
    });

    // Result filter
    let filterTimer = null;
    document.getElementById('result-filter-input').addEventListener('input', (e) => {
        clearTimeout(filterTimer);
        filterTimer = setTimeout(() => {
            state.filterKeyword = e.target.value.trim();
            applyFilterAndSort();
        }, 200);
    });

    document.getElementById('result-filter-clear').onclick = () => {
        const input = document.getElementById('result-filter-input');
        input.value = '';
        state.filterKeyword = '';
        applyFilterAndSort();
        input.focus();
    };

    // Escape to clear filter
    document.getElementById('result-filter-input').addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.target.value = '';
            state.filterKeyword = '';
            applyFilterAndSort();
            e.target.blur();
        }
    });
}

// ============================================================
// SSH Tunnel Manager
// ============================================================
function showTunnelManager() {
    document.getElementById('tunnel-dialog').style.display = 'flex';
    renderTunnelList();
    hideTunnelEdit();
}

function hideTunnelManager() {
    document.getElementById('tunnel-dialog').style.display = 'none';
    // Refresh tunnel dropdown in connection dialog if open
    const connDialog = document.getElementById('conn-dialog');
    if (connDialog.style.display !== 'none') {
        const currentSel = document.getElementById('conn-ssh-tunnel').value;
        populateTunnelDropdown(currentSel);
    }
}

function renderTunnelList() {
    const list = document.getElementById('tunnel-list');
    if (state.tunnels.length === 0) {
        list.innerHTML = '<div class="tunnel-empty">No tunnels configured</div>';
        return;
    }
    list.innerHTML = '';
    state.tunnels.forEach(t => {
        const item = document.createElement('div');
        item.className = 'tunnel-item' + (t.id === state.editingTunnelId ? ' active' : '');
        item.innerHTML = `
            <span class="tunnel-item-icon"></span>
            <div>
                <div class="tunnel-item-name">${escapeHtml(t.name || 'Unnamed')}</div>
                <div class="tunnel-item-host">${escapeHtml(t.username + '@' + t.host + ':' + t.port)}</div>
            </div>
        `;
        item.onclick = () => editTunnel(t);
        list.appendChild(item);
    });
}

function editTunnel(tunnel) {
    state.editingTunnelId = tunnel.id;
    document.getElementById('tunnel-name').value = tunnel.name || '';
    document.getElementById('tunnel-host').value = tunnel.host || '';
    document.getElementById('tunnel-port').value = tunnel.port || 22;
    document.getElementById('tunnel-username').value = tunnel.username || '';
    document.getElementById('tunnel-auth-type').value = tunnel.authType || 'password';
    document.getElementById('tunnel-password').value = tunnel.password || '';
    document.getElementById('tunnel-key-path').value = tunnel.keyPath || '';
    document.getElementById('tunnel-passphrase').value = tunnel.keyPassphrase || '';
    updateTunnelAuthFields();
    document.getElementById('tunnel-edit').style.display = '';
    document.getElementById('btn-delete-tunnel').style.display = '';
    renderTunnelList();
}

function showNewTunnelForm() {
    state.editingTunnelId = null;
    document.getElementById('tunnel-name').value = '';
    document.getElementById('tunnel-host').value = '';
    document.getElementById('tunnel-port').value = '22';
    document.getElementById('tunnel-username').value = '';
    document.getElementById('tunnel-auth-type').value = 'password';
    document.getElementById('tunnel-password').value = '';
    document.getElementById('tunnel-key-path').value = '';
    document.getElementById('tunnel-passphrase').value = '';
    updateTunnelAuthFields();
    document.getElementById('tunnel-edit').style.display = '';
    document.getElementById('btn-delete-tunnel').style.display = 'none';
    renderTunnelList();
}

function hideTunnelEdit() {
    state.editingTunnelId = null;
    document.getElementById('tunnel-edit').style.display = 'none';
    renderTunnelList();
}

function updateTunnelAuthFields() {
    const authType = document.getElementById('tunnel-auth-type').value;
    document.getElementById('row-tunnel-password').style.display = authType === 'password' ? '' : 'none';
    document.getElementById('row-tunnel-key').style.display = authType === 'key' ? '' : 'none';
    document.getElementById('row-tunnel-passphrase').style.display = authType === 'key' ? '' : 'none';
}

function buildTunnelInfo() {
    return {
        name: document.getElementById('tunnel-name').value || 'Unnamed',
        host: document.getElementById('tunnel-host').value,
        port: parseInt(document.getElementById('tunnel-port').value) || 22,
        username: document.getElementById('tunnel-username').value,
        authType: document.getElementById('tunnel-auth-type').value,
        password: document.getElementById('tunnel-password').value,
        keyPath: document.getElementById('tunnel-key-path').value,
        keyPassphrase: document.getElementById('tunnel-passphrase').value,
    };
}

async function saveTunnel() {
    const info = buildTunnelInfo();
    try {
        if (state.editingTunnelId) {
            await api.tunnels.update(state.editingTunnelId, info);
        } else {
            await api.tunnels.create(info);
        }
        state.tunnels = await api.tunnels.list();
        hideTunnelEdit();
    } catch (e) {
        alert('Failed to save tunnel: ' + e.message);
    }
}

async function deleteTunnel() {
    if (!state.editingTunnelId) return;
    if (!confirm('Delete this SSH tunnel?')) return;
    try {
        await api.tunnels.delete(state.editingTunnelId);
        state.tunnels = await api.tunnels.list();
        hideTunnelEdit();
    } catch (e) {
        alert('Failed to delete tunnel: ' + e.message);
    }
}

async function testTunnel() {
    const info = buildTunnelInfo();
    const btn = document.getElementById('btn-test-tunnel');
    btn.disabled = true;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"/></svg> Testing...';
    try {
        const result = await api.tunnels.test(info);
        alert(result.success ? 'SSH connection successful!' : 'SSH connection failed!');
    } catch (e) {
        alert('SSH connection failed: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Test';
    }
}

function initTunnelManager() {
    document.getElementById('tunnel-dialog-close').onclick = hideTunnelManager;
    document.getElementById('tunnel-dialog').onclick = (e) => {
        if (e.target.classList.contains('modal-backdrop')) hideTunnelManager();
    };
    document.getElementById('btn-add-tunnel').onclick = showNewTunnelForm;
    document.getElementById('btn-save-tunnel').onclick = saveTunnel;
    document.getElementById('btn-cancel-tunnel').onclick = hideTunnelEdit;
    document.getElementById('btn-delete-tunnel').onclick = deleteTunnel;
    document.getElementById('btn-test-tunnel').onclick = testTunnel;
    document.getElementById('tunnel-auth-type').onchange = updateTunnelAuthFields;
}

// ============================================================
// Theme
// ============================================================
const MONACO_THEMES = { normal: 'vs-dark', light: 'vs', dark: 'vs-dark' };

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dbee-theme', theme);

    // Update switcher buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    // Update Monaco editor theme
    if (typeof monaco !== 'undefined') {
        monaco.editor.setTheme(MONACO_THEMES[theme] || 'vs-dark');
    }
}

function initTheme() {
    const saved = localStorage.getItem('dbee-theme');
    if (saved) {
        setTheme(saved);
    } else {
        // Auto-detect OS dark mode
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
    }

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.onclick = () => setTheme(btn.dataset.theme);
    });

    // Listen for OS theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('dbee-theme')) {
            setTheme(e.matches ? 'dark' : 'light');
        }
    });
}

// ============================================================
// Notes
// ============================================================
function getEditorDarkMode() {
    const theme = localStorage.getItem('dbee-theme') || 'normal';
    return theme !== 'light';
}

function showNotesDialog() {
    document.getElementById('notes-dialog').style.display = 'flex';
    loadNotes();
}

function hideNotesDialog() {
    document.getElementById('notes-dialog').style.display = 'none';
    state.activeNoteId = null;
    destroyNoteEditor();
}

function destroyNoteEditor() {
    if (toastuiEditor) {
        toastuiEditor.destroy();
        toastuiEditor = null;
    }
}

async function loadNotes() {
    try {
        state.notes = await api.notes.list();
        renderNoteList();
        if (!state.activeNoteId) {
            hideNoteEditor();
        }
    } catch (e) {
        console.error('Failed to load notes:', e);
    }
}

function renderNoteList() {
    const list = document.getElementById('notes-list');
    if (state.notes.length === 0) {
        list.innerHTML = '<div class="notes-empty">No notes yet</div>';
        return;
    }
    list.innerHTML = '';
    const sorted = [...state.notes].sort((a, b) => b.updatedAt - a.updatedAt);
    sorted.forEach(note => {
        const item = document.createElement('div');
        item.className = 'note-item' + (note.id === state.activeNoteId ? ' active' : '');
        const date = new Date(note.updatedAt);
        const dateStr = date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        item.innerHTML = `
            <div class="note-item-title">${escapeHtml(note.title || 'Untitled')}</div>
            <div class="note-item-date">${dateStr}</div>
        `;
        item.onclick = () => openNote(note);
        list.appendChild(item);
    });
}

function openNote(note) {
    state.activeNoteId = note.id;
    document.getElementById('note-title').value = note.title || '';
    showNoteEditor();
    initNoteEditorContent(note.content || '');
    renderNoteList();
    document.getElementById('note-status').textContent = '';
}

function showNoteEditor() {
    document.getElementById('notes-editor-section').style.display = '';
}

function hideNoteEditor() {
    document.getElementById('notes-editor-section').style.display = 'none';
}

function initNoteEditorContent(content) {
    const container = document.getElementById('note-editor-container');

    if (toastuiEditor) {
        toastuiEditor.setMarkdown(content);
        return;
    }

    container.innerHTML = '';

    toastuiEditor = new toastui.Editor({
        el: container,
        height: '100%',
        initialEditType: 'wysiwyg',
        initialValue: content,
        theme: getEditorDarkMode() ? 'dark' : '',
        usageStatistics: false,
        hideModeSwitch: true,
        toolbarItems: [
            ['heading', 'bold', 'italic', 'strike'],
            ['hr', 'quote'],
            ['ul', 'ol', 'task'],
            ['table', 'link'],
            ['code', 'codeblock'],
        ],
    });

    toastuiEditor.on('change', () => {
        document.getElementById('note-status').textContent = 'Unsaved changes';
    });

    // Ctrl+S to save
    container.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveNote();
        }
    });
}

async function createNote() {
    try {
        const note = await api.notes.create({ title: 'Untitled', content: '' });
        state.notes.push(note);
        openNote(note);
    } catch (e) {
        alert('Failed to create note: ' + e.message);
    }
}

async function saveNote() {
    if (!state.activeNoteId || !toastuiEditor) return;
    const title = document.getElementById('note-title').value || 'Untitled';
    const content = toastuiEditor.getMarkdown();
    try {
        const updated = await api.notes.update(state.activeNoteId, { title, content });
        const idx = state.notes.findIndex(n => n.id === state.activeNoteId);
        if (idx >= 0) state.notes[idx] = updated;
        renderNoteList();
        document.getElementById('note-status').textContent = 'Saved';
        setTimeout(() => {
            if (document.getElementById('note-status').textContent === 'Saved') {
                document.getElementById('note-status').textContent = '';
            }
        }, 2000);
    } catch (e) {
        alert('Failed to save note: ' + e.message);
    }
}

async function deleteNote() {
    if (!state.activeNoteId) return;
    if (!confirm('Delete this note?')) return;
    try {
        await api.notes.delete(state.activeNoteId);
        state.notes = state.notes.filter(n => n.id !== state.activeNoteId);
        state.activeNoteId = null;
        destroyNoteEditor();
        hideNoteEditor();
        renderNoteList();
    } catch (e) {
        alert('Failed to delete note: ' + e.message);
    }
}

function initNotesManager() {
    document.getElementById('btn-notes').onclick = showNotesDialog;
    document.getElementById('notes-dialog-close').onclick = hideNotesDialog;
    document.getElementById('notes-dialog').onclick = (e) => {
        if (e.target.classList.contains('modal-backdrop')) hideNotesDialog();
    };
    document.getElementById('btn-add-note').onclick = createNote;
    document.getElementById('btn-save-note').onclick = saveNote;
    document.getElementById('btn-delete-note').onclick = deleteNote;
}

// ============================================================
// Command Palette
// ============================================================
const CMD_PALETTE_COMMANDS = [
    { name: 'Run Query (cursor/selection)', shortcut: 'Ctrl+Enter', action: () => executeQuery(false) },
    { name: 'Run All Queries', shortcut: 'Ctrl+Shift+Enter', action: () => executeQuery(true) },
    { name: 'Explain', shortcut: 'Ctrl+E', action: () => executeExplain(false) },
    { name: 'Explain Analyze', shortcut: 'Ctrl+Shift+E', action: () => executeExplain(true) },
    { name: 'Format SQL', shortcut: 'Ctrl+Shift+F', action: formatSql },
    { name: 'Save Query', shortcut: 'Ctrl+S', action: saveCurrentQuery },
    { name: 'Saved Queries', shortcut: 'Alt+S', action: showSavedQueriesDialog },
    { name: 'New Tab', shortcut: 'Alt+N', action: () => addEditorTab() },
    { name: 'Export CSV', action: () => exportData('csv') },
    { name: 'Export JSON', action: () => exportData('json') },
    { name: 'Export Excel', action: () => exportData('xlsx') },
    { name: 'Export SQL INSERT', action: () => exportData('insert') },
    { name: 'Query History', shortcut: 'Alt+H', action: showHistoryDialog },
    { name: 'AI Chat', shortcut: 'Ctrl+Shift+A', action: toggleAiChatPanel },
    { name: 'Toggle Right Panel', shortcut: 'Ctrl+Shift+R', action: () => { if (typeof RightPanel !== 'undefined') RightPanel.toggle(); } },
    { name: 'AI Settings', action: showAiSettingsDialog },
    { name: 'AI: Explain SQL', action: aiExplainSql },
    { name: 'AI: Optimize SQL', action: aiOptimizeSql },
    { name: 'AI: Analyze Results', action: aiAnalyzeResult },
];

function showCommandPalette() {
    const palette = document.getElementById('command-palette');
    const input = document.getElementById('cmd-palette-input');
    palette.style.display = 'block';
    input.value = '';
    input.focus();
    renderPaletteCommands('');
}

function hideCommandPalette() {
    document.getElementById('command-palette').style.display = 'none';
}

function renderPaletteCommands(filter) {
    const list = document.getElementById('cmd-palette-list');
    const f = filter.toLowerCase();
    const filtered = CMD_PALETTE_COMMANDS.filter(c => c.name.toLowerCase().includes(f));
    list.innerHTML = filtered.map((cmd, i) => `
        <div class="cmd-palette-item${i === 0 ? ' active' : ''}" data-idx="${i}">
            <span class="cmd-name">${cmd.name}</span>
            ${cmd.shortcut ? `<span class="cmd-shortcut">${cmd.shortcut}</span>` : ''}
        </div>
    `).join('');

    list.querySelectorAll('.cmd-palette-item').forEach(item => {
        item.onclick = () => {
            const idx = parseInt(item.dataset.idx);
            hideCommandPalette();
            filtered[idx]?.action();
        };
    });
}

function initCommandPalette() {
    const input = document.getElementById('cmd-palette-input');
    input.oninput = () => renderPaletteCommands(input.value);
    input.onkeydown = (e) => {
        if (e.key === 'Escape') { hideCommandPalette(); return; }
        if (e.key === 'Enter') {
            const active = document.querySelector('.cmd-palette-item.active');
            if (active) active.click();
            return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const items = [...document.querySelectorAll('.cmd-palette-item')];
            const cur = items.findIndex(i => i.classList.contains('active'));
            if (cur >= 0) items[cur].classList.remove('active');
            const next = e.key === 'ArrowDown' ? Math.min(cur + 1, items.length - 1) : Math.max(cur - 1, 0);
            if (items[next]) { items[next].classList.add('active'); items[next].scrollIntoView({ block: 'nearest' }); }
        }
    };

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.command-palette')) hideCommandPalette();
    });
}

async function executeTxn(cmd) {
    const connId = getActiveConnectionId();
    if (!connId) { updateStatus('No active connection', true); return; }
    try {
        const results = await api.query.execute(connId, cmd, 1);
        const r = Array.isArray(results) ? results[0] : results;
        if (r && r.error) updateStatus(`${cmd} failed: ${r.errorMessage}`, true);
        else updateStatus(`${cmd} executed`);
    } catch (e) { updateStatus(`${cmd} failed: ${e.message}`, true); }
}

async function aiAlterSchema() {
    const desc = prompt('Describe the schema change in natural language:\n(e.g. "Add an email column to users table")');
    if (!desc) return;
    const connId = getActiveConnectionId();
    if (!connId) { updateStatus('No active connection', true); return; }
    toggleAiChatPanel();
    appendChatMessage('user', `Alter schema: ${desc}`);
    const lm = appendChatMessage('loading', '');
    try {
        const r = await api.llm.alterSql(connId, desc);
        lm.remove();
        appendChatMessage(r.error ? 'error' : 'assistant', r.message, r.sql);
    } catch (e) { lm.remove(); appendChatMessage('error', e.message); }
}

async function aiIndexHint() {
    const sql = getCurrentSql();
    if (!sql.trim()) { updateStatus('No SQL for index analysis', true); return; }
    toggleAiChatPanel();
    appendChatMessage('user', `Suggest indexes for:\n${sql}`);
    const loadingMsg = appendChatMessage('loading', '');
    try {
        const result = await api.llm.indexHint(getActiveConnectionId(), sql);
        loadingMsg.remove();
        if (result.error) appendChatMessage('error', result.message);
        else appendChatMessage('assistant', result.message, result.sql);
    } catch (e) { loadingMsg.remove(); appendChatMessage('error', e.message); }
}

// ============================================================
// Dashboard (#77) - saved query + chart combos
// ============================================================
function showDashboard() {
    const connId = getActiveConnectionId();
    if (!connId) { updateStatus('Connect to a database first', true); return; }
    toggleAiChatPanel();
    appendChatMessage('user', 'Create a dashboard summary for this database');
    const lm = appendChatMessage('loading', '');
    api.llm.chat(connId, 'Give me 3-5 useful dashboard queries for this database: row counts per table, recent activity, data distributions. Return each as a SQL query in a code block.')
        .then(r => { lm.remove(); appendChatMessage(r.error ? 'error' : 'assistant', r.message, r.sql); })
        .catch(e => { lm.remove(); appendChatMessage('error', e.message); });
}

// ============================================================
// Schema & Data Comparison (#78, #79)
// ============================================================
function showSchemaCompare() {
    if (monacoEditor) {
        monacoEditor.setValue(`-- Schema Comparison: Run on each database and compare results
-- Database 1:
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'your_schema_1'
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- Database 2:
-- Connect to second DB and run the same query, then compare results`);
        monacoEditor.focus();
        updateStatus('Schema comparison queries loaded');
    }
}

function showDataCompare() {
    const table = prompt('Table name to compare:');
    if (!table) return;
    if (monacoEditor) {
        monacoEditor.setValue(`-- Data Comparison for: ${table}
-- Run on Database 1:
SELECT MD5(GROUP_CONCAT(CONCAT_WS(',', ${table}.*) ORDER BY 1)) AS checksum,
       COUNT(*) AS row_count
FROM ${table};

-- Compare checksums and row counts between databases
-- For detailed diff, use EXCEPT/MINUS or full outer join patterns`);
        monacoEditor.focus();
    }
}

// ============================================================
// DB Monitoring (#80, #81)
// ============================================================
async function publishToConfluence() {
    const baseUrl = prompt('Confluence Base URL:', 'https://your-domain.atlassian.net/wiki');
    if (!baseUrl) return;
    const spaceKey = prompt('Space Key:', 'DEV');
    if (!spaceKey) return;
    const email = prompt('Atlassian Email:');
    if (!email) return;
    const apiToken = prompt('API Token:');
    if (!apiToken) return;

    const schema = state.autocompleteCache?.schemas?.[0]?.name || 'schema';
    try {
        const doc = await api.metadata.documentation(getActiveConnectionId(), schema);
        const content = doc.markdown.replace(/\n/g, '<br/>');
        const result = await api.request('POST', '/api/integration/confluence/publish', {
            baseUrl, spaceKey, title: `DBee Schema: ${schema}`, content, email, apiToken
        });
        if (result.success) updateStatus('Published to Confluence: ' + (result.pageUrl || ''));
        else updateStatus('Confluence failed: ' + result.message, true);
    } catch (e) { updateStatus('Failed: ' + e.message, true); }
}

async function createJiraIssue() {
    const baseUrl = prompt('Jira Base URL:', 'https://your-domain.atlassian.net');
    if (!baseUrl) return;
    const projectKey = prompt('Project Key:', 'DB');
    if (!projectKey) return;
    const summary = prompt('Issue Summary:', 'Database query finding');
    if (!summary) return;
    const email = prompt('Atlassian Email:');
    if (!email) return;
    const apiToken = prompt('API Token:');
    if (!apiToken) return;

    const sql = getCurrentSql();
    const description = `SQL Query:\n${sql}\n\nGenerated from DBee`;
    try {
        const result = await api.request('POST', '/api/integration/jira/create-issue', {
            baseUrl, projectKey, summary, description, email, apiToken
        });
        if (result.success) updateStatus(`Jira issue created: ${result.issueKey}`);
        else updateStatus('Jira failed: ' + result.message, true);
    } catch (e) { updateStatus('Failed: ' + e.message, true); }
}

async function exportSchemaDoc() {
    const connId = getActiveConnectionId();
    if (!connId) { updateStatus('No connection', true); return; }
    // Find current schema from autocomplete cache
    const schema = state.autocompleteCache?.schemas?.[0]?.name;
    if (!schema) { updateStatus('No schema detected. Connect and expand a schema first.', true); return; }
    try {
        updateStatus('Generating documentation...');
        const result = await api.metadata.documentation(connId, schema);
        const blob = new Blob([result.markdown], { type: 'text/markdown' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${schema}-schema-doc.md`;
        a.click();
        URL.revokeObjectURL(a.href);
        updateStatus(`Schema documentation exported for ${schema}`);
    } catch (e) { updateStatus('Failed: ' + e.message, true); }
}

function showProcessList() {
    if (!getActiveConnectionId()) { updateStatus('No connection', true); return; }
    if (monacoEditor) {
        monacoEditor.setValue('SHOW PROCESSLIST;');
        executeQuery();
    }
}

function showDbStatus() {
    if (!getActiveConnectionId()) { updateStatus('No connection', true); return; }
    if (monacoEditor) {
        monacoEditor.setValue(`-- DB Status Overview
SHOW GLOBAL STATUS WHERE Variable_name IN ('Connections', 'Threads_connected', 'Threads_running', 'Questions', 'Slow_queries', 'Uptime');

-- Table sizes
SELECT table_schema AS 'Database',
       ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)',
       SUM(table_rows) AS 'Total Rows'
FROM information_schema.TABLES
GROUP BY table_schema
ORDER BY SUM(data_length + index_length) DESC;`);
        executeQuery();
    }
}

// ============================================================
// Chart Visualization
// ============================================================
let chartInstance = null;

function showChartDialog() {
    if (!state.resultData || !state.resultData.rows.length) {
        updateStatus('No result data to chart', true); return;
    }
    const dialog = document.getElementById('chart-dialog');
    dialog.style.display = 'flex';
    dialog.querySelector('.modal-backdrop').onclick = () => dialog.style.display = 'none';

    const cols = state.resultData.columnNames;
    const labelSel = document.getElementById('chart-label-col');
    const dataSel = document.getElementById('chart-data-col');
    labelSel.innerHTML = cols.map((c, i) => `<option value="${i}">${c} (Label)</option>`).join('');
    dataSel.innerHTML = cols.map((c, i) => `<option value="${i}"${i === 1 ? ' selected' : ''}>${c} (Data)</option>`).join('');

    renderChart();
}

function renderChart() {
    if (!state.resultData) return;
    const type = document.getElementById('chart-type').value;
    const labelIdx = parseInt(document.getElementById('chart-label-col').value);
    const dataIdx = parseInt(document.getElementById('chart-data-col').value);
    const rows = state.resultData.rows.slice(0, 100); // max 100 data points

    const labels = rows.map(r => r[labelIdx] !== null ? String(r[labelIdx]) : 'NULL');
    const data = rows.map(r => {
        const v = r[dataIdx];
        return v !== null ? (typeof v === 'number' ? v : parseFloat(v) || 0) : 0;
    });

    const colors = labels.map((_, i) => `hsl(${(i * 37) % 360}, 70%, 55%)`);
    const canvas = document.getElementById('chart-canvas');

    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(canvas, {
        type,
        data: {
            labels,
            datasets: [{
                label: state.resultData.columnNames[dataIdx],
                data,
                backgroundColor: colors,
                borderColor: type === 'line' ? 'var(--accent)' : colors,
                borderWidth: 1,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: type === 'pie' || type === 'doughnut' } },
        }
    });
}

// ============================================================
// Internationalization (i18n)
// ============================================================
let i18nData = {};

async function setLanguage(lang) {
    try {
        const res = await fetch(`/i18n/${lang}.json`);
        i18nData = await res.json();
        localStorage.setItem('dbee-lang', lang);
        // Update menu triggers
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (i18nData[key]) el.textContent = i18nData[key];
        });
        updateStatus(`Language: ${lang}`);
    } catch (e) {
        console.warn('Failed to load language:', e);
    }
}

function restoreLanguage() {
    const lang = localStorage.getItem('dbee-lang');
    if (lang && lang !== 'en') setLanguage(lang);
}

// ============================================================
// Global Zoom
// ============================================================
function adjustZoom(dir) {
    const root = document.documentElement;
    let currentZoom = parseFloat(localStorage.getItem('dbee-zoom') || '100');
    if (dir === 0) currentZoom = 100;
    else currentZoom = Math.max(70, Math.min(150, currentZoom + dir * 10));
    root.style.fontSize = currentZoom + '%';
    localStorage.setItem('dbee-zoom', String(currentZoom));
    updateStatus(`Zoom: ${currentZoom}%`);
}

function restoreZoom() {
    const zoom = localStorage.getItem('dbee-zoom');
    if (zoom) document.documentElement.style.fontSize = zoom + '%';
}

// ============================================================
// Connection Import/Export
// ============================================================
function exportConnections() {
    if (!state.connections || state.connections.length === 0) { updateStatus('No connections to export', true); return; }
    // Strip passwords for security
    const safe = state.connections.map(c => {
        const copy = { ...c, password: '***' };
        return copy;
    });
    const blob = new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dbee-connections.json';
    a.click();
    URL.revokeObjectURL(a.href);
    updateStatus(`Exported ${safe.length} connections (passwords masked)`);
}

function importConnections() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
        if (!input.files.length) return;
        try {
            const text = await input.files[0].text();
            const conns = JSON.parse(text);
            if (!Array.isArray(conns)) { updateStatus('Invalid connections file', true); return; }
            let imported = 0;
            for (const conn of conns) {
                conn.password = conn.password === '***' ? '' : (conn.password || '');
                delete conn.id; // will get new ID
                await api.connections.create(conn);
                imported++;
            }
            await loadConnections();
            updateStatus(`Imported ${imported} connections`);
        } catch (e) { updateStatus('Import failed: ' + e.message, true); }
    };
    input.click();
}

// ============================================================
// Data Import
// ============================================================
function showImportDialog() {
    if (!getActiveConnectionId()) { updateStatus('No active connection', true); return; }
    document.getElementById('import-dialog').style.display = 'flex';
    document.getElementById('import-result').style.display = 'none';
    document.getElementById('import-type').onchange = () => {
        document.getElementById('import-table-row').style.display =
            document.getElementById('import-type').value === 'csv' ? '' : 'none';
    };
}

async function executeImport() {
    const type = document.getElementById('import-type').value;
    const fileInput = document.getElementById('import-file');
    if (!fileInput.files.length) { updateStatus('No file selected', true); return; }

    const formData = new FormData();
    formData.append('connectionId', getActiveConnectionId());
    formData.append('file', fileInput.files[0]);
    if (type === 'csv') {
        const table = document.getElementById('import-table').value.trim();
        if (!table) { updateStatus('Enter target table name', true); return; }
        formData.append('table', table);
    }

    const resultDiv = document.getElementById('import-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<span style="color:var(--accent)">Importing...</span>';

    try {
        const res = await fetch(`/api/import/${type}`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            resultDiv.innerHTML = `<span style="color:var(--success)">Success! ${data.executed || data.inserted || 0} statements executed.</span>`;
        } else {
            resultDiv.innerHTML = `<span style="color:var(--error)">Completed with ${data.errors} errors. ${data.executed || data.inserted || 0} succeeded.</span>`;
        }
    } catch (e) {
        resultDiv.innerHTML = `<span style="color:var(--error)">Import failed: ${e.message}</span>`;
    }
}

// ============================================================
// Editor Settings
// ============================================================
function showEditorSettings() {
    const s = JSON.parse(localStorage.getItem('dbee-editor-settings') || '{}');
    document.getElementById('es-font-size').value = s.fontSize || 14;
    document.getElementById('es-tab-size').value = s.tabSize || 4;
    document.getElementById('es-word-wrap').value = s.wordWrap || 'off';
    document.getElementById('es-minimap').value = s.minimap ?? 'false';
    document.getElementById('es-line-numbers').value = s.lineNumbers || 'on';
    document.getElementById('editor-settings-dialog').style.display = 'flex';
    document.getElementById('editor-settings-close').onclick = closeEditorSettings;
    document.getElementById('editor-settings-dialog').querySelector('.modal-backdrop').onclick = closeEditorSettings;
}

function closeEditorSettings() {
    document.getElementById('editor-settings-dialog').style.display = 'none';
}

function applyEditorSettings() {
    const s = {
        fontSize: parseInt(document.getElementById('es-font-size').value),
        tabSize: parseInt(document.getElementById('es-tab-size').value),
        wordWrap: document.getElementById('es-word-wrap').value,
        minimap: document.getElementById('es-minimap').value,
        lineNumbers: document.getElementById('es-line-numbers').value,
    };
    localStorage.setItem('dbee-editor-settings', JSON.stringify(s));
    if (monacoEditor) {
        monacoEditor.updateOptions({
            fontSize: s.fontSize,
            tabSize: s.tabSize,
            wordWrap: s.wordWrap,
            minimap: { enabled: s.minimap === 'true' },
            lineNumbers: s.lineNumbers,
        });
    }
    closeEditorSettings();
    updateStatus('Editor settings applied');
}

function restoreEditorSettings() {
    const s = JSON.parse(localStorage.getItem('dbee-editor-settings') || '{}');
    if (monacoEditor && Object.keys(s).length > 0) {
        monacoEditor.updateOptions({
            fontSize: s.fontSize || 14,
            tabSize: s.tabSize || 4,
            wordWrap: s.wordWrap || 'off',
            minimap: { enabled: (s.minimap || 'false') === 'true' },
            lineNumbers: s.lineNumbers || 'on',
        });
    }
}

// ============================================================
// Icon Toolbar Toggle
// ============================================================
function toggleIconToolbar() {
    const tb = document.getElementById('icon-toolbar');
    const btn = document.getElementById('btn-toggle-toolbar');
    if (tb.style.display === 'none') {
        tb.style.display = 'flex';
        btn.textContent = 'Hide Toolbar';
        localStorage.setItem('dbee-toolbar-visible', 'true');
    } else {
        tb.style.display = 'none';
        btn.textContent = 'Show Toolbar';
        localStorage.setItem('dbee-toolbar-visible', 'false');
    }
}

function restoreToolbarState() {
    const visible = localStorage.getItem('dbee-toolbar-visible');
    const tb = document.getElementById('icon-toolbar');
    const btn = document.getElementById('btn-toggle-toolbar');
    if (visible === 'false') {
        tb.style.display = 'none';
        if (btn) btn.textContent = 'Show Toolbar';
    }
}

// ============================================================
// AI SQL Assistants (#40, #41, #42)
// ============================================================
async function aiExplainSql() {
    const sql = getCurrentSql();
    if (!sql.trim()) { updateStatus('No SQL to explain', true); return; }
    toggleAiChatPanel(); // open chat panel
    appendChatMessage('user', `Explain this SQL:\n${sql}`);
    const loadingMsg = appendChatMessage('loading', '');
    try {
        const result = await api.llm.explainSql(sql);
        loadingMsg.remove();
        if (result.error) appendChatMessage('error', result.message);
        else appendChatMessage('assistant', result.message, result.sql);
    } catch (e) { loadingMsg.remove(); appendChatMessage('error', e.message); }
}

async function aiOptimizeSql() {
    const sql = getCurrentSql();
    if (!sql.trim()) { updateStatus('No SQL to optimize', true); return; }
    toggleAiChatPanel();
    appendChatMessage('user', `Optimize this SQL:\n${sql}`);
    const loadingMsg = appendChatMessage('loading', '');
    try {
        const result = await api.llm.optimizeSql(getActiveConnectionId(), sql);
        loadingMsg.remove();
        if (result.error) appendChatMessage('error', result.message);
        else appendChatMessage('assistant', result.message, result.sql);
    } catch (e) { loadingMsg.remove(); appendChatMessage('error', e.message); }
}

async function aiAnalyzeResult() {
    if (!state.resultData) { updateStatus('No result to analyze', true); return; }
    const sql = state.lastResult?.sql || '';
    const rows = state.resultData.rows.slice(0, 20); // send first 20 rows
    const cols = state.resultData.columnNames;
    let message = `SQL: ${sql}\n\nResults (${state.resultData.rows.length} total rows, showing first ${rows.length}):\n`;
    message += cols.join(' | ') + '\n';
    rows.forEach(r => { message += r.map(v => v === null ? 'NULL' : String(v)).join(' | ') + '\n'; });

    toggleAiChatPanel();
    appendChatMessage('user', 'Analyze query results');
    const loadingMsg = appendChatMessage('loading', '');
    try {
        const result = await api.llm.analyzeResult(message);
        loadingMsg.remove();
        if (result.error) appendChatMessage('error', result.message);
        else appendChatMessage('assistant', result.message, null);
    } catch (e) { loadingMsg.remove(); appendChatMessage('error', e.message); }
}

// ============================================================
// AI Chat Panel — now backed by RightPanel 'ai' tab (#101)
// ============================================================
function toggleAiChatPanel() {
    if (typeof RightPanel !== 'undefined') {
        RightPanel.open('ai');
        const input = document.getElementById('ai-chat-input');
        if (input) setTimeout(() => input.focus(), 50);
    }
}

function closeAiChatPanel() {
    if (typeof RightPanel !== 'undefined') RightPanel.close();
}

function saveAiChatHistory() {
    const msgs = document.getElementById('ai-chat-messages');
    if (!msgs) return;
    const items = [];
    msgs.querySelectorAll('.ai-chat-msg').forEach(m => {
        if (m.classList.contains('ai-chat-msg-loading')) return;
        const role = m.classList.contains('ai-chat-msg-user') ? 'user'
            : m.classList.contains('ai-chat-msg-error') ? 'error' : 'assistant';
        const content = m.querySelector('.ai-msg-content')?.textContent || '';
        const sql = m.querySelector('.ai-sql-code')?.textContent || null;
        items.push({ role, content, sql });
    });
    try { localStorage.setItem('dbee-ai-chat', JSON.stringify(items.slice(-50))); } catch (e) {}
}

function loadAiChatHistory() {
    try {
        const items = JSON.parse(localStorage.getItem('dbee-ai-chat') || '[]');
        if (items.length === 0) return;
        const container = document.getElementById('ai-chat-messages');
        const welcome = container.querySelector('.ai-chat-welcome');
        if (welcome) welcome.remove();
        items.forEach(item => appendChatMessage(item.role, item.content, item.sql));
    } catch (e) {}
}

function clearAiChat() {
    try { localStorage.removeItem('dbee-ai-chat'); } catch (e) {}
    const container = document.getElementById('ai-chat-messages');
    container.innerHTML = `
        <div class="ai-chat-welcome">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"><path d="M12 2a4 4 0 0 0-4 4c0 2.8 4 6 4 6s4-3.2 4-6a4 4 0 0 0-4-4z"/><circle cx="12" cy="6" r="1.5"/><path d="M6 12c-2 0-4 1-4 3s2 3 4 3"/><path d="M18 12c2 0 4 1 4 3s-2 3-4 3"/><path d="M8 21c0-2 2-3 4-3s4 1 4 3"/></svg>
            <p>Ask a question in natural language and I'll generate SQL for you.</p>
            <p class="ai-chat-hint">Example: "Show all members who enrolled after 2024"</p>
        </div>`;
}

function appendChatMessage(role, content, sql) {
    const container = document.getElementById('ai-chat-messages');
    // Remove welcome message if present
    const welcome = container.querySelector('.ai-chat-welcome');
    if (welcome) welcome.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-chat-msg ai-chat-msg-${role}`;

    if (role === 'user') {
        msgDiv.innerHTML = `<div class="ai-msg-content">${escapeHtml(content)}</div>`;
    } else if (role === 'assistant') {
        // If SQL is rendered separately below, strip fenced code blocks from the prose
        const proseText = sql ? (content || '').replace(/```[a-zA-Z]*\s*\n?[\s\S]*?```/g, '').trim() : content;
        let html = `<div class="ai-msg-content">${formatAiMessage(proseText)}</div>`;
        if (sql) {
            html += `<div class="ai-msg-sql">
                <div class="ai-sql-header">
                    <span>Generated SQL</span>
                    <div style="display:flex;gap:4px;">
                        <button class="btn btn-ghost btn-xs ai-btn-edit" title="Edit before inserting">Edit</button>
                        <button class="btn btn-primary btn-xs ai-btn-insert" title="Insert to Editor">Insert</button>
                    </div>
                </div>
                <pre class="ai-sql-code">${escapeHtml(sql)}</pre>
                <textarea class="ai-sql-edit" style="display:none;">${escapeHtml(sql)}</textarea>
            </div>`;
        }
        msgDiv.innerHTML = html;

        // Attach insert/edit button handlers
        if (sql) {
            const insertBtn = msgDiv.querySelector('.ai-btn-insert');
            const editBtn = msgDiv.querySelector('.ai-btn-edit');
            const preEl = msgDiv.querySelector('.ai-sql-code');
            const textareaEl = msgDiv.querySelector('.ai-sql-edit');

            editBtn.onclick = () => {
                if (textareaEl.style.display === 'none') {
                    preEl.style.display = 'none';
                    textareaEl.style.display = 'block';
                    textareaEl.focus();
                    editBtn.textContent = 'Done';
                } else {
                    preEl.textContent = textareaEl.value;
                    preEl.style.display = '';
                    textareaEl.style.display = 'none';
                    editBtn.textContent = 'Edit';
                }
            };

            insertBtn.onclick = () => {
                const finalSql = textareaEl.style.display !== 'none' ? textareaEl.value : preEl.textContent;
                insertSqlToEditor(finalSql);
            };
        }
    } else if (role === 'error') {
        msgDiv.className = 'ai-chat-msg ai-chat-msg-error';
        msgDiv.innerHTML = `<div class="ai-msg-content">${escapeHtml(content)}</div>`;
    } else if (role === 'loading') {
        msgDiv.className = 'ai-chat-msg ai-chat-msg-loading';
        msgDiv.innerHTML = `<div class="ai-msg-content"><span class="ai-loading-dots">Thinking<span>...</span></span></div>`;
    }

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    // Auto-save chat history (skip loading messages)
    if (role !== 'loading') setTimeout(saveAiChatHistory, 100);
    return msgDiv;
}

function formatAiMessage(text) {
    // Simple markdown-like formatting
    let html = escapeHtml(text);
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    return html;
}

function insertSqlToEditor(sql) {
    if (monacoEditor) {
        const model = monacoEditor.getModel();
        const lastLine = model.getLineCount();
        const lastCol = model.getLineMaxColumn(lastLine);
        const currentContent = model.getValue();
        const prefix = currentContent.trim() ? '\n\n' : '';
        monacoEditor.executeEdits('ai-insert', [{
            range: new monaco.Range(lastLine, lastCol, lastLine, lastCol),
            text: prefix + sql,
        }]);
        monacoEditor.setPosition({ lineNumber: model.getLineCount(), column: 1 });
        monacoEditor.focus();
        updateStatus('SQL inserted from AI');
    }
}

async function sendAiChatMessage() {
    const input = document.getElementById('ai-chat-input');
    const message = input.value.trim();
    if (!message) return;

    const connId = getActiveConnectionId();
    if (!connId) {
        appendChatMessage('error', 'No active connection. Connect to a database first.');
        return;
    }

    input.value = '';
    input.style.height = 'auto';
    appendChatMessage('user', message);
    const loadingMsg = appendChatMessage('loading', '');

    document.getElementById('btn-ai-chat-send').disabled = true;

    const payload = (typeof aiLanguageInstruction === 'function' ? aiLanguageInstruction() : '') + message;
    try {
        const result = await api.llm.chat(connId, payload);
        loadingMsg.remove();

        if (result.error) {
            appendChatMessage('error', result.message);
        } else {
            appendChatMessage('assistant', result.message, result.sql);
        }
    } catch (e) {
        loadingMsg.remove();
        appendChatMessage('error', 'Failed: ' + e.message);
    } finally {
        document.getElementById('btn-ai-chat-send').disabled = false;
    }
}

function initAiChat() {
    document.getElementById('btn-ai-chat').onclick = toggleAiChatPanel;
    document.getElementById('btn-ai-chat-close').onclick = closeAiChatPanel;
    document.getElementById('btn-ai-chat-clear').onclick = clearAiChat;
    document.getElementById('btn-ai-chat-send').onclick = sendAiChatMessage;

    const chatInput = document.getElementById('ai-chat-input');
    chatInput.onkeydown = (e) => {
        // Skip while IME composition is active (Korean/Japanese/Chinese input)
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAiChatMessage();
        }
        if (e.key === 'Escape') {
            closeAiChatPanel();
        }
    };

    // Auto-resize textarea
    chatInput.oninput = () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    };

    // Restore chat history from localStorage
    loadAiChatHistory();
}

// ============================================================
// AI Settings
// ============================================================
const LLM_DEFAULTS = {
    OPENAI: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', needsKey: true },
    CLAUDE: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-20250514', needsKey: true },
    OLLAMA: { baseUrl: 'http://localhost:11434', model: 'llama3', needsKey: false },
};

async function showAiSettingsDialog() {
    const dialog = document.getElementById('ai-settings-dialog');
    dialog.style.display = 'flex';

    try {
        const settings = await api.llm.getSettings();
        document.getElementById('ai-provider').value = settings.provider || 'OPENAI';
        document.getElementById('ai-apikey').value = settings.apiKey || '';
        document.getElementById('ai-baseurl').value = settings.baseUrl || '';
        document.getElementById('ai-model').value = settings.model || '';
        document.getElementById('ai-temperature').value = settings.temperature ?? 0.3;
        document.getElementById('ai-temperature-value').textContent = settings.temperature ?? 0.3;
        const langEl = document.getElementById('ai-language');
        if (langEl) langEl.value = getAiLanguage();
        updateAiProviderFields();
    } catch (e) {
        console.error('Failed to load AI settings:', e);
    }

    document.getElementById('ai-test-result').style.display = 'none';
}

function getAiLanguage() {
    return localStorage.getItem('dbee.ai.language') || 'ko';
}

function setAiLanguage(lang) {
    try { localStorage.setItem('dbee.ai.language', lang); } catch (e) {}
}

function aiLanguageInstruction() {
    const lang = getAiLanguage();
    if (lang === 'ko') return '한국어로 답변해 주세요. ';
    if (lang === 'ja') return '日本語で回答してください。';
    return 'Please respond in English. ';
}

function closeAiSettingsDialog() {
    document.getElementById('ai-settings-dialog').style.display = 'none';
}

function updateAiProviderFields() {
    const provider = document.getElementById('ai-provider').value;
    const defaults = LLM_DEFAULTS[provider];
    const keyRow = document.getElementById('row-ai-apikey');

    if (defaults) {
        // Only update baseUrl/model if they match a different provider's defaults (i.e., user hasn't customized)
        const currentBase = document.getElementById('ai-baseurl').value;
        const isDefaultBase = Object.values(LLM_DEFAULTS).some(d => d.baseUrl === currentBase) || !currentBase;
        if (isDefaultBase) {
            document.getElementById('ai-baseurl').value = defaults.baseUrl;
        }

        const currentModel = document.getElementById('ai-model').value;
        const isDefaultModel = Object.values(LLM_DEFAULTS).some(d => d.model === currentModel) || !currentModel;
        if (isDefaultModel) {
            document.getElementById('ai-model').value = defaults.model;
        }

        keyRow.style.display = defaults.needsKey ? '' : 'none';

        // Auto-detect Ollama models
        if (provider === 'OLLAMA') {
            const baseUrl = document.getElementById('ai-baseurl').value || defaults.baseUrl;
            api.llm.ollamaModels(baseUrl).then(models => {
                if (models && models.length > 0) {
                    const modelInput = document.getElementById('ai-model');
                    // Show available models as datalist
                    let datalist = document.getElementById('ollama-models-list');
                    if (!datalist) {
                        datalist = document.createElement('datalist');
                        datalist.id = 'ollama-models-list';
                        document.body.appendChild(datalist);
                        modelInput.setAttribute('list', 'ollama-models-list');
                    }
                    datalist.innerHTML = models.map(m => `<option value="${m}">`).join('');
                    if (!models.includes(modelInput.value)) modelInput.value = models[0];
                }
            }).catch(() => {});
        }
    }
}

function getAiSettingsFromForm() {
    return {
        provider: document.getElementById('ai-provider').value,
        apiKey: document.getElementById('ai-apikey').value,
        baseUrl: document.getElementById('ai-baseurl').value,
        model: document.getElementById('ai-model').value,
        temperature: parseFloat(document.getElementById('ai-temperature').value),
    };
}

async function saveAiSettings() {
    const settings = getAiSettingsFromForm();
    try {
        await api.llm.saveSettings(settings);
        const langEl = document.getElementById('ai-language');
        if (langEl) setAiLanguage(langEl.value);
        updateStatus('AI settings saved');
        closeAiSettingsDialog();
    } catch (e) {
        updateStatus('Failed to save AI settings: ' + e.message, true);
    }
}

async function testAiConnection() {
    const settings = getAiSettingsFromForm();
    const resultEl = document.getElementById('ai-test-result');
    resultEl.style.display = 'block';
    resultEl.className = 'ai-test-result ai-test-loading';
    resultEl.textContent = 'Testing connection...';

    document.getElementById('btn-test-ai').disabled = true;

    try {
        const result = await api.llm.testConnection(settings);
        if (result.success) {
            resultEl.className = 'ai-test-result ai-test-success';
            resultEl.textContent = result.message;
        } else {
            resultEl.className = 'ai-test-result ai-test-error';
            resultEl.textContent = result.message;
        }
    } catch (e) {
        resultEl.className = 'ai-test-result ai-test-error';
        resultEl.textContent = 'Test failed: ' + e.message;
    } finally {
        document.getElementById('btn-test-ai').disabled = false;
    }
}

function initAiSettings() {
    document.getElementById('btn-ai-settings').onclick = showAiSettingsDialog;
    document.getElementById('ai-settings-dialog-close').onclick = closeAiSettingsDialog;
    document.getElementById('ai-settings-dialog').querySelector('.modal-backdrop').onclick = closeAiSettingsDialog;
    document.getElementById('btn-cancel-ai').onclick = closeAiSettingsDialog;
    document.getElementById('btn-save-ai').onclick = saveAiSettings;
    document.getElementById('btn-test-ai').onclick = testAiConnection;

    document.getElementById('ai-provider').onchange = updateAiProviderFields;
    document.getElementById('ai-temperature').oninput = (e) => {
        document.getElementById('ai-temperature-value').textContent = e.target.value;
    };
}

// ============================================================
// Cell Viewer
// ============================================================
function showCellViewer(value, columnName, typeName) {
    const dialog = document.getElementById('cell-viewer-dialog');
    const title = document.getElementById('cell-viewer-title');
    const content = document.getElementById('cell-viewer-content');

    title.textContent = columnName + (typeName ? ` (${typeName})` : '');

    // Try to format JSON
    let displayVal = value === null ? 'NULL' : String(value);
    if (typeName && /JSON/i.test(typeName)) {
        try { displayVal = JSON.stringify(JSON.parse(displayVal), null, 2); } catch (e) { /* keep as-is */ }
    }

    content.textContent = displayVal;
    dialog.style.display = 'flex';

    document.getElementById('cell-viewer-close').onclick = () => dialog.style.display = 'none';
    dialog.querySelector('.modal-backdrop').onclick = () => dialog.style.display = 'none';
    document.getElementById('btn-cell-copy').onclick = () => {
        navigator.clipboard.writeText(displayVal);
        updateStatus('Copied to clipboard');
    };
}

// ============================================================
// Saved Queries
// ============================================================
async function saveCurrentQuery() {
    const sql = getCurrentSql();
    if (!sql.trim()) { updateStatus('No SQL to save', true); return; }
    const name = prompt('Save query as:', 'My Query');
    if (!name) return;
    try {
        await api.savedQueries.create({ name, sql, folder: '' });
        updateStatus(`Query saved: ${name}`);
    } catch (e) {
        updateStatus('Failed to save query: ' + e.message, true);
    }
}

async function showSavedQueriesDialog() {
    const dialog = document.getElementById('saved-queries-dialog');
    dialog.style.display = 'flex';
    await loadSavedQueries();
}

function closeSavedQueriesDialog() {
    document.getElementById('saved-queries-dialog').style.display = 'none';
}

async function loadSavedQueries() {
    const list = document.getElementById('saved-queries-list');
    try {
        const queries = await api.savedQueries.list();
        if (queries.length === 0) {
            list.innerHTML = '<div class="history-empty">No saved queries yet. Use Ctrl+S to save.</div>';
            return;
        }
        list.innerHTML = queries.sort((a, b) => b.updatedAt - a.updatedAt).map(q => `
            <div class="saved-query-item" data-id="${q.id}">
                <div class="saved-query-header">
                    <span class="saved-query-name">${escapeHtml(q.name)}</span>
                    <div class="saved-query-actions">
                        <button class="btn-icon sq-load" title="Load to editor">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/></svg>
                        </button>
                        <button class="btn-icon sq-delete" title="Delete" style="color:var(--error)">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
                <pre class="saved-query-sql">${escapeHtml(q.sql.substring(0, 200))}${q.sql.length > 200 ? '...' : ''}</pre>
            </div>
        `).join('');

        // Attach handlers
        list.querySelectorAll('.sq-load').forEach(btn => {
            btn.onclick = () => {
                const id = btn.closest('.saved-query-item').dataset.id;
                const q = queries.find(x => x.id === id);
                if (q && monacoEditor) {
                    monacoEditor.setValue(q.sql);
                    monacoEditor.focus();
                    closeSavedQueriesDialog();
                    updateStatus(`Loaded: ${q.name}`);
                }
            };
        });
        list.querySelectorAll('.sq-delete').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.closest('.saved-query-item').dataset.id;
                if (confirm('Delete this saved query?')) {
                    await api.savedQueries.delete(id);
                    loadSavedQueries();
                }
            };
        });
    } catch (e) {
        list.innerHTML = `<div class="history-empty">Failed to load: ${escapeHtml(e.message)}</div>`;
    }
}

function initSavedQueries() {
    document.getElementById('btn-save-query').onclick = saveCurrentQuery;
    document.getElementById('btn-saved-queries').onclick = showSavedQueriesDialog;
    document.getElementById('saved-queries-dialog-close').onclick = closeSavedQueriesDialog;
    document.getElementById('saved-queries-dialog').querySelector('.modal-backdrop').onclick = closeSavedQueriesDialog;
}

// ============================================================
// Query History
// ============================================================
function showHistoryDialog() {
    document.getElementById('history-dialog').style.display = 'flex';
    document.getElementById('history-search').value = '';
    loadHistory();
    setTimeout(() => document.getElementById('history-search').focus(), 100);
}

function hideHistoryDialog() {
    document.getElementById('history-dialog').style.display = 'none';
}

let historySearchTimer = null;

async function loadHistory(search) {
    try {
        const items = await api.history.list(search, 200);
        renderHistoryList(items);
    } catch (e) {
        console.error('Failed to load history:', e);
    }
}

function renderHistoryList(items) {
    const list = document.getElementById('history-list');
    if (!items || items.length === 0) {
        list.innerHTML = `<div class="history-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>No query history yet</span>
        </div>`;
        return;
    }

    list.innerHTML = '';
    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'history-item';
        el.innerHTML = `
            <div class="history-item-status ${item.error ? 'error' : 'success'}"></div>
            <div class="history-item-content">
                <div class="history-item-sql">${escapeHtml(item.sql)}</div>
                ${item.error && item.errorMessage ? `<div class="history-error-msg">${escapeHtml(item.errorMessage)}</div>` : ''}
                <div class="history-item-meta">
                    <span title="${new Date(item.executedAt).toLocaleString()}">${formatRelativeTime(item.executedAt)}</span>
                    <span>${escapeHtml(item.connectionName || '')}</span>
                    ${!item.error ? `<span>${item.rowCount >= 0 ? item.rowCount + ' rows' : ''}</span>` : ''}
                    <span>${item.executionTimeMs}ms</span>
                </div>
            </div>
            <div class="history-item-actions">
                <button title="Delete" data-id="${item.id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        `;

        // Click to insert SQL into editor
        el.querySelector('.history-item-content').onclick = () => {
            if (monacoEditor) {
                const position = monacoEditor.getPosition();
                const currentValue = monacoEditor.getValue();
                if (currentValue.trim()) {
                    // Append with newline if editor has content
                    monacoEditor.setValue(currentValue + '\n' + item.sql);
                } else {
                    monacoEditor.setValue(item.sql);
                }
                hideHistoryDialog();
                monacoEditor.focus();
            }
        };

        // Delete button
        el.querySelector('.history-item-actions button').onclick = async (e) => {
            e.stopPropagation();
            const id = e.currentTarget.dataset.id;
            try {
                await api.history.delete(id);
                el.remove();
                // Check if list is now empty
                if (document.getElementById('history-list').children.length === 0) {
                    renderHistoryList([]);
                }
            } catch (err) {
                console.error('Failed to delete history:', err);
            }
        };

        list.appendChild(el);
    });
}

function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
}

async function showHistoryStats() {
    const list = document.getElementById('history-list');
    try {
        const s = await api.history.stats();
        if (s.totalQueries === 0) {
            list.innerHTML = '<div class="history-empty">No query history for statistics.</div>';
            return;
        }
        let html = `<div class="history-stats">
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${s.totalQueries}</div><div class="stat-label">Total Queries</div></div>
                <div class="stat-card"><div class="stat-value">${s.avgTimeMs}ms</div><div class="stat-label">Avg Time</div></div>
                <div class="stat-card"><div class="stat-value">${s.maxTimeMs}ms</div><div class="stat-label">Max Time</div></div>
                <div class="stat-card"><div class="stat-value">${s.errorRate}%</div><div class="stat-label">Error Rate</div></div>
            </div>`;
        if (s.slowestQueries && s.slowestQueries.length > 0) {
            html += '<div class="stats-section-title">Slowest Queries</div>';
            s.slowestQueries.forEach(q => {
                html += `<div class="history-item">
                    <div class="history-item-header">
                        <span class="history-time-badge">${q.executionTimeMs}ms</span>
                        <span class="history-conn">${escapeHtml(q.connectionName || '')}</span>
                    </div>
                    <pre class="history-sql">${escapeHtml(q.sql)}</pre>
                </div>`;
            });
        }
        html += '</div>';
        list.innerHTML = html;
    } catch (e) {
        list.innerHTML = `<div class="history-empty">Failed to load stats: ${escapeHtml(e.message)}</div>`;
    }
}

function initHistoryManager() {
    document.getElementById('btn-history').onclick = showHistoryDialog;
    document.getElementById('history-dialog-close').onclick = hideHistoryDialog;
    document.getElementById('history-dialog').onclick = (e) => {
        if (e.target.classList.contains('modal-backdrop')) hideHistoryDialog();
    };

    // Search with debounce
    document.getElementById('history-search').addEventListener('input', (e) => {
        clearTimeout(historySearchTimer);
        historySearchTimer = setTimeout(() => {
            loadHistory(e.target.value.trim() || undefined);
        }, 300);
    });

    // Stats
    document.getElementById('btn-history-stats').onclick = showHistoryStats;

    // Clear all
    document.getElementById('btn-clear-history').onclick = async () => {
        if (!confirm('Clear all query history?')) return;
        try {
            await api.history.clear();
            renderHistoryList([]);
        } catch (e) {
            console.error('Failed to clear history:', e);
        }
    };

    // Escape to close
    document.getElementById('history-dialog').addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideHistoryDialog();
    });
}

// ============================================================
// Init
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initFastTooltips();
    initEventHandlers();
    initTunnelManager();
    initNotesManager();
    initHistoryManager();
    // Global error handler
    window.onerror = (msg, src, line) => {
        console.error(`[DBee Error] ${msg} at ${src}:${line}`);
        updateStatus('An error occurred. Check console for details.', true);
    };
    window.onunhandledrejection = (e) => {
        console.error('[DBee] Unhandled promise rejection:', e.reason);
    };

    restoreZoom();
    restoreLanguage();
    restoreToolbarState();
    initCommandPalette();
    initSavedQueries();
    initAiChat();
    initAiSettings();
    initResizers();
    RightPanel.init();
    // Register Phase B tabs (overrides placeholder Inspector)
    RightPanel.registerTab({
        id: 'inspector',
        label: 'Inspector',
        tooltip: 'Inspector — 선택한 테이블/행/쿼리의 상세 정보',
        icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
        render: (el) => Inspector.render(el),
    });
    RightPanel.registerTab({
        id: 'ai',
        label: 'AI',
        tooltip: 'AI Chat (Ctrl+Shift+A)',
        icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4c0 2.8 4 6 4 6s4-3.2 4-6a4 4 0 0 0-4-4z"/><circle cx="12" cy="6" r="1.5"/></svg>',
        render: (el) => AiChatTab.render(el),
    });
    RightPanel.registerTab({
        id: 'history',
        label: 'History',
        tooltip: 'Query History & Saved Queries',
        icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        render: (el) => HistoryTab.render(el),
    });
    initMonaco();
    loadConnections();
    loadSnippetsCache();

    // Flush pending ERD layout save before unload
    window.addEventListener('beforeunload', async () => {
        const activeTab = state.editors.find(t => t.id === state.activeEditorId);
        if (activeTab && activeTab.type === 'erd' && window.erdReact) {
            try {
                const layout = await window.erdReact.getPositions();
                if (layout) {
                    await api.erdLayout.save(activeTab.connId, activeTab.schema, {
                        version: 1, zoom: layout.zoom,
                        pan: layout.viewport ? { x: layout.viewport.x, y: layout.viewport.y } : { x: 0, y: 0 },
                        positions: layout.positions,
                    });
                }
            } catch (e) {}
        }
    });
});
