import React from 'react'

interface WelcomePageProps {
  onNewProject: () => void
  onOpenProject: () => void
}

export const WelcomePage: React.FC<WelcomePageProps> = ({
  onNewProject,
  onOpenProject
}) => {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e]">
      <div className="text-center space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-amber-400 mb-2">
            Idea Search Tree
          </h1>
          <p className="text-gray-400 text-sm">
            A research tool for tracking ideas and experiments
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={onNewProject}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-amber-950 font-medium rounded-lg transition-colors shadow-lg"
          >
            New Project
          </button>
          <button
            onClick={onOpenProject}
            className="px-6 py-3 bg-[#2a2a4a] hover:bg-[#3a3a5a] text-gray-200 font-medium rounded-lg transition-colors shadow-lg border border-[#3a3a5a]"
          >
            Open .ist File
          </button>
        </div>
      </div>
    </div>
  )
}
