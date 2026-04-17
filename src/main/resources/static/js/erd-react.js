// ============================================================
// DBee - ERD Viewer (React Flow / @xyflow/react)
// ============================================================
// Exposes `window.erdReact` as a bridge for vanilla app.js to call.
// React Flow solves the Cytoscape hit-box issues — each node IS the DOM
// element, so drag / hit-testing / measurement all work natively.

import React, { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { createRoot } from 'react-dom/client';
import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    Controls,
    MiniMap,
    Handle,
    Position,
    useNodesState,
    useEdgesState,
    useReactFlow,
    useInternalNode,
    getSmoothStepPath,
    getBezierPath,
    getStraightPath,
    BaseEdge,
    EdgeLabelRenderer,
} from '@xyflow/react';
import dagre from 'dagre';
import {
    forceSimulation,
    forceLink,
    forceManyBody,
    forceCenter,
    forceCollide,
    forceX,
    forceY,
} from 'd3-force';

// ------------------------------------------------------------
// Type formatting (VARCHAR + size -> VARCHAR(255))
// ------------------------------------------------------------
const SIZED_TYPE = /^(CHAR|VARCHAR|BINARY|VARBINARY|TEXT|TINYTEXT|MEDIUMTEXT|LONGTEXT|DECIMAL|NUMERIC|FLOAT|DOUBLE|NCHAR|NVARCHAR|NTEXT|BIT|STRING)$/i;
function formatType(type, size) {
    if (type == null) return 'UNKNOWN';
    const t = String(type);
    if (size == null || size <= 0) return t;
    const bare = t.replace(/[\s(].*$/, '');
    if (SIZED_TYPE.test(bare)) {
        if (size > 65535) return t;
        return `${bare}(${size})`;
    }
    return t;
}

// ------------------------------------------------------------
// Custom Node: entity table
// ------------------------------------------------------------
const TableNode = React.memo(function TableNode({ data, selected }) {
    const { label, columns = [], options = {}, highlighted, faded } = data;
    const visible = options.pkFkOnly ? columns.filter(c => c.pk || c.fk) : columns;

    const className = [
        'erd-entity',
        'rf-erd-entity',
        selected ? 'selected' : '',
        highlighted ? 'highlighted' : '',
        faded ? 'faded' : '',
    ].filter(Boolean).join(' ');

    return React.createElement('div', { className },
        React.createElement(Handle, { type: 'target', position: Position.Left, id: 'l', style: HANDLE_STYLE }),
        React.createElement(Handle, { type: 'source', position: Position.Right, id: 'r', style: HANDLE_STYLE }),
        React.createElement(Handle, { type: 'target', position: Position.Top, id: 't', style: HANDLE_STYLE }),
        React.createElement(Handle, { type: 'source', position: Position.Bottom, id: 'b', style: HANDLE_STYLE }),
        React.createElement('div', { className: 'erd-entity-header' }, label),
        !options.hideColumns && React.createElement('div', { className: 'erd-entity-body' },
            visible.map(c =>
                React.createElement('div', { className: 'erd-entity-row', key: c.name },
                    React.createElement('span', { className: 'erd-entity-cell' },
                        React.createElement('span', {
                            className: 'erd-cell-icon ' + (c.pk ? 'pk' : c.fk ? 'fk' : ''),
                            title: c.pk ? 'Primary Key' : c.fk ? 'Foreign Key' : '',
                        }, c.pk ? '🔑' : c.fk ? '🔗' : '')
                    ),
                    React.createElement('span', { className: 'erd-entity-cell' },
                        React.createElement('span', { className: 'erd-cell-name' }, c.name),
                        c.nullable === false && React.createElement('span', {
                            style: { color: '#e67e22', marginLeft: 4 },
                            title: 'NOT NULL'
                        }, '●')
                    ),
                    !options.hideTypes && React.createElement('span', { className: 'erd-entity-cell' },
                        React.createElement('span', { className: 'erd-cell-type' }, formatType(c.type, c.size))
                    )
                )
            )
        )
    );
});

const HANDLE_STYLE = {
    opacity: 0,
    width: 8,
    height: 8,
    pointerEvents: 'none',
};

// ------------------------------------------------------------
// Floating-edge geometry: picks the closest points on the source/target
// node rectangles for each edge, so edges are drawn along the shortest
// path between the two tables (edges "float" around the node boundary).
// Adapted from the React Flow "floating edges" pattern.
// ------------------------------------------------------------
function getNodeIntersection(intersectionNode, targetNode) {
    const iw = intersectionNode.measured?.width ?? intersectionNode.width ?? 260;
    const ih = intersectionNode.measured?.height ?? intersectionNode.height ?? 120;
    const tw = targetNode.measured?.width ?? targetNode.width ?? 260;
    const th = targetNode.measured?.height ?? targetNode.height ?? 120;
    const ipos = intersectionNode.internals?.positionAbsolute ?? intersectionNode.position;
    const tpos = targetNode.internals?.positionAbsolute ?? targetNode.position;

    const w = iw / 2;
    const h = ih / 2;
    const x2 = ipos.x + w;
    const y2 = ipos.y + h;
    const x1 = tpos.x + tw / 2;
    const y1 = tpos.y + th / 2;

    const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
    const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
    const denom = Math.abs(xx1) + Math.abs(yy1) || 1;
    const a = 1 / denom;
    const xx3 = a * xx1;
    const yy3 = a * yy1;
    const x = w * (xx3 + yy3) + x2;
    const y = h * (yy3 - xx3) + y2;
    return { x, y };
}

function getEdgePosition(node, intersection) {
    const pos = node.internals?.positionAbsolute ?? node.position;
    const w = node.measured?.width ?? node.width ?? 260;
    const h = node.measured?.height ?? node.height ?? 120;
    const nx = Math.round(pos.x);
    const ny = Math.round(pos.y);
    const px = Math.round(intersection.x);
    const py = Math.round(intersection.y);
    if (px <= nx + 1) return Position.Left;
    if (px >= nx + w - 1) return Position.Right;
    if (py <= ny + 1) return Position.Top;
    if (py >= ny + h - 1) return Position.Bottom;
    return Position.Top;
}

function getEdgeParams(source, target) {
    const sp = getNodeIntersection(source, target);
    const tp = getNodeIntersection(target, source);
    return {
        sx: sp.x, sy: sp.y, tx: tp.x, ty: tp.y,
        sourcePos: getEdgePosition(source, sp),
        targetPos: getEdgePosition(target, tp),
    };
}

// ------------------------------------------------------------
// Custom Edge: Crow's foot (fork at "many", double-bar at "one")
// ------------------------------------------------------------
// Direction vector pointing AWAY from the node at the given Position.
function outwardVector(pos) {
    switch (pos) {
        case Position.Top:    return { x: 0,  y: -1 };
        case Position.Bottom: return { x: 0,  y: 1 };
        case Position.Left:   return { x: -1, y: 0 };
        case Position.Right:  return { x: 1,  y: 0 };
        default: return { x: 1, y: 0 };
    }
}

function FloatingCrowsFootEdge({ id, source, target, label }) {
    const sourceNode = useInternalNode(source);
    const targetNode = useInternalNode(target);
    if (!sourceNode || !targetNode) return null;

    const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX: sx, sourceY: sy, targetX: tx, targetY: ty,
        sourcePosition: sourcePos, targetPosition: targetPos,
        borderRadius: 8,
    });

    // --- Crow's-foot (MANY) fork drawn manually at source ---
    // Teeth AT the table edge (sx, sy), apex FORKLEN units along the line (outward from source)
    const FORK_LEN = 14;
    const FORK_HALF_WIDTH = 10;
    const srcOut = outwardVector(sourcePos);
    const srcPerp = { x: -srcOut.y, y: srcOut.x }; // rotated 90°
    const apex = { x: sx + srcOut.x * FORK_LEN, y: sy + srcOut.y * FORK_LEN };
    const toothMid   = { x: sx, y: sy };
    const toothLeft  = { x: sx + srcPerp.x * FORK_HALF_WIDTH, y: sy + srcPerp.y * FORK_HALF_WIDTH };
    const toothRight = { x: sx - srcPerp.x * FORK_HALF_WIDTH, y: sy - srcPerp.y * FORK_HALF_WIDTH };
    const forkPath = `M ${toothLeft.x} ${toothLeft.y} L ${apex.x} ${apex.y}`
        + ` M ${toothMid.x} ${toothMid.y} L ${apex.x} ${apex.y}`
        + ` M ${toothRight.x} ${toothRight.y} L ${apex.x} ${apex.y}`;

    // --- Double bar (ONE) drawn manually at target ---
    // Two bars perpendicular to the tangent, spaced along the line before (tx, ty)
    const BAR_HALF = 9;
    const BAR1_DIST = 6;
    const BAR2_DIST = 13;
    const tgtOut = outwardVector(targetPos);
    const tgtPerp = { x: -tgtOut.y, y: tgtOut.x };
    const bar1Center = { x: tx + tgtOut.x * BAR1_DIST, y: ty + tgtOut.y * BAR1_DIST };
    const bar2Center = { x: tx + tgtOut.x * BAR2_DIST, y: ty + tgtOut.y * BAR2_DIST };
    const barPath =
        `M ${bar1Center.x + tgtPerp.x * BAR_HALF} ${bar1Center.y + tgtPerp.y * BAR_HALF}`
      + ` L ${bar1Center.x - tgtPerp.x * BAR_HALF} ${bar1Center.y - tgtPerp.y * BAR_HALF}`
      + ` M ${bar2Center.x + tgtPerp.x * BAR_HALF} ${bar2Center.y + tgtPerp.y * BAR_HALF}`
      + ` L ${bar2Center.x - tgtPerp.x * BAR_HALF} ${bar2Center.y - tgtPerp.y * BAR_HALF}`;

    const edgeColor = '#7c8cff';

    return React.createElement(React.Fragment, null,
        React.createElement(BaseEdge, {
            id,
            path: edgePath,
            style: { stroke: edgeColor, strokeWidth: 1.5 },
        }),
        // Inline SVG paths for the crow's-foot symbols — guarantees correct placement
        React.createElement('path', {
            d: forkPath, stroke: edgeColor, strokeWidth: 1.8,
            fill: 'none', strokeLinecap: 'round', pointerEvents: 'none',
        }),
        React.createElement('path', {
            d: barPath, stroke: edgeColor, strokeWidth: 2.2,
            fill: 'none', strokeLinecap: 'round', pointerEvents: 'none',
        }),
        label && React.createElement(EdgeLabelRenderer, null,
            React.createElement('div', {
                className: 'rf-edge-label',
                style: { transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }
            }, label)
        )
    );
}

