import React from 'react'
import SpecsSection from './sections/SpecsSection'

const Specs: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Specifications
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Manage your project specifications and documentation
        </p>
      </div>
      
      <SpecsSection />
    </div>
  )
}

export default Specs