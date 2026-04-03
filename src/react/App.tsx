import React, { useState, useEffect, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import SimpleErrorBoundary from './components/ui/SimpleErrorBoundary'
import { ThemeProvider } from './store/theme-store'
import { WebSocketProvider } from './store/websocket-store'
import { ProjectProvider } from './store/project-store'
import { DashboardLayout } from './components/layout/DashboardLayout'

// Implement code splitting with React.lazy for performance optimization
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const Specs = React.lazy(() => import('./pages/Specs'))
const Agents = React.lazy(() => import('./pages/Agents'))
const Projects = React.lazy(() => import('./pages/Projects'))
const Skills = React.lazy(() => import('./pages/Skills'))
const Workflows = React.lazy(() => import('./pages/Workflows'))
const CronJobs = React.lazy(() => import('./pages/CronJobs'))
const Memory = React.lazy(() => import('./pages/Memory'))
const ReactDev = React.lazy(() => import('./pages/ReactDev'))
const DevDocs = React.lazy(() => import('./pages/DevDocs'))
const HybridReasoning = React.lazy(() => import('./pages/HybridReasoning'))
const CodeGraph = React.lazy(() => import('./pages/CodeGraph'))
const PromptPlayground = React.lazy(() => import('./pages/PromptPlayground'))
const MCP = React.lazy(() => import('./pages/MCP'))
const GodotDev = React.lazy(() => import('./pages/GodotDev'))
const APIDev = React.lazy(() => import('./pages/APIDev'))
const Buddies = React.lazy(() => import('./pages/Buddies'))
const BlenderPipeline = React.lazy(() => import('./pages/BlenderPipeline'))

// Loading component for Suspense fallback
const PageLoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center space-y-3">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      <p className="text-gray-600 dark:text-gray-400 text-sm">Loading page...</p>
    </div>
  </div>
)

// Create a component to handle the layout and routing integration
function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const [currentSection, setCurrentSection] = useState('overview')

  // Map routes to sections
  const routeToSection = {
    '/dashboard': 'overview',
    '/': 'overview',
    '/specs': 'specs',
    '/memory': 'memory',
    '/projects': 'projects',
    '/agents': 'agents',
    '/skills': 'skills',
    '/workflows': 'workflows',
    '/api-dev': 'api-dev',
    '/cronjobs': 'cronjobs',
    '/react-dev': 'react-dev',
    '/devdocs': 'devdocs',
    '/hybrid-reasoning': 'hybrid-reasoning',
    '/codegraph': 'codegraph',
    '/playground': 'playground',
    '/mcp': 'mcp',
    '/godot': 'godot',
    '/buddies': 'buddies',
    '/blender': 'blender',
  }

  const sectionToRoute = {
    'overview': '/dashboard',
    'specs': '/specs',
    'memory': '/memory', 
    'projects': '/projects',
    'agents': '/agents',
    'skills': '/skills',
    'workflows': '/workflows',
    'api-dev': '/api-dev',
    'cronjobs': '/cronjobs',
    'react-dev': '/react-dev',
    'devdocs': '/devdocs',
    'hybrid-reasoning': '/hybrid-reasoning',
    'codegraph': '/codegraph',
    'playground': '/playground',
    'mcp': '/mcp',
    'godot': '/godot',
    'buddies': '/buddies',
    'blender': '/blender',
  }

  // Update section when route changes
  useEffect(() => {
    const section = routeToSection[location.pathname as keyof typeof routeToSection] || 'overview'
    setCurrentSection(section)
  }, [location.pathname])

  // Handle section changes from navigation
  const handleSectionChange = (section: string) => {
    setCurrentSection(section)
    const route = sectionToRoute[section as keyof typeof sectionToRoute] || '/dashboard'
    navigate(route)
  }

  return (
    <DashboardLayout 
      currentSection={currentSection}
      onSectionChange={handleSectionChange}
    >
      <Suspense fallback={<PageLoadingSpinner />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/specs" element={<Specs />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/api-dev" element={<APIDev />} />
          <Route path="/cronjobs" element={<CronJobs />} />
          <Route path="/memory" element={<Memory />} />
          <Route path="/react-dev" element={<ReactDev />} />
          <Route path="/devdocs" element={<DevDocs />} />
          <Route path="/hybrid-reasoning" element={<HybridReasoning />} />
          <Route path="/codegraph" element={<CodeGraph />} />
          <Route path="/playground" element={<PromptPlayground />} />
          <Route path="/mcp" element={<MCP />} />
          <Route path="/godot" element={<GodotDev />} />
          <Route path="/buddies" element={<Buddies />} />
          <Route path="/blender" element={<BlenderPipeline />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </DashboardLayout>
  )
}

function App() {
  return (
    <SimpleErrorBoundary
      onError={(error, errorInfo) => {
        console.error('App Error:', error, errorInfo)
        // TODO: Send error to monitoring service
      }}
    >
      <ThemeProvider>
        <WebSocketProvider wsUrl={`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:3001`}>
          <ProjectProvider>
            <AppContent />
          </ProjectProvider>
        </WebSocketProvider>
      </ThemeProvider>
    </SimpleErrorBoundary>
  )
}

export default App