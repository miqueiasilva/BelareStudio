import React, { useState, useEffect } from 'react';
import { X, Search, Users, ShieldAlert, ArrowRight, Loader2, CheckCircle2, Phone, User, Calendar, Trash2 } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { Client } from '../../types';
import { toast } from 'sonner';

interface UnificarModalProps {
  currentClient: Client;
  onClose: () => void;
  onMergeSuccess: (primaryClientId: number) => void;
}

export const UnificarModal: React.FC<UnificarModalProps> = ({ currentClient, onClose, onMergeSuccess }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchedClients, setSearchedClients] = useState<Client[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedMergeTarget, setSelectedMergeTarget] = useState<Client | null>(null);
  
  // State for which client is primary (to remain) and secondary (to be purged)
  const [primaryId, setPrimaryId] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (currentClient?.id) {
       setPrimaryId(Number(currentClient.id));
    }
  }, [currentClient]);

  // Search for other clients to merge with
  const handleSearch = async (val: string) => {
    setSearchTerm(val);
    if (!val.trim()) {
      setSearchedClients([]);
      return;
    }

    setLoadingSearch(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('studio_id', currentClient.studio_id)
        .neq('id', currentClient.id) // Exclude current client
        .or(`nome.ilike.%${val}%,whatsapp.ilike.%${val}%,telefone.ilike.%${val}%,apelido.ilike.%${val}%`)
        .limit(6);

      if (error) throw error;
      setSearchedClients(data || []);
    } catch (err) {
      console.error("Erro ao buscar clientes duplicados:", err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSelectTarget = (target: Client) => {
    setSelectedMergeTarget(target);
    // Default to currentClient as primary
    setPrimaryId(Number(currentClient.id));
  };

  const executeMerge = async () => {
    if (!selectedMergeTarget || !primaryId || !currentClient.id) return;
    
    const targetId = Number(selectedMergeTarget.id);
    const sourceId = primaryId === Number(currentClient.id) ? targetId : Number(currentClient.id);
    const destId = primaryId;

    const primaryClientObj = primaryId === Number(currentClient.id) ? currentClient : selectedMergeTarget;
    const secondaryClientObj = primaryId === Number(currentClient.id) ? selectedMergeTarget : currentClient;

    setMerging(true);
    const toastId = toast.loading('Mesclando e unificando cadastros no banco...');

    try {
      // 1. Re-route appointments
      const { error: apptError } = await supabase
        .from('appointments')
        .update({ client_id: destId })
        .eq('client_id', sourceId);
      if (apptError) console.warn('Erro ao atualizar agendamentos no merge:', apptError);

      // 2. Re-route client photos
      const { error: photoError } = await supabase
        .from('client_photos')
        .update({ client_id: destId })
        .eq('client_id', sourceId);
      if (photoError) console.warn('Erro ao atualizar fotos no merge:', photoError);

      // 3. Re-route commands (Comandas)
      const { error: cmdError } = await supabase
        .from('commands')
        .update({ client_id: destId })
        .eq('client_id', sourceId);
      if (cmdError) console.warn('Erro ao atualizar comandas no merge:', cmdError);

      // 4. Re-route financial transactions
      const { error: finError } = await supabase
        .from('financial_transactions')
        .update({ client_id: destId })
        .eq('client_id', sourceId);
      if (finError) console.warn('Erro ao atualizar financeiro no merge:', finError);

      // 5. Merge Anamnesis
      const { data: sourceAnamnesis } = await supabase
        .from('client_anamnesis')
        .select('*')
        .eq('client_id', sourceId)
        .maybeSingle();

      const { data: destAnamnesis } = await supabase
        .from('client_anamnesis')
        .select('*')
        .eq('client_id', destId)
        .maybeSingle();

      if (sourceAnamnesis) {
        if (!destAnamnesis) {
          // If destination doesn't have an anamnesis record, just change the owner of the source anamnesis record
          const { error: anamnesisMoveError } = await supabase
            .from('client_anamnesis')
            .update({ client_id: destId })
            .eq('client_id', sourceId);
          if (anamnesisMoveError) console.warn('Erro ao mover anamnese:', anamnesisMoveError);
        } else {
          // Both have anamnesis, we combine notes and keep destination's fields, then delete the source one
          const combinedNotes = `${destAnamnesis.clinical_notes || ''}\n\n--- Notas de Anamnese Unificada ---\n${sourceAnamnesis.clinical_notes || ''}`.trim();
          
          await supabase
            .from('client_anamnesis')
            .update({ clinical_notes: combinedNotes })
            .eq('client_id', destId);

          await supabase
            .from('client_anamnesis')
            .delete()
            .eq('client_id', sourceId);
        }
      }

      // 6. Merge Client profile fields (fill missing fields in primary client)
      const updatedFields: any = {};
      const fieldsToCheck = [
        'whatsapp', 'telefone', 'email', 'nascimento', 'cpf', 'rg', 
        'sexo', 'profissao', 'cep', 'endereco', 'numero', 'complemento', 
        'bairro', 'cidade', 'estado', 'apelido', 'instagram', 'photo_url', 'observacoes'
      ];

      fieldsToCheck.forEach(field => {
        const primVal = (primaryClientObj as any)[field];
        const secVal = (secondaryClientObj as any)[field];
        if ((primVal === null || primVal === undefined || primVal === '') && (secVal !== null && secVal !== undefined && secVal !== '')) {
          updatedFields[field] = secVal;
        }
      });

      if (Object.keys(updatedFields).length > 0) {
        await supabase
          .from('clients')
          .update(updatedFields)
          .eq('id', destId);
      }

      // 7. Delete source client
      const { error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', sourceId);

      if (deleteError) throw deleteError;

      toast.success('Unificação realizada com sucesso!', { id: toastId });
      onMergeSuccess(destId);
    } catch (err: any) {
      console.error('Erro crítico ao unificar cadastros:', err);
      toast.error(`Falha no processo de unificação: ${err.message || 'Erro desconhecido'}`, { id: toastId });
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[90vh]">
        
        <header className="p-6 border-b border-slate-50 flex justify-between items-center bg-orange-50/10">
          <div>
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Users className="text-orange-500" size={22} /> Unificar Cadastro de Cliente
            </h3>
            <p className="text-xs text-slate-400 font-medium">Resolva cadastros duplicados mesclando dados e históricos de atendimento.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-all">
            <X size={18} />
          </button>
        </header>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {!selectedMergeTarget ? (
            <div className="space-y-4">
              <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100/60 flex gap-3 text-orange-800 text-xs font-bold leading-relaxed">
                <ShieldAlert size={18} className="flex-shrink-0 mt-0.5" />
                <p>
                  Você está prestes a unificar o cadastro de <strong className="font-extrabold">{currentClient.nome}</strong>. 
                  Pesquise e selecione abaixo o outro cadastro com o qual deseja fazer a fusão.
                </p>
              </div>

              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Buscar duplicado por nome, apelido, telefone..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-100 focus:border-orange-400 outline-none font-bold text-sm"
                />
              </div>

              {loadingSearch ? (
                <div className="py-8 flex justify-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <Loader2 size={20} className="animate-spin text-orange-500 mr-2" /> Buscando concorrentes...
                </div>
              ) : searchedClients.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {searchedClients.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => handleSelectTarget(c)}
                      className="p-3 border border-slate-100 hover:border-orange-200 hover:bg-orange-50/20 rounded-2xl flex items-center justify-between cursor-pointer transition-all active:scale-98"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center font-black text-xs">
                          {c.nome[0].toUpperCase()}
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-extrabold text-slate-700 leading-snug">{c.nome} {c.apelido && <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-1 rounded">"{c.apelido}"</span>}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{c.whatsapp || c.telefone || 'Sem contato'}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider">Selecionar</span>
                    </div>
                  ))}
                </div>
              ) : searchTerm ? (
                <div className="py-8 text-center text-slate-400 text-xs font-bold">Nenhum outro cliente encontrado com esse termo.</div>
              ) : (
                <div className="py-8 text-center text-slate-300 text-xs font-medium">Digite algo para procurar possíveis duplicidades.</div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-xs font-semibold text-slate-500 text-center">
                Selecione abaixo qual perfil deve ser <strong className="text-orange-500 uppercase">MANTIDO (Principal)</strong>. O outro será excluído permanente após as transferências.
              </div>

              {/* Side-by-Side comparison cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Current Client */}
                <div 
                  onClick={() => setPrimaryId(Number(currentClient.id))}
                  className={`p-4 border rounded-3xl cursor-pointer transition-all relative ${
                    primaryId === Number(currentClient.id) 
                      ? 'border-orange-500 bg-orange-50/20 ring-4 ring-orange-50' 
                      : 'border-slate-100 hover:border-slate-200 bg-white'
                  }`}
                >
                  <div className="absolute top-4 right-4 flex items-center justify-center">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${primaryId === Number(currentClient.id) ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300'}`}>
                      {primaryId === Number(currentClient.id) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                  </div>

                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Perfil A (Este que você abriu)</span>
                  <p className="text-sm font-extrabold text-slate-800 leading-snug mt-2">{currentClient.nome}</p>
                  
                  <div className="mt-4 space-y-1.5 text-[11px] font-bold text-slate-500">
                    <div className="flex items-center gap-1.5"><Phone size={11} className="text-slate-300" /> {currentClient.whatsapp || currentClient.telefone || 'Sem contato'}</div>
                    <div className="flex items-center gap-1.5"><Calendar size={11} className="text-slate-300" /> {currentClient.nascimento || 'Sem nascimento'}</div>
                    {currentClient.email && <div className="overflow-hidden text-ellipsis whitespace-nowrap">{currentClient.email}</div>}
                  </div>
                  
                  <p className={`mt-4 text-[9px] font-black uppercase text-center py-1 rounded-lg ${
                    primaryId === Number(currentClient.id) ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-400'
                  }`}>
                    {primaryId === Number(currentClient.id) ? 'Principal (Manter)' : 'Secundário (Deletar)'}
                  </p>
                </div>

                {/* Target Client */}
                <div 
                  onClick={() => setPrimaryId(Number(selectedMergeTarget.id))}
                  className={`p-4 border rounded-3xl cursor-pointer transition-all relative ${
                    primaryId === Number(selectedMergeTarget.id) 
                      ? 'border-orange-500 bg-orange-50/20 ring-4 ring-orange-50' 
                      : 'border-slate-100 hover:border-slate-200 bg-white'
                  }`}
                >
                  <div className="absolute top-4 right-4 flex items-center justify-center">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${primaryId === Number(selectedMergeTarget.id) ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300'}`}>
                      {primaryId === Number(selectedMergeTarget.id) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                  </div>

                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Perfil B (Selecionado)</span>
                  <p className="text-sm font-extrabold text-slate-800 leading-snug mt-2">{selectedMergeTarget.nome}</p>
                  
                  <div className="mt-4 space-y-1.5 text-[11px] font-bold text-slate-500">
                    <div className="flex items-center gap-1.5"><Phone size={11} className="text-slate-300" /> {selectedMergeTarget.whatsapp || selectedMergeTarget.telefone || 'Sem contato'}</div>
                    <div className="flex items-center gap-1.5"><Calendar size={11} className="text-slate-300" /> {selectedMergeTarget.nascimento || 'Sem nascimento'}</div>
                    {selectedMergeTarget.email && <div className="overflow-hidden text-ellipsis whitespace-nowrap">{selectedMergeTarget.email}</div>}
                  </div>
                  
                  <p className={`mt-4 text-[9px] font-black uppercase text-center py-1 rounded-lg ${
                    primaryId === Number(selectedMergeTarget.id) ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-400'
                  }`}>
                    {primaryId === Number(selectedMergeTarget.id) ? 'Principal (Manter)' : 'Secundário (Deletar)'}
                  </p>
                </div>
              </div>

              {/* Merge details reminder */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-600">O que acontece durante a unificação?</h4>
                <ul className="text-[11px] font-bold text-slate-500 space-y-1 pl-4 list-disc leading-relaxed text-left">
                  <li>Todos os <strong className="text-slate-700">agendamentos e comandas</strong> serão migrados para o Principal.</li>
                  <li>Todas as <strong className="text-slate-750">fotos da galeria de evolução</strong> serão transferidas.</li>
                  <li>As <strong className="text-slate-700">fichas de anamnese</strong> serão combinadas e mescladas.</li>
                  <li>Quaisquer campos em branco do Principal serão autocompletados com dados do Secundário.</li>
                  <li>O cadastro Secundário será <strong className="text-rose-500">deletado permanentemente</strong> do banco.</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedMergeTarget(null)}
                  disabled={merging}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-2xl text-xs transition-colors"
                >
                  Voltar para busca
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button 
            onClick={onClose} 
            disabled={merging}
            className="px-6 py-3 rounded-2xl text-slate-500 font-bold hover:bg-slate-200 transition-all text-xs"
          >
            Cancelar
          </button>
          
          {selectedMergeTarget && (
            <button
              onClick={executeMerge}
              disabled={merging}
              className="px-8 py-3 rounded-2xl bg-orange-600 text-white font-black shadow-xl shadow-orange-100 hover:bg-orange-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 text-xs"
            >
              {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 size={16} />}
              {merging ? 'Processando Unificação...' : 'Confirmar Unificação'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};
