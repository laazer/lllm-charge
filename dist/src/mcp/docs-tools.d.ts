import { DocsIntelligence } from '../intelligence/docs-intelligence';
export interface DocsToolContext {
    docsIntelligence: DocsIntelligence;
    projectDir: string;
}
export declare const docsTools: {
    search_developer_docs: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                query: {
                    type: string;
                    description: string;
                };
                docs: {
                    type: string;
                    items: {
                        type: string;
                    };
                    description: string;
                };
                limit: {
                    type: string;
                    description: string;
                    default: number;
                };
                include_content: {
                    type: string;
                    description: string;
                    default: boolean;
                };
                similarity_threshold: {
                    type: string;
                    description: string;
                    default: number;
                };
            };
            required: string[];
        };
        handler: (params: any, context: DocsToolContext) => Promise<string>;
    };
    install_developer_docs: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                docs: {
                    type: string;
                    items: {
                        type: string;
                    };
                    description: string;
                };
                force_reindex: {
                    type: string;
                    description: string;
                    default: boolean;
                };
            };
            required: string[];
        };
        handler: (params: any, context: DocsToolContext) => Promise<string>;
    };
    list_available_docs: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                show_installed_only: {
                    type: string;
                    description: string;
                    default: boolean;
                };
                category: {
                    type: string;
                    enum: string[];
                    description: string;
                    default: string;
                };
            };
        };
        handler: (params: any, context: DocsToolContext) => Promise<string>;
    };
    get_documentation_status: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {};
        };
        handler: (params: any, context: DocsToolContext) => Promise<string>;
    };
    quick_doc_lookup: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                api_or_concept: {
                    type: string;
                    description: string;
                };
                language_or_tool: {
                    type: string;
                    description: string;
                };
                include_examples: {
                    type: string;
                    description: string;
                    default: boolean;
                };
            };
            required: string[];
        };
        handler: (params: any, context: DocsToolContext) => Promise<string>;
    };
};
