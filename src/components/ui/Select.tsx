import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/utils/cn'

interface SelectProps {
  value: string
  onChange: (v: string) => void
  options: { value: string; label?: string }[]
  className?: string
}

export function Select({ value, onChange, options, className }: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 bg-[#0d0d14] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white hover:border-violet-500/40 transition-colors focus:outline-none focus:border-violet-500/60"
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown size={14} className={cn('text-slate-500 shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-white/10 bg-[#13131f] shadow-xl shadow-black/50 overflow-hidden">
          <div className="max-h-52 overflow-y-auto py-1">
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                onMouseEnter={e => { if (opt.value !== value) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)' }}
                onMouseLeave={e => { if (opt.value !== value) (e.currentTarget as HTMLButtonElement).style.background = '' }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors duration-150',
                  opt.value === value
                    ? 'bg-violet-600/25 text-violet-300'
                    : 'text-slate-300'
                )}
              >
                <span>{opt.label ?? opt.value}</span>
                {opt.value === value && <Check size={13} className="text-violet-400 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
