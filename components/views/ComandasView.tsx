import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
    Search, Plus, Clock, User, FileText, 
    DollarSign, Coffee, Scissors, Trash2, ShoppingBag, X,
    CreditCard, Banknote, Smartphone, CheckCircle, Loader2,
    Receipt, History, LayoutGrid, CheckCircle2, AlertCircle, Edit2,
    Briefcase
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { FinancialTransaction, PaymentMethod, Client, Command, CommandItem, LegacyProfessional } from '../../types';
import Toast, { ToastType } from '../shared/Toast';
import SelectionModal from '../modals/SelectionModal';
import ClientSearchModal from '../modals/ClientSearchModal';
import { differenceInMinutes, format } from 'date-fns';

const ComandasView: React.FC<any> = ({ onAddTransaction, onNavigateToCommand }) => {
    const { activeStudioId } = useStudio();
    const [tabs, setTabs] = useState<Command[]>([]);
    const [professionals, setProfessionals] = useState<LegacyProfessional[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentTab, setCurrentTab] = useState<'open' | 'paid'>('open');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Modais de Seleção
    const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
    const [isProfSelectionOpen, setIsProfSelectionOpen] = useState(false);
    
    // Estados de Edição
    const [editingCommand, setEditingCommand] = useState<Command | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);

    const fetchCommands = async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            // Regra: Filtrar comandos não deletados (deleted_at IS NULL)
            const { data, error } = await supabase
                .from('commands')
                .select('*, clients(*), command_items(*)')
                .eq('studio_id', activeStudioId)
                .eq('status', currentTab)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setTabs(data || []);
        } catch (e: any) {
            setToast({ message: "Erro ao carregar comandas.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const fetchProfessionals = async () => {
        if (!activeStudioId) return;
        try {
            const { data, error } = await supabase
                .from('team_members')
                .select('id, name')
                .eq('studio_id', activeStudioId)
                .eq('active', true);
            if (error) throw error;
            setProfessionals(data.map(p => ({ id: p.id, name: p.name, avatarUrl: '' })));
        } catch (e) {
            console.error("Erro ao carregar profissionais:", e);
        }
    };

    useEffect(() => { 
        fetchCommands(); 
        fetchProfessionals();
    }, [currentTab, activeStudioId]);

    const handleCreateCommand = async (client: Client) => {
        if (!activeStudioId) return;
        setIsClientSearchOpen(false);
        try {
            const { data, error } = await supabase
                .from('commands')
                .insert([{ studio_id: activeStudioId, client_id: client.id, status: 'open' }])
                .select('*, clients(*), command_items(*)')
                .single();
            if (error) throw error;
            setTabs(prev => [data, ...prev]);
            setToast({ message: `Comanda aberta!`, type: 'success' });
        } catch (e: any) { 
            setToast({ message: "Erro ao abrir comanda.", type: 'error' }); 
        }
    };

    const handleDeleteCommand = async (e: React.MouseEvent, commandId: string) => {
        e.stopPropagation();
        if (!window.confirm("Deseja realmente excluir esta comanda? Esta ação é irreversível.")) return;

        setIsActionLoading(true);
        try {
            // Soft Delete conforme especificado
            const { error } = await supabase
                .from('commands')
                .update({ 
                    status: 'canceled', 
                    deleted_at: new Date().toISOString() 
                })
                .eq('id', commandId);

            if (error) throw error;

            setTabs(prev => prev.filter(t => t.id !== commandId));
            setToast({ message: "Comanda excluída com sucesso.", type: 'info' });
        } catch (e: any) {
            setToast({ message: "Erro ao excluir comanda.", type: 'error' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleStartEdit = (e: React.MouseEvent, command: Command) => {
        e.stopPropagation();
        setEditingCommand(command);
    };

    const handleUpdateCommandClient = async (client: Client) => {
        if (!editingCommand) return;
        
        setIsActionLoading(true);
        try {
            const { error } = await supabase
                .from('commands')
                .update({ client_id: client.id })
                .eq('id', editingCommand.id);

            if (error) throw error;

            setToast({ message: "Cliente da comanda atualizado!", type: 'success' });
            fetchCommands();
            setEditingCommand(null);
        } catch (e: any) {
            setToast({ message: "Erro ao atualizar cliente.", type: 'error' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleUpdateCommandProfessional = async (prof: any) => {
        if (!editingCommand) return;
        
        setIsActionLoading(true);
        try {
            const { error } = await supabase
                .from('commands')
                .update({ professional_id: prof.id })
                .eq('id', editingCommand.id);

            if (error) throw error;

            setToast({ message: "Profissional da comanda atualizado!", type: 'success' });
            fetchCommands();
            setEditingCommand(null);
            setIsProfSelectionOpen(false);
        } catch (e: any) {
            setToast({ message: "Erro ao atualizar profissional.", type: 'error' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const filteredTabs = tabs.filter(t => (t.clients?.nome || '').toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><FileText className="text-orange-500" /> Comandas</h1>
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mt-2">
                        <button onClick={() => setCurrentTab('open')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${currentTab === 'open' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500'}`}>ABERTAS</button>
                        <button onClick={() => setCurrentTab('paid')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${currentTab === 'paid' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500'}`}>HISTÓRICO</button>
                    </div>
                </div>
                <button onClick={() => setIsClientSearchOpen(true)} className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-black text-xs shadow-lg active:scale-95 uppercase tracking-widest">ABRIR COMANDA</button>
            </header>

            <div className="p-4 bg-white border-b border-slate-100">
                <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full max-w-md px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
            </div>

            <main className="flex-1 overflow-y-auto p-6">
                {loading ? <div className="flex justify-center p-20"><Loader2 className="animate-spin text-orange-500" /></div> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                        {filteredTabs.map(tab => (
                            <div key={tab.id} className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[400px] group transition-all hover:shadow-md">
                                <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                    <div className="flex-1 min-w-0 mr-2">
                                        <h3 className="font-black text-slate-800 text-sm truncate">{tab.clients?.nome}</h3>
                                        <span className="text-[10px] font-black text-slate-400">#{tab.id.split('-')[0].toUpperCase()}</span>
                                    </div>
                                    
                                    {tab.status === 'open' && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => handleStartEdit(e, tab)}
                                                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar comanda"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button 
                                                onClick={(e) => handleDeleteCommand(e, tab.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                title="Excluir comanda"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
                                    {tab.command_items.length > 0 ? tab.command_items.map(item => (
                                        <div key={item.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                            <span className="text-xs font-bold text-slate-600 truncate flex-1 pr-2">{item.title}</span>
                                            <span className="text-xs font-black text-slate-800">R$ {Number(item.price).toFixed(2)}</span>
                                        </div>
                                    )) : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
                                            <ShoppingBag size={32} />
                                            <p className="text-[10px] font-black uppercase mt-2">Vazia</p>
                                        </div>
                                    )}
                                </div>

                                <div className="p-5 bg-slate-50/50 border-t border-slate-50">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Total</p>
                                            <p className="text-2xl font-black text-slate-800">R$ {Number(tab.total_amount || 0).toFixed(2)}</p>
                                        </div>
                                        {tab.status === 'open' && (
                                            <button 
                                                onClick={() => onNavigateToCommand?.(tab.id)}
                                                className="p-3 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                                                title="Ir para checkout"
                                            >
                                                <Receipt size={20}/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* MODAL DE EDIÇÃO (Simplificado) */}
            {editingCommand && (
                <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
                        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Editar Comanda</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">#{editingCommand.id.split('-')[0].toUpperCase()}</p>
                            </div>
                            <button onClick={() => setEditingCommand(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={24} /></button>
                        </header>
                        
                        <div className="p-8 space-y-6 text-left">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alterar Cliente</label>
                                <button 
                                    onClick={() => setIsClientSearchOpen(true)}
                                    className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-white transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <User size={18} className="text-orange-500" />
                                        <span className="font-bold text-slate-700">{editingCommand.clients?.nome}</span>
                                    </div>
                                    <Edit2 size={14} className="text-slate-300 group-hover:text-orange-500" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alterar Profissional</label>
                                <button 
                                    onClick={() => setIsProfSelectionOpen(true)}
                                    className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-white transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <Briefcase size={18} className="text-blue-500" />
                                        <span className="font-bold text-slate-700">Trocar Atendimento</span>
                                    </div>
                                    <Edit2 size={14} className="text-slate-300 group-hover:text-blue-500" />
                                </button>
                            </div>
                        </div>

                        <footer className="p-8 bg-slate-50 border-t border-slate-100">
                            <button 
                                onClick={() => setEditingCommand(null)}
                                className="w-full py-4 text-slate-400 font-black uppercase tracking-widest text-xs hover:bg-slate-200 rounded-2xl transition-all"
                            >
                                Fechar
                            </button>
                        </footer>
                    </div>
                </div>
            )}

            {isClientSearchOpen && (
                <ClientSearchModal 
                    onClose={() => setIsClientSearchOpen(false)} 
                    onSelect={editingCommand ? handleUpdateCommandClient : handleCreateCommand} 
                    onNewClient={() => {}} 
                />
            )}

            {isProfSelectionOpen && (
                <div className="fixed inset-0 z-[150] bg-white flex flex-col">
                    <SelectionModal 
                        title="Selecione o Profissional"
                        items={professionals}
                        onClose={() => setIsProfSelectionOpen(false)}
                        onSelect={handleUpdateCommandProfessional}
                        searchPlaceholder="Buscar profissional..."
                        renderItemIcon={() => <User size={20} />}
                    />
                </div>
            )}
        </div>
    );
};

export default ComandasView;