import React, { useState } from 'react';
import { X, Phone, Lock, User, Loader2, CheckCircle2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

interface PublicAuthModalProps {
    onClose: () => void;
    onAuthenticated: (clientData: { name: string; phone: string; clientId?: number }) => void;
}

// Normaliza telefone para 11 dígitos
const normalizePhone = (phone: string): string => {
    let clean = phone.replace(/\D/g, '');
    if (clean.length === 10 && !clean.startsWith('0')) {
        clean = clean.slice(0, 2) + '9' + clean.slice(2);
    }
    return clean;
};

const PublicAuthModal: React.FC<PublicAuthModalProps> = ({ onClose, onAuthenticated }) => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    // Campos
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Gera um email fictício a partir do telefone para usar no Supabase Auth
    const phoneToEmail = (p: string) => `${normalizePhone(p)}@belare.client`;

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!phone || !password) return;
        setLoading(true);

        try {
            const email = phoneToEmail(phone);
            const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

            if (authError) {
                if (authError.message.includes('Invalid login')) {
                    setError('WhatsApp ou senha incorretos.');
                } else {
                    setError(authError.message);
                }
                return;
            }

            if (data.user) {
                const cleanPhone = normalizePhone(phone);
                // Busca dados do cliente
                const { data: clientData } = await supabase
                    .from('clients')
                    .select('id, nome, whatsapp')
                    .eq('whatsapp', cleanPhone)
                    .maybeSingle();

                onAuthenticated({
                    name: clientData?.nome || data.user.user_metadata?.name || '',
                    phone: cleanPhone,
                    clientId: clientData?.id
                });
            }
        } catch (e: any) {
            setError('Erro ao fazer login. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name || !phone || !password) {
            setError('Preencha todos os campos.');
            return;
        }
        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        setLoading(true);
        const cleanPhone = normalizePhone(phone);
        const email = phoneToEmail(phone);

        try {
            // Cria conta no Supabase Auth
            const { data, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { name, phone: cleanPhone } }
            });

            if (authError) {
                if (authError.message.includes('already registered')) {
                    setError('Este WhatsApp já possui cadastro. Faça login.');
                    setMode('login');
                } else {
                    setError(authError.message);
                }
                return;
            }

            if (data.user) {
                onAuthenticated({ name, phone: cleanPhone });
            }
        } catch (e: any) {
            setError('Erro ao criar conta. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <header className="p-6 flex items-center justify-between border-b border-slate-50">
                    <div>
                        <h3 className="font-black text-slate-800">
                            {mode === 'login' ? 'Entrar na sua conta' : 'Criar conta'}
                        </h3>
                        <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mt-0.5">
                            {mode === 'login' ? 'Acesse seus agendamentos' : 'Cadastro rápido e gratuito'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                        <X size={22} />
                    </button>
                </header>

                <main className="p-6">
                    <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
                        {mode === 'register' && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seu Nome</label>
                                <div className="relative">
                                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Como devemos te chamar?"
                                        className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 transition-all font-bold text-slate-700 text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                            <div className="relative">
                                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder="(00) 00000-0000"
                                    className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 transition-all font-bold text-slate-700 text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : 'Sua senha'}
                                    className="w-full pl-10 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 transition-all font-bold text-slate-700 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {mode === 'register' && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirmar Senha</label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Repita a senha"
                                        className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 transition-all font-bold text-slate-700 text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl">
                                <p className="text-xs font-bold text-rose-600">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-orange-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 mt-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                            {mode === 'login' ? 'Entrar' : 'Criar Conta'}
                        </button>
                    </form>

                    <div className="mt-6 pt-4 border-t border-slate-50 text-center">
                        {mode === 'login' ? (
                            <p className="text-xs text-slate-500 font-medium">
                                Não tem conta?{' '}
                                <button onClick={() => { setMode('register'); setError(''); }} className="text-orange-500 font-black hover:text-orange-600 transition-colors">
                                    Cadastre-se grátis
                                </button>
                            </p>
                        ) : (
                            <p className="text-xs text-slate-500 font-medium">
                                Já tem conta?{' '}
                                <button onClick={() => { setMode('login'); setError(''); }} className="text-orange-500 font-black hover:text-orange-600 transition-colors">
                                    Fazer login
                                </button>
                            </p>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default PublicAuthModal;
