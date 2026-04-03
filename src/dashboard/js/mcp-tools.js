/**
 * MCP Tools Integration Module
 * Handles all MCP (Model Context Protocol) tool interactions
 */

export class MCPToolsManager {
    constructor(dashboard, modalManager) {
        this.dashboard = dashboard;
        this.modalManager = modalManager;
    }

    async showMCPToolsViewer() {
        const modal = this.modalManager.createModal('MCP Tools', '🔌');
        
        // Add loading content first
        this.modalManager.populateModal(modal, `
            <div style="padding: 2rem; text-align: center;">
                <div style="font-size: 2rem; margin-bottom: 1rem;">⏳</div>
                <div>Loading MCP tools...</div>
            </div>
        `);

        // Populate with real data after a short delay
        setTimeout(() => this.populateMCPToolsModal(modal), 100);
    }

    async populateMCPToolsModal(modal) {
        try {
            const response = await fetch('/mcp/tools');
            let tools = [];
            let hasError = false;

            if (response.ok) {
                const data = await response.json();
                tools = data.tools || [];
            } else {
                hasError = true;
                console.warn('Failed to load MCP tools');
            }

            let content;
            
            if (hasError || tools.length === 0) {
                content = `
                    <div style="padding: 2rem; text-align: center;">
                        <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">🔌</div>
                        <h3 style="color: var(--text); margin-bottom: 1rem;">No MCP Tools Available</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                            MCP tools are not currently connected or available. This could be due to:
                        </p>
                        <div style="text-align: left; max-width: 400px; margin: 0 auto;">
                            <ul style="color: var(--text-secondary); line-height: 1.6;">
                                <li>MCP server not running</li>
                                <li>No MCP tools configured</li>
                                <li>Connection issues</li>
                                <li>Permission restrictions</li>
                            </ul>
                        </div>
                        <div style="margin-top: 2rem;">
                            <button onclick="dashboard.refreshMCPData()" class="btn primary">
                                🔄 Retry Connection
                            </button>
                        </div>
                    </div>
                `;
            } else {
                content = `
                    <div style="padding: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <div>
                                <h3 style="margin: 0; color: var(--text);">Available MCP Tools</h3>
                                <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); font-size: 0.875rem;">
                                    ${tools.length} tools connected and ready for use
                                </p>
                            </div>
                            <div style="text-align: right;">
                                <span style="background: var(--success-color); color: white; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 600;">
                                    🟢 CONNECTED
                                </span>
                            </div>
                        </div>

                        <div style="display: grid; gap: 1rem; max-height: 400px; overflow-y: auto;">
                            ${tools.map(tool => this.renderToolCard(tool)).join('')}
                        </div>

                        <div style="border-top: 1px solid var(--border); padding-top: 1rem; margin-top: 1.5rem; text-align: center;">
                            <button onclick="this.closest('.modal-overlay').remove()" class="btn secondary">
                                Close
                            </button>
                            <button onclick="dashboard.testMCPConnection()" class="btn primary" style="margin-left: 0.5rem;">
                                🧪 Test Connection
                            </button>
                        </div>
                    </div>
                `;
            }

            const contentArea = modal.querySelector('.modal-content-area');
            if (contentArea) {
                contentArea.innerHTML = content;
            }

        } catch (error) {
            console.error('Failed to load MCP tools:', error);
            const contentArea = modal.querySelector('.modal-content-area');
            if (contentArea) {
                contentArea.innerHTML = `
                    <div style="padding: 2rem; text-align: center;">
                        <div style="font-size: 3rem; margin-bottom: 1rem; color: var(--error-color);">❌</div>
                        <h3 style="color: var(--error-color); margin-bottom: 1rem;">Connection Error</h3>
                        <p style="color: var(--text-secondary);">
                            Failed to connect to MCP tools: ${error.message}
                        </p>
                    </div>
                `;
            }
        }
    }

