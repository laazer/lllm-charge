import { EventEmitter } from 'events';
import { WorkflowDefinition, WorkflowNode, NodeType } from '../workflows/n8n-workflow-engine';
export interface NodePosition {
    x: number;
    y: number;
}
export interface ConnectionEndpoint {
    nodeId: string;
    type: 'input' | 'output';
    index: number;
}
export interface Connection {
    id: string;
    source: ConnectionEndpoint;
    target: ConnectionEndpoint;
}
export interface EditorState {
    workflow: WorkflowDefinition | null;
    selectedNodes: string[];
    selectedConnections: string[];
    clipboard: {
        nodes: WorkflowNode[];
        connections: Connection[];
    };
    zoom: number;
    pan: {
        x: number;
        y: number;
    };
    mode: 'select' | 'connect' | 'pan';
    dragState: DragState | null;
}
export interface DragState {
    type: 'node' | 'connection' | 'selection';
    startPosition: NodePosition;
    currentPosition: NodePosition;
    draggedElement: any;
}
export interface CanvasConfig {
    width: number;
    height: number;
    gridSize: number;
    showGrid: boolean;
    snapToGrid: boolean;
    backgroundColor: string;
    nodeWidth: number;
    nodeHeight: number;
}
export interface NodePalette {
    categories: NodeCategory[];
    searchFilter: string;
    expandedCategories: Set<string>;
}
export interface NodeCategory {
    name: string;
    icon: string;
    nodeTypes: NodeType[];
    expanded: boolean;
}
export declare class WorkflowEditor extends EventEmitter {
    private canvas;
    private ctx;
    private state;
    private config;
    private palette;
    private animationId;
    constructor(canvasElement: HTMLCanvasElement);
    loadWorkflow(workflow: WorkflowDefinition): void;
    saveWorkflow(): WorkflowDefinition | null;
    addNode(nodeType: string, position: NodePosition): string;
    removeNode(nodeId: string): void;
    connectNodes(sourceId: string, targetId: string, sourceIndex?: number, targetIndex?: number): void;
    selectNode(nodeId: string, multiSelect?: boolean): void;
    copyNodes(): void;
    pasteNodes(offset?: NodePosition): void;
    zoomIn(): void;
    zoomOut(): void;
    resetView(): void;
    fitToView(): void;
    private initializeState;
    private initializeConfig;
    private initializePalette;
    private setupEventListeners;
    private handleMouseDown;
    private handleMouseMove;
    private handleMouseUp;
    private handleWheel;
    private handleKeyDown;
    private handleContextMenu;
    private handleResize;
    private startRenderLoop;
    private render;
    private drawGrid;
    private drawNodes;
    private drawNode;
    private drawConnectionPoints;
    private drawConnections;
    private drawConnection;
    private drawArrow;
    private drawSelectionBox;
    private drawRoundedRect;
    private screenToWorld;
    private worldToScreen;
    private getNodeAtPosition;
    private generateNodeId;
    private generateNodeName;
    private truncateText;
    private moveSelectedNodes;
    private deleteSelectedNodes;
    private selectAllNodes;
    private removeNodeConnections;
    private updateWorkflowFromCanvas;
    private calculateWorkflowBounds;
    destroy(): void;
}
