'use client'

import { useEffect } from 'react'

export default function NoRightClick() {
  useEffect(() => {
    const block = (e: MouseEvent) => e.preventDefault()
    const blockDrag = (e: DragEvent) => e.preventDefault()

    document.addEventListener('contextmenu', block)
    document.addEventListener('dragstart', blockDrag)

    return () => {
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('dragstart', blockDrag)
    }
  }, [])

  return null
}
