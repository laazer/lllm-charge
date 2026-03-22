import { KnowledgeBase } from '../core/knowledge-base';
import { ClaudeProvider } from '../reasoning/providers/claude-provider';
export interface MultiModalRequest {
    type: 'image_analysis' | 'diagram_generation' | 'screenshot_analysis' | 'ui_analysis';
    content?: Buffer | string;
    query: string;
    context?: string;
    outputFormat?: 'text' | 'json' | 'markdown' | 'diagram';
}
export interface ImageAnalysisResult {
    description: string;
    elements: VisualElement[];
    technicalDetails: TechnicalDetails;
    insights: string[];
    recommendations: string[];
    extractedText?: string;
    codeSnippets?: CodeSnippet[];
}
export interface DiagramGenerationResult {
    diagramType: string;
    generatedContent: string;
    alternativeFormats: AlternativeFormat[];
    description: string;
    editingSuggestions: string[];
}
export interface VisualElement {
    type: 'text' | 'button' | 'image' | 'chart' | 'code' | 'ui_component';
    location: BoundingBox;
    confidence: number;
    description: string;
    properties: Record<string, any>;
}
export interface TechnicalDetails {
    dimensions: {
        width: number;
        height: number;
    };
    format: string;
    fileSize?: number;
    colorPalette: string[];
    accessibility: AccessibilityAnalysis;
}
export interface CodeSnippet {
    language: string;
    code: string;
    location: BoundingBox;
    confidence: number;
    analysis: string;
}
export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface AccessibilityAnalysis {
    contrastRatio: number;
    textReadability: 'excellent' | 'good' | 'fair' | 'poor';
    altTextPresent: boolean;
    keyboardNavigation: boolean;
    recommendations: string[];
}
export interface AlternativeFormat {
    type: 'mermaid' | 'plantuml' | 'graphviz' | 'drawio' | 'ascii';
    content: string;
    description: string;
}
export declare class MultiModalIntelligence {
    private knowledgeBase;
    private claudeProvider;
    private supportedImageFormats;
    private diagramTemplates;
    constructor(knowledgeBase: KnowledgeBase, claudeProvider: ClaudeProvider);
    initialize(): Promise<void>;
    processMultiModalRequest(request: MultiModalRequest): Promise<ImageAnalysisResult | DiagramGenerationResult>;
    private analyzeImage;
    private analyzeScreenshot;
    private analyzeUI;
    private generateDiagram;
    analyzeCodeScreenshot(imageBuffer: Buffer, language?: string): Promise<CodeAnalysisResult>;
    generateArchitecturalDiagram(description: string, diagramType: 'system' | 'component' | 'sequence' | 'class' | 'deployment'): Promise<DiagramGenerationResult>;
    analyzeUIDesignPatterns(imageBuffer: Buffer): Promise<DesignPatternAnalysis>;
    private extractTechnicalDetails;
    private extractTextFromImage;
    private detectCodeSnippets;
    private generateInsights;
    private initializeDiagramTemplates;
    private extractMermaidFromResponse;
    private extractPlantUMLFromResponse;
    private generateASCIIDiagram;
    private detectDiagramType;
    private convertToPlantUML;
    private extractDesignPatterns;
    private extractSuggestions;
    private loadVisualKnowledge;
    private setupImageProcessingCapabilities;
}
interface CodeAnalysisResult {
    detectedCode: CodeSnippet[];
    analyses: any[];
    overallAssessment: string;
    suggestions: any[];
}
interface DesignPatternAnalysis {
    identifiedPatterns: string[];
    consistencyScore: number;
    modernizationSuggestions: string[];
    componentLibraryRecommendations: string[];
    accessibilityScore: number;
}
export {};
