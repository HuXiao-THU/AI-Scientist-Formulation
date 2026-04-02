import React from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { TreeRenderer } from './TreeRenderer'

export const Canvas: React.FC = () => {
  return (
    <div className="w-full h-full bg-[#1a1a2e] overflow-hidden">
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
          contentStyle={{ width: '4000px', height: '4000px' }}
        >
          <TreeRenderer />
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}
