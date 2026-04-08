import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode
} from 'react'

interface ProjectContextType {
  currentProjectId: string
  setCurrentProjectId: (projectId: string) => void
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

const STORED_PROJECT_ID_KEY = 'llm-charge-current-project-id'
const DEFAULT_PROJECT_ID = 'main-1773934155652'

function readStoredProjectId(): string {
  if (typeof window === 'undefined') return DEFAULT_PROJECT_ID
  try {
    const v = window.localStorage.getItem(STORED_PROJECT_ID_KEY)?.trim()
    if (v) return v
  } catch {
    /* private mode */
  }
  return DEFAULT_PROJECT_ID
}

interface ProjectProviderProps {
  children: ReactNode
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [currentProjectId, setCurrentProjectIdState] = useState<string>(readStoredProjectId)

  const setCurrentProjectId = useCallback((projectId: string) => {
    setCurrentProjectIdState(projectId)
    try {
      window.localStorage.setItem(STORED_PROJECT_ID_KEY, projectId)
    } catch {
      /* private mode */
    }
  }, [])

  useEffect(() => {
    const handleProjectChange = (event: CustomEvent<{ projectId: string }>) => {
      setCurrentProjectId(event.detail.projectId)
    }

    window.addEventListener('projectChange', handleProjectChange as EventListener)

    return () => {
      window.removeEventListener('projectChange', handleProjectChange as EventListener)
    }
  }, [setCurrentProjectId])

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