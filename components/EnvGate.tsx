import React, { useState, useEffect } from 'react';
import { isConfigured, saveSupabaseConfig } from '../services/supabaseClient';
import { Database, Save, AlertTriangle, ShieldAlert } from 'lucide-react';

interface EnvGateProps {
  children: React.ReactNode;
}

const EnvGate: React.FC<EnvGateProps> = ({ children }) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');

  if (isConfigured) {
    return <>{children}</>;
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && key) {
      saveSupabaseConfig(url, key);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-[32px] shadow-2xl p-8 md:p-10 border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-orange-500"></div>
        
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 bg-orange-50 text-orange-500 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
            <ShieldAlert size={40} />
          </div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Conexão Necessária</h1>
          <p className="text-slate-500 text-sm mt-3 leading-relaxed">
            As chaves de acesso ao banco de dados não foram encontradas no ambiente de execução (Vercel).
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-[11px] text-amber-800 font-bold uppercase leading-tight">
                Dica: Configure as variáveis VITE_ no painel da Vercel para pular esta tela.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Supabase URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xyz.supabase.co"
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500 transition-all font-bold text-slate-700"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Anon Key
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsIn..."
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500 transition-all font-bold text-slate-700"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 mt-4 active:scale-[0.98]"
          >
            <Save size={20} />
            Salvar e Conectar
          </button>
        </form>
        
        <p className="text-center text-[9px] text-slate-300 font-bold uppercase tracking-[0.2em] mt-10">
          BelareStudio &bull; Gestão Inteligente
        </p>
      </div>
    </div>
  );
};

export default EnvGate;