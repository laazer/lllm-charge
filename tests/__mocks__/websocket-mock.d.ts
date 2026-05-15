/**
 * Mock WebSocket implementation for testing React WebSocket integration
 */
export declare class MockWebSocketServer {
    private mockInstance;
    private messageHandlers;
    simulateConnection(): void;
    simulateDisconnection(code?: number, reason?: string): void;
    simulateError(error: Error): void;
    simulateMessage(message: {
        type: string;
        data: any;
    }): void;
    simulateRawMessage(data: string): void;
    getLastSentMessage(): string | null;
    cleanup(): void;
    setMockInstance(instance: MockWebSocket): void;
}
export declare class MockWebSocket {
    static CONNECTING: number;
    static OPEN: number;
    static CLOSING: number;
    static CLOSED: number;
    static instances: MockWebSocket[];
    static mockServer: MockWebSocketServer | null;
    url: string;
    readyState: number;
    onopen: ((event: Event) => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    lastSentMessage: string | null;
    constructor(url: string);
    send(data: string): void;
    close(code?: number, reason?: string): void;
    static getInstance(): MockWebSocket;
    static resetMocks(): void;
    static setMockServer(server: MockWebSocketServer): void;
}
export declare const WebSocketConstructorMock: jest.Mock<any, any, any>;
