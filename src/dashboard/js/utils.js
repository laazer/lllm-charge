/**
 * Dashboard Utilities
 * Common utilities and helper functions
 */

export class DashboardUtils {
    constructor() {
        // Initialize any utility-level state
    }

    // Form handling utilities
    static parseDocumentFile(fileInput, formType) {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            DashboardUtils.extractFieldsFromDocument(content, formType);
        };
        reader.readAsText(file);
    }

    static extractFieldsFromDocument(content, formType) {
        let title = '';
        let description = '';
        let tags = [];
        let priority = 'medium';

        // Extract title from first heading or filename
        const titleMatch = content.match(/^#\s+(.+)$/m);
        if (titleMatch) {
            title = titleMatch[1].trim();
        } else {
            // Fallback to first line if no heading
            const firstLine = content.split('\n')[0].trim();
            if (firstLine && firstLine.length < 100) {
                title = firstLine.replace(/^[#\-*=]+\s*/, '').trim();
            }
        }

        // Extract description (first paragraph after title)
        const lines = content.split('\n');
        let descriptionLines = [];
        let startCollecting = false;
        
        for (let line of lines) {
            line = line.trim();
            
            // Skip the title line
            if (line.includes(title) && !startCollecting) {
                startCollecting = true;
                continue;
            }
            
            if (startCollecting) {
                // Stop at next heading or empty line followed by heading
                if (line.match(/^#{1,6}\s+/) && descriptionLines.length > 0) {
                    break;
                }
                
                if (line) {
                    descriptionLines.push(line);
                }
                
                // Stop after reasonable description length
                if (descriptionLines.join(' ').length > 300) {
                    break;
                }
            }
        }

        description = descriptionLines.join(' ').trim();

        // Extract tags from various sources
        const tagMatches = content.match(/(?:tags?|keywords?):\s*([^\n]+)/i);
        if (tagMatches) {
            tags = tagMatches[1].split(/[,;]/).map(tag => tag.trim().toLowerCase()).filter(tag => tag);
        }

        // Look for common markdown tags
        const hashtagMatches = content.match(/#(\w+)/g);
        if (hashtagMatches) {
            tags.push(...hashtagMatches.map(tag => tag.slice(1).toLowerCase()));
        }

        // Determine priority from content
        if (content.toLowerCase().includes('urgent') || content.toLowerCase().includes('critical')) {
            priority = 'high';
        } else if (content.toLowerCase().includes('important')) {
            priority = 'medium';
        }

        // Fill form fields
        DashboardUtils.fillFormFields(formType, {
            title: title || 'Imported Document',
            description: description || content.substring(0, 500) + (content.length > 500 ? '...' : ''),
            tags: [...new Set(tags)], // Remove duplicates
            priority: priority
        });

        DashboardUtils.showNotification(`✅ Document parsed successfully! Title and description filled.`, 'success');
    }

    static fillFormFields(formType, data) {
        const prefixes = { spec: 'spec', note: 'note', project: 'project' };
        const prefix = prefixes[formType] || formType;

        // Fill title
        const titleField = document.getElementById(`${prefix}-title`);
        if (titleField && data.title) {
            titleField.value = data.title;
        }

        // Fill description/content
        const descFields = [`${prefix}-description`, `${prefix}-content`];
        for (let fieldId of descFields) {
            const field = document.getElementById(fieldId);
            if (field && data.description) {
                field.value = data.description;
                break;
            }
        }

        // Fill tags
        const tagsField = document.getElementById(`${prefix}-tags`);
        if (tagsField && data.tags.length > 0) {
            tagsField.value = data.tags.join(', ');
        }

        // Fill priority
        const priorityField = document.getElementById(`${prefix}-priority`);
        if (priorityField && data.priority) {
            priorityField.value = data.priority;
        }
    }

    // Markdown utilities
    static updateMarkdownPreview(type) {
        const textarea = document.getElementById(`${type}-${type === 'spec' ? 'description' : type === 'note' ? 'content' : type === 'project' ? 'description' : 'description'}`);
        const preview = document.getElementById(`${type}-${type === 'spec' ? 'description' : type === 'note' ? 'content' : type === 'project' ? 'description' : 'description'}-preview`);
        
        if (textarea && preview) {
            const content = textarea.value;
            
            if (typeof marked !== 'undefined') {
                preview.innerHTML = marked.parse(content, {
                    highlight: function(code, lang) {
                        if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                            return hljs.highlight(code, { language: lang }).value;
                        }
                        return code;
                    }
                });
            } else {
                // Fallback to simple HTML formatting
                preview.innerHTML = content.replace(/\n/g, '<br>');
            }
            
            // Highlight code blocks if hljs is available
            if (typeof hljs !== 'undefined') {
                preview.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightBlock(block);
                });
            }
        }
    }

    static toggleEditMode(type, mode) {
        const textarea = document.getElementById(`${type}-${type === 'spec' ? 'description' : type === 'note' ? 'content' : 'description'}`);
        const preview = document.getElementById(`${type}-${type === 'spec' ? 'description' : type === 'note' ? 'content' : 'description'}-preview`);
        const editBtn = document.getElementById(`${type}-edit-btn`);
        const previewBtn = document.getElementById(`${type}-preview-btn`);
        
        if (mode === 'edit') {
            if (textarea) textarea.style.display = 'block';
            if (preview) preview.style.display = 'none';
            if (editBtn) editBtn.classList.add('active');
            if (previewBtn) previewBtn.classList.remove('active');
        } else {
            if (textarea) textarea.style.display = 'none';
            if (preview) preview.style.display = 'block';
            if (editBtn) editBtn.classList.remove('active');
            if (previewBtn) previewBtn.classList.add('active');
            
            DashboardUtils.updateMarkdownPreview(type);
        }
    }

    // Color utilities
    static getStatusColor(status) {
        const colors = {
            'active': 'var(--success-color)',
            'draft': 'var(--warning-color)',
            'completed': 'var(--primary-color)',
            'archived': 'var(--text-secondary)'
        };
        return colors[status] || 'var(--text-secondary)';
    }

    static getPriorityColor(priority) {
        const colors = {
            'critical': '#dc2626',
            'high': 'var(--error-color)',
            'medium': 'var(--warning-color)',
            'low': 'var(--success-color)'
        };
        return colors[priority] || 'var(--text-secondary)';
    }

    // API utilities
    static async fetchWithErrorHandling(url, options = {}) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Failed to fetch ${url}:`, error);
            throw error;
        }
    }

    // Local storage utilities
    static saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
        }
    }

    static loadFromLocalStorage(key, defaultValue = null) {
        try {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : defaultValue;
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
            return defaultValue;
        }
    }

    // DOM utilities
    static createElement(tag, className = '', innerHTML = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (innerHTML) element.innerHTML = innerHTML;
        return element;
    }

    static findElements(selector) {
        return Array.from(document.querySelectorAll(selector));
    }

    static updateElementContent(id, content) {
        const element = document.getElementById(id);
        if (element && content !== undefined) {
            element.textContent = content;
        }
    }

    // Date utilities
    static formatDate(date) {
        return new Date(date).toLocaleDateString();
    }

    static formatDateTime(date) {
        return new Date(date).toLocaleString();
    }

    static timeAgo(date) {
        const now = new Date();
        const diff = now - new Date(date);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }

    // Validation utilities
    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    static validateUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    static sanitizeHtml(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }

    // Notification utilities (static versions for convenience)
    static showNotification(message, type = 'info') {
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

    // Performance utilities
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Feature detection
    static supportsLocalStorage() {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    static supportsWebSockets() {
        return 'WebSocket' in window;
    }

    static supportsES6() {
        try {
            return typeof Symbol !== 'undefined';
        } catch (e) {
            return false;
        }
    }
}