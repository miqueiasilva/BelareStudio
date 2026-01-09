
import React, { useState, useEffect, useRef } from 'react';
import { X, Search, User, ChevronRight, Plus, Loader2, UserPlus } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { Client } from '../../types';

interface ClientSearchModalProps {
  onClose: () => void;
  onSelect: (client: Client) => void;
  onNewClient: () => void;
}

const ClientSearchModal: React.FC<ClientSearchModalProps> = ({ onClose, onSelect, onNewClient }) => {
  const { activeStudioId } = useStudio();
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lógica de busca com Debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      searchClients(searchTerm);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, activeStudioId]);

  const searchClients = async (term: string) => {
    if (!activeStudioId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('clients')
        .select('id, nome, whatsapp, email')
        .eq('studio_id', activeStudioId)
        .limit(20);

      if (term.trim()) {
        // Busca filtrada
        query = query.ilike('nome', `%${term}%`);
      } else {
        // Estado inicial: Recentes
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error("Erro na busca de clientes:", err);
    } finally {
      setLoading(false);
    }
  };

  // Focar o input automaticamente ao abrir
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="absolute inset-0 bg-white z-[100] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
      <header className="flex-shrink-0 flex items-center p-4 border-b bg-white">
        <div className="flex-1"></div>
        <h2 className="flex-1 text-lg font-black text-center text-slate-800 uppercase tracking-tighter">Selecionar Cliente</h2>
        <div className="flex-1 flex justify-end gap-2">
            <button 
                onClick={(e) => { e.stopPropagation(); onNewClient(); }}
                className="p-2 text-orange-600 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors"
                title="Novo Cliente"
            >
                <UserPlus size={22} />
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
                <X size={24} />
            </button>
        </div>
      </header>

      <div className="p-4 border-b bg-slate-50/50">
        <div className="relative group max-w-lg mx-auto">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {loading ? (
                <Loader2 size={18} className="text-orange-500 animate-spin" />
            ) : (
                <Search size={18} className="text-slate-400 group-focus-within:text-orange-500 transition-colors" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Digite o nome para buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 border-2 border-slate-200 rounded-2xl bg-white focus:ring-4 focus:ring-orange-100 focus:border-orange-400 outline-none font-bold text-slate-700 transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {clients.length > 0 ? (
          <ul className="divide-y divide-slate-50">
            {clients.map(client => (
              <li key={client.id}>
                <button
                  type="button"
                  onClick={() => onSelect(client)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-orange-50/50 transition-colors group active:bg-orange-100"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-black text-sm group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                        {client.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-black text-slate-700 group-hover:text-orange-700 transition-colors">{client.nome}</p>
                        <p className="text-xs text-slate-400 font-bold tracking-tighter uppercase">{client.whatsapp || 'Sem WhatsApp'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300 group-hover:text-orange-500 transition-colors">
                    <ChevronRight size={20} strokeWidth={3} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : !loading && (
          <div className="p-20 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-200">
                <Search size={40} />
            </div>
            <h3 className="font-black text-slate-700">Nenhum cliente encontrado</h3>
            <p className="text-slate-400 text-sm mt-1 uppercase font-bold tracking-tighter">Tente um nome diferente ou cadastre um novo.</p>
            <button 
                onClick={onNewClient}
                className="mt-6 px-6 py-3 bg-orange-500 text-white rounded-xl font-black shadow-lg shadow-orange-100 hover:bg-orange-600 active:scale-95 transition-all"
            >
                Cadastrar "{searchTerm}"
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientSearchModal;
