
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Search, Plus, Clock, User, FileText, 
    DollarSign, Coffee, Scissors, Trash2, ShoppingBag, X,
    CreditCard, Banknote, Smartphone, CheckCircle, Loader2,
    Receipt, History, LayoutGrid, CheckCircle2, AlertCircle
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { FinancialTransaction, PaymentMethod, Client, Command, CommandItem } from '../../types';
import Toast, { ToastType } from '../shared/Toast';
import SelectionModal from '../modals/SelectionModal';
import ClientSearchModal from '../modals/ClientSearchModal';
import { differenceInMinutes, parseISO, format } from 'date-fns';

const ComandasView: React.FC<any> = ({ onAddTransaction }) => {
    const { activeStudioId } = useStudio();
    const [tabs, setTabs] = useState<Command[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentTab, setCurrentTab] = useState<'open' | 'paid'>('open');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const [isSelectionOpen, setIsSelectionOpen] = useState(false);
    const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    
    const [catalog, setCatalog] = useState<any[]>([]);

    const fetchCommands = async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('commands')
                .select('*, clients(*), command_items(*)')
                .eq('studio_id', activeStudioId)
                .eq('status', currentTab)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setTabs(data || []);
        } catch (e: any) {
            setToast({ message: "Erro ao carregar comandas.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const fetchCatalog = async () => {
        if (!activeStudioId) return;
        const [svcs, prods] = await Promise.all([
            supabase.from('services').select('id, nome, preco').eq('studio_id', activeStudioId).eq('ativo', true),
            supabase.from('products').select('id, name, price').eq('studio_id', activeStudioId).eq('active', true)
        ]);
        const items = [
            ...(svcs.data || []).map(s => ({ id: s.id, name: `[Serviço] ${s.nome}`, price: s.preco, type: 'servico' })),
            ...(prods.data || []).map(p => ({ id: p.id, name: `[Produto] ${p.name}`, price: p.price, type: 'produto' }))
        ];
        setCatalog(items);
    };

    useEffect(() => { fetchCommands(); fetchCatalog(); }, [currentTab, activeStudioId]);

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
        } catch (e: any) { setToast({ message: "Erro ao abrir comanda.", type: 'error' }); }
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredTabs.map(tab => (
                            <div key={tab.id} className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[400px]">
                                <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                    <h3 className="font-black text-slate-800 text-sm truncate">{tab.clients?.nome}</h3>
                                    <span className="text-[10px] font-black text-slate-400">#{tab.id.split('-')[0].toUpperCase()}</span>
                                </div>
                                <div className="flex-1 p-5 overflow-y-auto">
                                    {tab.command_items.map(item => (
                                        <div key={item.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                            <span className="text-xs font-bold text-slate-600 truncate flex-1 pr-2">{item.title}</span>
                                            <span className="text-xs font-black text-slate-800">R$ {Number(item.price).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-5 bg-slate-50/50 border-t border-slate-50">
                                    <div className="flex justify-between items-end">
                                        <div><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Total</p><p className="text-2xl font-black text-slate-800">R$ {Number(tab.total_amount).toFixed(2)}</p></div>
                                        {tab.status === 'open' && <button className="p-3 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"><Receipt size={20}/></button>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
            {isClientSearchOpen && <ClientSearchModal onClose={() => setIsClientSearchOpen(false)} onSelect={handleCreateCommand} onNewClient={() => {}} />}
        </div>
    );
};

export default ComandasView;
