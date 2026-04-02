import React, { useMemo } from 'react'
import {
  TransformWrapper,
  TransformComponent,
  MiniMap
} from 'react-zoom-pan-pinch'
import { useTreeStore } from '../../store/useTreeStore'
import { computeLayout } from '../../layout/treeLayout'
import { TreeRenderer } from './TreeRenderer'

const CONTENT_FALLBACK = 4000

export const Canvas: React.FC = () => {
  const project = useTreeStore((s) => s.project)

  const layout = useMemo(() => {
    if (!project) return null
    return computeLayout(project)
  }, [project])

  const contentW = layout?.totalWidth ?? CONTENT_FALLBACK
  const contentH = layout?.totalHeight ?? CONTENT_FALLBACK

  return (
    <div className="relative w-full h-full min-h-0 bg-white overflow-hidden">
      <TransformWrapper
        initialScale={1}
        minScale={0.25}
        maxScale={4}
        limitToBounds={false}
        centerOnInit={false}
        panning={{ velocityDisabled: true }}
      >
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ width: contentW, height: contentH }}
        >
          <TreeRenderer layout={layout} />
        </TransformComponent>
        <MiniMap
          width={200}
          height={140}
          borderColor="rgba(37, 99, 235, 0.5)"
          className="canvas-mini-map pointer-events-none rounded-md border border-slate-300/90 bg-white/92 shadow-md"
          style={{
            position: 'absolute',
            left: 12,
            bottom: 12,
            zIndex: 20,
            overflow: 'hidden'
          }}
        >
          <TreeRenderer layout={layout} />
        </MiniMap>
      </TransformWrapper>
    </div>
  )
}
