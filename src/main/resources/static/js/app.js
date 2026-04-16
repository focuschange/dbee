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
        execute: (connectionId, sql, maxRows = 1000) =>
            api.request('POST', '/api/query/execute', { connectionId, sql, maxRows }),
        explain: (connectionId, sql, analyze = false) =>
            api.request('POST', '/api/query/explain', { connectionId, sql, analyze }),
        updateCell: (connectionId, schema, table, primaryKeys, column, value) =>
            api.request('POST', '/api/query/update-cell', { connectionId, schema, table, primaryKeys, column, value }),
    },
    metadata: {
        schemas: (connId) => api.request('GET', `/api/metadata/${connId}/schemas`),
        tables: (connId, schema) => api.request('GET', `/api/metadata/${connId}/schemas/${encodeURIComponent(schema)}/tables`),
        columns: (connId, schema, table) => api.request('GET', `/api/metadata/${connId}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/columns`),
        routines: (connId, schema) => api.request('GET', `/api/metadata/${connId}/schemas/${encodeURIComponent(schema)}/routines`),
        events: (connId, schema) => api.request('GET', `/api/metadata/${connId}/schemas/${encodeURIComponent(schema)}/events`),
        autocomplete: (connId) => api.request('GET', `/api/metadata/${connId}/autocomplete`),
        primaryKeys: (connId, schema, table) => api.request('GET', `/api/metadata/${connId}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/primarykeys`),
    },
    llm: {
        getSettings: () => api.request('GET', '/api/llm/settings'),
        saveSettings: (settings) => api.request('POST', '/api/llm/settings', settings),
        testConnection: (settings) => api.request('POST', '/api/llm/test', settings),
        getProviders: () => api.request('GET', '/api/llm/providers'),
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
    },
    export: {
        csv: async (connectionId, sql) => {
            const res = await fetch('/api/export/csv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connectionId, sql, maxRows: 50000 })
            });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'export.csv';
            a.click();
            URL.revokeObjectURL(url);
        }
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

async function loadAutoCompleteCache(connectionId) {
    try {
        const data = await api.metadata.autocomplete(connectionId);
        state.autocompleteCache = { connectionId, ...data };
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
    state.editors.push({ id, name: 'Query ' + editorCounter, model });
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
        div.className = 'tab' + (tab.id === state.activeEditorId ? ' active' : '');
        div.innerHTML = `
            <span class="tab-label">${tab.name}</span>
            ${state.editors.length > 1 ? '<span class="tab-close">&times;</span>' : ''}
        `;
        div.querySelector('.tab-label').onclick = () => switchTab(tab.id);
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
    state.connections.forEach(conn => {
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

    updateStatus('Executing...');
    document.getElementById('btn-run').disabled = true;

    try {
        const result = await api.query.execute(state.activeConnectionId, sql);
        state.lastResult = { connectionId: state.activeConnectionId, sql };
        displayResult(result);
    } catch (e) {
        displayError(e.message);
    } finally {
        document.getElementById('btn-run').disabled = false;
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
        container.innerHTML = `<div class="result-error">${escapeHtml(result.errorMessage)}</div>`;
        updateStatus(result.errorMessage, true);
        state.resultData = null;
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

function renderResultTable(rows, totalRows) {
    const container = document.getElementById('result-content');
    const { columnNames } = state.resultData;
    const { columnIndex: sortCol, direction: sortDir } = state.sortState;
    const keyword = state.filterKeyword.toLowerCase();

    let html = '<table class="result-table"><thead><tr>';
    columnNames.forEach((col, idx) => {
        const isActive = sortCol === idx;
        const arrow = isActive ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
        const cls = isActive ? ' class="th-sorted"' : '';
        html += `<th${cls} data-col-idx="${idx}"><span class="th-label">${escapeHtml(col)}</span><span class="th-sort-arrow">${arrow}</span></th>`;
    });
    html += '</tr></thead><tbody>';

    const editable = state.resultData.tableName && !keyword;
    rows.forEach((row, rowIdx) => {
        html += `<tr data-row-idx="${rowIdx}">`;
        row.forEach((val, colIdx) => {
            const editAttr = editable ? ` data-col-idx="${colIdx}"` : '';
            if (val === null) {
                html += `<td class="null-value"${editAttr}>NULL</td>`;
            } else {
                const str = String(val);
                html += `<td${editAttr}>${keyword ? highlightMatch(str, keyword) : escapeHtml(str)}</td>`;
            }
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    // Attach sort click handlers
    container.querySelectorAll('.result-table th').forEach(th => {
        th.onclick = () => {
            const idx = parseInt(th.dataset.colIdx);
            sortResultByColumn(idx);
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
        const editLabel = editable ? ' | Editable' : '';
        if (keyword && rows.length !== totalRows) {
            summary.textContent = `${rows.length} / ${totalRows} rows in ${timeMs}ms${editLabel}`;
        } else {
            summary.textContent = `${rows.length} rows in ${timeMs}ms${editLabel}`;
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

function displayError(msg) {
    document.getElementById('result-content').innerHTML = `<div class="result-error">${escapeHtml(msg)}</div>`;
    updateStatus(msg, true);
}

// ============================================================
// Connection Dialog
// ============================================================
function showConnectionDialog(existing) {
    state.editingConnectionId = existing ? existing.id : null;
    document.getElementById('conn-dialog-title').textContent = existing ? 'Edit Connection' : 'New Connection';

    document.getElementById('conn-name').value = existing ? existing.name : '';
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
async function exportCsv() {
    if (!state.activeConnectionId || !state.lastResult) {
        updateStatus('No query result to export', true);
        return;
    }
    try {
        await api.export.csv(state.lastResult.connectionId, state.lastResult.sql);
        updateStatus('Exported successfully');
    } catch (e) {
        updateStatus('Export failed: ' + e.message, true);
    }
}

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
    document.getElementById('btn-new-tab').onclick = () => addEditorTab();
    document.getElementById('btn-add-tab').onclick = () => addEditorTab();
    document.getElementById('btn-export').onclick = exportCsv;

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
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            executeQuery();
        }
        // Ctrl/Cmd+F to focus result filter when result panel is visible
        if ((e.ctrlKey || e.metaKey) && e.key === 'f' && state.resultData) {
            const filterInput = document.getElementById('result-filter-input');
            if (filterInput && filterInput.offsetParent !== null) {
                e.preventDefault();
                filterInput.focus();
                filterInput.select();
            }
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
    const saved = localStorage.getItem('dbee-theme') || 'normal';
    setTheme(saved);

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.onclick = () => setTheme(btn.dataset.theme);
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
    initAiSettings();
    initResizers();
    initMonaco();
    loadConnections();
});
