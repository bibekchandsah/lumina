import { useEffect, useRef, useState } from 'react'

export function useTypewriter(
  fullText: string,
  speed = 12,
  enabled = true,
  onTick?: () => void
) {
  const [displayed, setDisplayed] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onTickRef = useRef(onTick)
  onTickRef.current = onTick

  // When enabled flips true with text already present, start animating
  // When fullText changes (new content), restart
  const enabledRef = useRef(enabled)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!enabled) {
      setDisplayed(fullText)
      return
    }

    // Start fresh
    setDisplayed('')
    let index = 0

    const tick = () => {
      index++
      const slice = fullText.slice(0, index)
      setDisplayed(slice)
      onTickRef.current?.()
      if (index < fullText.length) {
        timerRef.current = setTimeout(tick, speed)
      }
    }

    if (fullText.length > 0) {
      timerRef.current = setTimeout(tick, speed)
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  // Only re-run when enabled flips or fullText changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullText, enabled, speed])

  enabledRef.current = enabled
  const done = !enabled || displayed.length >= fullText.length

  return { displayed, done }
}
