# React Component Architecture Plan - Phase 2

## Overview
This document outlines the systematic migration from the existing vanilla HTML/CSS/JavaScript dashboard to a modern React component architecture.

## Current Architecture Analysis

### Existing Dashboard Structure
```
interactive-dashboard.html (3600+ lines)
├── Dashboard Header (project selector, theme toggle, connection status)
├── Navigation Bar (Overview, Specs, Memory, Projects, Agents, Workflows, Studio)
├── Main Content Sections
│   ├── Overview Section (status cards, metrics, quick actions)
│   ├── Specs Section (specifications management)
│   ├── Memory Section (notes and checkpoints)
│   ├── Projects Section (project management)
│   ├── Agents Section (agent management)
│   ├── Workflows Section (workflow automation)
│   └── Studio Section (agent/workflow builders)
└── Footer (connection info, status indicators)
```

### JavaScript Modules (Modular Architecture - 5 files)
```
dashboard-class.js     - Core dashboard logic, WebSocket, navigation
modals.js             - Modal management, preview functionality
graph-viewers.js      - CodeGraph and FileGraph visualization
mcp-tools.js          - MCP protocol integration
utils.js              - Shared utilities, form handling
```

### Data Models (TypeScript Interfaces)
```typescript
// From real-time-dashboard.ts
DashboardMetrics, RealTimeMetrics, CostMetrics
PerformanceMetrics, ModelMetrics, OptimizationMetrics
Alert, SystemLoad, TimeSeries, ActiveModel
```

## React Component Architecture

### 1. Layout Components
```
src/react/components/layout/
├── DashboardLayout.tsx          - Main layout container
├── Header/
│   ├── DashboardHeader.tsx      - Header with project selector, theme toggle
│   ├── ProjectSelector.tsx      - Project dropdown with live data
│   ├── ThemeToggle.tsx          - Light/dark mode toggle
│   └── ConnectionStatus.tsx     - WebSocket connection indicator
├── Navigation/
│   ├── NavigationBar.tsx        - Main navigation tabs
│   ├── NavigationButton.tsx     - Individual nav button component
│   └── BreadcrumbBar.tsx        - Breadcrumb navigation
└── Footer/
    └── DashboardFooter.tsx      - Footer with status info
```

### 2. Dashboard Sections (Pages)
```
src/react/pages/sections/
├── OverviewSection.tsx          - Status cards, metrics, quick actions
├── SpecsSection.tsx             - Specifications management interface
├── MemorySection.tsx            - Notes and checkpoints management
├── ProjectsSection.tsx          - Project management interface
├── AgentsSection.tsx            - Agent management and monitoring
├── WorkflowsSection.tsx         - Workflow automation interface
└── StudioSection.tsx            - Agent/workflow builders
```

### 3. UI Components Library
```
src/react/components/ui/
├── Cards/
│   ├── StatusCard.tsx           - Status display cards
│   ├── MetricCard.tsx           - Metric visualization cards
│   ├── InfoCard.tsx             - General information cards
│   └── ActionCard.tsx           - Interactive action cards
├── Data/
│   ├── DataTable.tsx            - Sortable data tables
│   ├── DataList.tsx             - List display component
│   ├── DataGrid.tsx             - Grid layout for data
│   └── Pagination.tsx           - Pagination controls
├── Forms/
│   ├── FormField.tsx            - Reusable form field
│   ├── FormButton.tsx           - Styled form buttons
│   ├── FormSelect.tsx           - Select dropdown
│   └── FormTextArea.tsx         - Text area input
├── Modals/
│   ├── Modal.tsx                - Base modal component
│   ├── ConfirmModal.tsx         - Confirmation dialog
│   ├── PreviewModal.tsx         - Document preview modal
│   └── FormModal.tsx            - Form-based modals
├── Charts/
│   ├── LineChart.tsx            - Time series charts
│   ├── BarChart.tsx             - Bar charts for metrics
│   ├── PieChart.tsx             - Pie charts for breakdowns
│   └── MetricsChart.tsx         - Combined metrics visualization
├── Indicators/
│   ├── StatusIndicator.tsx      - Status dots and badges
│   ├── ProgressBar.tsx          - Progress indicators
│   ├── LoadingSpinner.tsx       - Loading animations
│   └── AlertBanner.tsx          - Alert notifications
└── Utilities/
    ├── Tooltip.tsx              - Tooltip component
    ├── Dropdown.tsx             - Dropdown menus
    ├── TagList.tsx              - Tag/chip display
    └── CodeBlock.tsx            - Code syntax highlighting
```

### 4. Real-time Data Components
```
src/react/components/realtime/
├── MetricsDisplay.tsx           - Real-time metrics dashboard
├── LiveChart.tsx                - Live updating charts
├── ConnectionMonitor.tsx        - WebSocket connection monitoring
├── AlertCenter.tsx              - Real-time alerts display
└── SystemStatus.tsx             - System health indicators
```

### 5. Data Visualization Components
```
src/react/components/visualization/
├── CodeGraphViewer.tsx          - CodeGraph visualization (from graph-viewers.js)
├── FileGraphViewer.tsx          - FileGraph visualization  
├── NetworkDiagram.tsx           - Network topology visualization
├── DependencyGraph.tsx          - Dependency visualization
└── FlowDiagram.tsx              - Workflow visualization
```

### 6. MCP Integration Components
```
src/react/components/mcp/
├── MCPToolsList.tsx             - Available MCP tools display
├── MCPResourceBrowser.tsx       - MCP resources browser
├── MCPConnectionStatus.tsx      - MCP connection monitoring
└── MCPDebugPanel.tsx            - MCP debugging interface
```

