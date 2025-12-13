
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { testConnection } from '../../services/supabaseClient';
import { Loader2, Lock, Mail, Eye, EyeOff, ArrowRight, CheckCircle2, XCircle, Github, User, ArrowLeft, Send } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'forgot';

const LoginView: React.FC = () => {
    const { signIn, signUp, resetPassword, signInWithGoogle, signInWithGithub } = useAuth();
    
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
    
    // Estado da Conexão
    const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');

    useEffect(() => {
        const checkDb = async () => {
            const isConnected = await testConnection();
            setDbStatus(isConnected ? 'connected' : 'error');
        };
        checkDb();
    }, []);

    const resetForm = () => {
        setError(null);
        setSuccessMessage(null);
        setPassword('');
        // Keep email populated as it's often reused
    };

    const handleModeChange = (newMode: AuthMode) => {
        resetForm();
        setMode(newMode);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setIsLoading(true);

        try {
            if (mode === 'login') {
                const result = await signIn(email, password);
                if (result.error) setError(result.error);
            } else if (mode === 'register') {
                if (!name) {
                    setError("Por favor, informe seu nome.");
                    setIsLoading(false);
                    return;
                }
                const result = await signUp(email, password, name);
                if (result.error) {
                    setError(result.error);
                } else {
                    setSuccessMessage("Conta criada com sucesso! Verifique seu e-mail para confirmar.");
                    // Optional: Switch to login or keep showing success
                }
            } else if (mode === 'forgot') {
                const result = await resetPassword(email);
                if (result.error) {
                    setError(result.error);
                } else {
                    setSuccessMessage("Se o e-mail estiver cadastrado, você receberá um link de recuperação.");
                }
            }
        } catch (err) {
            setError("Ocorreu um erro inesperado. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError(null);
        setIsLoading(true);
        await signInWithGoogle();
    };

    const handleGithubLogin = async () => {
        setError(null);
        setIsLoading(true);
        await signInWithGithub();
    };

    // --- Render Helpers ---

    const getTitle = () => {
        switch (mode) {
            case 'register': return 'Criar Conta';
            case 'forgot': return 'Recuperar Senha';
            default: return 'Bem-vindo ao BelaApp';
        }
    };

    const getSubtitle = () => {
        switch (mode) {
            case 'register': return 'Comece a gerenciar seu estúdio hoje';
            case 'forgot': return 'Informe seu e-mail para receber o link';
            default: return 'Gestão Inteligente para Estúdios de Beleza';
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute top-0 -right-32 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-32 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-slate-800/50 rounded-full blur-3xl opacity-40"></div>
            </div>

            <div className="w-full max-w-md p-8 relative z-10">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8 transition-all duration-300">
                    
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-tr from-orange-400 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20">
                            <span className="text-white font-bold text-3xl">B</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">{getTitle()}</h1>
                        <p className="text-slate-300 text-sm">{getSubtitle()}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-200 text-sm text-center flex items-center justify-center gap-2">
                                <XCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}
                        {successMessage && (
                            <div className="p-3 bg-green-500/10 border border-green-500/50 rounded-xl text-green-200 text-sm text-center flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                {successMessage}
                            </div>
                        )}

                        {mode === 'register' && (
                            <div className="space-y-1 animate-in slide-in-from-left-4 fade-in">
                                <label className="text-xs font-semibold text-slate-300 uppercase ml-1">Nome Completo</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-slate-400 group-focus-within:text-white transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                                        placeholder="Seu Nome"
                                        required={mode === 'register'}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-300 uppercase ml-1">E-mail</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-white transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                                    placeholder="seu@email.com"
                                    required
                                />
                            </div>
                        </div>

                        {mode !== 'forgot' && (
                            <div className="space-y-1 animate-in slide-in-from-right-4 fade-in">
                                <label className="text-xs font-semibold text-slate-300 uppercase ml-1">Senha</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-white transition-colors" />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-10 pr-10 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                                        placeholder="••••••"
                                        required={mode !== 'forgot'}
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {mode === 'login' && (
                            <div className="flex items-center justify-between text-sm">
                                <label className="flex items-center text-slate-300 cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-slate-900" />
                                    <span className="ml-2">Lembrar de mim</span>
                                </label>
                                <button type="button" onClick={() => handleModeChange('forgot')} className="text-orange-400 hover:text-orange-300 font-medium transition-colors">
                                    Esqueceu a senha?
                                </button>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-orange-500/20 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 focus:ring-offset-slate-900 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin h-5 w-5" />
                            ) : (
                                <>
                                    {mode === 'login' && <>Entrar no Sistema <ArrowRight className="h-5 w-5" /></>}
                                    {mode === 'register' && <>Criar Conta <CheckCircle2 className="h-5 w-5" /></>}
                                    {mode === 'forgot' && <>Enviar Link <Send className="h-4 w-4" /></>}
                                </>
                            )}
                        </button>
                        
                        {/* Secondary Actions */}
                        <div className="flex justify-center mt-2">
                            {mode === 'login' ? (
                                <p className="text-sm text-slate-400">
                                    Não tem uma conta? <button type="button" onClick={() => handleModeChange('register')} className="text-white font-bold hover:underline">Cadastre-se</button>
                                </p>
                            ) : (
                                <button type="button" onClick={() => handleModeChange('login')} className="text-sm text-slate-400 flex items-center gap-1 hover:text-white transition-colors">
                                    <ArrowLeft className="w-4 h-4" /> Voltar para o login
                                </button>
                            )}
                        </div>
                    </form>

                    {/* Social Login (Only in Login Mode for cleaner UI) */}
                    {mode === 'login' && (
                        <>
                            <div className="my-6 flex items-center justify-between">
                                <span className="w-full border-b border-slate-600/50"></span>
                                <span className="px-3 text-xs text-slate-400 font-medium uppercase">OU</span>
                                <span className="w-full border-b border-slate-600/50"></span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={handleGoogleLogin}
                                    disabled={isLoading}
                                    className="flex justify-center items-center gap-2 py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed text-xs"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    Google
                                </button>
                                <button
                                    type="button"
                                    onClick={handleGithubLogin}
                                    disabled={isLoading}
                                    className="flex justify-center items-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed text-xs"
                                >
                                    <Github className="w-5 h-5" />
                                    GitHub
                                </button>
                            </div>
                        </>
                    )}

                    {/* DB Status Indicator */}
                    <div className={`mt-6 p-3 rounded-lg border flex items-center justify-center gap-2 text-xs font-medium transition-colors ${
                        dbStatus === 'checking' ? 'bg-slate-800/50 border-slate-700 text-slate-400' :
                        dbStatus === 'connected' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                        'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                        {dbStatus === 'checking' && (
                            <>
                                <Loader2 className="w-3 h-3 animate-spin" /> Verificando conexão...
                            </>
                        )}
                        {dbStatus === 'connected' && (
                            <>
                                <CheckCircle2 className="w-3 h-3" /> Banco de Dados Conectado
                            </>
                        )}
                        {dbStatus === 'error' && (
                            <>
                                <XCircle className="w-3 h-3" /> Erro de Conexão com Supabase
                            </>
                        )}
                    </div>

                    {mode === 'login' && (
                        <div className="mt-4 text-center text-sm text-slate-400">
                            <p>Login de Teste: <b>admin@bela.com</b> / <b>123123</b></p>
                        </div>
                    )}
                </div>
                
                <p className="mt-8 text-center text-xs text-slate-500">
                    &copy; 2025 BelaApp. Todos os direitos reservados.
                </p>
            </div>
        </div>
    );
};

export default LoginView;
