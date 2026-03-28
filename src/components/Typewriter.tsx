import { useEffect, useRef, useState } from 'react'

interface Props {
  text: string
  speed?: number // ms per char
}

export function Typewriter({ text, speed = 8 }: Props) {
  const [displayed, setDisplayed] = useState('')
  const prevTextRef = useRef('')
  const frameRef = useRef<number | null>(null)
  const indexRef = useRef(0)

  useEffect(() => {
    // If text grew (new chunk arrived), animate the new portion
    if (text.startsWith(prevTextRef.current)) {
      const newPart = text.slice(prevTextRef.current.length)
      if (!newPart) return

      prevTextRef.current = text
      const startIndex = indexRef.current

      let i = 0
      const animate = () => {
        if (i < newPart.length) {
          i++
          indexRef.current = startIndex + i
          setDisplayed(text.slice(0, startIndex + i))
          frameRef.current = window.setTimeout(animate, speed)
        }
      }
      animate()
    } else {
      // Text was reset (new message)
      if (frameRef.current) clearTimeout(frameRef.current)
      prevTextRef.current = ''
      indexRef.current = 0
      setDisplayed('')
    }

    return () => { if (frameRef.current) clearTimeout(frameRef.current) }
  }, [text, speed])

  return (
    <span className="whitespace-pre-wrap">
      {displayed}
      <span className="inline-block w-[2px] h-[1em] bg-violet-400 animate-pulse ml-0.5 align-middle rounded-full" />
    </span>
  )
}
