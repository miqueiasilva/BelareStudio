
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';

export default function ResetPasswordView() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
        setStatus('error');
        setMsg('A senha deve ter no mínimo 6 caracteres.');
        return;
    }
    if (password !== confirmPassword) {
        setStatus('error');
        setMsg('As senhas não coincidem.');
        return;
    }

    setStatus('loading');
    const { error } = await updatePassword(password);
    
    if (error) {
        setStatus('error');
        setMsg(error.message);
    } else {
        setStatus('success');
        setMsg('Senha atualizada com sucesso! Redirecionando para o app...');
        setTimeout(() => {
            window.location.href = '/'; // Reload to clear hash and go to dashboard
        }, 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Redefinir Senha</h2>
        <p className="text-slate-500 mb-6 text-sm">Digite sua nova senha abaixo para recuperar o acesso.</p>

        {status === 'success' ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center animate-in zoom-in-95">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="font-bold text-green-800">Sucesso!</h3>
                <p className="text-green-700 text-sm mt-1">{msg}</p>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
                {status === 'error' && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100">
                        <AlertTriangle size={16} /> {msg}
                    </div>
                )}
                
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nova Senha</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                        <input 
                            type="password" 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                            placeholder="••••••"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmar Senha</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                        <input 
                            type="password" 
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                            placeholder="••••••"
                            required
                        />
                    </div>
                </div>

                <button 
                    disabled={status === 'loading'}
                    className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl hover:bg-orange-600 transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-orange-200"
                >
                    {status === 'loading' ? <Loader2 className="animate-spin w-5 h-5" /> : 'Atualizar Senha'}
                    {status !== 'loading' && <ArrowRight size={18} />}
                </button>
            </form>
        )}
      </div>
    </div>
  );
}