    renderToolCard(tool) {
        const description = tool.description || 'No description available';
        const shortDescription = description.length > 100 ? description.substring(0, 100) + '...' : description;
        
        const requiredParams = tool.inputSchema?.required || [];
        const properties = tool.inputSchema?.properties || {};
        const paramCount = Object.keys(properties).length;

        return `
            <div style="
                background: var(--surface); 
                border: 1px solid var(--border); 
                border-radius: 0.75rem; 
                padding: 1.25rem;
                transition: all 0.2s ease;
            " onmouseover="this.style.borderColor='var(--primary-color)'" onmouseout="this.style.borderColor='var(--border)'">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 0.5rem 0; color: var(--text); font-weight: 600;">${tool.name}</h4>
                        <p style="margin: 0; color: var(--text-secondary); font-size: 0.875rem; line-height: 1.4;">
                            ${shortDescription}
                        </p>
                    </div>
                    <div style="margin-left: 1rem;">
                        <span style="background: var(--primary-color); color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 500;">
                            TOOL
                        </span>
                    </div>
                </div>
                
                ${paramCount > 0 ? `
                    <div style="margin-bottom: 1rem;">
                        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                            Parameters (${paramCount} total, ${requiredParams.length} required):
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                            ${Object.keys(properties).slice(0, 4).map(param => `
                                <span style="
                                    background: ${requiredParams.includes(param) ? 'var(--error-color)' : 'var(--text-secondary)'};
                                    color: white; 
                                    padding: 0.125rem 0.375rem; 
                                    border-radius: 0.25rem; 
                                    font-size: 0.625rem;
                                    font-family: monospace;
                                ">
                                    ${param}${requiredParams.includes(param) ? '*' : ''}
                                </span>
                            `).join('')}
                            ${paramCount > 4 ? `<span style="color: var(--text-secondary); font-size: 0.75rem;">+${paramCount - 4} more</span>` : ''}
                        </div>
                    </div>
                ` : ''}
                
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">
                        ${tool.inputSchema ? '📋 Schema Available' : '📋 No Schema'}
                    </div>
                    <button onclick="dashboard.inspectMCPTool('${tool.name}')" 
                            style="background: transparent; border: 1px solid var(--primary-color); color: var(--primary-color); padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-size: 0.75rem; cursor: pointer;"
                            onmouseover="this.style.background='var(--primary-color)'; this.style.color='white';"
                            onmouseout="this.style.background='transparent'; this.style.color='var(--primary-color)';">
                        🔍 Inspect
                    </button>
                </div>
            </div>
        `;
    }

    async showMCPStatusViewer() {
        const modal = this.modalManager.createModal('MCP Connection Status', '🔗');
        
        const content = `
            <div style="padding: 1rem;">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;" id="mcp-status-icon">⏳</div>
                    <h3 style="margin: 0 0 0.5rem 0; color: var(--text);" id="mcp-status-title">Checking Connection...</h3>
                    <p style="margin: 0; color: var(--text-secondary);" id="mcp-status-description">
                        Please wait while we verify the MCP connection status.
                    </p>
                </div>

                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 1.5rem;" id="mcp-status-details">
                    <h4 style="margin: 0 0 1rem 0; color: var(--text);">Connection Details</h4>
                    <div id="mcp-connection-info">Loading...</div>
                </div>

                <div style="text-align: center;">
                    <button onclick="dashboard.refreshMCPStatus()" class="btn secondary">
                        🔄 Refresh Status
                    </button>
                    <button onclick="dashboard.testMCPConnection()" class="btn primary" style="margin-left: 0.5rem;">
                        🧪 Test Connection
                    </button>
                </div>
            </div>
        `;
        
        this.modalManager.populateModal(modal, content);
        
        // Load actual status after modal is displayed
        setTimeout(() => this.loadMCPStatus(), 100);
    }

