
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Lock, Mail, Eye, EyeOff, ArrowRight, CheckCircle2, XCircle, User, ArrowLeft, Send } from 'lucide-react';

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
    
    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    
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
            setError("Erro ao conectar com Google. Tente novamente.");
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
                setSuccessMessage("Verifique seu e-mail para confirmar a conta!");
            } else if (mode === 'forgot') {
                const { error } = await resetPassword(email);
                if (error) throw error;
                setSuccessMessage("Link de recuperação enviado para seu e-mail.");
            }
        } catch (err: any) {
            setError(err.message === "Invalid login credentials" ? "E-mail ou senha inválidos." : err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden font-sans">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-100 rounded-full opacity-50 blur-3xl"></div>
                <div className="absolute bottom-0 right-0 w-80 h-80 bg-slate-200 rounded-full opacity-30 blur-3xl"></div>
            </div>

            <div className="w-full max-w-[440px] p-6 relative z-10 animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden">
                    
                    <div className="bg-orange-500 p-10 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl rotate-3">
                            <span className="text-orange-500 font-black text-5xl">B</span>
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight">BelaApp</h1>
                        <p className="text-orange-100 text-sm mt-1 font-medium">Gestão Inteligente para Beleza</p>
                    </div>

                    <div className="p-10 pt-8 space-y-6">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-3">
                                <XCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}
                        {successMessage && (
                            <div className="p-4 bg-green-50 border border-green-100 rounded-2xl text-green-600 text-xs font-bold flex items-center gap-3">
                                <CheckCircle2 className="w-4 h-4" />
                                {successMessage}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {mode === 'register' && (
                                <div className="space-y-1">
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-orange-500 transition-colors" />
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium"
                                            placeholder="Nome Completo"
                                            required={mode === 'register'}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-orange-500 transition-colors" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium"
                                        placeholder="E-mail profissional"
                                        required
                                    />
                                </div>
                            </div>

                            {(mode === 'login' || mode === 'register') && (
                                <div className="space-y-1">
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-orange-500 transition-colors" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="block w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium"
                                            placeholder="Sua senha secreta"
                                            required
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-4 flex items-center text-slate-300 hover:text-slate-500"
                                        >
                                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {mode === 'login' && (
                                <div className="flex justify-end pr-2">
                                    <button type="button" onClick={() => handleModeChange('forgot')} className="text-orange-600 text-xs font-bold hover:underline">
                                        Esqueceu a senha?
                                    </button>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center items-center gap-3 py-4.5 px-6 rounded-2xl shadow-xl shadow-orange-100 text-sm font-black text-white bg-orange-500 hover:bg-orange-600 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-wider h-14"
                            >
                                {isLoading ? (
                                    <Loader2 className="animate-spin h-5 w-5" />
                                ) : (
                                    <>
                                        {mode === 'login' ? 'Entrar no Sistema' : mode === 'register' ? 'Criar Minha Conta' : 'Enviar Link de Resgate'}
                                        <ArrowRight className="h-5 w-5" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-slate-100"></div>
                            <span className="flex-shrink-0 mx-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">ou entre com</span>
                            <div className="flex-grow border-t border-slate-100"></div>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-3 bg-white text-slate-700 font-bold py-4 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all shadow-sm active:scale-[0.98] disabled:opacity-70"
                        >
                            <GoogleIcon />
                            <span className="text-sm">Google</span>
                        </button>
                        
                        <div className="text-center pt-4 border-t border-slate-50">
                            {mode === 'login' ? (
                                <p className="text-xs text-slate-400 font-medium">
                                    Ainda não usa BelaApp? <button type="button" onClick={() => handleModeChange('register')} className="text-orange-600 font-black hover:underline ml-1">Comece Grátis</button>
                                </p>
                            ) : (
                                <button type="button" onClick={() => handleModeChange('login')} className="text-xs text-slate-400 font-bold flex items-center gap-2 mx-auto hover:text-slate-600 transition-colors">
                                    <ArrowLeft className="w-3 h-3" /> Voltar para o Login
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                <p className="mt-8 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">BelaApp © 2025 • Todos os direitos reservados</p>
            </div>
        </div>
    );
};

export default LoginView;
