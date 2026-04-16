// ============================================================
// DBee - Web Application
// ============================================================

const DEFAULT_PORTS = {
    MYSQL: 3306, POSTGRESQL: 5432, ORACLE: 1521,
    SQLITE: 0, MSSQL: 1433, ATHENA: 443
};

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
            if (!res.ok) throw new Error('Export failed');
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

        // Ctrl+Enter to execute
        monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            executeQuery();
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

        // Add AI context menu actions
        monacoEditor.addAction({ id: 'ai-explain', label: 'AI: Explain SQL', contextMenuGroupId: 'ai', run: aiExplainSql });
        monacoEditor.addAction({ id: 'ai-optimize', label: 'AI: Optimize SQL', contextMenuGroupId: 'ai', run: aiOptimizeSql });
        monacoEditor.addAction({ id: 'ai-analyze', label: 'AI: Analyze Results', contextMenuGroupId: 'ai', run: aiAnalyzeResult });

        // Register SQL autocomplete provider
        registerSqlCompletionProvider();

        // Create first tab
        addEditorTab();
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

            return { suggestions: deduplicateSuggestions(suggestions) };
        }
    });
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
    const tab = { id, name: 'Query ' + editorCounter, model, savedContent: '' };
    // Track dirty state
    model.onDidChangeContent(() => {
        tab.dirty = model.getValue() !== tab.savedContent;
        renderTabs();
    });
    state.editors.push(tab);
    renderTabs();
    switchTab(id);
}

function switchTab(id) {
    state.activeEditorId = id;
    const tab = state.editors.find(e => e.id === id);
    if (tab && monacoEditor) {
        monacoEditor.setModel(tab.model);
    }
    renderTabs();
}

function closeTab(id) {
    const idx = state.editors.findIndex(e => e.id === id);
    if (idx === -1 || state.editors.length <= 1) return;

    state.editors[idx].model.dispose();
    state.editors.splice(idx, 1);

    if (state.activeEditorId === id) {
        const newIdx = Math.min(idx, state.editors.length - 1);
        switchTab(state.editors[newIdx].id);
    }
    renderTabs();
}

function renderTabs() {
    const tabList = document.getElementById('tab-list');
    tabList.innerHTML = '';
    state.editors.forEach(tab => {
        const div = document.createElement('div');
        div.className = 'tab' + (tab.id === state.activeEditorId ? ' active' : '') + (tab.dirty ? ' dirty' : '');
        const dirtyDot = tab.dirty ? '<span class="tab-dirty-dot">●</span>' : '';
        div.innerHTML = `
            <span class="tab-label">${escapeHtml(tab.name)}${dirtyDot}</span>
            ${state.editors.length > 1 ? '<span class="tab-close">&times;</span>' : ''}
        `;
        div.querySelector('.tab-label').onclick = () => switchTab(tab.id);
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
        const closeBtn = div.querySelector('.tab-close');
        if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); closeTab(tab.id); };
        tabList.appendChild(div);
    });
}

function getCurrentSql() {
    if (!monacoEditor) return '';
    const selection = monacoEditor.getModel().getValueInRange(monacoEditor.getSelection());
    return selection.trim() ? selection : monacoEditor.getValue();
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
}