    async loadMCPStatus() {
        try {
            const [toolsResponse, resourcesResponse] = await Promise.all([
                fetch('/mcp/tools'),
                fetch('/mcp/resources')
            ]);

            let toolsCount = 0;
            let resourcesCount = 0;
            let toolsError = null;
            let resourcesError = null;

            if (toolsResponse.ok) {
                const toolsData = await toolsResponse.json();
                toolsCount = toolsData.tools?.length || 0;
            } else {
                toolsError = `HTTP ${toolsResponse.status}`;
            }

            if (resourcesResponse.ok) {
                const resourcesData = await resourcesResponse.json();
                resourcesCount = resourcesData.resources?.length || 0;
            } else {
                resourcesError = `HTTP ${resourcesResponse.status}`;
            }

            const hasError = toolsError || resourcesError;
            const isConnected = !hasError && (toolsCount > 0 || resourcesCount > 0);

            // Update status display
            const statusIcon = document.getElementById('mcp-status-icon');
            const statusTitle = document.getElementById('mcp-status-title');
            const statusDescription = document.getElementById('mcp-status-description');
            const connectionInfo = document.getElementById('mcp-connection-info');

            if (statusIcon) {
                statusIcon.textContent = isConnected ? '✅' : (hasError ? '❌' : '⚠️');
            }

            if (statusTitle) {
                statusTitle.textContent = isConnected ? 'MCP Connected' : (hasError ? 'Connection Failed' : 'No MCP Tools');
                statusTitle.style.color = isConnected ? 'var(--success-color)' : (hasError ? 'var(--error-color)' : 'var(--warning-color)');
            }

            if (statusDescription) {
                if (isConnected) {
                    statusDescription.textContent = `Successfully connected with ${toolsCount + resourcesCount} total items available.`;
                } else if (hasError) {
                    statusDescription.textContent = 'Failed to establish connection to MCP services. Check server status and configuration.';
                } else {
                    statusDescription.textContent = 'Connection established but no MCP tools or resources are currently available.';
                }
            }

            if (connectionInfo) {
                connectionInfo.innerHTML = `
                    <div style="display: grid; gap: 1rem; font-size: 0.875rem;">
                        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
                            <span style="color: var(--text);">Tools Available</span>
                            <span style="color: ${toolsError ? 'var(--error-color)' : 'var(--success-color)'};">
                                ${toolsError ? `Error: ${toolsError}` : `${toolsCount} tools`}
                            </span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
                            <span style="color: var(--text);">Resources Available</span>
                            <span style="color: ${resourcesError ? 'var(--error-color)' : 'var(--success-color)'};">
                                ${resourcesError ? `Error: ${resourcesError}` : `${resourcesCount} resources`}
                            </span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
                            <span style="color: var(--text);">Connection Status</span>
                            <span style="color: ${isConnected ? 'var(--success-color)' : 'var(--error-color)'};">
                                ${isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                            </span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
                            <span style="color: var(--text);">Last Check</span>
                            <span style="color: var(--text-secondary);">
                                ${new Date().toLocaleTimeString()}
                            </span>
                        </div>
                    </div>
                `;
            }

        } catch (error) {
            console.error('Failed to load MCP status:', error);
            
            const statusIcon = document.getElementById('mcp-status-icon');
            const statusTitle = document.getElementById('mcp-status-title');
            const statusDescription = document.getElementById('mcp-status-description');
            const connectionInfo = document.getElementById('mcp-connection-info');

            if (statusIcon) statusIcon.textContent = '❌';
            if (statusTitle) {
                statusTitle.textContent = 'Connection Error';
                statusTitle.style.color = 'var(--error-color)';
            }
            if (statusDescription) {
                statusDescription.textContent = `Failed to check MCP status: ${error.message}`;
            }
            if (connectionInfo) {
                connectionInfo.innerHTML = `
                    <div style="color: var(--error-color); text-align: center;">
                        <div style="font-size: 1rem; margin-bottom: 0.5rem;">⚠️ Error Details</div>
                        <div style="font-family: monospace; background: var(--background); padding: 1rem; border-radius: 0.5rem; font-size: 0.8rem;">
                            ${error.message}
                        </div>
                    </div>
                `;
            }
        }
    }

