import React, { useState, useEffect } from 'react'
import type { AIConfig, AIProvider } from '@shared/types'

interface AISettingsProps {
  open: boolean
  onClose: () => void
}

const DEFAULT_CONFIG: AIConfig = {
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini'
}

const PROVIDER_DEFAULTS: Record<AIProvider, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-20250514' }
}

export const AISettings: React.FC<AISettingsProps> = ({ open, onClose }) => {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    if (open && window.electronAPI?.store) {
      window.electronAPI.store.get('aiConfig').then((stored) => {
        if (stored) setConfig(stored as AIConfig)
      })
    }
  }, [open])

  if (!open) return null

  const handleProviderChange = (provider: AIProvider) => {
    const defaults = PROVIDER_DEFAULTS[provider]
    setConfig((prev) => ({
      ...prev,
      provider,
      baseUrl: defaults.baseUrl,
      model: defaults.model
    }))
  }

  const handleSave = async () => {
    if (window.electronAPI?.store) {
      await window.electronAPI.store.set('aiConfig', config)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#16213e] rounded-xl shadow-2xl border border-[#2a2a4a] w-[420px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a4a]">
          <h2 className="text-base font-semibold text-gray-200">
            AI Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg"
          >
            &times;
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Provider
            </label>
            <select
              value={config.provider}
              onChange={(e) =>
                handleProviderChange(e.target.value as AIProvider)
              }
              className="w-full bg-[#0f1a30] border border-[#2a2a4a] rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Base URL
            </label>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, baseUrl: e.target.value }))
              }
              className="w-full bg-[#0f1a30] border border-[#2a2a4a] rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">API Key</label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, apiKey: e.target.value }))
              }
              placeholder="sk-..."
              className="w-full bg-[#0f1a30] border border-[#2a2a4a] rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Model</label>
            <input
              type="text"
              value={config.model}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, model: e.target.value }))
              }
              className="w-full bg-[#0f1a30] border border-[#2a2a4a] rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-[#2a2a4a]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-amber-950 font-medium rounded transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
