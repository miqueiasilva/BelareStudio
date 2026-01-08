
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Search, Plus, Clock, User, FileText, 
    DollarSign, Coffee, Scissors, Trash2, ShoppingBag, X,
    CreditCard, Banknote, Smartphone, CheckCircle, Loader2,
    Receipt, History, LayoutGrid, CheckCircle2, AlertCircle,
    UserCheck, Briefcase
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { FinancialTransaction, PaymentMethod, Client, Command, CommandItem } from '../../types';
import Toast, { ToastType } from '../shared/Toast';
import SelectionModal from '../modals/SelectionModal';
import ClientSearchModal from '../modals/ClientSearchModal';
import { differenceInMinutes, parseISO, format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';

interface ComandasViewProps {
    onAddTransaction: (t: FinancialTransaction) => void;
}

type CommandTab = 'open' | 'paid' | 'all';

const ComandasView: React.FC<ComandasViewProps> = ({ onAddTransaction }) => {
    const { user } = useAuth();
    const [tabs, setTabs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentTab, setCurrentTab] = useState<CommandTab>('open');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Modals State
    const [isSelectionOpen, setIsSelectionOpen] = useState(false);
    const [isProfSelectionOpen, setIsProfSelectionOpen] = useState(false);
    const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [pendingItem, setPendingItem] = useState<any>(null);
    
    // Close Tab Modal State
    const [closingTab, setClosingTab] = useState<any | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
    const [isFinishing, setIsFinishing] = useState(false);

    // Dados de Catálogo e Equipe
    const [catalog, setCatalog] = useState<any[]>([]);
    const [team, setTeam] = useState<any[]>([]);

    const fetchCommands = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('commands')
                .select('*, clients(id, name, nome, avatar_url, photo_url), command_items(*, team_members(id, name))');

            if (currentTab === 'open') {
                query = query.eq('status', 'open');
            } else if (currentTab === 'paid') {
                query = query.eq('status', 'paid');
            }

            const { data, error } = await query
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTabs(data || []);
        } catch (e: any) {
            setToast({ message: "Erro ao carregar comandas.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const fetchData = async () => {
        const [svcs, prods, teamRes] = await Promise.all([
            supabase.from('services').select('id, nome, preco').eq('ativo', true),
            supabase.from('products').select('id, name, price').eq('ativo', true),
            supabase.from('team_members').select('id, name').eq('active', true)
        ]);

        const items = [
            ...(svcs.data || []).map(s => ({ id: s.id, name: `[Serviço] ${s.nome}`, price: s.preco, type: 'servico' })),
            ...(prods.data || []).map(p => ({ id: p.id, name: `[Produto] ${p.name}`, price: p.price, type: 'produto' }))
        ];
        setCatalog(items);
        setTeam((teamRes.data || []).map(t => ({ id: t.id, name: t.name })));
    };

    useEffect(() => {
        fetchCommands();
        fetchData();
    }, [currentTab]);

    // --- Handlers ---

    const handleDeleteCommand = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!window.confirm("Deseja realmente excluir esta comanda?")) return;
        try {
            await supabase.from('command_items').delete().eq('command_id', id);
            const { error } = await supabase.from('commands').delete().eq('id', id);
            if (error) throw error;
            setTabs(prev => prev.filter(t => t.id !== id));
            setToast({ message: "Comanda excluída.", type: 'info' });
        } catch (e) {
            setToast({ message: "Erro ao excluir.", type: 'error' });
        }
    };

    // CORREÇÃO 1: Validação de client_id na criação da comanda
    const handleCreateCommand = async (client: Client) => {
        if (!client.id) {
            setToast({ message: "Erro: Cliente inválido ou sem ID registrado.", type: 'error' });
            return;
        }

        setIsClientSearchOpen(false);
        try {
            const { data, error } = await supabase
                .from('commands')
                .insert([{ 
                    client_id: client.id, 
                    status: 'open',
                    total_amount: 0 
                }])
                .select('*, clients(*), command_items(*)')
                .single();

            if (error) throw error;
            
            if (currentTab !== 'paid') {
                setTabs(prev => [data, ...prev]);
            }
            
            setToast({ message: `Comanda aberta para ${client.nome}!`, type: 'success' });
        } catch (e: any) {
            setToast({ message: "Erro ao abrir comanda no banco.", type: 'error' });
        }
    };

    const handleSelectItemFromCatalog = (item: any) => {
        if (item.type === 'produto') {
            handleAddItemToDB(item, null);
        } else {
            setPendingItem(item);
            setIsSelectionOpen(false);
            setIsProfSelectionOpen(true);
        }
    };

    // CORREÇÃO 2: Garantir professional_id no payload
    const handleAddItemToDB = async (item: any, professionalId: string | null) => {
        if (!activeTabId) return;

        // Lógica de Fallback Inteligente
        let finalProfId = professionalId;
        
        if (item.type === 'servico' && !finalProfId) {
             // Tenta usar o usuário logado se ele for um profissional da equipe
             const loggedInAsMember = team.find(t => t.id === user?.id);
             if (loggedInAsMember) {
                 finalProfId = loggedInAsMember.id;
             } else {
                 setToast({ message: "Erro: Selecione um profissional para este serviço.", type: 'error' });
                 setIsProfSelectionOpen(true);
                 return;
             }
        }

        try {
            const payload = {
                command_id: activeTabId,
                title: item.name.replace(/\[.*?\]\s/g, ''),
                price: item.price,
                quantity: 1,
                product_id: item.type === 'produto' ? item.id : null,
                service_id: item.type === 'servico' ? item.id : null,
                professional_id: finalProfId // OBRIGATÓRIO PARA SERVIÇOS
            };

            const { data, error } = await supabase
                .from('command_items')
                .insert([payload])
                .select('*, team_members(id, name)')
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
            setIsProfSelectionOpen(false);
            setPendingItem(null);
            setToast({ message: "Item lançado com sucesso!", type: 'success' });
        } catch (e) {
            setToast({ message: "Erro ao gravar item na comanda.", type: 'error' });
        }
    };

    const handleRemoveItem = async (commandId: string, itemId: string) => {
        try {
            const { error } = await supabase.from('command_items').delete().eq('id', itemId);
            if (error) throw error;
            setTabs(prev => prev.map(tab => {
                if (tab.id === commandId) {
                    const removedItem = tab.command_items.find((i: any) => i.id === itemId);
                    const newTotal = removedItem ? Number(tab.total_amount) - (Number(removedItem.price) * removedItem.quantity) : tab.total_amount;
                    return { ...tab, command_items: tab.command_items.filter((i: any) => i.id !== itemId), total_amount: newTotal };
                }
                return tab;
            }));
            setToast({ message: "Item removido.", type: 'info' });
        } catch (e) {
            setToast({ message: "Erro ao remover.", type: 'error' });
        }
    };

    const handleOpenCloseTab = (id: string) => {
        const command = tabs.find(t => t.id === id);
        if (command) window.location.hash = `#/comanda/${command.id}`;
    };

    const filteredTabs = useMemo(() => {
        return tabs.filter(t => {
            const name = (t.clients?.nome || t.clients?.name || '').toLowerCase();
            return name.includes(searchTerm.toLowerCase());
        });
    }, [tabs, searchTerm]);

    return (
        <div className="h-full flex flex-col bg-slate-50 relative font-sans text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0 z-30 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <FileText className="text-orange-500" />
                        Comandas Digitais
                    </h1>
                    <div className="flex items-center gap-4 mt-2">
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button onClick={() => setCurrentTab('open')} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${currentTab === 'open' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}><LayoutGrid size={14} /> Em Aberto</button>
                            <button onClick={() => setCurrentTab('paid')} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${currentTab === 'paid' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}><History size={14} /> Histórico</button>
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-transparent rounded-xl outline-none font-bold text-slate-700" />
                    </div>
                    <button onClick={() => setIsClientSearchOpen(true)} className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-lg active:scale-95 text-sm uppercase tracking-widest"><Plus size={20} /><span>Abrir Nova</span></button>
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
                        <FileText size={40} className="mb-4" />
                        <p className="text-sm font-black uppercase tracking-widest">Nenhuma comanda encontrada</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredTabs.map(tab => {
                            const total = tab.command_items.reduce((acc: number, i: any) => acc + (i.price * i.quantity), 0);
                            const duration = differenceInMinutes(new Date(), parseISO(tab.created_at));
                            const clientDisplayName = tab.clients?.nome || tab.clients?.name || 'Cliente Não Identificado';
                            const isPaid = tab.status === 'paid';

                            return (
                                <div key={tab.id} className={`bg-white rounded-[32px] border transition-all flex flex-col overflow-hidden h-[480px] ${isPaid ? 'border-slate-100 opacity-90' : 'border-slate-100 shadow-sm hover:shadow-xl'}`}>
                                    <div className="p-5 border-b border-slate-50 flex justify-between items-start bg-slate-50/50">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg border-2 border-white shadow-sm overflow-hidden ${isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                                                {clientDisplayName.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-black text-slate-800 text-sm truncate max-w-[120px]">{clientDisplayName}</h3>
                                                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                                    <Clock size={10} />
                                                    <span>{isPaid ? 'Finalizada' : `Há ${duration} min`}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {!isPaid && (
                                            <button onClick={(e) => handleDeleteCommand(e, tab.id)} className="p-2 text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                                        )}
                                    </div>

                                    <div className="flex-1 p-5 bg-white space-y-3 overflow-y-auto custom-scrollbar">
                                        {tab.command_items.map((item: any) => (
                                            <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-transparent">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-700 truncate">{item.title}</p>
                                                    <p className="text-[10px] text-slate-400 font-black flex items-center gap-1">
                                                        {item.team_members?.name && <><UserCheck size={8}/> {item.team_members.name} • </>} 
                                                        R$ {Number(item.price).toFixed(2)}
                                                    </p>
                                                </div>
                                                {!isPaid && (
                                                    <button onClick={() => handleRemoveItem(tab.id, item.id)} className="p-1 text-slate-300 hover:text-rose-500"><X size={14} /></button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-5 bg-slate-50/50 border-t border-slate-50 space-y-4">
                                        {!isPaid ? (
                                            <button onClick={() => { setActiveTabId(tab.id); setIsSelectionOpen(true); }} className="w-full py-3 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase text-slate-500 hover:border-orange-400 hover:text-orange-600 transition-all flex items-center justify-center gap-2">
                                                <Plus size={14} /> Lançar Item
                                            </button>
                                        ) : (
                                            <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-600 rounded-2xl text-[9px] font-black uppercase border border-emerald-100"><CheckCircle size={14} /> Atendimento Pago</div>
                                        )}

                                        <div className="flex justify-between items-end px-1">
                                            <div>
                                                <p className="text-[9px] text-slate-400 font-black uppercase mb-0.5">Total</p>
                                                <p className={`text-2xl font-black ${isPaid ? 'text-emerald-600' : 'text-slate-800'}`}>R$ {Number(total).toFixed(2)}</p>
                                            </div>
                                            {!isPaid && (
                                                <button onClick={() => handleOpenCloseTab(tab.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-2xl shadow-lg transition-all active:scale-90"><Receipt size={20} /></button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* MODAL: Selecionar Cliente */}
            {isClientSearchOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="relative w-full max-w-md h-[600px] bg-white rounded-[40px] shadow-2xl overflow-hidden">
                        <ClientSearchModal onClose={() => setIsClientSearchOpen(false)} onSelect={handleCreateCommand} onNewClient={() => {}} />
                    </div>
                </div>
            )}

            {/* MODAL: Seleção de Item (Serviço/Produto) */}
            {isSelectionOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="relative w-full max-w-md h-[550px] bg-white rounded-[40px] shadow-2xl overflow-hidden">
                        <SelectionModal title="Lançar Item" items={catalog} onClose={() => setIsSelectionOpen(false)} onSelect={handleSelectItemFromCatalog} searchPlaceholder="Buscar no catálogo..." renderItemIcon={() => <Plus size={18}/>} />
                    </div>
                </div>
            )}

            {/* MODAL: Seleção de Profissional (OBRIGATÓRIO PARA SERVIÇOS) */}
            {isProfSelectionOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="relative w-full max-w-md h-[550px] bg-white rounded-[40px] shadow-2xl overflow-hidden">
                        <SelectionModal title="Quem realizou o serviço?" items={team} onClose={() => { setIsProfSelectionOpen(false); setPendingItem(null); }} onSelect={(prof) => handleAddItemToDB(pendingItem, String(prof.id))} searchPlaceholder="Selecionar profissional..." renderItemIcon={() => <UserCheck size={18}/>} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComandasView;
