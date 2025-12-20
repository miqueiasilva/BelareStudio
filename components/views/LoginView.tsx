
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
            {/* Background com Gradiente Radial Profundo */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_30%,_#1e1b4b_0%,_#09090b_70%,_#000000_100%)] z-0"></div>
            <div className="absolute top-[-5%] left-[-10%] w-[600px] h-[600px] bg-orange-600/15 rounded-full blur-[140px] z-0"></div>
            <div className="absolute bottom-[-5%] right-[-10%] w-[600px] h-[600px] bg-rose-600/15 rounded-full blur-[140px] z-0"></div>

            {/* Glassmorphism Card com Border Radius Ampliado (Foco em Curvas Modernas) */}
            <div className="w-full max-w-[460px] relative z-10 animate-in fade-in slide-in-from-bottom-12 duration-1000 ease-out">
                <div className="bg-white/[0.04] backdrop-blur-[18px] border border-white/10 rounded-[44px] p-8 md:p-14 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-y-auto max-h-[95vh] scrollbar-hide">
                    
                    {/* Header: Logo e Título */}
                    <div className="flex flex-col items-center mb-10">
                        <div className="w-16 h-16 bg-gradient-to-br from-[#FF8C42] to-[#F43F5E] rounded-[22px] flex items-center justify-center shadow-[0_8px_32px_rgba(255,140,66,0.3)] mb-5 transform hover:rotate-3 transition-transform cursor-default">
                            <span className="text-white font-black text-4xl tracking-tighter">B</span>
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">BelaApp</h1>
                        <p className="text-slate-200/80 text-sm text-center font-medium leading-relaxed max-w-[240px]">Gestão Inteligente para Estúdios de Beleza</p>
                    </div>

                    {/* Feedback Messages */}
                    {error && (
                        <div className="mb-6 p-4 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-3 rounded-2xl animate-in zoom-in-95">
                            <XCircle size={16} />
                            {error}
                        </div>
                    )}
                    {successMessage && (
                        <div className="mb-6 p-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-3 rounded-2xl animate-in zoom-in-95">
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
                            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-bold py-4 rounded-[20px] hover:bg-slate-50 transition-all active:scale-[0.97] disabled:opacity-50 mb-8 shadow-xl text-sm"
                        >
                            <GoogleIcon />
                            <span>Entrar com Google</span>
                        </button>
                    )}

                    {/* Divisor com Melhor Contraste */}
                    <div className="relative flex items-center py-2 mb-8">
                        <div className="flex-grow border-t border-white/10"></div>
                        <span className="flex-shrink-0 mx-6 text-[10px] font-black text-slate-200/60 uppercase tracking-[0.25em]">OU VIA E-MAIL</span>
                        <div className="flex-grow border-t border-white/10"></div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {mode === 'register' && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-2">Nome Completo</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-[18px] px-6 py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/60 transition-all font-medium"
                                        placeholder="Seu nome"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-2">E-mail</label>
                            <div className="relative group">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#FF8C42]">
                                    <Mail size={19} />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-[18px] pl-14 pr-6 py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/60 transition-all font-medium"
                                    placeholder="exemplo@email.com"
                                    required
                                />
                            </div>
                        </div>

                        {mode !== 'forgot' && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-2">Senha</label>
                                <div className="relative group">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#FF8C42]">
                                        <Lock size={19} />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-[18px] pl-14 pr-14 py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/60 transition-all font-medium"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-5 flex items-center text-slate-500 hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {mode === 'login' && (
                            <div className="flex justify-end">
                                <button 
                                    type="button" 
                                    onClick={() => handleModeChange('forgot')} 
                                    className="text-xs font-bold text-[#FF8C42] hover:text-[#F43F5E] transition-all"
                                >
                                    Esqueceu a senha?
                                </button>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-[#FF8C42] to-[#F43F5E] hover:scale-[1.02] text-white font-black py-4.5 rounded-[22px] shadow-[0_12px_40px_rgba(255,140,66,0.3)] transition-all active:scale-[0.97] disabled:opacity-70 flex items-center justify-center gap-3 mt-8 relative group overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            {isLoading ? (
                                <Loader2 className="animate-spin h-6 w-6" />
                            ) : (
                                <>
                                    <span className="text-base tracking-tight">{mode === 'login' ? 'Entrar Agora' : mode === 'register' ? 'Criar Minha Conta' : 'Recuperar Acesso'}</span>
                                    <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer Links com Cores Vibrantes */}
                    <div className="mt-12 text-center">
                        {mode === 'login' ? (
                            <p className="text-sm text-slate-400 font-medium">
                                Ainda não tem conta?{' '}
                                <button 
                                    type="button" 
                                    onClick={() => handleModeChange('register')} 
                                    className="text-white font-black hover:text-[#FF8C42] transition-colors decoration-[#FF8C42]/30 underline underline-offset-4"
                                >
                                    Cadastre-se
                                </button>
                            </p>
                        ) : (
                            <button 
                                type="button" 
                                onClick={() => handleModeChange('login')} 
                                className="text-sm text-slate-300 font-bold hover:text-white transition-all bg-white/5 px-6 py-2.5 rounded-full border border-white/5"
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
