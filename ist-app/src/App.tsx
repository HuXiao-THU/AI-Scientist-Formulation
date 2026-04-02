import React, { useEffect, useCallback } from 'react'
import { Canvas } from './components/Canvas/Canvas'
import { NodeDetail } from './components/Sidebar/NodeDetail'
import { WelcomePage } from './components/Welcome/WelcomePage'
import { AISettings } from './components/Settings/AISettings'
import { DeleteConfirm } from './components/DeleteConfirm'
import { useTreeStore } from './store/useTreeStore'
import { useUIStore } from './store/useUIStore'

const App: React.FC = () => {
  const project = useTreeStore((s) => s.project)
  const filePath = useTreeStore((s) => s.filePath)
  const isDirty = useTreeStore((s) => s.isDirty)
  const initNewProject = useTreeStore((s) => s.initNewProject)
  const loadProject = useTreeStore((s) => s.loadProject)
  const markClean = useTreeStore((s) => s.markClean)
  const setFilePath = useTreeStore((s) => s.setFilePath)

  const showWelcome = useUIStore((s) => s.showWelcome)
  const setShowWelcome = useUIStore((s) => s.setShowWelcome)
  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const toggleSettings = useUIStore((s) => s.toggleSettings)
  const selectedNodeId = useUIStore((s) => s.selectedNodeId)
  const selectNode = useUIStore((s) => s.selectNode)
  const closeSidebar = useUIStore((s) => s.closeSidebar)

  const deleteNode = useTreeStore((s) => s.deleteNode)
  const setDeleteConfirmNodeId = useUIStore((s) => s.setDeleteConfirmNodeId)

  useEffect(() => {
    const tryRestoreLast = async () => {
      if (!window.electronAPI?.store) {
        setShowWelcome(true)
        return
      }
      try {
        const lastFile = (await window.electronAPI.store.get('lastOpenedFile')) as string | null
        if (lastFile) {
          const proj = await window.electronAPI.file.open(lastFile)
          loadProject(proj, lastFile)
          setShowWelcome(false)
          return
        }
      } catch {
        // file not found, show welcome
      }
      setShowWelcome(true)
    }
    tryRestoreLast()
  }, [])

  const handleNewProject = useCallback(() => {
    initNewProject()
    setShowWelcome(false)
  }, [initNewProject, setShowWelcome])

  const handleOpenProject = useCallback(async () => {
    if (!window.electronAPI?.file) {
      handleNewProject()
      return
    }
    const path = await window.electronAPI.file.showOpenDialog()
    if (path) {
      try {
        const proj = await window.electronAPI.file.open(path)
        loadProject(proj, path)
        setShowWelcome(false)
        if (window.electronAPI.store) {
          window.electronAPI.store.set('lastOpenedFile', path)
        }
      } catch (err) {
        console.error('Failed to open file:', err)
      }
    }
  }, [loadProject, setShowWelcome, handleNewProject])

  const handleSave = useCallback(async () => {
    const state = useTreeStore.getState()
    if (!state.project || !window.electronAPI?.file) return

    let savePath = state.filePath
    if (!savePath) {
      savePath = await window.electronAPI.file.showSaveDialog()
      if (!savePath) return
      setFilePath(savePath)
    }

    await window.electronAPI.file.save(savePath, state.project)
    markClean()
    if (window.electronAPI.store) {
      window.electronAPI.store.set('lastOpenedFile', savePath)
    }
  }, [markClean, setFilePath])

  const handleSaveAs = useCallback(async () => {
    const state = useTreeStore.getState()
    if (!state.project || !window.electronAPI?.file) return

    const savePath = await window.electronAPI.file.showSaveDialog()
    if (!savePath) return

    setFilePath(savePath)
    await window.electronAPI.file.save(savePath, state.project)
    markClean()
    if (window.electronAPI.store) {
      window.electronAPI.store.set('lastOpenedFile', savePath)
    }
  }, [markClean, setFilePath])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey

      if (isMod && e.key === 's') {
        e.preventDefault()
        if (e.shiftKey) {
          handleSaveAs()
        } else {
          handleSave()
        }
        return
      }

      if (isMod && e.key === 'n') {
        e.preventDefault()
        handleNewProject()
        return
      }

      if (isMod && e.key === 'o') {
        e.preventDefault()
        handleOpenProject()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId && project) {
          const target = e.target as HTMLElement
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

          const node = project.nodes[selectedNodeId]
          if (!node) return
          if (node.id === project.rootNodeId) return

          const hasContent = node.title.trim() || node.description.trim()
          const hasChildren = node.childrenIds.length > 0
          if (hasContent || hasChildren) {
            setDeleteConfirmNodeId(selectedNodeId)
          } else {
            deleteNode(selectedNodeId)
            closeSidebar()
          }
        }
        return
      }

      if (e.key === 'Escape') {
        selectNode(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    handleSave,
    handleSaveAs,
    handleNewProject,
    handleOpenProject,
    selectedNodeId,
    project,
    deleteNode,
    closeSidebar,
    selectNode,
    setDeleteConfirmNodeId
  ])

  if (showWelcome && !project) {
    return (
      <WelcomePage
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
      />
    )
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-10 bg-[#16213e] border-b border-[#2a2a4a] flex items-center px-4 gap-4 shrink-0 drag-region">
        <span className="text-xs text-gray-400 truncate flex-1 ml-16">
          {filePath
            ? `${filePath}${isDirty ? ' *' : ''}`
            : `Untitled${isDirty ? ' *' : ''}`}
        </span>
        <button
          onClick={toggleSettings}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          AI Settings
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <Canvas />
        <NodeDetail />
      </div>

      {/* Modals */}
      <AISettings open={settingsOpen} onClose={toggleSettings} />
      <DeleteConfirm />
    </div>
  )
}

export default App
