import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { Loader2, Eye, EyeOff, Mail, Lock, ArrowRight, XCircle, CheckCircle2, RefreshCw, ExternalLink, Trash2, HelpCircle, AlertCircle, Sparkles } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'forgot';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.29-2.29-2.55z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

interface LoginViewProps {
  onBack?: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onBack }) => {
    const { signIn, signUp, resetPassword, signInWithGoogle } = useAuth();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    
    const [mode, setMode] = useState<AuthMode>('login');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    
    // Troubleshooting States
    const [showHelp, setShowHelp] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [connectionError, setConnectionError] = useState<string | null>(null);

    const handleModeChange = (newMode: AuthMode) => {
        setError(null);
        setSuccessMessage(null);
        setMode(newMode);
    };

    const handleTestConnection = async () => {
        setConnectionStatus('testing');
        setConnectionError(null);
        try {
            const { error } = await supabase.auth.getSession();
            if (error) throw error;
            setConnectionStatus('success');
        } catch (err: any) {
            console.error('[AUTH_DEBUG] Falha de conexão com Supabase:', err);
            setConnectionStatus('error');
            setConnectionError(err.message || 'Sem resposta do banco de dados.');
        }
    };

    const handleClearSession = () => {
        if (confirm("Deseja realmente limpar todos os dados de sessão salvos no seu navegador? Isso removerá credenciais anteriores e recarregará a página.")) {
            try {
                localStorage.clear();
                sessionStorage.clear();
                
                const cookies = document.cookie.split(";");
                for (let i = 0; i < cookies.length; i++) {
                    const cookie = cookies[i];
                    const eqPos = cookie.indexOf("=");
                    const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
                    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
                }
                
                alert("Dados limpos com sucesso! A página será reiniciada.");
                window.location.reload();
            } catch (e: any) {
                setError("Erro ao limpar cookies/localStorage: " + e.message);
            }
        }
    };

    const handleDemoLogin = async () => {
        setError(null);
        setSuccessMessage(null);
        setIsLoading(true);
        console.log('[AUTH_DEBUG] Usuário iniciou Login de Demonstração');
        try {
            const demoEmail = 'demo@belarestudio.com';
            const demoPass = 'demo123456';
            const { error: signInError } = await signIn(demoEmail, demoPass);
            if (signInError) {
                console.log('[AUTH_DEBUG] Login demo falhou. Tentando criar conta demo...', signInError.message);
                const { error: signUpError } = await signUp(demoEmail, demoPass, 'Administrador Demo');
                if (signUpError) {
                    throw signUpError;
                }
                // Se o cadastro funcionou, tenta o login novamente
                const { error: signInRetryError } = await signIn(demoEmail, demoPass);
                if (signInRetryError) {
                    throw signInRetryError;
                }
            }
            setSuccessMessage("Logado com sucesso no Modo de Demonstração!");
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } catch (err: any) {
            console.error('[AUTH_DEBUG] Falha no login demo:', err);
            setError("Não foi possível iniciar o modo de demonstração: " + (err.message || "Erro desconhecido"));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError(null);
        setSuccessMessage(null);
        setIsLoading(true);
        console.log('[AUTH_DEBUG] Usuário clicou em Login com Google (fluxo popup seguro para iFrame)');
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/`,
                    skipBrowserRedirect: true,
                    flowType: 'pkce'
                }
            });
            
            if (error) throw error;
            
            if (data?.url) {
                console.log('[AUTH_DEBUG] Abrindo URL do Google OAuth:', data.url);
                const width = 600;
                const height = 700;
                const left = window.screen.width / 2 - width / 2;
                const top = window.screen.height / 2 - height / 2;
                
                const authWindow = window.open(
                    data.url,
                    'google_oauth_popup',
                    `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes,scrollbars=yes`
                );
                
                if (!authWindow) {
                    throw new Error("O bloqueador de pop-ups do seu navegador impediu a abertura da janela de login do Google. Por favor, permita pop-ups para este site ou clique em 'Não consegue logar? Opções de ajuda' abaixo para abrir o sistema em uma nova aba.");
                }
                
                setSuccessMessage("Verifique a janela pop-up que se abriu para concluir o login do Google.");
                
                const interval = setInterval(async () => {
                    try {
                        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
                        if (sessionErr) {
                            console.warn('[AUTH_DEBUG] Polling getSession error:', sessionErr);
                        }
                        if (sessionData?.session?.user) {
                            console.log('[AUTH_DEBUG] Sessão detectada via polling!');
                            clearInterval(interval);
                            setSuccessMessage("Login do Google realizado com sucesso! Atualizando...");
                            setIsLoading(false);
                            setTimeout(() => {
                                window.location.reload();
                            }, 500);
                        }
                    } catch (pollingErr) {
                        console.error('[AUTH_DEBUG] Polling exception:', pollingErr);
                    }
                    if (authWindow.closed) {
                        clearInterval(interval);
                        setIsLoading(false);
                        console.log('[AUTH_DEBUG] Janela de OAuth fechada pelo usuário.');
                    }
                }, 1500);
            } else {
                throw new Error("Não foi possível gerar a URL de autenticação do Google.");
            }
        } catch (err: any) {
            console.error('[AUTH_DEBUG] Erro Google OAuth:', err);
            setError(err.message || "Falha na conexão com Google.");
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setIsLoading(true);
        
        console.log(`[AUTH_DEBUG] Tentativa de ${mode} para: ${email}`);

        try {
            if (mode === 'login') {
                const { error: signInError } = await signIn(email, password);
                if (signInError) throw signInError;
            } else if (mode === 'register') {
                const { error: signUpError } = await signUp(email, password, name);
                if (signUpError) throw signUpError;
                setSuccessMessage("Conta criada! Verifique seu e-mail para confirmar.");
            } else if (mode === 'forgot') {
                const { error: forgotError } = await resetPassword(email);
                if (forgotError) throw forgotError;
                setSuccessMessage("Link de recuperação enviado para o seu e-mail.");
            }
        } catch (err: any) {
            console.error('[AUTH_DEBUG] Falha no processo de autenticação:', err);
            let message = err.message;
            if (message === "Invalid login credentials") {
                message = "E-mail ou senha incorretos. Dica: Se for seu primeiro acesso neste ambiente, clique em 'Cadastre-se' abaixo para criar seu usuário administrador!";
            }
            if (message.includes("API key")) message = "Erro técnico: Chave de API não configurada corretamente.";
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
                
                <div className="text-center mb-8 relative">
                    {onBack && (
                        <button 
                            onClick={onBack}
                            className="absolute left-0 top-0 p-2 text-slate-500 hover:text-white transition-colors"
                        >
                            <ArrowRight className="rotate-180" size={20} />
                        </button>
                    )}
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

                    <button
                        type="button"
                        onClick={handleDemoLogin}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-orange-500/10 to-rose-500/10 hover:from-orange-500/20 hover:to-rose-500/20 border border-orange-500/20 text-orange-400 font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                        <Sparkles size={18} className="text-orange-400" />
                        <span>Entrar como Convidado (Modo Demo)</span>
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
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-[#242936] border border-white/5 rounded-xl pl-4 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-50/20 focus:border-orange-500/50 transition-all"
                                placeholder="Seu nome"
                                required
                            />
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
                                className="w-full bg-[#242936] border border-white/5 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-50/20 focus:border-orange-500/50 transition-all"
                                placeholder="seu@email.com"
                                required
                            />
                        </div>
                    </div>

                    {mode !== 'forgot' && (
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Senha</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-400 transition-colors" size={18} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#242936] border border-white/5 rounded-xl pl-12 pr-12 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-50/20 focus:border-orange-500/50 transition-all"
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
                        <p className="text-sm text-slate-500 font-medium font-sans">
                            Não tem conta?{' '}
                            <button type="button" onClick={() => handleModeChange('register')} className="text-white font-bold hover:underline cursor-pointer">
                                Cadastre-se
                            </button>
                        </p>
                    ) : (
                        <button 
                            type="button" 
                            onClick={() => handleModeChange('login')} 
                            className="text-sm text-white font-bold hover:underline inline-flex items-center gap-2 cursor-pointer"
                        >
                            Voltar para o Login
                        </button>
                    )}
                </div>

                {/* Botão de Ajuda de Acesso */}
                <div className="mt-6 pt-4 border-t border-white/5 text-center">
                    <button 
                        type="button" 
                        onClick={() => setShowHelp(!showHelp)} 
                        className="text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                        <HelpCircle size={14} className="text-orange-500" />
                        <span>Não consegue logar? Opções de ajuda</span>
                    </button>
                </div>

                {/* Painel de Ajuda */}
                {showHelp && (
                    <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4 text-left animate-in fade-in slide-in-from-top-2 duration-200">
                        <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                            <AlertCircle size={14} className="text-orange-500" />
                            Diagnóstico e Soluções
                        </h3>
                        
                        <div className="space-y-3 text-left">
                            {/* Solução 1: Nova Aba */}
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">1. Bloqueio de Cookies (iFrame)</p>
                                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                                    O iFrame ou navegadores como o Safari podem bloquear cookies e inviabilizar o login com Google ou e-mail. Abrir em uma nova aba resolve 100% desses casos.
                                </p>
                                <a 
                                    href={window.location.href} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 px-3 py-2.5 bg-orange-500/10 hover:bg-orange-500/25 text-orange-400 rounded-xl text-xs font-bold w-full justify-center transition-all mt-1"
                                >
                                    <ExternalLink size={14} />
                                    Abrir Aplicativo em Nova Aba
                                </a>
                            </div>

                            {/* Solução 2: Limpar Sessão */}
                            <div className="space-y-1 pt-2 border-t border-white/5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">2. Sessão Expirada ou Corrompida</p>
                                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                                    Se sua sessão anterior expirou ou corrompeu, limpe os dados locais temporários salvos no navegador para recomeçar do zero.
                                </p>
                                <button 
                                    type="button"
                                    onClick={handleClearSession}
                                    className="inline-flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 rounded-xl text-xs font-bold w-full justify-center transition-all mt-1 cursor-pointer"
                                >
                                    <Trash2 size={14} />
                                    Limpar Sessão e Cache
                                </button>
                            </div>

                            {/* Solução 3: Diagnóstico */}
                            <div className="space-y-1 pt-2 border-t border-white/5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">3. Conexão com o Banco</p>
                                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                                    Verifique se a API do banco de dados (Supabase) está ativa e respondendo neste exato momento.
                                </p>
                                <div className="flex gap-2 mt-1">
                                    <button 
                                        type="button"
                                        onClick={handleTestConnection}
                                        disabled={connectionStatus === 'testing'}
                                        className="inline-flex items-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold w-full justify-center transition-all cursor-pointer"
                                    >
                                        {connectionStatus === 'testing' ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <RefreshCw size={14} />
                                        )}
                                        {connectionStatus === 'testing' ? 'Testando...' : 'Testar Conexão'}
                                    </button>
                                </div>
                                {connectionStatus === 'success' && (
                                    <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 mt-1 font-sans">
                                        ● Banco de dados conectado e operando normalmente!
                                    </p>
                                )}
                                {connectionStatus === 'error' && (
                                    <div className="text-[10px] text-rose-400 font-bold mt-1 space-y-1 font-sans">
                                        <p>● Erro de conexão:</p>
                                        <p className="text-[9px] text-rose-500 font-mono bg-rose-500/5 p-1.5 rounded-lg border border-rose-500/10 leading-normal max-w-full overflow-x-auto">{connectionError}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

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