function createConnectionNode(conn) {
    const node = document.createElement('div');
    node.className = 'tree-node';
    node.dataset.connId = conn.id;
    node.dataset.type = 'connection';

    const hasSsh = !!conn.properties?.sshTunnelId;
    const sshBadge = hasSsh ? '<span class="tree-badge ssh-badge" title="SSH Tunnel">SSH</span>' : '';

    node.innerHTML = `
        <div class="tree-node-content">
            <span class="tree-arrow">&#9654;</span>
            <span class="tree-icon icon-db">&#9711;</span>
            <span class="tree-label">${escapeHtml(conn.name || conn.databaseType)}${sshBadge}</span>
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
    state.activeConnectionId = conn.id;
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
        menu.innerHTML = '<div class="ctx-item">Show ER Diagram</div>';
        document.body.appendChild(menu);
        menu.querySelector('.ctx-item').onclick = () => { menu.remove(); showErDiagram(connId, schema.name); };
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

    // Tables folder
    const tablesFolder = createCategoryFolder('Tables', SVG_FOLDER_TABLE, 'icon-table', () => loadTablesIntoFolder(connId, schema, tablesFolder));
    childrenEl.appendChild(tablesFolder);

    // Routines folder
    const routinesFolder = createCategoryFolder('Routines', SVG_FOLDER_ROUTINE, 'icon-routine', () => loadRoutinesIntoFolder(connId, schema, routinesFolder));
    childrenEl.appendChild(routinesFolder);

    // Events folder
    const eventsFolder = createCategoryFolder('Events', SVG_FOLDER_EVENT, 'icon-event', () => loadEventsIntoFolder(connId, schema, eventsFolder));
    childrenEl.appendChild(eventsFolder);

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
    content.onclick = () => selectTreeNode(content);

    content.ondblclick = () => {
        if (monacoEditor) {
            monacoEditor.setValue(`SELECT * FROM ${schema}.${table.name} LIMIT 100;`);
        }
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
        content.innerHTML = `<div class="mermaid">${result.mermaid}</div>`;
        if (window.mermaid) {
            mermaid.initialize({ startOnLoad: false, theme: document.body.dataset.theme === 'light' ? 'default' : 'dark' });
            await mermaid.run({ nodes: content.querySelectorAll('.mermaid') });
        }
    } catch (e) {
        content.innerHTML = `<div style="color:var(--error);padding:20px;">Failed: ${e.message}</div>`;
    }
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
        <div class="ctx-separator"></div>
        <div class="ctx-item" data-action="ai-explain-table">AI: Explain Table</div>
    `;
    document.body.appendChild(menu);

    menu.querySelector('[data-action="select-top"]').onclick = () => {
        if (monacoEditor) monacoEditor.setValue(`SELECT * FROM ${schema}.${tableName} LIMIT 100;`);
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
    menu.querySelector('[data-action="ai-explain-table"]').onclick = async () => {
        menu.remove();
        await aiExplainTable(connId, schema, tableName);
    };

    const close = () => { menu.remove(); document.removeEventListener('click', close); };
    setTimeout(() => document.addEventListener('click', close), 0);
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
async function executeQuery() {
    if (!state.activeConnectionId) {
        updateStatus('No active connection. Double-click a connection in the tree.', true);
        return;
    }
    const sql = getCurrentSql();
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
        const results = await api.query.execute(state.activeConnectionId, sql, 1000, executionId);
        state.lastResult = { connectionId: state.activeConnectionId, sql };
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
    if (!state.activeConnectionId) {
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
        const result = await api.query.explain(state.activeConnectionId, sql, analyze);
        state.lastResult = { connectionId: state.activeConnectionId, sql, explain: true };
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
            ${state.activeConnectionId ? `<button class="btn btn-ghost btn-sm ai-fix-btn" onclick="askAiToFix('${escapeHtml(result.errorMessage).replace(/'/g, "\\'")}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4c0 2.8 4 6 4 6s4-3.2 4-6a4 4 0 0 0-4-4z"/><circle cx="12" cy="6" r="1.5"/></svg>
                Ask AI to Fix
            </button>` : ''}
            <div id="ai-fix-result" style="display:none;"></div>
        </div>`;
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

    const conn = state.connections.find(c => c.id === state.activeConnectionId);
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
        html += `<div class="load-more-bar"><button class="btn btn-ghost btn-sm" id="btn-load-more">Show more (${visibleRows.length} of ${rows.length})</button></div>`;
    }
    container.innerHTML = html;

    // Load more button
    const loadMoreBtn = document.getElementById('btn-load-more');
    if (loadMoreBtn) {
        loadMoreBtn.onclick = () => {
            state._renderedCount = Math.min(state._renderedCount + RENDER_PAGE_SIZE, state._allFilteredRows.length);
            // Re-render with more rows (simplified: just re-call full render)
            const moreRows = state._allFilteredRows.slice(0, state._renderedCount);
            // Temporarily override to render more
            const orig = state._allFilteredRows;
            renderResultTable(moreRows.length === orig.length ? orig : moreRows, totalRows);
        };
    }

    // Attach sort click handlers
    container.querySelectorAll('.result-table th').forEach(th => {
        th.onclick = () => {
            const idx = parseInt(th.dataset.colIdx);
            sortResultByColumn(idx);
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

    // Get primary keys (cached)
    if (!state.primaryKeyCache) {
        const pks = await api.metadata.primaryKeys(state.activeConnectionId, schemaName, tableName);
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
    return await api.query.updateCell(state.activeConnectionId, schemaName, tableName, primaryKeys, column, newValue);
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
        const result = await api.query.insertRow(state.activeConnectionId, schemaName, tableName, values);
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

    // Get PKs
    if (!state.primaryKeyCache) {
        const pks = await api.metadata.primaryKeys(state.activeConnectionId, schemaName, tableName);
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
        const result = await api.query.deleteRow(state.activeConnectionId, schemaName, tableName, primaryKeys);
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
        const result = await api.llm.fixSql(state.activeConnectionId, sql, error);

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
        ${state.activeConnectionId ? `<button class="btn btn-ghost btn-sm ai-fix-btn" onclick="askAiToFix('${escapeHtml(msg).replace(/'/g, "\\'")}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4c0 2.8 4 6 4 6s4-3.2 4-6a4 4 0 0 0-4-4z"/><circle cx="12" cy="6" r="1.5"/></svg>
            Ask AI to Fix
        </button>` : ''}
        <div id="ai-fix-result" style="display:none;"></div>
    </div>`;
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
    // Group
    const group = document.getElementById('conn-group').value.trim();
    if (group) info.properties.group = group;

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
        case 'connect':
            activateConnection(contextConn, contextNode);
            break;
        case 'disconnect':
            await api.connections.disconnect(contextConn.id);
            if (state.activeConnectionId === contextConn.id) {
                state.activeConnectionId = null;
                clearAutoCompleteCache();
            }
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
                if (state.activeConnectionId === contextConn.id) {
                    state.activeConnectionId = null;
                    clearAutoCompleteCache();
                }
                await loadConnections();
            }
            break;
    }
}

// ============================================================
// Export
// ============================================================
async function exportData(format) {
    if (!state.activeConnectionId || !state.lastResult) {
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
    } catch (e) {
        console.error('Failed to load connections:', e);
    }
}

// ============================================================
// Event Handlers
// ============================================================
function initEventHandlers() {
    document.getElementById('btn-add-conn').onclick = () => showConnectionDialog();
    document.getElementById('btn-run').onclick = executeQuery;
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
    { name: 'Run Query', shortcut: 'Ctrl+Enter', action: executeQuery },
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
        const result = await api.llm.optimizeSql(state.activeConnectionId, sql);
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
// AI Chat Panel
// ============================================================
function toggleAiChatPanel() {
    const panel = document.getElementById('ai-chat-panel');
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
        document.getElementById('ai-chat-input').focus();
    }
}

function closeAiChatPanel() {
    document.getElementById('ai-chat-panel').style.display = 'none';
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
        let html = `<div class="ai-msg-content">${formatAiMessage(content)}</div>`;
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

    if (!state.activeConnectionId) {
        appendChatMessage('error', 'No active connection. Connect to a database first.');
        return;
    }

    input.value = '';
    input.style.height = 'auto';
    appendChatMessage('user', message);
    const loadingMsg = appendChatMessage('loading', '');

    document.getElementById('btn-ai-chat-send').disabled = true;

    try {
        const result = await api.llm.chat(state.activeConnectionId, message);
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
        updateAiProviderFields();
    } catch (e) {
        console.error('Failed to load AI settings:', e);
    }

    document.getElementById('ai-test-result').style.display = 'none';
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
        list.innerHTML = `<div class="history-empty">Failed to load: ${e.message}</div>`;
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
        list.innerHTML = `<div class="history-empty">Failed to load stats: ${e.message}</div>`;
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
    initEventHandlers();
    initTunnelManager();
    initNotesManager();
    initHistoryManager();
    initCommandPalette();
    initSavedQueries();
    initAiChat();
    initAiSettings();
    initResizers();
    initMonaco();
    loadConnections();
});
