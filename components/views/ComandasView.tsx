import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
    Search, Plus, Clock, User, FileText, 
    DollarSign, Coffee, Scissors, Trash2, ShoppingBag, X,
    CreditCard, Banknote, Smartphone, CheckCircle, Loader2,
    Receipt, History, LayoutGrid, CheckCircle2, AlertCircle, Edit2,
    Briefcase, ArrowRight, Eye
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { FinancialTransaction, PaymentMethod, Client, Command, CommandItem, LegacyProfessional } from '../../types';
import Toast, { ToastType } from '../shared/Toast';
import ClientSearchModal from '../modals/ClientSearchModal';

const ComandasView: React.FC<any> = ({ onAddTransaction, onNavigateToCommand }) => {
    const { activeStudioId } = useStudio();
    const [tabs, setTabs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentTab, setCurrentTab] = useState<'open' | 'paid'>('open');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);

    const fetchCommands = async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            if (currentTab === 'paid') {
                // Tenta carregar da view oficial
                const { data, error } = await supabase
                    .from('v_commands_paid_list')
                    .select('*')
                    .eq('studio_id', activeStudioId)
                    .order('paid_at', { ascending: false });
                
                if (error) {
                    console.warn("View v_commands_paid_list não encontrada, usando fallback manual.");
                    const { data: cmdData } = await supabase
                        .from('commands')
                        .select('*, clients:client_id(nome), items:command_items(*)')
                        .eq('studio_id', activeStudioId)
                        .eq('status', 'paid')
                        .is('deleted_at', null)
                        .order('created_at', { ascending: false });
                    
                    setTabs(cmdData?.map(c => ({
                        ...c,
                        client_display: c.clients?.nome || c.client_name || 'Consumidor Final',
                        command_items: c.items || []
                    })) || []);
                } else {
                    setTabs(data || []);
                }
            } else {
                const { data, error } = await supabase
                    .from('commands')
                    .select('*, clients:client_id(nome, photo_url), command_items(*)')
                    .eq('studio_id', activeStudioId)
                    .eq('status', 'open')
                    .is('deleted_at', null)
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                setTabs(data?.map(c => ({
                    ...c,
                    client_display: c.clients?.nome || c.client_name || 'Consumidor Final'
                })) || []);
            }
        } catch (e: any) {
            setToast({ message: "Erro ao sincronizar comandos.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCommands(); }, [currentTab, activeStudioId]);

    const handleActionClick = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation(); // Evita o clique do card pai se houver
        console.log("Abrindo comanda:", id);
        onNavigateToCommand?.(id);
    };

    // FIX: Added missing handleCreateCommand function to open a new command for a selected client.
    const handleCreateCommand = async (client: Client) => {
        if (!activeStudioId) return;
        setIsClientSearchOpen(false);
        setLoading(true);
        try {
            const { data: command, error: cmdError } = await supabase
                .from('commands')
                .insert([{
                    studio_id: activeStudioId,
                    client_id: client.id,
                    status: 'open',
                    total_amount: 0
                }])
                .select()
                .single();

            if (cmdError) throw cmdError;

            setToast({ message: `Comanda iniciada para ${client.nome}! 💳`, type: 'success' });
            onNavigateToCommand?.(command.id);
        } catch (e: any) {
            console.error("Falha ao iniciar comanda:", e);
            setToast({ message: "Erro ao iniciar comanda.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCommand = async (e: React.MouseEvent, commandId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm("Excluir esta comanda?")) return;
        try {
            const { error } = await supabase.from('commands').update({ deleted_at: new Date().toISOString(), status: 'canceled' }).eq('id', commandId);
            if (error) throw error;
            setTabs(prev => prev.filter(t => t.id !== commandId));
            setToast({ message: "Comanda removida.", type: 'info' });
        } catch (e) {}
    };

    const filteredTabs = tabs.filter(t => {
        const name = (t.client_display || '').toLowerCase();
        return name.includes(searchTerm.toLowerCase());
    });

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm flex-shrink-0 z-50">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 leading-none uppercase tracking-tighter"><FileText className="text-orange-500" size={24} /> Balcão / Comandas</h1>
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mt-2">
                        <button onClick={() => setCurrentTab('open')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${currentTab === 'open' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-50'}`}>Em Atendimento</button>
                        <button onClick={() => setCurrentTab('paid')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${currentTab === 'paid' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-50'}`}>Pagos / Arquivo</button>
                    </div>
                </div>
                <button onClick={() => setIsClientSearchOpen(true)} className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-black text-xs shadow-lg active:scale-95 uppercase tracking-widest flex items-center gap-2 z-50">
                    <Plus size={18} /> Iniciar Comanda
                </button>
            </header>

            <div className="p-4 bg-white border-b border-slate-100 flex-shrink-0 z-40">
                <div className="relative group max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5 group-focus-within:text-orange-500 transition-colors" />
                    <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:ring-4 focus:ring-orange-50 focus:border-orange-400 outline-none transition-all" />
                </div>
            </div>

            <main className="flex-1 overflow-y-auto p-6 custom-scrollbar relative z-10">
                {loading ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-orange-500" size={40} /></div> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24">
                        {filteredTabs.map(tab => (
                            <div key={tab.id} className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[380px] group transition-all hover:shadow-xl hover:border-orange-200 relative">
                                {/* CARD HEADER */}
                                <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xs flex-shrink-0 uppercase">
                                            {tab.photo_url || tab.clients?.photo_url ? <img src={tab.photo_url || tab.clients.photo_url} className="w-full h-full object-cover rounded-2xl" /> : (tab.client_display || 'C').charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-black text-slate-800 text-sm truncate uppercase tracking-tight">{tab.client_display}</h3>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">#{tab.id.split('-')[0].toUpperCase()}</span>
                                        </div>
                                    </div>
                                    
                                    {/* ACTION BUTTONS: Z-INDEX FORCED */}
                                    <div className="flex gap-1 relative z-30 pointer-events-auto">
                                        {tab.status === 'open' ? (
                                            <>
                                                <button 
                                                    onClick={(e) => handleActionClick(e, tab.id)}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-orange-600 uppercase hover:bg-orange-50 transition-colors shadow-sm active:scale-95"
                                                >
                                                    <Edit2 size={10} /> Editar
                                                </button>
                                                <button onClick={(e) => handleDeleteCommand(e, tab.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                                            </>
                                        ) : (
                                            <button 
                                                onClick={(e) => handleActionClick(e, tab.id)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-slate-400 uppercase hover:bg-slate-50 transition-colors shadow-sm active:scale-95"
                                            >
                                                <Eye size={10} /> Ver Detalhe
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-2 pointer-events-none">
                                    {tab.command_items?.map((item: any) => (
                                        <div key={item.id} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                                            <span className="text-xs font-bold text-slate-600 truncate flex-1 pr-2">{item.title}</span>
                                            <span className="text-xs font-black text-slate-800">R$ {Number(item.price).toFixed(2)}</span>
                                        </div>
                                    ))}
                                    {(!tab.command_items || tab.command_items.length === 0) && tab.status === 'open' && (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
                                            <ShoppingBag size={32} />
                                            <p className="text-[10px] font-black uppercase mt-2">Sem Consumo</p>
                                        </div>
                                    )}
                                    {tab.status === 'paid' && (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
                                            <Receipt size={32} />
                                            <p className="text-[10px] font-black uppercase mt-2">Comanda Paga</p>
                                            <p className="text-[8px] font-bold mt-1 uppercase">{tab.payment_method?.replace('_', ' ') || 'LIQUIDADO'}</p>
                                        </div>
                                    )}
                                </div>

                                {/* FOOTER ACTIONS */}
                                <div className="p-5 bg-slate-50/50 border-t border-slate-50 mt-auto">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Valor Total</p>
                                            <p className="text-2xl font-black text-slate-800">R$ {Number(tab.total_amount || 0).toFixed(2)}</p>
                                        </div>
                                        <button 
                                            onClick={(e) => handleActionClick(e, tab.id)}
                                            className={`p-3 rounded-2xl shadow-sm border border-slate-100 transition-all active:scale-95 z-30 pointer-events-auto ${tab.status === 'open' ? 'bg-white text-orange-500 hover:bg-orange-500 hover:text-white' : 'bg-slate-800 text-white opacity-80 hover:opacity-100'}`}
                                        >
                                            <ArrowRight size={20} strokeWidth={3} />
                                        </button>
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