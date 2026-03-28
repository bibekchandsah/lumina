import { cn } from '@/utils/cn'

interface ToggleProps {
  value: boolean
  onChange: (v: boolean) => void
}

export function Toggle({ value, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        'relative inline-flex items-center w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:ring-offset-1 focus:ring-offset-black shrink-0 cursor-pointer',
        value ? 'bg-violet-600' : 'bg-slate-700'
      )}
    >
      <span
        className={cn(
          'inline-block w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300',
          value ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  )
}