// Floating simple edge: computes intersection points dynamically so the edge
// always starts/ends at the closest point between the two tables.
function makeFloatingEdge(pathFn) {
    return function ({ id, source, target, label, style = {} }) {
        const sourceNode = useInternalNode(source);
        const targetNode = useInternalNode(target);
        if (!sourceNode || !targetNode) return null;
        const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);
        const [edgePath, labelX, labelY] = pathFn({
            sourceX: sx, sourceY: sy, targetX: tx, targetY: ty,
            sourcePosition: sourcePos, targetPosition: targetPos,
        });
        return React.createElement(React.Fragment, null,
            React.createElement(BaseEdge, {
                id, path: edgePath,
                style: { stroke: '#888', strokeWidth: 1.5, ...style },
                markerEnd: 'url(#arrow-triangle)',
            }),
            label && React.createElement(EdgeLabelRenderer, null,
                React.createElement('div', {
                    className: 'rf-edge-label',
                    style: { transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }
                }, label)
            )
        );
    };
}

const BezierEdge   = makeFloatingEdge(getBezierPath);
const StraightEdge = makeFloatingEdge(getStraightPath);
const StepEdge     = makeFloatingEdge((p) => getSmoothStepPath({ ...p, borderRadius: 0 }));
const CrowsFootEdge = FloatingCrowsFootEdge;

