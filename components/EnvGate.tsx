
import React, { useState, useEffect } from 'react';
import { isConfigured, saveSupabaseConfig } from '../services/supabaseClient';
import { Database, Save, AlertTriangle } from 'lucide-react';

interface EnvGateProps {
  children: React.ReactNode;
}

const EnvGate: React.FC<EnvGateProps> = ({ children }) => {
  // Credenciais padrão sincronizadas com o client
  const [url, setUrl] = useState('https://rxtwmwrgcilmsldtqdfe.supabase.co');
  const [key, setKey] = useState('sb_publishable_jpVmCuQ3xmbWWcvgHn_H3g_Vypfyw0x');

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
          <h1 className="text-2xl font-bold text-slate-800">Configuração do Supabase</h1>
          <p className="text-slate-500 text-sm mt-2">
            As chaves de conexão não foram detectadas automaticamente. Confirme os dados abaixo para conectar ao banco de dados.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r mb-6">
            <div className="flex gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Esses dados serão salvos no <strong>LocalStorage</strong> para habilitar a conexão neste ambiente.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">
              Supabase URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-orange-50 font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">
              Anon Key
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-orange-50 font-medium"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-xl shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2 mt-4"
          >
            <Save size={18} />
            Conectar e Iniciar App
          </button>
        </form>
      </div>
    </div>
  );
};

export default EnvGate;