    showMCPConnectionCount() {
        const modal = this.modalManager.createModal('MCP Connection Overview', '📊');
        
        const content = `
            <div style="padding: 1rem;">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📊</div>
                    <h3 style="margin: 0 0 0.5rem 0; color: var(--text);">MCP Connection Summary</h3>
                    <p style="margin: 0; color: var(--text-secondary);">
                        Overview of Model Context Protocol connections and capabilities
                    </p>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" id="mcp-overview-cards">
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; text-align: center;">
                        <div style="font-size: 2rem; color: var(--primary-color); margin-bottom: 0.5rem;">🔌</div>
                        <h4 style="margin: 0 0 0.5rem 0; color: var(--text);">Tools</h4>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text);" id="tools-count-display">Loading...</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Available tools</div>
                    </div>
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; text-align: center;">
                        <div style="font-size: 2rem; color: var(--success-color); margin-bottom: 0.5rem;">📂</div>
                        <h4 style="margin: 0 0 0.5rem 0; color: var(--text);">Resources</h4>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text);" id="resources-count-display">Loading...</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Available resources</div>
                    </div>
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; text-align: center;">
                        <div style="font-size: 2rem; color: var(--warning-color); margin-bottom: 0.5rem;">🌐</div>
                        <h4 style="margin: 0 0 0.5rem 0; color: var(--text);">Total</h4>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text);" id="total-count-display">Loading...</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Combined capabilities</div>
                    </div>
                </div>

                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 1.5rem;">
                    <h4 style="margin: 0 0 1rem 0; color: var(--text);">Quick Actions</h4>
                    <div style="display: grid; gap: 0.75rem;">
                        <button onclick="dashboard.showMCPToolsViewer()" class="btn primary full-width">
                            🔌 View All Tools
                        </button>
                        <button onclick="dashboard.showMCPResourcesViewer()" class="btn secondary full-width">
                            📂 View All Resources
                        </button>
                        <button onclick="dashboard.testMCPConnection()" class="btn secondary full-width">
                            🧪 Test Connection
                        </button>
                    </div>
                </div>

                <div style="text-align: center;">
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn secondary">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        this.modalManager.populateModal(modal, content);
        
        // Load actual counts
        setTimeout(() => this.loadMCPCounts(), 100);
    }

    async loadMCPCounts() {
        try {
            const [toolsResponse, resourcesResponse] = await Promise.all([
                fetch('/mcp/tools'),
                fetch('/mcp/resources')
            ]);

            let toolsCount = 0;
            let resourcesCount = 0;

            if (toolsResponse.ok) {
                const toolsData = await toolsResponse.json();
                toolsCount = toolsData.tools?.length || 0;
            }

            if (resourcesResponse.ok) {
                const resourcesData = await resourcesResponse.json();
                resourcesCount = resourcesData.resources?.length || 0;
            }

            const totalCount = toolsCount + resourcesCount;

            // Update displays
            const toolsDisplay = document.getElementById('tools-count-display');
            const resourcesDisplay = document.getElementById('resources-count-display');
            const totalDisplay = document.getElementById('total-count-display');

            if (toolsDisplay) toolsDisplay.textContent = toolsCount;
            if (resourcesDisplay) resourcesDisplay.textContent = resourcesCount;
            if (totalDisplay) totalDisplay.textContent = totalCount;

        } catch (error) {
            console.error('Failed to load MCP counts:', error);
            
            const toolsDisplay = document.getElementById('tools-count-display');
            const resourcesDisplay = document.getElementById('resources-count-display');
            const totalDisplay = document.getElementById('total-count-display');

            if (toolsDisplay) toolsDisplay.textContent = 'Error';
            if (resourcesDisplay) resourcesDisplay.textContent = 'Error';
            if (totalDisplay) totalDisplay.textContent = 'Error';
        }
    }

    // Utility methods
    async refreshMCPData() {
        console.log('🔄 Refreshing MCP data...');
        await this.dashboard.loadMCPData();
        this.modalManager.showNotification('MCP data refreshed', 'success');
    }

    async testMCPConnection() {
        console.log('🧪 Testing MCP connection...');
        this.modalManager.showNotification('Testing MCP connection...', 'info');
        
        try {
            const response = await fetch('/mcp/tools');
            if (response.ok) {
                this.modalManager.showNotification('MCP connection successful! ✅', 'success');
            } else {
                this.modalManager.showNotification('MCP connection failed ❌', 'error');
            }
        } catch (error) {
            this.modalManager.showNotification(`MCP test failed: ${error.message}`, 'error');
        }
    }

    async inspectMCPTool(toolName) {
        console.log('🔍 Inspecting MCP tool:', toolName);
        this.modalManager.showNotification(`Opening inspector for ${toolName}...`, 'info');
        
        // This could open a detailed view of the tool's schema and capabilities
        // For now, just show a notification
        setTimeout(() => {
            this.modalManager.showNotification(`Tool inspection for ${toolName} - Coming soon!`, 'warning');
        }, 1000);
    }

    async showMCPResourcesViewer() {
        console.log('📂 Opening MCP resources viewer...');
        this.modalManager.showNotification('MCP Resources viewer - Coming soon!', 'info');
    }
}