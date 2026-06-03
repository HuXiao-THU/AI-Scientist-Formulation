import React, { useEffect, useRef } from 'react'
import { useExperimentStore } from '../../store/useExperimentStore'

export const LogPanel: React.FC = () => {
  const logs = useExperimentStore((s) => s.logs)
  const activeNodeId = useExperimentStore((s) => s.activeNodeId)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  if (!activeNodeId && logs.length === 0) return null

  return (
    <div className="h-48 shrink-0 border-t border-[#2a2a4a] bg-[#0f1a30] flex flex-col">
      <div className="px-4 py-2 border-b border-[#2a2a4a] flex items-center justify-between">
        <span className="text-xs font-medium text-gray-300">Experiment Log</span>
        {activeNodeId && (
          <span className="text-xs text-amber-400/90">Running…</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs text-gray-300 whitespace-pre-wrap">
        {logs.length === 0 ? (
          <span className="text-gray-500">Waiting for output…</span>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="mb-1 last:mb-0">
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
