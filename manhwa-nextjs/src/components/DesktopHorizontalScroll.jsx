'use client'

import { useEffect } from 'react'

/** Enables click-and-drag scrolling for horizontally scrollable content on desktop. */
export default function DesktopHorizontalScroll() {
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return

    let active = null
    let suppressClick = false

    const findScroller = (target) => {
      for (let node = target instanceof Element ? target : null; node && node !== document.body; node = node.parentElement) {
        const overflowX = getComputedStyle(node).overflowX
        if (node.scrollWidth > node.clientWidth + 1 && (overflowX === 'auto' || overflowX === 'scroll')) return node
      }
      return null
    }

    const onMouseDown = (event) => {
      if (event.button !== 0 || event.target.closest('input, textarea, select, [contenteditable="true"]')) return
      const element = findScroller(event.target)
      if (!element) return
      active = { element, startX: event.clientX, scrollLeft: element.scrollLeft, moved: false }
      element.classList.add('desktop-drag-scroll-active')
    }

    const onMouseMove = (event) => {
      if (!active) return
      const distance = event.clientX - active.startX
      if (!active.moved && Math.abs(distance) < 5) return
      active.moved = true
      active.element.scrollLeft = active.scrollLeft - distance
      event.preventDefault()
    }

    const finish = () => {
      if (!active) return
      suppressClick = active.moved
      active.element.classList.remove('desktop-drag-scroll-active')
      active = null
      if (suppressClick) window.setTimeout(() => { suppressClick = false }, 0)
    }

    const onClick = (event) => {
      if (!suppressClick) return
      event.preventDefault()
      event.stopPropagation()
      suppressClick = false
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', finish)
    document.addEventListener('mouseleave', finish)
    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', finish)
      document.removeEventListener('mouseleave', finish)
      document.removeEventListener('click', onClick, true)
    }
  }, [])

  return null
}
