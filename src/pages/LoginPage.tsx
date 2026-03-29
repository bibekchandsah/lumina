import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, isConfigured } = useAuth()
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
      navigate('/')
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || 'Authentication failed'
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)\.?/, '').trim())
    } finally { setLoading(false) }
  }

  const handleGoogle = async () => {
    setError(''); setLoading(true)
    try { await signInWithGoogle(); navigate('/') }
    catch (e: unknown) { setError((e as { message?: string })?.message || 'Google sign-in failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative"
      >
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-500 hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Back to chat
        </button>

        <div className="glass-dark border border-white/10 rounded-2xl p-8 space-y-6">
          {/* Logo */}
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto shadow-lg shadow-violet-500/20">
              <Zap size={26} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text">Lumina</h1>
              <p className="text-slate-500 text-sm mt-1">
                {mode === 'signin' ? 'Welcome back' : 'Create your account'}
              </p>
            </div>
          </div>

          {!isConfigured ? (
            <div className="space-y-4">
              <div className="glass rounded-xl p-4 text-sm text-slate-400 space-y-2 border border-amber-500/20">
                <p className="text-amber-400 font-medium">Firebase not configured</p>
                <p className="text-slate-500 text-xs">
                  Add your Firebase credentials to <code className="text-violet-400 bg-violet-500/10 px-1 rounded">.env</code> to enable cloud sync. Your chats are currently saved in localStorage.
                </p>
              </div>
              <div className="text-xs text-slate-600 space-y-1 font-mono bg-black/30 rounded-xl p-4">
                <p>VITE_FIREBASE_API_KEY=...</p>
                <p>VITE_FIREBASE_AUTH_DOMAIN=...</p>
                <p>VITE_FIREBASE_PROJECT_ID=...</p>
                <p>VITE_FIREBASE_APP_ID=...</p>
              </div>
              <button onClick={() => navigate('/')}
                className="w-full py-2.5 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-sm hover:bg-violet-600/30 transition-all">
                Continue with local storage
              </button>
            </div>
          ) : (
            <>
              {/* Google */}
              <button onClick={handleGoogle} disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl glass border border-white/10 hover:bg-white/10 text-white text-sm font-medium transition-all disabled:opacity-50 hover:border-white/20"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
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
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-violet-500/50 placeholder-slate-600 transition-colors"
                  />
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEmail()}
                    placeholder="Password"
                    className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-11 py-3 text-sm text-white outline-none focus:border-violet-500/50 placeholder-slate-600 transition-colors"
                  />
                  <button onClick={() => setShowPass(s => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}

              <button onClick={handleEmail} disabled={loading || !email || !password}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-medium transition-all disabled:opacity-40 shadow-lg shadow-violet-500/20"
              >
                {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>

              <p className="text-center text-sm text-slate-600">
                {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <button onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError('') }}
                  className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </p>

              <p className="text-center text-xs text-slate-600">
                <button onClick={() => navigate('/')} className="hover:text-slate-500 transition-colors">
                  Continue without account
                </button>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
