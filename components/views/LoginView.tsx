import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Eye, EyeOff, Mail, Lock, ArrowRight, XCircle, CheckCircle2 } from 'lucide-react';

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
            setError(err.message || "Falha na autenticação com Google.");
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
                const { error: signInError } = await signIn(email, password);
                if (signInError) throw signInError;
            } else if (mode === 'register') {
                const { error: signUpError } = await signUp(email, password, name);
                if (signUpError) throw signUpError;
                setSuccessMessage("Conta criada! Verifique seu e-mail para confirmar o cadastro.");
            } else if (mode === 'forgot') {
                const { error: forgotError } = await resetPassword(email);
                if (forgotError) throw forgotError;
                setSuccessMessage("Link de recuperação enviado para seu e-mail!");
            }
        } catch (err: any) {
            // Tratamento de erros específicos do Supabase para melhor UX
            let message = err.message;
            if (message === "Invalid login credentials") message = "E-mail ou senha incorretos.";
            if (message === "Email not confirmed") message = "Por favor, confirme seu e-mail antes de entrar.";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f1219] flex items-center justify-center p-6 font-sans relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px]"></div>

            <div className="w-full max-w-[420px] bg-[#1a1e26]/80 backdrop-blur-xl rounded-[32px] p-8 md:p-10 shadow-2xl border border-white/5 relative z-10">
                
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-tr from-orange-500 to-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/20 transition-transform hover:scale-105 duration-300">
                        <span className="text-white font-black text-3xl">B</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">BelareStudio</h1>
                    <p className="text-slate-400 mt-2 text-sm font-medium">Gestão Inteligente para Estúdios de Beleza</p>
                </div>

                <div className="space-y-4">
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-bold py-3.5 rounded-xl hover:bg-slate-100 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        <GoogleIcon />
                        <span>Entrar com Google</span>
                    </button>

                    <div className="relative flex items-center py-4">
                        <div className="flex-grow border-t border-white/5"></div>
                        <span className="flex-shrink-0 mx-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">ou via e-mail</span>
                        <div className="flex-grow border-t border-white/5"></div>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-3 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <XCircle size={16} />
                        {error}
                    </div>
                )}
                {successMessage && (
                    <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-3 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <CheckCircle2 size={16} />
                        {successMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {mode === 'register' && (
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nome Completo</label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-[#242936] border border-white/5 rounded-xl pl-4 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all"
                                    placeholder="Seu nome"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">E-mail</label>
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-400 transition-colors" size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-[#242936] border border-white/5 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all"
                                placeholder="seu@email.com"
                                required
                            />
                        </div>
                    </div>

                    {mode !== 'forgot' && (
                        <div>
                            <div className="flex justify-between items-center mb-2 ml-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Senha</label>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-400 transition-colors" size={18} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#242936] border border-white/5 rounded-xl pl-12 pr-12 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {mode === 'login' && (
                                <div className="flex justify-end mt-3">
                                    <button 
                                        type="button" 
                                        onClick={() => handleModeChange('forgot')} 
                                        className="text-xs font-bold text-orange-400 hover:text-orange-300 transition-all"
                                    >
                                        Esqueceu a senha?
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-orange-500 to-rose-500 text-white font-black py-4 rounded-xl shadow-lg shadow-orange-500/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-3 mt-4"
                    >
                        {isLoading ? (
                            <Loader2 className="animate-spin h-5 w-5" />
                        ) : (
                            <>
                                <span>{mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar Conta' : 'Recuperar Senha'}</span>
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    {mode === 'login' ? (
                        <p className="text-sm text-slate-500 font-medium">
                            Não tem conta?{' '}
                            <button type="button" onClick={() => handleModeChange('register')} className="text-white font-bold hover:underline">
                                Cadastre-se
                            </button>
                        </p>
                    ) : (
                        <button 
                            type="button" 
                            onClick={() => handleModeChange('login')} 
                            className="text-sm text-white font-bold hover:underline inline-flex items-center gap-2"
                        >
                            Voltar para o Login
                        </button>
                    )}
                </div>

                <div className="mt-10 text-center opacity-30">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                        BelareStudio &copy; 2025 &bull; Todos os direitos reservados
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginView;
