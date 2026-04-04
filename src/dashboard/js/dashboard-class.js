/**
 * LLM-Charge Dashboard Core Class
 * Main dashboard functionality extracted from monolithic file
 */

export class LLMChargeDashboard {
    constructor() {
        this.ws = null;
        this.connectionRetries = 0;
        this.maxRetries = 3;
        this.currentProject = null;
        this.projects = [];
        this.realMCPData = null;
        this.cachedLinkedAgents = null;
        
        console.log('🚀 Initializing LLM-Charge Dashboard...');
    }

    init() {
        this.setupEventListeners();
        this.connectWebSocket();
        this.loadInitialData();
        this.handleInitialRoute();
    }

    handleInitialRoute() {
        // Handle initial page load and hash routing
        const hash = window.location.hash.replace('#', '');
        const validSections = ['overview', 'specs', 'memory', 'projects', 'agents'];
        
        if (hash && validSections.includes(hash)) {
            this.switchSection(hash, false); // Don't update hash since we're reading from it
        } else {
            // Default to overview section if no valid hash
            this.switchSection('overview');
        }
    }

    setupEventListeners() {
        // Theme and style toggles
        const themeToggle = document.getElementById('theme-toggle');
        const styleToggle = document.getElementById('style-toggle');
        
        if (themeToggle) themeToggle.addEventListener('click', () => this.toggleTheme());
        if (styleToggle) styleToggle.addEventListener('click', () => this.toggleStyle());

        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchSection(e.target.dataset.section));
        });

        // Hash change handling
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.replace('#', '');
            const validSections = ['overview', 'specs', 'memory', 'projects', 'agents'];
            
            if (hash && validSections.includes(hash)) {
                this.switchSection(hash, false);
            }
        });

        // Connection info tooltip
        const connectionDot = document.getElementById('connection-dot');
        if (connectionDot) {
            connectionDot.addEventListener('click', () => this.toggleConnectionInfo());
        }

        // Outside click to close tooltips
        document.addEventListener('click', (e) => {
            const tooltip = document.getElementById('connection-tooltip');
            const connectionInfo = e.target.closest('.connection-info') || e.target.closest('#connection-tooltip');
            const tooltipContent = tooltip?.querySelector('.tooltip-content');
            
            if (!connectionInfo && !tooltipContent && tooltip?.classList.contains('show')) {
                tooltip.classList.remove('show');
            }
        });

        // Form event listeners
        const specForm = document.getElementById('spec-form');
        const noteForm = document.getElementById('note-form');
        const agentForm = document.getElementById('agent-form');
        const projectConfigForm = document.getElementById('project-config-form');

        if (specForm) specForm.addEventListener('submit', (e) => this.createSpec(e));
        if (noteForm) noteForm.addEventListener('submit', (e) => this.createNote(e));
        if (agentForm) agentForm.addEventListener('submit', (e) => this.createAgent(e));
        if (projectConfigForm) projectConfigForm.addEventListener('submit', (e) => this.saveProjectConfiguration(e));
    }

    connectWebSocket() {
        try {
            this.ws = new WebSocket(`ws://${window.location.host}/ws`);
            
            this.ws.onopen = () => {
                console.log('📡 WebSocket connected');
                this.connectionRetries = 0;
                this.updateConnectionStatus(true);
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('📡 WebSocket disconnected');
                this.updateConnectionStatus(false);
                this.reconnectWebSocket();
            };
            
            this.ws.onerror = (error) => {
                console.error('📡 WebSocket error:', error);
                this.updateConnectionStatus(false);
            };
            
        } catch (error) {
            console.error('Failed to establish WebSocket connection:', error);
            this.updateConnectionStatus(false);
        }
    }

    reconnectWebSocket() {
        if (this.connectionRetries < this.maxRetries) {
            this.connectionRetries++;
            setTimeout(() => {
                console.log(`📡 Attempting to reconnect WebSocket (${this.connectionRetries}/${this.maxRetries})...`);
                this.connectWebSocket();
            }, 3000 * this.connectionRetries);
        }
    }

    updateConnectionStatus(connected) {
        const dot = document.getElementById('connection-dot');
        const text = document.getElementById('connection-text');
        
        if (connected) {
            if (dot) dot.className = 'connection-dot connected';
            if (text) text.textContent = 'Connected';
        } else {
            if (dot) dot.className = 'connection-dot disconnected';
            if (text) text.textContent = 'Disconnected';
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'metrics_update':
            case 'metrics':  // Handle both message formats
                this.updateMetrics(data.data);
                break;
            case 'spec_created':
                this.loadSpecs();
                break;
            case 'note_created':
                this.loadNotes();
                break;
            case 'project_created':
                this.loadProjects();
                break;
            default:
                console.log('Unknown WebSocket message type:', data.type);
        }
    }

    updateMetrics(metrics) {
        // Update main metrics (totalRequests is already formatted by server)
        this.updateElement('total-requests', metrics.totalRequests);
        this.updateElement('cost-savings', '$' + metrics.costSavings);
        this.updateElement('success-rate', metrics.successRate + '%');
        this.updateElement('avg-latency', metrics.avgLatency + 's');

        // Update counts
        this.updateElement('specs-count', `${metrics.specsCount || 0} specs`);
        this.updateElement('memory-count', `${metrics.notesCount || 0} notes`);
        this.updateElement('projects-count', `${metrics.projectsCount || 0} projects`);
    }

    updateElement(id, content) {
        const element = document.getElementById(id);
        if (element && content !== undefined) {
            element.textContent = content;
        }
    }

    async loadInitialData() {
        try {
            const response = await fetch('/api/metrics');
            const metrics = await response.json();
            this.updateMetrics(metrics);
        } catch (error) {
            console.error('Failed to load initial metrics:', error);
        }

        // Load MCP data for dashboard cards
        await this.loadMCPData();

        // Load projects first to set up project context
        await this.loadProjects();
        await this.setupProjectSelector();
        
        // Load project-scoped data
        this.loadSpecs();
        this.loadNotes();
        this.loadAgents();
    }

    async loadMCPData() {
        try {
            console.log('🔌 Loading real MCP data...');
            
            const [toolsResponse, resourcesResponse] = await Promise.all([
                fetch('/mcp/tools'),
                fetch('/mcp/resources')
            ]);
            
            let toolsCount = 0;
            let resourcesCount = 0;
            let hasError = false;
            
            if (toolsResponse.ok) {
                const toolsData = await toolsResponse.json();
                toolsCount = toolsData.tools?.length || 0;
                console.log('🛠️ MCP Tools:', toolsCount);
            } else {
                console.warn('Failed to load MCP tools');
                hasError = true;
            }
            
            if (resourcesResponse.ok) {
                const resourcesData = await resourcesResponse.json();
                resourcesCount = resourcesData.resources?.length || 0;
                console.log('📂 MCP Resources:', resourcesCount);
            } else {
                console.warn('Failed to load MCP resources');
                hasError = true;
            }
            
            this.realMCPData = {
                toolsCount,
                resourcesCount,
                hasError,
                timestamp: new Date().toISOString()
            };
            
            this.updateMCPCards(toolsCount, resourcesCount, hasError);
            
        } catch (error) {
            console.error('Failed to load MCP data:', error);
            this.updateMCPCards(0, 0, true);
        }
    }

    updateMCPCards(toolsCount, resourcesCount, hasError = false) {
        // Update tools card
        const toolsCard = document.querySelector('.status-card[onclick*="showMCPToolsViewer"]');
        if (toolsCard) {
            const valueElement = toolsCard.querySelector('.status-card-value');
            if (valueElement) {
                valueElement.textContent = hasError ? 'Error' : `${toolsCount} tools`;
                valueElement.className = hasError ? 'status-card-value status-error' : 'status-card-value status-active';
            }
        }

        // Update connections count
        const connectionsElement = document.getElementById('mcp-connections-count');
        if (connectionsElement) {
            connectionsElement.textContent = hasError ? 'Error' : `${toolsCount + resourcesCount} total`;
        }

        // Update status card
        const statusCard = document.querySelector('.status-card[onclick*="showMCPStatusViewer"]');
        if (statusCard) {
            const valueElement = statusCard.querySelector('.status-card-value');
            if (valueElement) {
                valueElement.textContent = hasError ? 'Disconnected' : 'Connected';
                valueElement.className = hasError ? 'status-card-value status-error' : 'status-card-value status-success';
            }
        }
    }

    // Utility methods
    toggleTheme() {
        const body = document.body;
        const isDark = body.classList.contains('theme-dark');
        
        // Preserve style
        const isLiquidGlass = body.classList.contains('style-liquid-glass');
        
        body.className = '';
        body.classList.add(isDark ? 'theme-light' : 'theme-dark');
        body.classList.add(isLiquidGlass ? 'style-liquid-glass' : 'style-flat');
        
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
    }

    toggleStyle() {
        const body = document.body;
        const isLiquidGlass = body.classList.contains('style-liquid-glass');
        
        // Preserve theme
        const isDark = body.classList.contains('theme-dark');
        
        body.className = '';
        body.classList.add(isDark ? 'theme-dark' : 'theme-light');
        body.classList.add(isLiquidGlass ? 'style-flat' : 'style-liquid-glass');
        
        localStorage.setItem('style', isLiquidGlass ? 'flat' : 'liquid-glass');
    }

    toggleConnectionInfo() {
        const tooltip = document.getElementById('connection-tooltip');
        const isVisible = tooltip?.classList.contains('show');
        
        if (isVisible) {
            tooltip.classList.remove('show');
        } else {
            if (tooltip) {
                tooltip.classList.add('show');
                this.updateServiceStatuses();
            }
        }
    }

    updateServiceStatuses() {
        // Update individual service statuses based on actual connection state
        const services = {
            'ws-status': this.ws?.readyState === WebSocket.OPEN,
            'spec-status': true, // Always true if server is running
            'memory-status': true, // Always true if server is running
            'project-status': true, // Always true if server is running
            'agent-status': true, // Always true if server is running
            'workflow-status': false // Not implemented yet
        };

        Object.entries(services).forEach(([id, connected]) => {
            const statusElement = document.getElementById(id);
            if (statusElement) {
                if (connected) {
                    statusElement.classList.remove('disconnected');
                } else {
                    statusElement.classList.add('disconnected');
                }
            }
        });
    }

    // Section navigation
    switchSection(section, updateHash = true) {
        console.log(`🔄 Switching to section: ${section}`);
        
        if (this.currentProject) {
            console.log('📊 Current project context:', this.currentProject.name);
        }
        
        if (updateHash && section !== 'workflows' && section !== 'studio') {
            window.location.hash = section;
        }
        
        // Update active nav button
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const navButton = document.querySelector(`.nav-btn[data-section="${section}"]`);
        if (navButton) {
            navButton.classList.add('active');
        }
        
        // Handle special sections
        if (section === 'workflows') {
            this.openWorkflowEditor();
            return;
        }
        if (section === 'studio') {
            this.openAgentStudio();
            return;
        }
        
        // Show/hide sections
        console.log('🔄 Hiding all data sections');
        document.querySelectorAll('.data-section').forEach(s => s.style.display = 'none');
        const sectionElement = document.getElementById(`${section}-section`);
        console.log(`🔄 Looking for section element: ${section}-section`, sectionElement);
        if (sectionElement) {
            sectionElement.style.display = 'block';
            sectionElement.style.visibility = 'visible';
            sectionElement.style.opacity = '1';
            console.log(`✅ Showing section: ${section}-section`, 'display:', sectionElement.style.display);
            console.log(`🎯 Section computed style:`, window.getComputedStyle(sectionElement).display);
        } else {
            console.log(`❌ Section element not found: ${section}-section`);
        }
        
        // Load section-specific data
        switch (section) {
            case 'overview':
                // Overview data is loaded via WebSocket
                break;
            case 'specs':
                this.loadSpecs();
                break;
            case 'memory':
                this.loadNotes();
                break;
            case 'projects':
                this.loadProjects();
                break;
            case 'agents':
                this.loadAgents();
                break;
        }
    }

    // Stub methods for sections to be implemented in other modules
    openWorkflowEditor() {
        console.log('🔧 Opening workflow editor...');
        window.open('/workflow-editor.html', '_blank');
    }

    openAgentStudio() {
        console.log('🤖 Opening agent studio...');
        window.open('/agent-studio.html', '_blank');
    }

    // Data loading methods
    async loadSpecs() {
        console.log('📋 Loading specs...');
        try {
            const response = await fetch('/api/specs');
            console.log('📋 Specs response status:', response.status);
            const specs = await response.json();
            console.log('📋 Specs data received:', specs ? specs.length : 'null', 'items');
            console.log('📋 First spec:', specs?.[0]);
            
            // SIMPLE TEST: Just put basic text to see if anything shows
            const content = document.getElementById('specs-content');
            if (content && specs && specs.length > 0) {
                content.innerHTML = `<p style="color: red; font-size: 20px; font-weight: bold;">TEST: Found ${specs.length} specs. First spec: ${specs[0]?.title || 'No title'}</p>`;
                console.log('🧪 SIMPLE TEST: Set basic HTML directly to specs-content');
                
                // NUCLEAR TEST: Also try to inject into main container to bypass section visibility
                const mainContainer = document.querySelector('.dashboard-main');
                if (mainContainer) {
                    const testDiv = document.createElement('div');
                    testDiv.style.cssText = `
                        background: blue !important; 
                        color: white !important; 
                        padding: 40px !important; 
                        font-size: 30px !important; 
                        font-weight: bold !important; 
                        border: 10px solid red !important;
                        margin: 20px !important;
                        min-height: 200px !important;
                    `;
                    testDiv.innerHTML = `
                        <h2>🔵 MAIN CONTAINER TEST: ${specs.length} specs loaded!</h2>
                        <div style="background: white; color: black; padding: 10px; margin: 10px 0;">
                            First spec: ${specs[0]?.title || 'No title'}
                        </div>
                        <div style="background: green; color: white; padding: 10px;">
                            This should be VERY visible in the yellow box!
                        </div>
                    `;
                    mainContainer.appendChild(testDiv);
                    console.log('💥 MAIN CONTAINER TEST: Added blue div to dashboard-main');
                } else {
                    console.log('❌ Could not find dashboard-main container');
                }
                
                // ALSO keep the popup test
                const popupDiv = document.createElement('div');
                popupDiv.style.cssText = `
                    position: fixed; 
                    top: 100px; 
                    left: 50%; 
                    transform: translateX(-50%); 
                    background: red; 
                    color: white; 
                    padding: 20px; 
                    font-size: 24px; 
                    font-weight: bold; 
                    z-index: 9999; 
                    border: 5px solid yellow;
                `;
                popupDiv.textContent = `POPUP TEST: ${specs.length} specs loaded!`;
                document.body.appendChild(popupDiv);
                console.log('💥 POPUP TEST: Added fixed position div to body');
                
                // Remove popup after 5 seconds
                setTimeout(() => popupDiv.remove(), 5000);
            } else {
                console.log('🧪 SIMPLE TEST: No content div or no specs data', {content, specs: specs?.length});
            }
            
            // Also try the normal render
            this.renderSpecs(specs);
        } catch (error) {
            console.error('Failed to load specs:', error);
            document.getElementById('specs-content').innerHTML = '<p>Failed to load specifications.</p>';
        }
    }

    async loadNotes() {
        console.log('📝 Loading notes...');
        try {
            const response = await fetch('/api/memory/notes');
            const notes = await response.json();
            this.renderNotes(notes);
        } catch (error) {
            console.error('Failed to load notes:', error);
            document.getElementById('memory-content').innerHTML = '<p>Failed to load memory notes.</p>';
        }
    }

    async loadProjects() {
        console.log('📊 Loading projects...');
        try {
            const response = await fetch('/api/projects');
            const projects = await response.json();
            this.renderProjects(projects);
        } catch (error) {
            console.error('Failed to load projects:', error);
            document.getElementById('projects-content').innerHTML = '<p>Failed to load projects.</p>';
        }
    }

    async loadAgents() {
        console.log('🤖 Loading agents...');
        try {
            const response = await fetch('/api/agents');
            const agents = await response.json();
            this.renderAgents(agents);
        } catch (error) {
            console.error('Failed to load agents:', error);
            document.getElementById('agents-content').innerHTML = '<p>Failed to load agents.</p>';
        }
    }

    // Rendering methods
    renderSpecs(specs) {
        console.log('🔍 renderSpecs called with data:', specs ? specs.length : 'null', specs);
        const content = document.getElementById('specs-content');
        console.log('🎯 specs-content element:', content);
        
        if (!specs || specs.length === 0) {
            console.log('❌ No specs data, showing no data message');
            content.innerHTML = '<p>No specifications found.</p>';
            return;
        }

        const specsHtml = specs.slice(0, 10).map(spec => `
            <div class="data-item" data-type="spec">
                <h4>${spec.title}</h4>
                <p>${spec.description ? spec.description.substring(0, 200) + '...' : 'No description'}</p>
                <div class="data-item-meta">
                    <span class="data-tag">${spec.status || 'draft'}</span>
                    <span class="data-priority priority-${spec.priority || 'medium'}">${spec.priority || 'medium'}</span>
                    ${spec.tags ? spec.tags.slice(0, 3).map(tag => `<span class="data-tag">${tag}</span>`).join('') : ''}
                </div>
            </div>
        `).join('');

        const finalHtml = `
            <div class="data-list">
                ${specsHtml}
            </div>
            ${specs.length > 10 ? `<p style="text-align: center; margin-top: 1rem; color: var(--text-secondary);">Showing 10 of ${specs.length} specifications</p>` : ''}
        `;
        
        console.log('✅ Setting innerHTML with HTML length:', finalHtml.length);
        content.innerHTML = finalHtml;
        console.log('🎯 After setting innerHTML, content.innerHTML length:', content.innerHTML.length);
    }

    renderNotes(notes) {
        const content = document.getElementById('memory-content');
        if (!notes || notes.length === 0) {
            content.innerHTML = '<p>No memory notes found.</p>';
            return;
        }

        const notesHtml = notes.slice(0, 10).map(note => `
            <div class="data-item" data-type="memory">
                <h4>${note.title}</h4>
                <p>${note.content ? note.content.substring(0, 200) + '...' : 'No content'}</p>
                <div class="data-item-meta">
                    ${note.tags ? note.tags.slice(0, 3).map(tag => `<span class="data-tag">${tag}</span>`).join('') : ''}
                </div>
            </div>
        `).join('');

        content.innerHTML = `
            <div class="data-list">
                ${notesHtml}
            </div>
            ${notes.length > 10 ? `<p style="text-align: center; margin-top: 1rem; color: var(--text-secondary);">Showing 10 of ${notes.length} notes</p>` : ''}
        `;
    }

    renderProjects(projects) {
        const content = document.getElementById('projects-content');
        if (!projects || projects.length === 0) {
            content.innerHTML = '<p>No projects found.</p>';
            return;
        }

        const projectsHtml = projects.map(project => `
            <div class="data-item" data-type="project">
                <h4>${project.name}</h4>
                <p>${project.description || 'No description'}</p>
                <div class="data-item-meta">
                    ${project.key ? `<span class="data-tag">${project.key}</span>` : ''}
                    ${project.type ? `<span class="data-tag">${project.type}</span>` : ''}
                </div>
            </div>
        `).join('');

        content.innerHTML = `
            <div class="data-list">
                ${projectsHtml}
            </div>
        `;
    }

    renderAgents(agents) {
        const content = document.getElementById('agents-content');
        if (!agents || agents.length === 0) {
            content.innerHTML = '<p>No agents found.</p>';
            return;
        }

        const agentsHtml = agents.slice(0, 10).map(agent => `
            <div class="data-item" data-type="agent">
                <h4>${agent.name}</h4>
                <p>${agent.description ? agent.description.substring(0, 200) + '...' : 'No description'}</p>
                <div class="data-item-meta">
                    ${agent.primaryRole ? `<span class="data-tag">${agent.primaryRole}</span>` : ''}
                    ${agent.capabilities ? Object.keys(agent.capabilities).slice(0, 2).map(cap => `<span class="data-tag">${cap}</span>`).join('') : ''}
                </div>
            </div>
        `).join('');

        content.innerHTML = `
            <div class="data-list">
                ${agentsHtml}
            </div>
            ${agents.length > 10 ? `<p style="text-align: center; margin-top: 1rem; color: var(--text-secondary);">Showing 10 of ${agents.length} agents</p>` : ''}
        `;
    }

    async setupProjectSelector() {
        console.log('🔧 Setting up project selector...');
        // Implementation will be in projects module
    }

    // Form submission methods (to be extended)
    createSpec(event) {
        event.preventDefault();
        console.log('📋 Creating spec...');
        // Implementation will be in specs module
    }

    createNote(event) {
        event.preventDefault();
        console.log('📝 Creating note...');
        // Implementation will be in memory module
    }

    createAgent(event) {
        event.preventDefault();
        console.log('🤖 Creating agent...');
        // Implementation will be in agents module
    }

    saveProjectConfiguration(event) {
        event.preventDefault();
        console.log('💾 Saving project configuration...');
        // Implementation will be in projects module
    }

    createSpecModal() {
        console.log('📋 Creating spec modal...');
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        modal.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 8px; width: 500px; max-width: 90vw;">
                <h3>Create New Specification</h3>
                <form id="quick-spec-form">
                    <div style="margin-bottom: 1rem;">
                        <label>Title:</label>
                        <input type="text" id="spec-title" style="width: 100%; padding: 0.5rem; margin-top: 0.5rem;" required>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label>Description:</label>
                        <textarea id="spec-description" style="width: 100%; padding: 0.5rem; margin-top: 0.5rem; height: 100px;"></textarea>
                    </div>
                    <div style="display: flex; gap: 1rem; justify-content: end;">
                        <button type="button" onclick="this.closest('.modal').remove()" style="padding: 0.5rem 1rem;">Cancel</button>
                        <button type="submit" style="padding: 0.5rem 1rem; background: #007bff; color: white; border: none; border-radius: 4px;">Create</button>
                    </div>
                </form>
            </div>
        `;
        modal.className = 'modal';
        
        modal.querySelector('form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = modal.querySelector('#spec-title').value;
            const description = modal.querySelector('#spec-description').value;
            
            try {
                const response = await fetch('/api/specs', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({title, description, status: 'draft', priority: 'medium'})
                });
                if (response.ok) {
                    modal.remove();
                    this.loadSpecs(); // Reload the specs
                }
            } catch (error) {
                console.error('Failed to create spec:', error);
            }
        });
        
        document.body.appendChild(modal);
    }
}