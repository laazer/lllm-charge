import React from 'react'
import AgentsSection from './sections/AgentsSection'

const Agents: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Agents
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Manage your AI agents and their capabilities
        </p>
      </div>
      
      <AgentsSection />
    </div>
  )
}

export default Agents