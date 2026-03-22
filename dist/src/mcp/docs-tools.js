// MCP tools for developer documentation search and management
// Integrates DevDocs and GPT4All for zero-cost documentation lookups
export const docsTools = {
    search_developer_docs: {
        name: 'search_developer_docs',
        description: 'Search developer documentation using semantic search and DevDocs integration. Provides zero-cost lookups for API references, guides, and examples.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query for documentation (e.g., "React useState hook", "Python list comprehensions", "Docker compose examples")'
                },
                docs: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Specific documentation sets to search (e.g., ["react", "javascript", "typescript"]). If not specified, searches all available docs.'
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of results to return (default: 10)',
                    default: 10
                },
                include_content: {
                    type: 'boolean',
                    description: 'Whether to include full content in results (default: false for performance)',
                    default: false
                },
                similarity_threshold: {
                    type: 'number',
                    description: 'Minimum similarity score for semantic matches (0.0-1.0, default: 0.7)',
                    default: 0.7
                }
            },
            required: ['query']
        },
        handler: async (params, context) => {
            try {
                const query = {
                    query: params.query,
                    docs: params.docs,
                    limit: params.limit || 10,
                    includeContent: params.include_content || false,
                    similarity_threshold: params.similarity_threshold || 0.7
                };
                const results = await context.docsIntelligence.searchDocs(query);
                if (results.length === 0) {
                    return `No documentation found for query: "${params.query}"\n\nTry:\n- Using different keywords\n- Installing relevant documentation with install_developer_docs\n- Checking available docs with list_available_docs`;
                }
                let output = `Found ${results.length} documentation results for "${params.query}":\n\n`;
                results.forEach((result, index) => {
                    output += `${index + 1}. **${result.name}** (${result.doc})\n`;
                    output += `   Type: ${result.type} | Similarity: ${(result.similarity * 100).toFixed(1)}% | Source: ${result.source}\n`;
                    output += `   Path: ${result.path}\n`;
                    if (result.content) {
                        const preview = result.content.slice(0, 200).replace(/\n/g, ' ');
                        output += `   Preview: ${preview}${result.content.length > 200 ? '...' : ''}\n`;
                    }
                    output += '\n';
                });
                output += `💡 Tip: Use include_content=true to get full documentation content for detailed answers.`;
                return output;
            }
            catch (error) {
                return `Error searching documentation: ${error instanceof Error ? error.message : String(error)}`;
            }
        }
    },
    install_developer_docs: {
        name: 'install_developer_docs',
        description: 'Install and index developer documentation locally. Downloads docs from DevDocs and stores them for offline semantic search.',
        inputSchema: {
            type: 'object',
            properties: {
                docs: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Documentation sets to install (e.g., ["react", "javascript", "python", "docker"])'
                },
                force_reindex: {
                    type: 'boolean',
                    description: 'Force re-indexing of already installed documentation',
                    default: false
                }
            },
            required: ['docs']
        },
        handler: async (params, context) => {
            try {
                const docsToInstall = params.docs;
                const forceReindex = params.force_reindex || false;
                let output = `Installing documentation for: ${docsToInstall.join(', ')}\n\n`;
                const status = await context.docsIntelligence.getDocumentationStatus();
                const alreadyInstalled = docsToInstall.filter(doc => status.installed.includes(doc));
                if (alreadyInstalled.length > 0 && !forceReindex) {
                    output += `Already installed: ${alreadyInstalled.join(', ')}\n`;
                    output += `Use force_reindex=true to re-install these docs.\n\n`;
                }
                const toInstall = forceReindex ? docsToInstall : docsToInstall.filter(doc => !status.installed.includes(doc));
                if (toInstall.length === 0) {
                    output += `No new documentation to install.`;
                    return output;
                }
                output += `Installing: ${toInstall.join(', ')}\n\n`;
                // Install documentation
                await context.docsIntelligence.indexDocumentation(toInstall);
                // Get updated status
                const updatedStatus = await context.docsIntelligence.getDocumentationStatus();
                const successfullyInstalled = toInstall.filter(doc => updatedStatus.installed.includes(doc));
                output += `✅ Successfully installed: ${successfullyInstalled.join(', ')}\n`;
                output += `📊 Total documentation sets: ${updatedStatus.installed.length}\n`;
                output += `💾 Storage used: ${(updatedStatus.storage_size / 1024 / 1024).toFixed(2)} MB\n\n`;
                if (successfullyInstalled.length < toInstall.length) {
                    const failed = toInstall.filter(doc => !successfullyInstalled.includes(doc));
                    output += `❌ Failed to install: ${failed.join(', ')}\n`;
                }
                output += `💡 You can now search this documentation with search_developer_docs`;
                return output;
            }
            catch (error) {
                return `Error installing documentation: ${error instanceof Error ? error.message : String(error)}`;
            }
        }
    },
    list_available_docs: {
        name: 'list_available_docs',
        description: 'List all available developer documentation that can be installed and searched.',
        inputSchema: {
            type: 'object',
            properties: {
                show_installed_only: {
                    type: 'boolean',
                    description: 'Show only installed documentation',
                    default: false
                },
                category: {
                    type: 'string',
                    enum: ['all', 'language', 'framework', 'tool', 'database', 'runtime'],
                    description: 'Filter by documentation category',
                    default: 'all'
                }
            }
        },
        handler: async (params, context) => {
            try {
                const showInstalledOnly = params.show_installed_only || false;
                const category = params.category || 'all';
                const status = await context.docsIntelligence.getDocumentationStatus();
                const availableDocs = await context.docsIntelligence.getAvailableDocumentations();
                let filteredDocs = availableDocs;
                if (showInstalledOnly) {
                    filteredDocs = availableDocs.filter(doc => status.installed.includes(doc.slug));
                }
                if (category !== 'all') {
                    filteredDocs = filteredDocs.filter(doc => doc.type === category);
                }
                let output = `📚 Developer Documentation ${showInstalledOnly ? '(Installed)' : '(Available)'}\n\n`;
                if (filteredDocs.length === 0) {
                    output += `No documentation found for category: ${category}\n`;
                    return output;
                }
                // Group by category
                const groupedDocs = filteredDocs.reduce((acc, doc) => {
                    if (!acc[doc.type])
                        acc[doc.type] = [];
                    acc[doc.type].push(doc);
                    return acc;
                }, {});
                Object.entries(groupedDocs).forEach(([type, docs]) => {
                    output += `## ${type.charAt(0).toUpperCase() + type.slice(1)}s\n`;
                    docs.forEach(doc => {
                        const isInstalled = status.installed.includes(doc.slug);
                        const status_icon = isInstalled ? '✅' : '⬜';
                        output += `${status_icon} **${doc.name}** (${doc.slug})\n`;
                    });
                    output += '\n';
                });
                // Summary statistics
                output += `📊 Summary:\n`;
                output += `   Total available: ${availableDocs.length} documentation sets\n`;
                output += `   Currently installed: ${status.installed.length}\n`;
                output += `   Storage used: ${(status.storage_size / 1024 / 1024).toFixed(2)} MB\n\n`;
                if (!showInstalledOnly) {
                    output += `💡 Install documentation with: install_developer_docs\n`;
                    output += `🔍 Search documentation with: search_developer_docs`;
                }
                return output;
            }
            catch (error) {
                return `Error listing documentation: ${error instanceof Error ? error.message : String(error)}`;
            }
        }
    },
    get_documentation_status: {
        name: 'get_documentation_status',
        description: 'Get detailed status of local documentation storage, smart caching, and auto-download capabilities.',
        inputSchema: {
            type: 'object',
            properties: {}
        },
        handler: async (params, context) => {
            try {
                const status = await context.docsIntelligence.getDocumentationStatus();
                const queueStatus = await context.docsIntelligence.smartCache?.getQueueStatus() || { queued: [], inProgress: [] };
                let output = `📋 Smart Documentation System Status\n\n`;
                output += `📚 **Installed Documentation:**\n`;
                if (status.installed.length === 0) {
                    output += `   No documentation installed yet.\n`;
                }
                else {
                    status.installed.forEach(doc => {
                        output += `   ✅ ${doc}\n`;
                    });
                }
                output += '\n';
                // Smart cache status
                output += `🧠 **Smart Cache Status:**\n`;
                if (queueStatus.inProgress.length > 0) {
                    output += `   📥 Downloading: ${queueStatus.inProgress.join(', ')}\n`;
                }
                if (queueStatus.queued.length > 0) {
                    output += `   ⏳ Queued: ${queueStatus.queued.join(', ')}\n`;
                }
                if (queueStatus.inProgress.length === 0 && queueStatus.queued.length === 0) {
                    output += `   💤 Idle - ready to auto-detect needed docs\n`;
                }
                output += `   🗓️  Cache expires after 365 days of no use\n`;
                output += `   🎯 Auto-detects needed docs from queries and project files\n\n`;
                output += `🔢 **Statistics:**\n`;
                output += `   Installed sets: ${status.installed.length}\n`;
                output += `   Available sets: ${status.available.length}\n`;
                output += `   Storage used: ${(status.storage_size / 1024 / 1024).toFixed(2)} MB\n`;
                output += `   Coverage: ${((status.installed.length / status.available.length) * 100).toFixed(1)}%\n\n`;
                output += `⚡ **Smart Features:**\n`;
                output += `   • Zero API costs for documentation lookups\n`;
                output += `   • Auto-detects needed docs from context\n`;
                output += `   • Background downloading (non-blocking)\n`;
                output += `   • 365-day smart expiration (extends on use)\n`;
                output += `   • Semantic search with GPT4All embeddings\n`;
                output += `   • DevDocs structured content integration\n\n`;
                if (status.installed.length > 0) {
                    output += `🎯 **Usage:**\n`;
                    output += `   • Search: search_developer_docs query="your question"\n`;
                    output += `   • System auto-detects and caches missing docs\n`;
                    output += `   • Examples: "React hooks", "Python async", "Docker commands"\n`;
                }
                else {
                    output += `🚀 **Get Started:**\n`;
                    output += `   • Just start searching! System auto-detects needed docs\n`;
                    output += `   • Manual install: install_developer_docs docs=["javascript","react"]\n`;
                    output += `   • View available: list_available_docs\n`;
                }
                return output;
            }
            catch (error) {
                return `Error getting documentation status: ${error instanceof Error ? error.message : String(error)}`;
            }
        }
    },
    quick_doc_lookup: {
        name: 'quick_doc_lookup',
        description: 'Quick lookup for specific API methods, functions, or concepts. Optimized for fast, targeted documentation retrieval.',
        inputSchema: {
            type: 'object',
            properties: {
                api_or_concept: {
                    type: 'string',
                    description: 'Specific API method, function, or concept to look up (e.g., "Array.map", "useEffect", "git rebase")'
                },
                language_or_tool: {
                    type: 'string',
                    description: 'Specific language or tool context (e.g., "javascript", "react", "git")'
                },
                include_examples: {
                    type: 'boolean',
                    description: 'Include code examples in the response',
                    default: true
                }
            },
            required: ['api_or_concept']
        },
        handler: async (params, context) => {
            try {
                const apiOrConcept = params.api_or_concept;
                const languageOrTool = params.language_or_tool;
                const includeExamples = params.include_examples !== false;
                // Construct targeted search query
                let searchQuery = apiOrConcept;
                if (languageOrTool) {
                    searchQuery = `${languageOrTool} ${apiOrConcept}`;
                }
                const query = {
                    query: searchQuery,
                    docs: languageOrTool ? [languageOrTool] : undefined,
                    limit: 3, // Fewer results for quick lookup
                    includeContent: true, // Always include content for API lookups
                    similarity_threshold: 0.6 // Lower threshold for specific API searches
                };
                const results = await context.docsIntelligence.searchDocs(query);
                if (results.length === 0) {
                    let output = `❌ No documentation found for: "${apiOrConcept}"`;
                    if (languageOrTool) {
                        output += ` in ${languageOrTool}`;
                    }
                    output += `\n\nSuggestions:\n`;
                    output += `• Check spelling and try alternate names\n`;
                    output += `• Install relevant documentation: install_developer_docs\n`;
                    output += `• Use broader search: search_developer_docs\n`;
                    return output;
                }
                let output = `📖 Quick Documentation Lookup: "${apiOrConcept}"\n\n`;
                const topResult = results[0];
                output += `## ${topResult.name} (${topResult.doc})\n`;
                output += `**Type:** ${topResult.type} | **Similarity:** ${(topResult.similarity * 100).toFixed(1)}%\n\n`;
                if (topResult.content) {
                    // Extract relevant sections
                    const content = topResult.content;
                    const sections = content.split(/\n#{1,3}\s/).slice(0, 3); // First 3 sections
                    sections.forEach(section => {
                        if (section.trim()) {
                            output += `${section.trim()}\n\n`;
                        }
                    });
                }
                if (results.length > 1) {
                    output += `**Related Documentation:**\n`;
                    results.slice(1).forEach((result, index) => {
                        output += `${index + 2}. ${result.name} (${result.doc}) - ${(result.similarity * 100).toFixed(1)}% match\n`;
                    });
                    output += '\n';
                }
                output += `💡 **Cost Savings:** This lookup used $0.00 vs ~$0.003-0.008 for API call`;
                return output;
            }
            catch (error) {
                return `Error in quick documentation lookup: ${error instanceof Error ? error.message : String(error)}`;
            }
        }
    }
};
