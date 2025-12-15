import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Lock, Mail, Eye, EyeOff, ArrowRight, CheckCircle2, XCircle, User, Sparkles, Send, ArrowLeft } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'forgot';

// Google Icon SVG
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
    
    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState(''); // For registration
    
    // UI State
    const [mode, setMode] = useState<AuthMode>('login');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const resetForm = () => {
        setError(null);
        setSuccessMessage(null);
        setPassword('');
    };

    const handleModeChange = (newMode: AuthMode) => {
        resetForm();
        setMode(newMode);
    };

    const handleGoogleLogin = async () => {
        setError(null);
        setIsLoading(true);
        try {
            const { error } = await signInWithGoogle();
            if (error) throw error;
        } catch (err: any) {
            console.error(err);
            setError("Erro ao conectar com Google. Verifique a configuração.");
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
                setSuccessMessage("Conta criada! Verifique seu e-mail para confirmar.");
            } else if (mode === 'forgot') {
                const { error } = await resetPassword(email);
                if (error) throw error;
                setSuccessMessage("Link de recuperação enviado para o e-mail.");
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const getTitle = () => {
        switch (mode) {
            case 'register': return 'Criar Conta';
            case 'forgot': return 'Recuperar Senha';
            default: return 'Bem-vindo(a)';
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
            <div className="w-full max-w-md p-6">
                
                {/* Logo / Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500 shadow-lg shadow-orange-200 mb-4 transform transition-transform hover:scale-105">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">BelaApp</h1>
                    <p className="text-slate-500 text-sm font-medium">Gestão Inteligente para Estúdios</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-8 overflow-hidden relative">
                    {/* Header */}
                    <div className="mb-6 text-center">
                        <h2 className="text-2xl font-bold text-slate-800">{getTitle()}</h2>
                    </div>

                    <div className="space-y-5">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-start gap-3 animate-in slide-in-from-top-2">
                                <XCircle className="w-5 h-5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                        {successMessage && (
                            <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-green-600 text-sm flex items-start gap-3 animate-in slide-in-from-top-2">
                                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                                <span>{successMessage}</span>
                            </div>
                        )}

                        {/* Google Button */}
                        {(mode === 'login' || mode === 'register') && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleGoogleLogin}
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3.5 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? <Loader2 className="animate-spin w-5 h-5 text-slate-400"/> : <GoogleIcon />}
                                    <span>
                                        {mode === 'login' ? 'Entrar com Google' : 'Cadastrar com Google'}
                                    </span>
                                </button>

                                <div className="relative flex items-center py-2">
                                    <div className="flex-grow border-t border-slate-200"></div>
                                    <span className="flex-shrink-0 mx-4 text-xs font-bold text-slate-400 uppercase tracking-wider">ou</span>
                                    <div className="flex-grow border-t border-slate-200"></div>
                                </div>
                            </>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {mode === 'register' && (
                                <div className="space-y-1.5 animate-in slide-in-from-left-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nome Completo</label>
                                    <div className="relative group">
                                        <User className="absolute left-3 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                                            placeholder="Seu Nome"
                                            required={mode === 'register'}
                                            autoComplete="name"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">E-mail</label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                                        placeholder="seu@email.com"
                                        required
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            {(mode === 'login' || mode === 'register') && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Senha</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="block w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                                            placeholder="••••••"
                                            required
                                            minLength={6}
                                            autoComplete="current-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {mode === 'login' && (
                                <div className="flex justify-end pt-1">
                                    <button 
                                        type="button" 
                                        onClick={() => handleModeChange('forgot')} 
                                        className="text-xs font-medium text-slate-500 hover:text-orange-500 transition-colors hover:underline"
                                    >
                                        Esqueceu a senha?
                                    </button>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl shadow-lg shadow-orange-200 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed mt-6"
                            >
                                {isLoading ? (
                                    <Loader2 className="animate-spin h-5 w-5" />
                                ) : (
                                    <>
                                        {mode === 'login' && <>Entrar <ArrowRight className="h-5 w-5" /></>}
                                        {mode === 'register' && <>Criar Conta <CheckCircle2 className="h-5 w-5" /></>}
                                        {mode === 'forgot' && <>Enviar Link <Send className="h-4 w-4" /></>}
                                    </>
                                )}
                            </button>
                        </form>
                        
                        <div className="flex justify-center pt-2">
                            {mode === 'login' ? (
                                <p className="text-sm text-slate-500">
                                    Não tem conta? <button type="button" onClick={() => handleModeChange('register')} className="text-orange-500 font-bold hover:text-orange-600 transition-colors">Cadastre-se</button>
                                </p>
                            ) : (
                                <button type="button" onClick={() => handleModeChange('login')} className="text-sm font-medium text-slate-500 flex items-center gap-2 hover:text-slate-800 transition-colors group">
                                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Voltar para login
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Footer Text */}
                <p className="text-center text-slate-400 text-xs mt-8">
                    &copy; {new Date().getFullYear()} BelaApp. Todos os direitos reservados.
                </p>
            </div>
        </div>
    );
};

export default LoginView;