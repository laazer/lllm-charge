/**
 * Modal Management System
 * Handles all modal creation, population, and interaction
 */

export class ModalManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    createModal(title, icon = '📋') {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-container">
                <div class="modal-header">
                    <h2>${icon} ${title}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-content-area">
                    <!-- Content will be populated here -->
                </div>
            </div>
        `;
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Close modal with Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        return modal;
    }

    populateModal(modal, content) {
        const contentArea = modal.querySelector('.modal-content-area');
        if (contentArea) {
            contentArea.innerHTML = content;
        }
        document.body.appendChild(modal);
    }

    showPreview(type, data) {
        const modal = this.createModal(`${type.charAt(0).toUpperCase() + type.slice(1)} Preview`, '👁️');
        
        let content = '';
        
        if (type === 'spec') {
            content = `
                <div style="padding: 1rem;">
                    <div style="margin-bottom: 1rem;">
                        <h3 style="margin: 0; color: var(--text);">${data.title}</h3>
                        ${data.status ? `<span style="background: ${this.getStatusColor(data.status)}; color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; margin: 0.5rem 0;">${data.status.toUpperCase()}</span>` : ''}
                        ${data.priority ? `<span style="background: ${this.getPriorityColor(data.priority)}; color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; margin-left: 0.5rem;">${data.priority.toUpperCase()}</span>` : ''}
                    </div>
                    ${data.tags && data.tags.length > 0 ? `<div style="margin-bottom: 1rem;">${data.tags.map(tag => `<span style="background: var(--primary-color); color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; margin-right: 0.5rem;">${tag}</span>`).join('')}</div>` : ''}
                    <div style="border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem; background: var(--surface);">
                        ${this.renderMarkdown(data.description)}
                    </div>
                </div>
            `;
        } else if (type === 'note') {
            content = `
                <div style="padding: 1rem;">
                    <div style="margin-bottom: 1rem;">
                        <h3 style="margin: 0; color: var(--text);">${data.title}</h3>
                        ${data.tags && data.tags.length > 0 ? `<div style="margin-top: 0.5rem;">${data.tags.map(tag => `<span style="background: var(--success-color); color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; margin-right: 0.5rem;">${tag}</span>`).join('')}</div>` : ''}
                    </div>
                    <div style="border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem; background: var(--surface);">
                        ${this.renderMarkdown(data.content)}
                    </div>
                </div>
            `;
        } else if (type === 'project') {
            content = `
                <div style="padding: 1rem;">
                    <div style="margin-bottom: 1rem;">
                        <h3 style="margin: 0; color: var(--text);">${data.name}</h3>
                        ${data.key ? `<div style="font-family: monospace; background: var(--surface); padding: 0.5rem; border-radius: 0.25rem; margin: 0.5rem 0; font-size: 0.875rem; border: 1px solid var(--border);">${data.key}</div>` : ''}
                    </div>
                    <div style="border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem; background: var(--surface);">
                        ${this.renderMarkdown(data.description)}
                    </div>
                </div>
            `;
        } else if (type === 'agent') {
            content = `
                <div style="padding: 1rem;">
                    <div style="margin-bottom: 1rem;">
                        <h3 style="margin: 0; color: var(--text);">${data.name}</h3>
                        ${data.primaryRole ? `<div style="background: var(--warning-color); color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; margin: 0.5rem 0; display: inline-block;">${data.primaryRole.toUpperCase()}</div>` : ''}
                    </div>
                    <div style="border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem; background: var(--surface);">
                        ${this.renderMarkdown(data.description)}
                    </div>
                </div>
            `;
        }
        
        // Add edit button
        content += `
            <div style="padding: 1rem; text-align: right; border-top: 1px solid var(--border);">
                <button onclick="dashboard.edit${type.charAt(0).toUpperCase() + type.slice(1)}('${data.id}')" class="btn primary">
                    ✏️ Edit ${type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
            </div>
        `;
        
        this.populateModal(modal, content);
    }

    renderMarkdown(content) {
        if (typeof marked !== 'undefined' && content) {
            return marked.parse(content, {
                highlight: function(code, lang) {
                    if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                        return hljs.highlight(code, { language: lang }).value;
                    }
                    return code;
                }
            });
        }
        
        // Fallback to simple HTML formatting
        if (typeof hljs !== 'undefined') {
            const highlightedContent = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
                const highlighted = lang && hljs.getLanguage(lang) 
                    ? hljs.highlight(code, { language: lang }).value 
                    : code;
                return `<pre><code class="hljs">${highlighted}</code></pre>`;
            });
            return highlightedContent.replace(/\n/g, '<br>');
        }
        
        return content.replace(/\n/g, '<br>');
    }

    getStatusColor(status) {
        const colors = {
            'active': 'var(--success-color)',
            'draft': 'var(--warning-color)',
            'completed': 'var(--primary-color)',
            'archived': 'var(--text-secondary)'
        };
        return colors[status] || 'var(--text-secondary)';
    }

    getPriorityColor(priority) {
        const colors = {
            'critical': '#dc2626',
            'high': 'var(--error-color)',
            'medium': 'var(--warning-color)',
            'low': 'var(--success-color)'
        };
        return colors[priority] || 'var(--text-secondary)';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            transition: opacity 0.3s ease;
            ${type === 'success' ? 'background: #10b981;' : ''}
            ${type === 'error' ? 'background: #ef4444;' : ''}
            ${type === 'warning' ? 'background: #f59e0b;' : ''}
            ${type === 'info' ? 'background: #3b82f6;' : ''}
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }
}