const EDGE_TYPES = {
    bezier: BezierEdge,
    straight: StraightEdge,
    step: StepEdge,
    crowsfoot: CrowsFootEdge,
};

// ------------------------------------------------------------
// SVG Markers — minimal, for default arrow on simple edges.
// Crow's foot is now drawn inline inside FloatingCrowsFootEdge,
// so no cf-many / cf-one markers are needed here.
// ------------------------------------------------------------
function SvgMarkers() {
    return React.createElement('svg', {
        style: { position: 'absolute', top: 0, left: 0, width: 0, height: 0, pointerEvents: 'none' }
    },
        React.createElement('defs', null,
            React.createElement('marker', {
                id: 'arrow-triangle',
                viewBox: '0 0 10 10', refX: '8', refY: '5',
                markerWidth: '6', markerHeight: '6', orient: 'auto',
            },
                React.createElement('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#888' })
            )
        )
    );
}

// ------------------------------------------------------------
// Dagre auto-layout
// ------------------------------------------------------------
function runDagreLayout(nodes, edges, direction = 'LR') {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: direction, nodesep: 80, ranksep: 140, marginx: 40, marginy: 40 });
    g.setDefaultEdgeLabel(() => ({}));
    nodes.forEach(n => {
        // Use measured size if available (React Flow sets width/height once rendered)
        g.setNode(n.id, { width: n.measured?.width || 280, height: n.measured?.height || 180 });
    });
    edges.forEach(e => g.setEdge(e.source, e.target));
    dagre.layout(g);
    return nodes.map(n => {
        const p = g.node(n.id);
        return { ...n, position: { x: p.x - p.width / 2, y: p.y - p.height / 2 } };
    });
}

