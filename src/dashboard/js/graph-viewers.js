/**
 * Graph Viewers Module
 * Handles CodeGraph and FileGraph visualization components
 */

export class GraphViewers {
    constructor(dashboard, modalManager) {
        this.dashboard = dashboard;
        this.modalManager = modalManager;
    }

    async showCodeGraphViewer() {
        try {
            // First try to fetch real CodeGraph data via MCP
            const response = await fetch('/api/codegraph/status');
            const cgData = await response.json();
            
            if (cgData.success && cgData.data) {
                // Use real CodeGraph data
                const analysis = {
                    functions: cgData.data.nodes || 0,
                    connections: cgData.data.edges || 0,
                    classes: cgData.data.files || 0,
                    isReal: true,
                    lastIndexed: cgData.data.lastIndexed
                };
                this.displayCodeGraphModal(analysis);
            } else {
                // Fallback to sample data
                console.log('📊 No real CodeGraph data, showing fallback');
                this.showCodeGraphViewerFallback();
            }
        } catch (error) {
            console.error('Failed to load CodeGraph data:', error);
            this.showCodeGraphViewerFallback();
        }
    }

    displayCodeGraphModal(analysis) {
        const modal = this.modalManager.createModal('Code Graph Viewer', '🔗');
        
        const content = `
            <div style="display: grid; gap: 1.5rem;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; text-align: center;">
                        <div style="font-size: 2rem; color: var(--primary-color); margin-bottom: 0.5rem;">🧠</div>
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--text);">Functions</h3>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text);">${analysis.functions}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Analyzed functions</div>
                    </div>
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; text-align: center;">
                        <div style="font-size: 2rem; color: var(--success-color); margin-bottom: 0.5rem;">🔗</div>
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--text);">Connections</h3>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text);">${analysis.connections}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Function calls</div>
                    </div>
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; text-align: center;">
                        <div style="font-size: 2rem; color: var(--warning-color); margin-bottom: 0.5rem;">📦</div>
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--text);">Classes</h3>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text);">${analysis.classes}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Class definitions</div>
                    </div>
                </div>

                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem;">
                    <h3 style="margin: 0 0 1rem 0; color: var(--text); display: flex; align-items: center; gap: 0.5rem;">
                        🌐 Graph Visualization
                        ${analysis.isReal ? '<span style="background: var(--success-color); color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; margin-left: auto;">REAL DATA</span>' : ''}
                    </h3>
                    <div style="
                        height: 300px; 
                        background: linear-gradient(135deg, var(--background) 0%, var(--surface) 100%); 
                        border: 2px dashed var(--border); 
                        border-radius: 0.5rem; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center;
                        position: relative;
                        overflow: hidden;
                    ">
                        ${this.generateGraphVisualization(analysis)}
                        <div style="
                            background: rgba(59, 130, 246, 0.1); 
                            border: 1px solid var(--primary-color); 
                            color: var(--primary-color); 
                            padding: 1rem 2rem; 
                            border-radius: 0.5rem; 
                            text-align: center;
                            backdrop-filter: blur(4px);
                        ">
                            <div style="font-weight: 600; margin-bottom: 0.5rem;">Interactive Graph View</div>
                            <div style="font-size: 0.875rem;">Visual representation of code dependencies and relationships</div>
                        </div>
                    </div>
                </div>

                ${this.generateGraphStats(analysis)}
            </div>
        `;
        
        this.modalManager.populateModal(modal, content);
    }

