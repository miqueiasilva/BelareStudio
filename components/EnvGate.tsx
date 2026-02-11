import React, { useState, useEffect } from 'react';
import { isConfigured, saveSupabaseConfig } from '../services/supabaseClient';
import { Database, Save, AlertTriangle } from 'lucide-react';

interface EnvGateProps {
  children: React.ReactNode;
}

const EnvGate: React.FC<EnvGateProps> = ({ children }) => {
  // Configuração automática: Credenciais do Supabase preenchidas
  const [url, setUrl] = useState('https://rxtwmwrgcilmsldtqdfe.supabase.co');
  const [key, setKey] = useState('sb_publishable_jpVmCuQ3xmbWWcvgHn_H3g_Vypfyw0x');

  useEffect(() => {
    // Log para depuração em produção se necessário
    if (!isConfigured) console.log('EnvGate: Aguardando configuração do Supabase...');
  }, []);

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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4">
            <Database size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Configuração Necessária</h1>
          <p className="text-slate-500 text-sm mt-2">
            As variáveis de ambiente do Supabase não foram detectadas. Por favor, confirme as configurações abaixo para continuar.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r mb-6">
            <div className="flex gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Esses dados serão salvos no <strong>LocalStorage</strong> do seu navegador para habilitar a conexão neste ambiente.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Supabase URL (VITE_SUPABASE_URL)
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xyz.supabase.co"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Supabase Anon Key (VITE_SUPABASE_ANON_KEY)
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2 mt-4"
          >
            <Save size={18} />
            Salvar e Conectar
          </button>
        </form>
      </div>
    </div>
  );
};

export default EnvGate;