// Helper: largest node dimensions (with fallback) for overlap-free spacing
function maxNodeSize(nodes) {
    let w = 280, h = 180;
    nodes.forEach(n => {
        const nw = n.measured?.width || n.width || 280;
        const nh = n.measured?.height || n.height || 180;
        if (nw > w) w = nw;
        if (nh > h) h = nh;
    });
    return { w, h };
}

function simpleGridLayout(nodes) {
    const { w, h } = maxNodeSize(nodes);
    const cellW = w + 100;  // 100px horizontal gap
    const cellH = h + 80;   // 80px vertical gap
    const cols = Math.ceil(Math.sqrt(nodes.length));
    return nodes.map((n, i) => ({
        ...n,
        position: { x: (i % cols) * cellW, y: Math.floor(i / cols) * cellH },
    }));
}

/**
 * Force-directed layout — minimizes total edge length while preventing overlap.
 * Produces tighter, more organic layouts than dagre for ER diagrams.
 */
function forceLayout(nodes, edges) {
    const { w, h } = maxNodeSize(nodes);
    // Copy node state for the simulation
    const simNodes = nodes.map(n => ({
        id: n.id,
        x: n.position?.x ?? 0,
        y: n.position?.y ?? 0,
        w: n.measured?.width || n.width || w,
        h: n.measured?.height || n.height || h,
    }));
    const simEdges = edges.map(e => ({ source: e.source, target: e.target }));

    const linkDistance = Math.max(w, h) * 0.9 + 40;
    const collideRadius = d => Math.max(d.w, d.h) / 2 + 40;

    const sim = forceSimulation(simNodes)
        .force('charge', forceManyBody().strength(-2200).distanceMax(1500))
        .force('link', forceLink(simEdges).id(d => d.id).distance(linkDistance).strength(1.1))
        .force('center', forceCenter(0, 0))
        .force('collide', forceCollide().radius(collideRadius).strength(1).iterations(3))
        .force('x', forceX(0).strength(0.04))
        .force('y', forceY(0).strength(0.04))
        .stop();

    // Run simulation to completion synchronously
    const iterations = Math.max(300, Math.ceil(Math.log(0.001) / Math.log(1 - 0.0228)));
    for (let i = 0; i < iterations; i++) sim.tick();

    const posById = new Map(simNodes.map(n => [n.id, { x: n.x, y: n.y }]));
    return nodes.map(n => ({ ...n, position: posById.get(n.id) || n.position }));
}

function circleLayout(nodes) {
    const { w, h } = maxNodeSize(nodes);
    const n = nodes.length;
    // Minimum arc length between centers must accommodate the largest node
    const minStep = Math.max(w, h) + 100;
    const radius = Math.max(260, (n * minStep) / (2 * Math.PI));
    return nodes.map((node, i) => {
        const theta = (2 * Math.PI * i) / n;
        return {
            ...node,
            position: {
                x: Math.cos(theta) * radius + radius,
                y: Math.sin(theta) * radius + radius,
            }
        };
    });
}

