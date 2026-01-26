
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
    Search, Plus, Clock, User, FileText, 
    DollarSign, Coffee, Scissors, Trash2, ShoppingBag, X,
    CreditCard, Banknote, Smartphone, CheckCircle, Loader2,
    Receipt, History, LayoutGrid, CheckCircle2, AlertCircle, Edit2,
    Briefcase, ArrowRight
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

    const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
    const [isProfSelectionOpen, setIsProfSelectionOpen] = useState(false);
    const [editingCommand, setEditingCommand] = useState<Command | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);

    const fetchCommands = async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('commands')
                .select('*, clients(nome, photo_url), command_items(*)')
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
            const { data } = await supabase.from('team_members').select('id, name').eq('studio_id', activeStudioId).eq('active', true);
            if (data) setProfessionals(data.map(p => ({ id: p.id, name: p.name, avatarUrl: '' })));
        } catch (e) {}
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
                .insert([{ studio_id: activeStudioId, client_id: client.id, client_name: client.nome, status: 'open' }])
                .select('*, clients(nome), command_items(*)')
                .single();
            if (error) throw error;
            setTabs(prev => [data, ...prev]);
            setToast({ message: `Comanda aberta!`, type: 'success' });
            onNavigateToCommand?.(data.id);
        } catch (e: any) { 
            setToast({ message: "Erro ao abrir comanda.", type: 'error' }); 
        }
    };

    const handleDeleteCommand = async (e: React.MouseEvent, commandId: string) => {
        e.stopPropagation();
        if (!window.confirm("Excluir esta comanda?")) return;
        try {
            const { error } = await supabase.from('commands').update({ deleted_at: new Date().toISOString(), status: 'canceled' }).eq('id', commandId);
            if (error) throw error;
            setTabs(prev => prev.filter(t => t.id !== commandId));
            setToast({ message: "Removida.", type: 'info' });
        } catch (e) {}
    };

    const filteredTabs = tabs.filter(t => {
        const name = (t.clients?.nome || t.client_name || '').toLowerCase();
        return name.includes(searchTerm.toLowerCase());
    });

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm flex-shrink-0">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 leading-none uppercase tracking-tighter"><FileText className="text-orange-500" size={24} /> Balcão / Comandas</h1>
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mt-2">
                        <button onClick={() => setCurrentTab('open')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${currentTab === 'open' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500'}`}>Em Atendimento</button>
                        <button onClick={() => setCurrentTab('paid')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${currentTab === 'paid' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500'}`}>Pagos / Arquivo</button>
                    </div>
                </div>
                <button onClick={() => setIsClientSearchOpen(true)} className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-black text-xs shadow-lg shadow-orange-100 active:scale-95 uppercase tracking-widest flex items-center gap-2">
                    <Plus size={18} /> Iniciar Comanda
                </button>
            </header>

            <div className="p-4 bg-white border-b border-slate-100 flex-shrink-0">
                <div className="relative group max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5 group-focus-within:text-orange-500 transition-colors" />
                    <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:ring-4 focus:ring-orange-50 focus:border-orange-400 outline-none transition-all" />
                </div>
            </div>

            <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {loading ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-orange-500" size={40} /></div> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24">
                        {filteredTabs.map(tab => (
                            <div key={tab.id} onClick={() => onNavigateToCommand?.(tab.id)} className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[380px] group transition-all hover:shadow-xl hover:border-orange-200 cursor-pointer">
                                <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xs flex-shrink-0 uppercase">
                                            {tab.clients?.photo_url ? <img src={tab.clients.photo_url} className="w-full h-full object-cover rounded-2xl" /> : (tab.clients?.nome || tab.client_name || '?').charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-black text-slate-800 text-sm truncate uppercase tracking-tight">{tab.clients?.nome || tab.client_name}</h3>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">#{tab.id.split('-')[0].toUpperCase()}</span>
                                        </div>
                                    </div>
                                    {tab.status === 'open' && (
                                        <button onClick={(e) => handleDeleteCommand(e, tab.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                                    )}
                                </div>

                                <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-2">
                                    {tab.command_items.map(item => (
                                        <div key={item.id} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                                            <span className="text-xs font-bold text-slate-600 truncate flex-1 pr-2">{item.title}</span>
                                            <span className="text-xs font-black text-slate-800">R$ {Number(item.price).toFixed(2)}</span>
                                        </div>
                                    ))}
                                    {tab.command_items.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
                                            <ShoppingBag size={32} />
                                            <p className="text-[10px] font-black uppercase mt-2">Sem Consumo</p>
                                        </div>
                                    )}
                                </div>

                                <div className="p-5 bg-slate-50/50 border-t border-slate-50">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Valor Total</p>
                                            <p className="text-2xl font-black text-slate-800">R$ {Number(tab.total_amount || 0).toFixed(2)}</p>
                                        </div>
                                        <div className="bg-white p-3 rounded-2xl shadow-sm text-orange-500 border border-slate-100 group-hover:bg-orange-500 group-hover:text-white transition-all active:scale-95">
                                            <ArrowRight size={20} strokeWidth={3} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {isClientSearchOpen && (
                <ClientSearchModal 
                    onClose={() => setIsClientSearchOpen(false)} 
                    onSelect={handleCreateCommand} 
                    onNewClient={() => {}} 
                />
            )}
        </div>
    );
};

export default ComandasView;
