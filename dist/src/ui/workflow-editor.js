// N8n-Inspired Workflow Visual Editor
import { EventEmitter } from 'events';
export class WorkflowEditor extends EventEmitter {
    canvas;
    ctx;
    state;
    config;
    palette;
    animationId = null;
    constructor(canvasElement) {
        super();
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.state = this.initializeState();
        this.config = this.initializeConfig();
        this.palette = this.initializePalette();
        this.setupEventListeners();
        this.startRenderLoop();
    }
    // Public API
    loadWorkflow(workflow) {
        this.state.workflow = workflow;
        this.emit('workflowLoaded', workflow);
        this.render();
    }
    saveWorkflow() {
        if (!this.state.workflow)
            return null;
        // Update node positions from canvas
        this.updateWorkflowFromCanvas();
        return this.state.workflow;
    }
    addNode(nodeType, position) {
        if (!this.state.workflow)
            return '';
        const nodeId = this.generateNodeId();
        const node = {
            id: nodeId,
            name: this.generateNodeName(nodeType),
            type: nodeType,
            typeVersion: 1,
            position: [position.x, position.y],
            parameters: {}
        };
        this.state.workflow.nodes.push(node);
        this.emit('nodeAdded', { nodeId, node });
        this.render();
        return nodeId;
    }
    removeNode(nodeId) {
        if (!this.state.workflow)
            return;
        // Remove node
        const nodeIndex = this.state.workflow.nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex > -1) {
            this.state.workflow.nodes.splice(nodeIndex, 1);
        }
        // Remove connections
        this.removeNodeConnections(nodeId);
        this.emit('nodeRemoved', { nodeId });
        this.render();
    }
    connectNodes(sourceId, targetId, sourceIndex = 0, targetIndex = 0) {
        if (!this.state.workflow)
            return;
        const connections = this.state.workflow.connections;
        if (!connections[sourceId]) {
            connections[sourceId] = { main: [] };
        }
        if (!connections[sourceId].main[sourceIndex]) {
            connections[sourceId].main[sourceIndex] = [];
        }
        connections[sourceId].main[sourceIndex].push({
            node: targetId,
            type: 'main',
            index: targetIndex
        });
        this.emit('connectionAdded', { sourceId, targetId, sourceIndex, targetIndex });
        this.render();
    }
    selectNode(nodeId, multiSelect = false) {
        if (!multiSelect) {
            this.state.selectedNodes = [nodeId];
        }
        else {
            const index = this.state.selectedNodes.indexOf(nodeId);
            if (index > -1) {
                this.state.selectedNodes.splice(index, 1);
            }
            else {
                this.state.selectedNodes.push(nodeId);
            }
        }
        this.emit('selectionChanged', { selectedNodes: this.state.selectedNodes });
        this.render();
    }
    copyNodes() {
        if (!this.state.workflow || this.state.selectedNodes.length === 0)
            return;
        const selectedNodes = this.state.workflow.nodes.filter(node => this.state.selectedNodes.includes(node.id));
        this.state.clipboard.nodes = selectedNodes.map(node => ({
            ...node,
            id: this.generateNodeId() // Generate new IDs for copying
        }));
        this.emit('nodesCopied', { count: selectedNodes.length });
    }
    pasteNodes(offset = { x: 50, y: 50 }) {
        if (!this.state.workflow || this.state.clipboard.nodes.length === 0)
            return;
        const pastedNodes = this.state.clipboard.nodes.map(node => ({
            ...node,
            id: this.generateNodeId(),
            name: this.generateNodeName(node.type),
            position: [node.position[0] + offset.x, node.position[1] + offset.y]
        }));
        this.state.workflow.nodes.push(...pastedNodes);
        this.state.selectedNodes = pastedNodes.map(node => node.id);
        this.emit('nodesPasted', { nodes: pastedNodes });
        this.render();
    }
    zoomIn() {
        this.state.zoom = Math.min(this.state.zoom * 1.2, 3);
        this.render();
    }
    zoomOut() {
        this.state.zoom = Math.max(this.state.zoom / 1.2, 0.1);
        this.render();
    }
    resetView() {
        this.state.zoom = 1;
        this.state.pan = { x: 0, y: 0 };
        this.render();
    }
    fitToView() {
        if (!this.state.workflow || this.state.workflow.nodes.length === 0)
            return;
        const bounds = this.calculateWorkflowBounds();
        const padding = 50;
        const scaleX = (this.canvas.width - 2 * padding) / (bounds.width || 1);
        const scaleY = (this.canvas.height - 2 * padding) / (bounds.height || 1);
        this.state.zoom = Math.min(scaleX, scaleY, 1);
        this.state.pan = {
            x: -bounds.left * this.state.zoom + padding,
            y: -bounds.top * this.state.zoom + padding
        };
        this.render();
    }
    // Private Methods
    initializeState() {
        return {
            workflow: null,
            selectedNodes: [],
            selectedConnections: [],
            clipboard: { nodes: [], connections: [] },
            zoom: 1,
            pan: { x: 0, y: 0 },
            mode: 'select',
            dragState: null
        };
    }
    initializeConfig() {
        return {
            width: this.canvas.width,
            height: this.canvas.height,
            gridSize: 20,
            showGrid: true,
            snapToGrid: false,
            backgroundColor: '#f5f5f5',
            nodeWidth: 180,
            nodeHeight: 80
        };
    }
    initializePalette() {
        return {
            categories: [
                {
                    name: 'Triggers',
                    icon: '⚡',
                    nodeTypes: [],
                    expanded: true
                },
                {
                    name: 'AI & LLM',
                    icon: '🤖',
                    nodeTypes: [],
                    expanded: true
                },
                {
                    name: 'Data Processing',
                    icon: '⚙️',
                    nodeTypes: [],
                    expanded: false
                },
                {
                    name: 'Communication',
                    icon: '💬',
                    nodeTypes: [],
                    expanded: false
                }
            ],
            searchFilter: '',
            expandedCategories: new Set(['Triggers', 'AI & LLM'])
        };
    }
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        // Keyboard events
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        // Context menu
        this.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        // Resize
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    handleMouseDown(event) {
        const canvasRect = this.canvas.getBoundingClientRect();
        const x = event.clientX - canvasRect.left;
        const y = event.clientY - canvasRect.top;
        const worldPos = this.screenToWorld({ x, y });
        const hitNode = this.getNodeAtPosition(worldPos);
        if (hitNode) {
            this.selectNode(hitNode.id, event.ctrlKey || event.metaKey);
            this.state.dragState = {
                type: 'node',
                startPosition: worldPos,
                currentPosition: worldPos,
                draggedElement: hitNode
            };
        }
        else {
            // Clear selection if clicking on empty space
            if (!event.shiftKey) {
                this.state.selectedNodes = [];
                this.emit('selectionChanged', { selectedNodes: [] });
            }
            // Start panning
            this.state.dragState = {
                type: 'selection',
                startPosition: worldPos,
                currentPosition: worldPos,
                draggedElement: null
            };
        }
        this.render();
    }
    handleMouseMove(event) {
        const canvasRect = this.canvas.getBoundingClientRect();
        const x = event.clientX - canvasRect.left;
        const y = event.clientY - canvasRect.top;
        const worldPos = this.screenToWorld({ x, y });
        if (this.state.dragState) {
            this.state.dragState.currentPosition = worldPos;
            if (this.state.dragState.type === 'node') {
                // Move selected nodes
                const deltaX = worldPos.x - this.state.dragState.startPosition.x;
                const deltaY = worldPos.y - this.state.dragState.startPosition.y;
                this.moveSelectedNodes({ x: deltaX, y: deltaY });
            }
            else if (this.state.dragState.type === 'selection') {
                // Pan the view
                const deltaX = x - this.screenToWorld(this.state.dragState.startPosition).x;
                const deltaY = y - this.screenToWorld(this.state.dragState.startPosition).y;
                this.state.pan.x += deltaX;
                this.state.pan.y += deltaY;
            }
            this.render();
        }
        // Update cursor
        const hitNode = this.getNodeAtPosition(worldPos);
        this.canvas.style.cursor = hitNode ? 'pointer' : 'default';
    }
    handleMouseUp(event) {
        this.state.dragState = null;
        this.canvas.style.cursor = 'default';
    }
    handleWheel(event) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(3, this.state.zoom * delta));
        // Zoom towards mouse position
        const canvasRect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - canvasRect.left;
        const mouseY = event.clientY - canvasRect.top;
        const worldBefore = this.screenToWorld({ x: mouseX, y: mouseY });
        this.state.zoom = newZoom;
        const worldAfter = this.screenToWorld({ x: mouseX, y: mouseY });
        this.state.pan.x += (worldAfter.x - worldBefore.x) * this.state.zoom;
        this.state.pan.y += (worldAfter.y - worldBefore.y) * this.state.zoom;
        this.render();
    }
    handleKeyDown(event) {
        if (event.target !== document.body)
            return;
        switch (event.key) {
            case 'Delete':
            case 'Backspace':
                this.deleteSelectedNodes();
                break;
            case 'c':
                if (event.ctrlKey || event.metaKey) {
                    this.copyNodes();
                }
                break;
            case 'v':
                if (event.ctrlKey || event.metaKey) {
                    this.pasteNodes();
                }
                break;
            case 'a':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.selectAllNodes();
                }
                break;
            case 'Escape':
                this.state.selectedNodes = [];
                this.emit('selectionChanged', { selectedNodes: [] });
                this.render();
                break;
        }
    }
    handleContextMenu(event) {
        event.preventDefault();
        const canvasRect = this.canvas.getBoundingClientRect();
        const x = event.clientX - canvasRect.left;
        const y = event.clientY - canvasRect.top;
        const worldPos = this.screenToWorld({ x, y });
        const hitNode = this.getNodeAtPosition(worldPos);
        this.emit('contextMenu', {
            position: { x: event.clientX, y: event.clientY },
            worldPosition: worldPos,
            node: hitNode
        });
    }
    handleResize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.config.width = rect.width;
        this.config.height = rect.height;
        this.render();
    }
    startRenderLoop() {
        const renderFrame = () => {
            this.render();
            this.animationId = requestAnimationFrame(renderFrame);
        };
        this.animationId = requestAnimationFrame(renderFrame);
    }
    render() {
        // Clear canvas
        this.ctx.fillStyle = this.config.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        // Draw grid
        if (this.config.showGrid) {
            this.drawGrid();
        }
        // Apply transforms
        this.ctx.save();
        this.ctx.scale(this.state.zoom, this.state.zoom);
        this.ctx.translate(this.state.pan.x / this.state.zoom, this.state.pan.y / this.state.zoom);
        // Draw connections
        this.drawConnections();
        // Draw nodes
        this.drawNodes();
        // Draw selection box
        if (this.state.dragState && this.state.dragState.type === 'selection') {
            this.drawSelectionBox();
        }
        this.ctx.restore();
    }
    drawGrid() {
        const gridSize = this.config.gridSize * this.state.zoom;
        const offsetX = this.state.pan.x % gridSize;
        const offsetY = this.state.pan.y % gridSize;
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        // Vertical lines
        for (let x = offsetX; x < this.canvas.width; x += gridSize) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
        }
        // Horizontal lines
        for (let y = offsetY; y < this.canvas.height; y += gridSize) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
        }
        this.ctx.stroke();
    }
    drawNodes() {
        if (!this.state.workflow)
            return;
        for (const node of this.state.workflow.nodes) {
            this.drawNode(node);
        }
    }
    drawNode(node) {
        const x = node.position[0];
        const y = node.position[1];
        const width = this.config.nodeWidth;
        const height = this.config.nodeHeight;
        const isSelected = this.state.selectedNodes.includes(node.id);
        // Node background
        this.ctx.fillStyle = node.color || (isSelected ? '#4dabf7' : '#ffffff');
        this.ctx.strokeStyle = isSelected ? '#339af0' : '#dee2e6';
        this.ctx.lineWidth = isSelected ? 3 : 1;
        this.drawRoundedRect(x, y, width, height, 8);
        this.ctx.fill();
        this.ctx.stroke();
        // Node icon (simplified)
        this.ctx.fillStyle = '#495057';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('⚡', x + 30, y + 35);
        // Node name
        this.ctx.fillStyle = '#212529';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'left';
        const maxWidth = width - 60;
        const truncatedName = this.truncateText(node.name, maxWidth, this.ctx.font);
        this.ctx.fillText(truncatedName, x + 60, y + 25);
        // Node type
        this.ctx.fillStyle = '#6c757d';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(node.type.split('.').pop() || node.type, x + 60, y + 45);
        // Connection points
        this.drawConnectionPoints(node, x, y, width, height);
    }
    drawConnectionPoints(node, x, y, width, height) {
        // Input connection point (left side)
        this.ctx.fillStyle = '#868e96';
        this.ctx.beginPath();
        this.ctx.arc(x, y + height / 2, 6, 0, 2 * Math.PI);
        this.ctx.fill();
        // Output connection point (right side)
        this.ctx.fillStyle = '#868e96';
        this.ctx.beginPath();
        this.ctx.arc(x + width, y + height / 2, 6, 0, 2 * Math.PI);
        this.ctx.fill();
    }
    drawConnections() {
        if (!this.state.workflow)
            return;
        for (const [sourceNodeName, outputs] of Object.entries(this.state.workflow.connections)) {
            const sourceNode = this.state.workflow.nodes.find(n => n.name === sourceNodeName);
            if (!sourceNode)
                continue;
            for (const [outputType, connections] of Object.entries(outputs)) {
                for (const connectionArray of connections) {
                    for (const connection of connectionArray) {
                        const targetNode = this.state.workflow.nodes.find(n => n.name === connection.node);
                        if (targetNode) {
                            this.drawConnection(sourceNode, targetNode);
                        }
                    }
                }
            }
        }
    }
    drawConnection(sourceNode, targetNode) {
        const startX = sourceNode.position[0] + this.config.nodeWidth;
        const startY = sourceNode.position[1] + this.config.nodeHeight / 2;
        const endX = targetNode.position[0];
        const endY = targetNode.position[1] + this.config.nodeHeight / 2;
        // Draw bezier curve
        this.ctx.strokeStyle = '#495057';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        const controlPoint1X = startX + (endX - startX) * 0.5;
        const controlPoint1Y = startY;
        const controlPoint2X = startX + (endX - startX) * 0.5;
        const controlPoint2Y = endY;
        this.ctx.moveTo(startX, startY);
        this.ctx.bezierCurveTo(controlPoint1X, controlPoint1Y, controlPoint2X, controlPoint2Y, endX, endY);
        this.ctx.stroke();
        // Draw arrow
        this.drawArrow(endX, endY, Math.atan2(endY - controlPoint2Y, endX - controlPoint2X));
    }
    drawArrow(x, y, angle) {
        const arrowLength = 8;
        const arrowAngle = Math.PI / 6;
        this.ctx.fillStyle = '#495057';
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x - arrowLength * Math.cos(angle - arrowAngle), y - arrowLength * Math.sin(angle - arrowAngle));
        this.ctx.lineTo(x - arrowLength * Math.cos(angle + arrowAngle), y - arrowLength * Math.sin(angle + arrowAngle));
        this.ctx.closePath();
        this.ctx.fill();
    }
    drawSelectionBox() {
        if (!this.state.dragState)
            return;
        const start = this.state.dragState.startPosition;
        const current = this.state.dragState.currentPosition;
        this.ctx.strokeStyle = '#339af0';
        this.ctx.fillStyle = 'rgba(51, 154, 240, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        const x = Math.min(start.x, current.x);
        const y = Math.min(start.y, current.y);
        const width = Math.abs(current.x - start.x);
        const height = Math.abs(current.y - start.y);
        this.ctx.fillRect(x, y, width, height);
        this.ctx.strokeRect(x, y, width, height);
        this.ctx.setLineDash([]);
    }
    drawRoundedRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
    }
    // Utility methods
    screenToWorld(screenPos) {
        return {
            x: (screenPos.x - this.state.pan.x) / this.state.zoom,
            y: (screenPos.y - this.state.pan.y) / this.state.zoom
        };
    }
    worldToScreen(worldPos) {
        return {
            x: worldPos.x * this.state.zoom + this.state.pan.x,
            y: worldPos.y * this.state.zoom + this.state.pan.y
        };
    }
    getNodeAtPosition(position) {
        if (!this.state.workflow)
            return null;
        for (const node of this.state.workflow.nodes) {
            const nodeX = node.position[0];
            const nodeY = node.position[1];
            const nodeWidth = this.config.nodeWidth;
            const nodeHeight = this.config.nodeHeight;
            if (position.x >= nodeX && position.x <= nodeX + nodeWidth &&
                position.y >= nodeY && position.y <= nodeY + nodeHeight) {
                return node;
            }
        }
        return null;
    }
    generateNodeId() {
        return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateNodeName(nodeType) {
        const baseName = nodeType.split('.').pop() || 'Node';
        const existing = this.state.workflow?.nodes.filter(n => n.name.startsWith(baseName)) || [];
        return existing.length === 0 ? baseName : `${baseName} ${existing.length + 1}`;
    }
    truncateText(text, maxWidth, font) {
        this.ctx.font = font;
        if (this.ctx.measureText(text).width <= maxWidth) {
            return text;
        }
        let truncated = text;
        while (this.ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
            truncated = truncated.slice(0, -1);
        }
        return truncated + '...';
    }
    moveSelectedNodes(delta) {
        if (!this.state.workflow)
            return;
        for (const nodeId of this.state.selectedNodes) {
            const node = this.state.workflow.nodes.find(n => n.id === nodeId);
            if (node) {
                node.position[0] += delta.x;
                node.position[1] += delta.y;
                // Snap to grid if enabled
                if (this.config.snapToGrid) {
                    node.position[0] = Math.round(node.position[0] / this.config.gridSize) * this.config.gridSize;
                    node.position[1] = Math.round(node.position[1] / this.config.gridSize) * this.config.gridSize;
                }
            }
        }
    }
    deleteSelectedNodes() {
        if (!this.state.workflow || this.state.selectedNodes.length === 0)
            return;
        for (const nodeId of this.state.selectedNodes) {
            this.removeNode(nodeId);
        }
        this.state.selectedNodes = [];
        this.emit('selectionChanged', { selectedNodes: [] });
    }
    selectAllNodes() {
        if (!this.state.workflow)
            return;
        this.state.selectedNodes = this.state.workflow.nodes.map(node => node.id);
        this.emit('selectionChanged', { selectedNodes: this.state.selectedNodes });
        this.render();
    }
    removeNodeConnections(nodeId) {
        if (!this.state.workflow)
            return;
        const connections = this.state.workflow.connections;
        // Remove outgoing connections
        delete connections[nodeId];
        // Remove incoming connections
        for (const [sourceNodeId, outputs] of Object.entries(connections)) {
            for (const [outputType, connectionArrays] of Object.entries(outputs)) {
                for (let i = connectionArrays.length - 1; i >= 0; i--) {
                    connectionArrays[i] = connectionArrays[i].filter(conn => conn.node !== nodeId);
                    if (connectionArrays[i].length === 0) {
                        connectionArrays.splice(i, 1);
                    }
                }
            }
        }
    }
    updateWorkflowFromCanvas() {
        // This would sync any canvas-specific state back to the workflow
        // For now, node positions are already updated directly
    }
    calculateWorkflowBounds() {
        if (!this.state.workflow || this.state.workflow.nodes.length === 0) {
            return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
        }
        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        for (const node of this.state.workflow.nodes) {
            const x = node.position[0];
            const y = node.position[1];
            const width = this.config.nodeWidth;
            const height = this.config.nodeHeight;
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x + width);
            bottom = Math.max(bottom, y + height);
        }
        return {
            left,
            top,
            right,
            bottom,
            width: right - left,
            height: bottom - top
        };
    }
    // Cleanup
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.removeAllListeners();
    }
}