// ------------------------------------------------------------
// Main ERD App component (with imperative handle for bridge)
// ------------------------------------------------------------
const ErdApp = forwardRef(function ErdApp({ graph, savedLayout, options: initialOptions, onPositionsChange, onTableDoubleClick }, ref) {
    const initialNodes = useMemo(() => {
        return graph.nodes.map(n => {
            const pos = savedLayout?.positions?.[n.id];
            return {
                id: n.id,
                type: 'table',
                position: pos ? { x: pos.x, y: pos.y } : { x: 0, y: 0 },
                data: {
                    label: n.label,
                    columns: n.columns,
                    comment: n.comment,
                    options: initialOptions,
                    highlighted: false,
                    faded: false,
                },
            };
        });
    }, [graph.nodes]);

    const initialEdges = useMemo(() => {
        const edgeType = initialOptions.edgeStyle || 'bezier';
        return graph.edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
            type: edgeType,
            // No sourceHandle/targetHandle — edges are "floating" and compute
            // the closest connection points dynamically in the custom edge component.
        }));
    }, [graph.edges]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [options, setOptions] = useState(initialOptions);
    const reactFlowInstance = useReactFlow();
    const firstLayoutDone = useRef(!!(savedLayout?.positions && Object.keys(savedLayout.positions).length > 0));

    // Update nodes when options change (so Hide columns / types etc. reflect)
    useEffect(() => {
        setNodes(nodes => nodes.map(n => ({ ...n, data: { ...n.data, options } })));
    }, [options.hideColumns, options.hideTypes, options.pkFkOnly]);

    // Update edges when edgeStyle changes
    useEffect(() => {
        setEdges(edges => edges.map(e => ({ ...e, type: options.edgeStyle || 'bezier' })));
    }, [options.edgeStyle]);

    // Run auto-layout on first render (if no saved positions)
    useEffect(() => {
        if (firstLayoutDone.current) return;
        const t = setTimeout(() => {
            const measured = reactFlowInstance.getNodes();
            const currentEdges = reactFlowInstance.getEdges();
            // Use the user's preferred layout or default to force-directed (shortest edges)
            const algo = initialOptions.layout || 'force';
            let laid;
            switch (algo) {
                case 'force':    laid = forceLayout(measured, currentEdges); break;
                case 'dagre-tb': laid = runDagreLayout(measured, currentEdges, 'TB'); break;
                case 'dagre-lr': laid = runDagreLayout(measured, currentEdges, 'LR'); break;
                case 'dagre-bt': laid = runDagreLayout(measured, currentEdges, 'BT'); break;
                case 'dagre-rl': laid = runDagreLayout(measured, currentEdges, 'RL'); break;
                case 'grid':     laid = simpleGridLayout(measured); break;
                case 'circle':   laid = circleLayout(measured); break;
                default:         laid = forceLayout(measured, currentEdges);
            }
            const posMap = new Map(laid.map(n => [n.id, n.position]));
            setNodes(prev => prev.map(n => {
                const p = posMap.get(n.id);
                return p ? { ...n, position: p } : n;
            }));
            setTimeout(() => reactFlowInstance.fitView({ padding: 0.1, duration: 400 }), 120);
            firstLayoutDone.current = true;
        }, 250);
        return () => clearTimeout(t);
    }, []);

    // Notify parent when positions change (debounced save)
    const saveTimer = useRef(null);
    const notifyPositions = useCallback(() => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            if (onPositionsChange) {
                const positions = {};
                reactFlowInstance.getNodes().forEach(n => { positions[n.id] = { x: n.position.x, y: n.position.y }; });
                onPositionsChange({
                    zoom: reactFlowInstance.getZoom(),
                    viewport: reactFlowInstance.getViewport(),
                    positions,
                });
            }
        }, 1000);
    }, [onPositionsChange, reactFlowInstance]);

    const onNodeDragStop = useCallback(() => notifyPositions(), [notifyPositions]);
    const onNodeDoubleClick = useCallback((_evt, node) => {
        if (onTableDoubleClick) onTableDoubleClick(node.id);
    }, [onTableDoubleClick]);

    // Focus mode: highlight connected when a node is selected
    const applyFocus = useCallback((selectedId) => {
        if (!options.focusMode) {
            setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, faded: false } })));
            return;
        }
        if (!selectedId) {
            setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, faded: false } })));
            return;
        }
        const connected = new Set([selectedId]);
        edges.forEach(e => {
            if (e.source === selectedId) connected.add(e.target);
            if (e.target === selectedId) connected.add(e.source);
        });
        setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, faded: !connected.has(n.id) } })));
    }, [options.focusMode, edges]);

    const onNodeClick = useCallback((_evt, node) => applyFocus(node.id), [applyFocus]);
    const onPaneClick = useCallback(() => applyFocus(null), [applyFocus]);

    // Imperative handle exposed to vanilla JS via window.erdReact
    useImperativeHandle(ref, () => ({
        getPositions() {
            const positions = {};
            reactFlowInstance.getNodes().forEach(n => { positions[n.id] = { x: n.position.x, y: n.position.y }; });
            return {
                zoom: reactFlowInstance.getZoom(),
                viewport: reactFlowInstance.getViewport(),
                positions,
            };
        },
        applyPositions(positions) {
            setNodes(ns => ns.map(n => positions[n.id] ? { ...n, position: positions[n.id] } : n));
            notifyPositions();
        },
        runLayout(algorithm = 'dagre-lr') {
            // Pull live nodes/edges from React Flow (not closure references,
            // which may be stale after edge style changes etc.)
            const currentNodes = reactFlowInstance.getNodes();
            const currentEdges = reactFlowInstance.getEdges();
            if (!currentNodes.length) {
                console.warn('[erdReact] runLayout: no nodes to arrange');
                return;
            }
            let laid;
            switch (algorithm) {
                case 'force':    laid = forceLayout(currentNodes, currentEdges); break;
                case 'dagre-tb': laid = runDagreLayout(currentNodes, currentEdges, 'TB'); break;
                case 'dagre-lr': laid = runDagreLayout(currentNodes, currentEdges, 'LR'); break;
                case 'dagre-bt': laid = runDagreLayout(currentNodes, currentEdges, 'BT'); break;
                case 'dagre-rl': laid = runDagreLayout(currentNodes, currentEdges, 'RL'); break;
                case 'grid':     laid = simpleGridLayout(currentNodes); break;
                case 'circle':   laid = circleLayout(currentNodes); break;
                default:         laid = forceLayout(currentNodes, currentEdges);
            }
            // Build a map of id → new position, then update ONLY the position field
            // via functional setNodes — this preserves all other React Flow-managed state.
            const posMap = new Map(laid.map(n => [n.id, n.position]));
            setNodes(prev => prev.map(n => {
                const p = posMap.get(n.id);
                return p ? { ...n, position: p } : n;
            }));
            setTimeout(() => reactFlowInstance.fitView({ padding: 0.1, duration: 400 }), 80);
            notifyPositions();
        },
        setOptions(partial) {
            setOptions(prev => ({ ...prev, ...partial }));
        },
        getOptions() { return options; },
        fitView() { reactFlowInstance.fitView({ padding: 0.1, duration: 400 }); },
        zoomIn() { reactFlowInstance.zoomIn({ duration: 200 }); },
        zoomOut() { reactFlowInstance.zoomOut({ duration: 200 }); },
        resetZoom() { reactFlowInstance.zoomTo(1, { duration: 200 }); },
        getZoom() { return reactFlowInstance.getZoom(); },
        searchHighlight(query) {
            const q = (query || '').trim().toLowerCase();
            if (!q) {
                setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, highlighted: false, faded: false } })));
                return;
            }
            const matched = [];
            setNodes(ns => ns.map(n => {
                const hit = n.data.label.toLowerCase().includes(q);
                if (hit) matched.push(n);
                return { ...n, data: { ...n.data, highlighted: hit, faded: !hit } };
            }));
            if (matched.length > 0) {
                setTimeout(() => reactFlowInstance.fitView({
                    padding: 0.2, duration: 400, nodes: matched.map(m => ({ id: m.id })),
                }), 50);
            }
        },
        getGraph() {
            // Returns structural graph (for export). Positions come from getPositions.
            return graph;
        },
    }), [reactFlowInstance, edges, options, graph, notifyPositions]);

    // Minimap with high-contrast node rendering
    const minimapProp = options.minimap
        ? React.createElement(MiniMap, {
            pannable: true,
            zoomable: true,
            nodeStrokeWidth: 4,
            nodeColor: '#5294e2',
            nodeStrokeColor: '#ffffff',
            nodeBorderRadius: 4,
            maskColor: 'rgba(0, 0, 0, 0.65)',
            maskStrokeColor: '#f39c12',
            maskStrokeWidth: 2,
            style: { background: '#1a1d23' },
        })
        : null;

    return React.createElement('div', { className: 'rf-erd-wrapper', style: { width: '100%', height: '100%', position: 'relative' } },
        React.createElement(SvgMarkers),
        React.createElement(ReactFlow, {
            nodes,
            edges,
            onNodesChange,
            onEdgesChange,
            onNodeDragStop,
            onNodeClick,
            onPaneClick,
            onNodeDoubleClick,
            nodeTypes: NODE_TYPES,
            edgeTypes: EDGE_TYPES,
            fitView: false,
            attributionPosition: 'bottom-right',
            proOptions: { hideAttribution: true },
            minZoom: 0.2,
            maxZoom: 3,
            defaultViewport: savedLayout?.viewport || { x: 0, y: 0, zoom: 1 },
        },
            React.createElement(Background, { gap: 24, size: 1, color: 'rgba(127,127,127,0.2)' }),
            minimapProp
        )
    );
});

