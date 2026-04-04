import React from 'react'
import BuddiesSection from './sections/BuddiesSection'

const Buddies: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Buddies
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Customizable AI companions for pair programming, code review, and more
        </p>
      </div>

      <BuddiesSection />
    </div>
  )
}

export default Buddies
