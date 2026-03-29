import { useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export function AuthModal() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleEmail = async () => {
    if (!email || !password) return
    setError(''); setLoading(true)
    try {
      if (mode === 'signin') await signInWithEmail(email, password)
      else await signUpWithEmail(email, password)
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || 'Authentication failed'
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)\.?/, '').trim())
    } finally { setLoading(false) }
  }

  const handleGoogle = async () => {
    setError(''); setLoading(true)
    try { await signInWithGoogle() }
    catch (e: unknown) { setError((e as { message?: string })?.message || 'Google sign-in failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-sm glass-dark border border-white/10 rounded-2xl p-8 space-y-6"
      >
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto">
            <Zap size={22} className="text-white" />
          </div>
          <h1 className="text-xl font-bold gradient-text">Lumina</h1>
          <p className="text-sm text-slate-500">
            {mode === 'signin' ? 'Sign in to sync your chats' : 'Create an account'}
          </p>
        </div>

        {/* Google */}
        <button onClick={handleGoogle} disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl glass border border-white/10 hover:bg-white/10 text-white text-sm transition-all disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-slate-600">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Email/Password */}
        <div className="space-y-3">
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 placeholder-slate-600"
            />
          </div>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEmail()}
              placeholder="Password"
              className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 placeholder-slate-600"
            />
            <button onClick={() => setShowPass(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}

        <button onClick={handleEmail} disabled={loading || !email || !password}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-medium transition-all disabled:opacity-40"
        >
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>

        <p className="text-center text-xs text-slate-600">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError('') }}
            className="text-violet-400 hover:text-violet-300 transition-colors">
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>

        {/* Skip option */}
        <p className="text-center text-xs text-slate-700">
          <button onClick={() => useSkipAuth()}
            className="hover:text-slate-500 transition-colors">
            Continue without account (local storage only)
          </button>
        </p>
      </motion.div>
    </div>
  )
}

// Exported so App can call it
export function useSkipAuth() {
  sessionStorage.setItem('lumina-skip-auth', '1')
  window.dispatchEvent(new Event('lumina-skip-auth'))
}