const NODE_TYPES = { table: TableNode };

// ------------------------------------------------------------
// Bridge for vanilla app.js
// ------------------------------------------------------------
let _root = null;
let _api = null;

function mount(container, params) {
    if (_root) destroy();
    _root = createRoot(container);
    const apiRef = React.createRef();
    const element = React.createElement(ReactFlowProvider, null,
        React.createElement(ErdApp, {
            ref: apiRef,
            graph: params.graph,
            savedLayout: params.savedLayout || null,
            options: params.options || {},
            onPositionsChange: params.onPositionsChange,
            onTableDoubleClick: params.onTableDoubleClick,
        })
    );
    _root.render(element);
    // Expose api once mounted
    // React doesn't populate ref synchronously, so wait one microtask
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            _api = apiRef.current;
            resolve(_api);
        });
    });
}

function destroy() {
    if (_root) {
        try { _root.unmount(); } catch (e) {}
        _root = null;
    }
    _api = null;
}

// Wait until the React imperative handle is available
function waitForApi(retries = 10) {
    return new Promise((resolve) => {
        const tick = (left) => {
            if (_api) return resolve(_api);
            if (left <= 0) return resolve(null);
            requestAnimationFrame(() => tick(left - 1));
        };
        tick(retries);
    });
}

window.erdReact = {
    mount,
    destroy,
    async getPositions() { const api = await waitForApi(); return api ? api.getPositions() : null; },
    async applyPositions(p) { const api = await waitForApi(); if (api) api.applyPositions(p); },
    async runLayout(alg) { const api = await waitForApi(); if (api) api.runLayout(alg); },
    async setOptions(opts) { const api = await waitForApi(); if (api) api.setOptions(opts); },
    async getOptions() { const api = await waitForApi(); return api ? api.getOptions() : null; },
    async fitView() { const api = await waitForApi(); if (api) api.fitView(); },
    async zoomIn() { const api = await waitForApi(); if (api) api.zoomIn(); },
    async zoomOut() { const api = await waitForApi(); if (api) api.zoomOut(); },
    async resetZoom() { const api = await waitForApi(); if (api) api.resetZoom(); },
    async getZoom() { const api = await waitForApi(); return api ? api.getZoom() : 1; },
    async searchHighlight(q) { const api = await waitForApi(); if (api) api.searchHighlight(q); },
    async getGraph() { const api = await waitForApi(); return api ? api.getGraph() : null; },
};

console.log('[DBee] ERD React module loaded');
