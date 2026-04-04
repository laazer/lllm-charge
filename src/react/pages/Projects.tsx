import React from 'react'
import ProjectsSection from './sections/ProjectsSection'

const Projects: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Projects
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Manage your development projects and configurations
        </p>
      </div>
      
      <ProjectsSection />
    </div>
  )
}

export default Projects