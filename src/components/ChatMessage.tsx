import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertCircle, Clock, Cpu } from 'lucide-react'
import { memo } from 'react'
import type { Message } from '@/types'
import { PROVIDER_INFO } from '@/types'
import { cn } from '@/utils/cn'
import { useTypewriter } from '@/hooks/useTypewriter'

interface Props {
  message: Message
  animate?: boolean
  onScrollNeeded?: () => void
}

const mdComponents = {
  code({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { className?: string }) {
    const isBlock = className?.includes('language-')
    return isBlock ? (
      <pre className="bg-black/40 rounded-lg p-3 overflow-x-auto my-2 text-xs">
        <code className={className} {...props}>{children}</code>
      </pre>
    ) : (
      <code className="bg-black/30 px-1.5 py-0.5 rounded text-violet-300 text-xs" {...props}>{children}</code>
    )
  },
  p: ({ children }: React.HTMLAttributes<HTMLElement>) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }: React.HTMLAttributes<HTMLElement>) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
  ol: ({ children }: React.HTMLAttributes<HTMLElement>) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
  h1: ({ children }: React.HTMLAttributes<HTMLElement>) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
  h2: ({ children }: React.HTMLAttributes<HTMLElement>) => <h2 className="text-base font-bold mb-2">{children}</h2>,
  h3: ({ children }: React.HTMLAttributes<HTMLElement>) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
  blockquote: ({ children }: React.HTMLAttributes<HTMLElement>) => (
    <blockquote className="border-l-2 border-violet-500 pl-3 italic text-slate-400 my-2">{children}</blockquote>
  ),
}

function AssistantContent({ content, animate, onScrollNeeded }: { content: string; animate: boolean; onScrollNeeded?: () => void }) {
  const { displayed, done } = useTypewriter(content, 10, animate, onScrollNeeded)

  return (
    <>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {displayed}
      </ReactMarkdown>
      {!done && (
        <span className="inline-block w-[2px] h-[1em] bg-violet-400 animate-pulse ml-0.5 align-middle rounded-full" />
      )}
    </>
  )
}

export const ChatMessage = memo(function ChatMessage({ message, animate = false, onScrollNeeded }: Props) {
  const isUser = message.role === 'user'
  const isError = message.role === 'error'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('flex gap-3 px-4 py-2', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-1',
          isError ? 'bg-red-500/20 text-red-400' : 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
        )}>
          {isError ? '!' : message.provider ? message.provider[0].toUpperCase() : 'AI'}
        </div>
      )}

      <div className={cn('max-w-[75%] flex flex-col gap-1', isUser && 'items-end')}>
        <div className={cn(
          'px-4 py-3 rounded-2xl text-sm leading-relaxed',
          isUser ? 'msg-user text-white rounded-br-sm' :
          isError ? 'bg-red-500/10 border border-red-500/30 text-red-300 rounded-bl-sm' :
          'msg-ai text-slate-200 rounded-bl-sm'
        )}>
          {isUser || isError ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <AssistantContent content={message.content} animate={animate} onScrollNeeded={onScrollNeeded} />
          )}
        </div>

        {!isUser && !isError && (message.provider || message.latency) && (
          <div className="flex items-center gap-3 px-1 text-xs text-slate-600">
            {message.provider && (
              <span style={{ color: PROVIDER_INFO[message.provider]?.color + '99' }}>
                {PROVIDER_INFO[message.provider]?.name} · {message.model}
              </span>
            )}
            {message.latency && (
              <span className="flex items-center gap-1">
                <Clock size={10} /> {(message.latency / 1000).toFixed(1)}s
              </span>
            )}
            {message.tokens && (
              <span className="flex items-center gap-1">
                <Cpu size={10} /> {message.tokens} tokens
              </span>
            )}
          </div>
        )}
        {isError && (
          <div className="flex items-center gap-1 px-1 text-xs text-red-500">
            <AlertCircle size={10} /> API Error
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold shrink-0 mt-1 text-white">
          U
        </div>
      )}
    </motion.div>
  )
})
