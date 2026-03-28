import { useEffect, useRef, useState } from 'react'

export function useTypewriter(
  fullText: string,
  speed = 12,
  enabled = true,
  onTick?: () => void
) {
  const [displayed, setDisplayed] = useState(enabled ? '' : fullText)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const indexRef = useRef(0)
  const onTickRef = useRef(onTick)
  onTickRef.current = onTick

  const done = !enabled || displayed.length >= fullText.length

  useEffect(() => {
    if (!enabled) { setDisplayed(fullText); return }

    indexRef.current = 0
    setDisplayed('')

    const tick = () => {
      indexRef.current++
      setDisplayed(fullText.slice(0, indexRef.current))
      onTickRef.current?.()
      if (indexRef.current < fullText.length) {
        timerRef.current = setTimeout(tick, speed)
      }
    }
    timerRef.current = setTimeout(tick, speed)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [fullText, speed, enabled])

  return { displayed, done }
}