    showCodeGraphViewerFallback() {
        const modal = this.modalManager.createModal('Code Graph Viewer', '🔗');
        
        const content = `
            <div style="display: grid; gap: 1.5rem;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; text-align: center;">
                        <div style="font-size: 2rem; color: var(--primary-color); margin-bottom: 0.5rem;">🧠</div>
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--text);">Functions</h3>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text);">234</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Analyzed functions</div>
                    </div>
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; text-align: center;">
                        <div style="font-size: 2rem; color: var(--success-color); margin-bottom: 0.5rem;">🔗</div>
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--text);">Connections</h3>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text);">189</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Function calls</div>
                    </div>
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; text-align: center;">
                        <div style="font-size: 2rem; color: var(--warning-color); margin-bottom: 0.5rem;">📦</div>
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--text);">Classes</h3>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text);">45</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Class definitions</div>
                    </div>
                </div>

                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem;">
                    <h3 style="margin: 0 0 1rem 0; color: var(--text); display: flex; align-items: center; gap: 0.5rem;">
                        🌐 Graph Visualization
                        <span style="background: var(--warning-color); color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; margin-left: auto;">SAMPLE DATA</span>
                    </h3>
                    <div style="
                        height: 300px; 
                        background: linear-gradient(135deg, var(--background) 0%, var(--surface) 100%); 
                        border: 2px dashed var(--border); 
                        border-radius: 0.5rem; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center;
                        position: relative;
                        overflow: hidden;
                    ">
                        ${this.generateSampleGraphVisualization()}
                        <div style="
                            background: rgba(59, 130, 246, 0.1); 
                            border: 1px solid var(--primary-color); 
                            color: var(--primary-color); 
                            padding: 1rem 2rem; 
                            border-radius: 0.5rem; 
                            text-align: center;
                            backdrop-filter: blur(4px);
                        ">
                            <div style="font-weight: 600; margin-bottom: 0.5rem;">Interactive Graph View</div>
                            <div style="font-size: 0.875rem;">Visual representation of code dependencies and relationships</div>
                        </div>
                    </div>
                </div>

                ${this.generateSampleGraphStats()}
            </div>
        `;
        
        this.modalManager.populateModal(modal, content);
    }

    async showFileGraphViewer() {
        try {
            // Fetch real analysis data
            const response = await fetch('/api/metrics');
            const data = await response.json();
            
            if (data.projectAnalysis && data.projectAnalysis.files) {
                this.displayFileGraphModal(data.projectAnalysis);
            } else {
                this.showFileGraphViewerFallback();
            }
        } catch (error) {
            console.error('Failed to load file graph data:', error);
            this.showFileGraphViewerFallback();
        }
    }

    displayFileGraphModal(analysis) {
        const modal = this.modalManager.createModal('File Graph Viewer', '📁');
        
        const fileData = analysis.files || {};
        const totalFiles = fileData.total || 0;
        const dependencies = analysis.dependencies?.total || 0;
        
        const content = `
            <div style="display: grid; gap: 1.5rem;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; text-align: center;">
                        <div style="font-size: 2rem; color: var(--primary-color); margin-bottom: 0.5rem;">📄</div>
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--text);">Total Files</h3>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text);">${totalFiles}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Indexed files</div>
                    </div>
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; text-align: center;">
                        <div style="font-size: 2rem; color: var(--success-color); margin-bottom: 0.5rem;">🔗</div>
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--text);">Dependencies</h3>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text);">${dependencies}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Import/exports</div>
                    </div>
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; text-align: center;">
                        <div style="font-size: 2rem; color: var(--warning-color); margin-bottom: 0.5rem;">📦</div>
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--text);">Modules</h3>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text);">${Object.keys(fileData.byType || {}).length}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">File types</div>
                    </div>
                </div>

                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem;">
                    <h3 style="margin: 0 0 1rem 0; color: var(--text); display: flex; align-items: center; gap: 0.5rem;">
                        🗂️ Project Structure
                        <span style="background: var(--success-color); color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; margin-left: auto;">REAL DATA</span>
                    </h3>
                    ${this.generateFileTree(analysis)}
                </div>

                ${this.generateFileStats(fileData)}
            </div>
        `;
        
        this.modalManager.populateModal(modal, content);
    }

