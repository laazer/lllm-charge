import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface ProjectContextType {
  currentProjectId: string
  setCurrentProjectId: (projectId: string) => void
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

interface ProjectProviderProps {
  children: ReactNode
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [currentProjectId, setCurrentProjectId] = useState<string>('main-1773934155652')

  useEffect(() => {
    // Listen for project change events from ProjectSelector
    const handleProjectChange = (event: CustomEvent) => {
      setCurrentProjectId(event.detail.projectId)
    }

    window.addEventListener('projectChange', handleProjectChange as EventListener)
    
    return () => {
      window.removeEventListener('projectChange', handleProjectChange as EventListener)
    }
  }, [])

  return (
    <ProjectContext.Provider value={{ currentProjectId, setCurrentProjectId }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const context = useContext(ProjectContext)
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider')
  }
  return context
}