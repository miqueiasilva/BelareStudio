
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Search, Plus, Clock, User, FileText, 
    DollarSign, Coffee, Scissors, Trash2, ShoppingBag, X,
    CreditCard, Banknote, Smartphone, CheckCircle, Loader2,
    Receipt
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { FinancialTransaction, PaymentMethod, Client, Command, CommandItem } from '../../types';
import Toast, { ToastType } from '../shared/Toast';
import SelectionModal from '../modals/SelectionModal';
import ClientSearchModal from '../modals/ClientSearchModal';
import { differenceInMinutes, parseISO, format } from 'date-fns';

interface ComandasViewProps {
    onAddTransaction: (t: FinancialTransaction) => void;
}

const ComandasView: React.FC<ComandasViewProps> = ({ onAddTransaction }) => {
    const [tabs, setTabs] = useState<Command[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Modals State
    const [isSelectionOpen, setIsSelectionOpen] = useState(false);
    const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    
    // Close Tab Modal State
    const [closingTab, setClosingTab] = useState<Command | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
    const [isFinishing, setIsFinishing] = useState(false);

    // Dados de Catálogo para Adição
    const [catalog, setCatalog] = useState<any[]>([]);

    const fetchCommands = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('commands')
                .select('*, clients(nome), command_items(*)')
                .eq('status', 'open')
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
        const [svcs, prods] = await Promise.all([
            supabase.from('services').select('id, nome, preco').eq('ativo', true),
            supabase.from('products').select('id, name, price').eq('active', true)
        ]);

        const items = [
            ...(svcs.data || []).map(s => ({ id: s.id, name: `[Serviço] ${s.nome}`, price: s.preco, type: 'servico' })),
            ...(prods.data || []).map(p => ({ id: p.id, name: `[Produto] ${p.name}`, price: p.price, type: 'produto' }))
        ];
        setCatalog(items);
    };

    useEffect(() => {
        fetchCommands();
        fetchCatalog();
    }, []);

    // --- Handlers ---

    const handleCreateCommand = async (client: Client) => {
        setIsClientSearchOpen(false);
        try {
            const { data, error } = await supabase
                .from('commands')
                .insert([{ client_id: client.id, status: 'open' }])
                .select('*, clients(nome), command_items(*)')
                .single();

            if (error) throw error;
            setTabs(prev => [data, ...prev]);
            setToast({ message: `Comanda de ${client.nome} aberta!`, type: 'success' });
        } catch (e: any) {
            setToast({ message: "Erro ao abrir comanda.", type: 'error' });
        }
    };

    const handleAddItem = async (item: any) => {
        if (!activeTabId) return;

        try {
            const payload = {
                command_id: activeTabId,
                title: item.name.replace(/\[.*?\]\s/g, ''),
                price: item.price,
                quantity: 1,
                product_id: item.type === 'produto' ? item.id : null,
                service_id: item.type === 'servico' ? item.id : null
            };

            const { data, error } = await supabase
                .from('command_items')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;

            setTabs(prev => prev.map(tab => {
                if (tab.id === activeTabId) {
                    return { 
                        ...tab, 
                        command_items: [...tab.command_items, data],
                        total_amount: Number(tab.total_amount) + Number(data.price)
                    };
                }
                return tab;
            }));

            setIsSelectionOpen(false);
            setToast({ message: "Item adicionado!", type: 'success' });
        } catch (e) {
            setToast({ message: "Erro ao adicionar item.", type: 'error' });
        }
    };

    const handleRemoveItem = async (commandId: string, itemId: string) => {
        try {
            const { error } = await supabase.from('command_items').delete().eq('id', itemId);
            if (error) throw error;

            setTabs(prev => prev.map(tab => {
                if (tab.id === commandId) {
                    const removedItem = tab.command_items.find(i => i.id === itemId);
                    const newTotal = removedItem ? Number(tab.total_amount) - (Number(removedItem.price) * removedItem.quantity) : tab.total_amount;
                    return { 
                        ...tab, 
                        command_items: tab.command_items.filter(i => i.id !== itemId),
                        total_amount: newTotal
                    };
                }
                return tab;
            }));
            setToast({ message: "Item removido.", type: 'info' });
        } catch (e) {
            setToast({ message: "Erro ao remover.", type: 'error' });
        }
    };

    const handleOpenCloseTab = (id: string) => {
        const tab = tabs.find(t => t.id === id);
        if (tab) setClosingTab(tab);
    };

    const handleFinishCommand = async () => {
        if (!closingTab || isFinishing) return;
        setIsFinishing(true);

        const total = closingTab.command_items.reduce((acc, i) => acc + (i.price * i.quantity), 0);

        try {
            // 1. Criar Transação Financeira
            const { error: finError } = await supabase.from('financial_transactions').insert([{
                description: `Fechamento Comanda - ${closingTab.clients?.nome}`,
                amount: total,
                type: 'income',
                category: 'servico',
                payment_method: paymentMethod,
                client_id: closingTab.client_id,
                date: new Date().toISOString()
            }]);

            if (finError) throw finError;

            // 2. Fechar Comanda
            const { error: cmdError } = await supabase
                .from('commands')
                .update({ 
                    status: 'paid',
                    closed_at: new Date().toISOString()
                })
                .eq('id', closingTab.id);

            if (cmdError) throw cmdError;

            setTabs(prev => prev.filter(t => t.id !== closingTab.id));
            setClosingTab(null);
            setToast({ message: "Comanda finalizada com sucesso! 💰", type: 'success' });
        } catch (e) {
            setToast({ message: "Erro ao finalizar.", type: 'error' });
        } finally {
            setIsFinishing(false);
        }
    };

    const filteredTabs = useMemo(() => {
        return tabs.filter(t => t.clients?.nome.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [tabs, searchTerm]);

    const paymentMethodsConfig = [
        { id: 'pix', label: 'Pix', icon: Smartphone, color: 'bg-teal-500' },
        { id: 'cartao_credito', label: 'Crédito', icon: CreditCard, color: 'bg-blue-500' },
        { id: 'cartao_debito', label: 'Débito', icon: CreditCard, color: 'bg-cyan-500' },
        { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: 'bg-green-500' },
    ];

    return (
        <div className="h-full flex flex-col bg-slate-50 relative font-sans text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0 z-30 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <FileText className="text-orange-500" />
                        Comandas Digitais
                    </h1>
                    <p className="text-slate-500 text-xs font-medium">Controle de consumo em tempo real.</p>
                </div>
                
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={16} />
                        <input 
                            type="text" 
                            placeholder="Buscar cliente..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-transparent rounded-xl focus:bg-white focus:border-orange-200 focus:ring-4 focus:ring-orange-50 outline-none transition-all font-bold text-slate-700"
                        />
                    </div>
                    <button 
                        onClick={() => setIsClientSearchOpen(true)}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-lg shadow-orange-100 transition-all active:scale-95 text-sm uppercase tracking-widest"
                    >
                        <Plus size={20} />
                        <span>Abrir Nova</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <Loader2 className="animate-spin text-orange-500 mb-4" size={48} />
                        <p className="text-xs font-black uppercase tracking-widest">Sincronizando comandas...</p>
                    </div>
                ) : filteredTabs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                        <div className="w-24 h-24 bg-white rounded-[40px] flex items-center justify-center shadow-inner border-2 border-dashed border-slate-200 mb-6">
                            <FileText size={40} className="text-slate-200" />
                        </div>
                        <p className="text-sm font-black uppercase tracking-[0.2em]">Nenhuma comanda aberta</p>
                        <button onClick={() => setIsClientSearchOpen(true)} className="mt-4 text-orange-500 font-black text-xs uppercase hover:underline">Iniciar novo atendimento</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredTabs.map(tab => {
                            const total = tab.command_items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
                            const duration = differenceInMinutes(new Date(), parseISO(tab.created_at));

                            return (
                                <div key={tab.id} className="bg-white rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-orange-100 transition-all flex flex-col overflow-hidden group h-[480px]">
                                    <div className="p-5 border-b border-slate-50 flex justify-between items-start bg-slate-50/50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-black text-lg border-2 border-white shadow-sm">
                                                {tab.clients?.nome.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-800 text-sm truncate max-w-[140px]">{tab.clients?.nome}</h3>
                                                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                                    <Clock size={10} />
                                                    <span>Iniciado há {duration} min</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 p-5 bg-white space-y-3 overflow-y-auto custom-scrollbar">
                                        {tab.command_items.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-slate-300 opacity-50">
                                                <ShoppingBag size={32} className="mb-2"/>
                                                <p className="text-[10px] font-black uppercase tracking-widest">Sem itens</p>
                                            </div>
                                        ) : (
                                            tab.command_items.map((item) => (
                                                <div key={item.id} className="flex justify-between items-center group/item bg-slate-50 p-3 rounded-2xl border border-transparent hover:border-slate-200 transition-all">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                                            item.product_id ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                                                        }`}>
                                                            {item.product_id ? <ShoppingBag size={14}/> : <Scissors size={14}/>}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-700 truncate">{item.title}</p>
                                                            <p className="text-[10px] font-black text-slate-400">
                                                                {item.quantity}x R$ {Number(item.price).toFixed(2)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleRemoveItem(tab.id, item.id)}
                                                        className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover/item:opacity-100"
                                                    >
                                                        <X size={14} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="p-5 bg-slate-50/50 border-t border-slate-50 space-y-4">
                                        <button 
                                            onClick={() => { setActiveTabId(tab.id); setIsSelectionOpen(true); }}
                                            className="w-full py-3 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-orange-400 hover:text-orange-600 transition-all flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <Plus size={14} strokeWidth={3} /> Adicionar Item
                                        </button>

                                        <div className="flex justify-between items-end px-1">
                                            <div>
                                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Total Aberto</p>
                                                <p className="text-2xl font-black text-slate-800 tracking-tighter">R$ {Number(total).toFixed(2)}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleOpenCloseTab(tab.id)}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-2xl shadow-lg shadow-emerald-100 transition-all active:scale-90"
                                                title="Fechar Comanda"
                                            >
                                                <Receipt size={20} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* MODAL: Selecionar Cliente (Abertura) */}
            {isClientSearchOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="relative w-full max-w-md h-[600px] bg-white rounded-[40px] shadow-2xl overflow-hidden">
                        <ClientSearchModal 
                            onClose={() => setIsClientSearchOpen(false)}
                            onSelect={handleCreateCommand}
                            onNewClient={() => { setIsClientSearchOpen(false); alert("Redirecione para cadastro"); }}
                        />
                    </div>
                </div>
            )}

            {/* MODAL: Adicionar Item */}
            {isSelectionOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="relative w-full max-w-md h-[550px] bg-white rounded-[40px] shadow-2xl overflow-hidden">
                        <SelectionModal
                            title="Lançar Item"
                            items={catalog}
                            onClose={() => setIsSelectionOpen(false)}
                            onSelect={handleAddItem}
                            searchPlaceholder="O que o cliente consumiu?"
                            renderItemIcon={() => <Plus size={18}/>}
                        />
                    </div>
                </div>
            )}

            {/* MODAL: Fechamento de Conta */}
            {closingTab && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
                        <header className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                            <h3 className="font-black text-slate-800 text-xl tracking-tight uppercase">Fechar Comanda</h3>
                            <button onClick={() => setClosingTab(null)} className="p-2 hover:bg-white rounded-full text-slate-400"><X size={24} /></button>
                        </header>
                        <div className="p-10 space-y-8">
                            <div className="text-center">
                                <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-[28px] flex items-center justify-center mx-auto mb-4 font-black text-3xl border-4 border-white shadow-xl">
                                    {closingTab.clients?.nome?.charAt(0).toUpperCase() || 'C'}
                                </div>
                                <h2 className="text-xl font-black text-slate-800">{closingTab.clients?.nome || 'Cliente'}</h2>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Check-out de Consumo</p>
                            </div>

                            <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden group">
                                <div className="absolute -right-4 -top-4 opacity-10 group-hover:rotate-12 transition-transform">
                                    <DollarSign size={100} />
                                </div>
                                <div className="relative z-10">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total a Receber</p>
                                    <h3 className="text-4xl font-black tracking-tighter">
                                        R$ {closingTab.command_items.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}
                                    </h3>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Método de Pagamento</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {paymentMethodsConfig.map(pm => (
                                        <button
                                            key={pm.id}
                                            onClick={() => setPaymentMethod(pm.id as PaymentMethod)}
                                            className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
                                                paymentMethod === pm.id 
                                                ? 'border-orange-500 bg-orange-50/50 shadow-lg' 
                                                : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                            }`}
                                        >
                                            <pm.icon size={22} className={`mb-1.5 ${paymentMethod === pm.id ? 'text-orange-500' : 'text-slate-300'}`} />
                                            <span className="text-[9px] font-black uppercase tracking-tighter">{pm.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button 
                                onClick={handleFinishCommand}
                                disabled={isFinishing}
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-5 rounded-[24px] shadow-xl shadow-orange-100 transition-all active:scale-95 flex items-center justify-center gap-3 text-lg uppercase tracking-widest disabled:opacity-50"
                            >
                                {isFinishing ? <Loader2 size={24} className="animate-spin"/> : <CheckCircle size={24} />}
                                Finalizar e Baixar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComandasView;