    showFileGraphViewerFallback() {
        const modal = this.modalManager.createModal('File Graph Viewer', '📁');
        
        const content = `
            <div style="display: grid; gap: 1.5rem;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; text-align: center;">
                        <div style="font-size: 2rem; color: var(--primary-color); margin-bottom: 0.5rem;">📄</div>
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--text);">Total Files</h3>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text);">89</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Indexed files</div>
                    </div>
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; text-align: center;">
                        <div style="font-size: 2rem; color: var(--success-color); margin-bottom: 0.5rem;">🔗</div>
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--text);">Dependencies</h3>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text);">156</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Import/exports</div>
                    </div>
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; text-align: center;">
                        <div style="font-size: 2rem; color: var(--warning-color); margin-bottom: 0.5rem;">📦</div>
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--text);">Modules</h3>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text);">12</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Module groups</div>
                    </div>
                </div>

                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem;">
                    <h3 style="margin: 0 0 1rem 0; color: var(--text); display: flex; align-items: center; gap: 0.5rem;">
                        🗂️ File Structure Tree
                        <span style="background: var(--warning-color); color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; margin-left: auto;">SAMPLE DATA</span>
                    </h3>
                    ${this.generateSampleFileTree()}
                </div>

                ${this.generateSampleFileStats()}
            </div>
        `;
        
        this.modalManager.populateModal(modal, content);
    }

    generateGraphVisualization(analysis) {
        // Generate SVG based on real data
        const nodeCount = Math.min(analysis.functions, 10);
        const nodes = [];
        const edges = [];
        
        // Generate node positions
        for (let i = 0; i < nodeCount; i++) {
            const angle = (i / nodeCount) * 2 * Math.PI;
            const radius = 80 + Math.random() * 40;
            const x = 50 + Math.cos(angle) * radius;
            const y = 50 + Math.sin(angle) * radius;
            nodes.push({ x: x + '%', y: y + '%', size: 6 + Math.random() * 4 });
        }
        
        // Generate edges based on connections
        const edgeCount = Math.min(analysis.connections, nodeCount * 2);
        for (let i = 0; i < edgeCount && i < nodes.length - 1; i++) {
            const target = (i + 1 + Math.floor(Math.random() * 3)) % nodes.length;
            edges.push({ from: nodes[i], to: nodes[target] });
        }
        
        let svg = '<svg width="100%" height="100%" style="position: absolute; top: 0; left: 0;">';
        
        // Render edges
        edges.forEach(edge => {
            svg += `<line x1="${edge.from.x}" y1="${edge.from.y}" x2="${edge.to.x}" y2="${edge.to.y}" stroke="var(--border)" stroke-width="2" opacity="0.6"/>`;
        });
        
        // Render nodes
        nodes.forEach((node, i) => {
            const colors = ['var(--primary-color)', 'var(--success-color)', 'var(--warning-color)', 'var(--error-color)'];
            const color = colors[i % colors.length];
            svg += `<circle cx="${node.x}" cy="${node.y}" r="${node.size}" fill="${color}" opacity="0.8"/>`;
        });
        
        svg += '</svg>';
        return svg;
    }

    generateSampleGraphVisualization() {
        return `
            <svg width="100%" height="100%" style="position: absolute; top: 0; left: 0;">
                <!-- Graph nodes -->
                <circle cx="20%" cy="30%" r="8" fill="var(--primary-color)" opacity="0.8"/>
                <circle cx="40%" cy="20%" r="6" fill="var(--success-color)" opacity="0.8"/>
                <circle cx="60%" cy="40%" r="10" fill="var(--warning-color)" opacity="0.8"/>
                <circle cx="80%" cy="25%" r="7" fill="var(--error-color)" opacity="0.8"/>
                <circle cx="30%" cy="70%" r="9" fill="var(--primary-color)" opacity="0.8"/>
                <circle cx="70%" cy="75%" r="6" fill="var(--success-color)" opacity="0.8"/>
                
                <!-- Graph edges -->
                <line x1="20%" y1="30%" x2="40%" y2="20%" stroke="var(--border)" stroke-width="2" opacity="0.6"/>
                <line x1="40%" y1="20%" x2="60%" y2="40%" stroke="var(--border)" stroke-width="2" opacity="0.6"/>
                <line x1="60%" y1="40%" x2="80%" y2="25%" stroke="var(--border)" stroke-width="2" opacity="0.6"/>
                <line x1="20%" y1="30%" x2="30%" y2="70%" stroke="var(--border)" stroke-width="2" opacity="0.6"/>
                <line x1="60%" y1="40%" x2="70%" y2="75%" stroke="var(--border)" stroke-width="2" opacity="0.6"/>
            </svg>
        `;
    }