## State Management Architecture

### 1. Context Providers
```typescript
// Global Context Providers
ThemeProvider       - Theme (light/dark) and style (glass/normal) state
WebSocketProvider   - WebSocket connection and real-time data
ProjectProvider     - Current project and project management
AlertProvider       - Alert notifications and management
```

### 2. React Query Integration
```typescript
// API State Management with React Query
useProjects()       - Projects data fetching and caching
useSpecs()          - Specifications data management
useAgents()         - Agents data and lifecycle management
useWorkflows()      - Workflows data management
useMetrics()        - Real-time metrics with WebSocket integration
useMCPTools()       - MCP tools and resources
```

### 3. Local State Hooks
```typescript
// Custom Hooks for Local State
useNavigationState() - Navigation section tracking
useModalState()      - Modal open/close state management
useFormState()       - Form validation and submission
useTableState()      - Table sorting, filtering, pagination
useChartState()      - Chart configuration and data processing
```

## Migration Strategy

### Phase 2a: Core Layout Components (Days 1-2)
1. **DashboardLayout.tsx** - Main container with responsive grid
2. **DashboardHeader.tsx** - Header with all controls
3. **NavigationBar.tsx** - Navigation with section switching
4. **DashboardFooter.tsx** - Footer with connection status

### Phase 2b: UI Components Library (Days 2-4)
1. **Cards Components** - StatusCard, MetricCard, InfoCard, ActionCard
2. **Data Components** - DataTable, DataList, DataGrid, Pagination
3. **Form Components** - FormField, FormButton, FormSelect, FormTextArea
4. **Modal Components** - Modal, ConfirmModal, PreviewModal, FormModal

### Phase 2c: Dashboard Sections (Days 4-6)
1. **OverviewSection.tsx** - Status cards and metrics
2. **SpecsSection.tsx** - Specifications management
3. **ProjectsSection.tsx** - Projects interface
4. **AgentsSection.tsx** - Agent management

### Phase 2d: Advanced Components (Days 6-7)
1. **Real-time Components** - MetricsDisplay, LiveChart, AlertCenter
2. **Visualization Components** - CodeGraphViewer, FileGraphViewer
3. **MCP Components** - MCPToolsList, MCPResourceBrowser

## Development Guidelines

### Component Standards
- **TypeScript**: All components with proper typing
- **Props Interface**: Each component has defined Props interface
- **Error Boundaries**: Wrap complex components with error handling
- **Loading States**: All async components handle loading states
- **Responsive Design**: Mobile-first responsive components
- **Accessibility**: WCAG 2.1 AA compliance

### Styling Approach
- **Tailwind CSS v4**: Primary styling framework
- **CSS Variables**: Theme system with CSS custom properties
- **Liquid Glass Theme**: Maintain existing glass morphism styles
- **Dark Mode**: Full dark theme support
- **Animations**: Smooth transitions and micro-interactions

### Data Flow Patterns
- **Props Down**: Data flows down through props
- **Events Up**: Events bubble up through callbacks
- **Context for Global**: Theme, WebSocket, Project state via Context
- **React Query for Server**: All server state through React Query
- **Local State for UI**: Component-specific UI state

## Testing Strategy

### Component Testing
- **React Testing Library**: All components tested with RTL
- **Jest Snapshots**: Visual regression testing
- **User Events**: Interactive behavior testing
- **Accessibility Testing**: axe-core integration

### Integration Testing
- **WebSocket Integration**: Real-time data flow testing
- **API Integration**: End-to-end data flow testing
- **Navigation Testing**: Section switching and routing
- **Form Submission**: Complete form workflows

### Visual Testing
- **Storybook**: Component library documentation
- **Chromatic**: Visual regression testing
- **Responsive Testing**: Mobile/tablet/desktop layouts
- **Theme Testing**: Light/dark mode validation

## Performance Considerations

### Optimization Strategies
- **Code Splitting**: Lazy load dashboard sections
- **React.memo**: Memoize expensive components
- **useCallback**: Memoize event handlers
- **useMemo**: Memoize computed values
- **Virtual Scrolling**: Large data lists optimization

### Bundle Size Management
- **Tree Shaking**: Remove unused code
- **Dynamic Imports**: Load components on demand
- **Chart Libraries**: Lightweight chart components
- **Icon System**: Optimized icon components

## Success Criteria

### Functional Requirements
- [ ] All existing dashboard functionality preserved
- [ ] Real-time WebSocket updates working
- [ ] Navigation between sections functional
- [ ] Project switching working
- [ ] Theme toggling operational
- [ ] All modals and forms functional

### Performance Requirements
- [ ] First Contentful Paint < 1.5s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Bundle size < 1MB main chunk
- [ ] Memory usage < 50MB
- [ ] Real-time updates < 100ms latency

### Quality Requirements
- [ ] 90%+ test coverage
- [ ] Zero TypeScript errors
- [ ] WCAG 2.1 AA compliance
- [ ] Cross-browser compatibility
- [ ] Mobile responsiveness

## Next Steps

1. **Begin Layout Components** - Start with DashboardLayout.tsx
2. **Implement Navigation** - NavigationBar with section switching
3. **Create UI Library** - Build reusable components
4. **Migrate Sections** - Convert each dashboard section
5. **Test Integration** - Ensure WebSocket and API integration
6. **Performance Optimization** - Code splitting and lazy loading