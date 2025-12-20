
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
    Loader2, 
    Eye, 
    EyeOff, 
    Mail, 
    Lock, 
    ArrowRight, 
    XCircle, 
    CheckCircle2 
} from 'lucide-react';

type AuthMode = 'login' | 'register' | 'forgot';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.29-2.29-2.55z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const LoginView: React.FC = () => {
    const { signIn, signUp, resetPassword, signInWithGoogle } = useAuth();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    
    const [mode, setMode] = useState<AuthMode>('login');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        // Higiene de Sessão Preventiva
        localStorage.clear();
        sessionStorage.clear();
    }, []);

    const handleModeChange = (newMode: AuthMode) => {
        setError(null);
        setSuccessMessage(null);
        setMode(newMode);
    };

    const handleGoogleLogin = async () => {
        setError(null);
        setIsLoading(true);
        try {
            const { error } = await signInWithGoogle();
            if (error) throw error;
        } catch (err: any) {
            setError("Falha na comunicação com o Google.");
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setIsLoading(true);

        try {
            if (mode === 'login') {
                const { error } = await signIn(email, password);
                if (error) throw error;
            } else if (mode === 'register') {
                const { error } = await signUp(email, password, name);
                if (error) throw error;
                setSuccessMessage("Conta criada! Verifique seu e-mail.");
            } else if (mode === 'forgot') {
                const { error } = await resetPassword(email);
                if (error) throw error;
                setSuccessMessage("Instruções enviadas para seu e-mail.");
            }
        } catch (err: any) {
            setError(err.message || "Ocorreu um erro inesperado.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-black">
            {/* Background com Gradiente Radial e Orbs */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black z-0"></div>
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[120px] z-0"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-rose-500/10 rounded-full blur-[120px] z-0"></div>

            {/* Glassmorphism Card */}
            <div className="w-full max-w-[440px] relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 md:p-12 shadow-2xl overflow-y-auto max-h-[95vh] scrollbar-hide">
                    
                    {/* Header: Logo e Título */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-14 h-14 bg-gradient-to-br from-[#FF8C42] to-[#F43F5E] rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 mb-4 transform hover:scale-105 transition-transform">
                            <span className="text-white font-black text-3xl">B</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">BelaApp</h1>
                        <p className="text-slate-400 text-sm mt-1 text-center font-medium">Gestão Inteligente para Estúdios de Beleza</p>
                    </div>

                    {/* Feedback Messages */}
                    {error && (
                        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-3 rounded-2xl animate-in zoom-in-95">
                            <XCircle size={16} />
                            {error}
                        </div>
                    )}
                    {successMessage && (
                        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-3 rounded-2xl animate-in zoom-in-95">
                            <CheckCircle2 size={16} />
                            {successMessage}
                        </div>
                    )}

                    {/* Google Login */}
                    {mode === 'login' && (
                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-bold py-3.5 rounded-2xl hover:bg-slate-100 transition-all active:scale-95 disabled:opacity-50 mb-6 shadow-xl"
                        >
                            <GoogleIcon />
                            <span>Entrar com Google</span>
                        </button>
                    )}

                    {/* Divisor */}
                    <div className="relative flex items-center py-2 mb-6">
                        <div className="flex-grow border-t border-white/5"></div>
                        <span className="flex-shrink-0 mx-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">OU VIA E-MAIL</span>
                        <div className="flex-grow border-t border-white/5"></div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'register' && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-white/5 border border-slate-700/50 rounded-2xl px-5 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all font-medium"
                                        placeholder="Seu nome"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-orange-500">
                                    <Mail size={18} />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white/5 border border-slate-700/50 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all font-medium"
                                    placeholder="exemplo@email.com"
                                    required
                                />
                            </div>
                        </div>

                        {mode !== 'forgot' && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-orange-500">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white/5 border border-slate-700/50 rounded-2xl pl-12 pr-12 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all font-medium"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-4 flex items-center text-slate-500 hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {mode === 'login' && (
                            <div className="flex justify-end">
                                <button 
                                    type="button" 
                                    onClick={() => handleModeChange('forgot')} 
                                    className="text-xs font-bold text-[#FF8C42] hover:text-[#F43F5E] transition-colors"
                                >
                                    Esqueceu a senha?
                                </button>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-[#FF8C42] to-[#F43F5E] hover:from-[#f97316] hover:to-[#e11d48] text-white font-black py-4 rounded-2xl shadow-xl shadow-orange-500/20 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-3 mt-6"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin h-5 w-5" />
                            ) : (
                                <>
                                    <span>{mode === 'login' ? 'Entrar' : mode === 'register' ? 'Cadastrar' : 'Recuperar'}</span>
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer Links */}
                    <div className="mt-10 text-center">
                        {mode === 'login' ? (
                            <p className="text-sm text-slate-500 font-medium">
                                Ainda não tem conta?{' '}
                                <button 
                                    type="button" 
                                    onClick={() => handleModeChange('register')} 
                                    className="text-white font-black hover:text-[#FF8C42] transition-colors"
                                >
                                    Cadastre-se
                                </button>
                            </p>
                        ) : (
                            <button 
                                type="button" 
                                onClick={() => handleModeChange('login')} 
                                className="text-sm text-slate-300 font-bold hover:text-white transition-all"
                            >
                                Voltar para o Login
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginView;