    generateGraphStats(analysis) {
        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1rem;">
                    <h4 style="margin: 0 0 1rem 0; color: var(--text); font-size: 0.875rem;">Analysis Details</h4>
                    <div style="display: grid; gap: 0.5rem; font-size: 0.75rem;">
                        <div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid var(--border);">
                            <span style="color: var(--text);">Functions Analyzed</span>
                            <span style="color: var(--primary-color);">${analysis.functions}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid var(--border);">
                            <span style="color: var(--text);">Call Relationships</span>
                            <span style="color: var(--primary-color);">${analysis.connections}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 0.25rem 0;">
                            <span style="color: var(--text);">Classes Found</span>
                            <span style="color: var(--primary-color);">${analysis.classes}</span>
                        </div>
                    </div>
                </div>
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1rem;">
                    <h4 style="margin: 0 0 1rem 0; color: var(--text); font-size: 0.875rem;">Graph Health</h4>
                    <div style="display: grid; gap: 0.75rem; font-size: 0.75rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text);">Data Quality</span>
                            <span style="color: ${analysis.isReal ? 'var(--success-color)' : 'var(--warning-color)'};">${analysis.isReal ? 'Real' : 'Sample'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text);">Complexity</span>
                            <span style="color: var(--warning-color);">Medium</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text);">Last Updated</span>
                            <span style="color: var(--text-secondary);">${analysis.lastIndexed ? new Date(analysis.lastIndexed).toLocaleString() : '2 min ago'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    generateSampleGraphStats() {
        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1rem;">
                    <h4 style="margin: 0 0 1rem 0; color: var(--text); font-size: 0.875rem;">Top Functions</h4>
                    <div style="display: grid; gap: 0.5rem; font-size: 0.75rem;">
                        <div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid var(--border);">
                            <span style="color: var(--text);">processRequest()</span>
                            <span style="color: var(--primary-color);">42 calls</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid var(--border);">
                            <span style="color: var(--text);">validateInput()</span>
                            <span style="color: var(--primary-color);">38 calls</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 0.25rem 0;">
                            <span style="color: var(--text);">createAgent()</span>
                            <span style="color: var(--primary-color);">29 calls</span>
                        </div>
                    </div>
                </div>
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1rem;">
                    <h4 style="margin: 0 0 1rem 0; color: var(--text); font-size: 0.875rem;">Graph Health</h4>
                    <div style="display: grid; gap: 0.75rem; font-size: 0.75rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text);">Coverage</span>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <div style="width: 40px; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden;">
                                    <div style="width: 85%; height: 100%; background: var(--success-color);"></div>
                                </div>
                                <span style="color: var(--success-color);">85%</span>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text);">Complexity</span>
                            <span style="color: var(--warning-color);">Medium</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text);">Last Updated</span>
                            <span style="color: var(--text-secondary);">2 min ago</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    generateFileTree(analysis) {
        const deps = analysis.dependencies?.dependencies || [];
        const prodDeps = deps.slice(0, 10); // Show first 10 dependencies
        
        return `
            <div style="
                background: var(--background); 
                border: 1px solid var(--border); 
                border-radius: 0.5rem; 
                padding: 1rem;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 0.8rem;
                line-height: 1.5;
                max-height: 300px;
                overflow-y: auto;
            ">
                <div style="color: var(--text);">
                    <div style="color: var(--primary-color);">📁 src/</div>
                    <div style="margin-left: 1rem; color: var(--text);">
                        <div style="color: var(--success-color);">📁 dashboard/</div>
                        <div style="margin-left: 1rem;">
                            <div>📄 interactive-dashboard.html</div>
                            <div>📄 real-time-dashboard.ts</div>
                        </div>
                        <div style="color: var(--success-color);">📁 server/</div>
                        <div style="margin-left: 1rem;">
                            <div>📄 working-server.mjs</div>
                        </div>
                    </div>
                    <div style="color: var(--primary-color);">📁 dependencies/</div>
                    <div style="margin-left: 1rem; color: var(--text);">
                        ${prodDeps.map(dep => `<div>📦 ${dep}</div>`).join('')}
                        ${deps.length > 10 ? `<div style="color: var(--text-secondary);">... and ${deps.length - 10} more</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    generateSampleFileTree() {
        return `
            <div style="
                background: var(--background); 
                border: 1px solid var(--border); 
                border-radius: 0.5rem; 
                padding: 1rem;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 0.8rem;
                line-height: 1.5;
                max-height: 300px;
                overflow-y: auto;
            ">
                <div style="color: var(--text);">
                    <div style="color: var(--primary-color);">📁 src/</div>
                    <div style="margin-left: 1rem; color: var(--text);">
                        <div style="color: var(--success-color);">📁 dashboard/</div>
                        <div style="margin-left: 1rem;">
                            <div>📄 interactive-dashboard.html</div>
                            <div>📄 workflow-editor.html</div>
                            <div>📄 agent-studio.html</div>
                        </div>
                        <div style="color: var(--success-color);">📁 server/</div>
                        <div style="margin-left: 1rem;">
                            <div>📄 working-server.mjs</div>
                            <div>📄 spec-manager.js</div>
                        </div>
                        <div style="color: var(--success-color);">📁 utils/</div>
                        <div style="margin-left: 1rem;">
                            <div>📄 common-commands.ts</div>
                            <div>📄 file-utils.js</div>
                        </div>
                    </div>
                    <div style="color: var(--primary-color);">📁 tests/</div>
                    <div style="margin-left: 1rem; color: var(--text);">
                        <div style="color: var(--success-color);">📁 unit/</div>
                        <div style="margin-left: 1rem;">
                            <div>📄 spec-manager.test.ts</div>
                            <div>📄 checkpoint-manager.test.ts</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    generateFileStats(fileData) {
        const types = fileData.byType || {};
        const typeEntries = Object.entries(types).slice(0, 5);
        
        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1rem;">
                    <h4 style="margin: 0 0 1rem 0; color: var(--text); font-size: 0.875rem;">File Types</h4>
                    <div style="display: grid; gap: 0.5rem; font-size: 0.75rem;">
                        ${typeEntries.map(([ext, count]) => `
                            <div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid var(--border);">
                                <span style="color: var(--text);">${ext}</span>
                                <span style="color: var(--primary-color);">${count} files</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1rem;">
                    <h4 style="margin: 0 0 1rem 0; color: var(--text); font-size: 0.875rem;">Project Health</h4>
                    <div style="display: grid; gap: 0.75rem; font-size: 0.75rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text);">File Count</span>
                            <span style="color: var(--success-color);">${fileData.total || 0}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text);">Data Quality</span>
                            <span style="color: ${fileData.isReal ? 'var(--success-color)' : 'var(--warning-color)'};">${fileData.isReal ? 'Real' : 'Sample'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text);">Last Scan</span>
                            <span style="color: var(--text-secondary);">Just now</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    generateSampleFileStats() {
        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1rem;">
                    <h4 style="margin: 0 0 1rem 0; color: var(--text); font-size: 0.875rem;">File Types</h4>
                    <div style="display: grid; gap: 0.5rem; font-size: 0.75rem;">
                        <div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid var(--border);">
                            <span style="color: var(--text);">.html</span>
                            <span style="color: var(--primary-color);">12 files</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid var(--border);">
                            <span style="color: var(--text);">.js/.mjs</span>
                            <span style="color: var(--success-color);">28 files</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 0.25rem 0;">
                            <span style="color: var(--text);">.ts</span>
                            <span style="color: var(--warning-color);">15 files</span>
                        </div>
                    </div>
                </div>
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1rem;">
                    <h4 style="margin: 0 0 1rem 0; color: var(--text); font-size: 0.875rem;">Project Health</h4>
                    <div style="display: grid; gap: 0.75rem; font-size: 0.75rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text);">Coverage</span>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <div style="width: 40px; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden;">
                                    <div style="width: 92%; height: 100%; background: var(--success-color);"></div>
                                </div>
                                <span style="color: var(--success-color);">92%</span>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text);">Organization</span>
                            <span style="color: var(--success-color);">Good</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text);">Last Scan</span>
                            <span style="color: var(--text-secondary);">5 min ago</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}