
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Search, ShoppingCart, Plus, Trash2, CreditCard, 
    CheckCircle, Package, Scissors, UserPlus, ArrowRight, Loader2, X
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { Product, Service, Client, PaymentMethod, FinancialTransaction } from '../../types';
import Toast, { ToastType } from '../shared/Toast';

interface CartItem {
    id: number;
    name: string;
    price: number;
    type: 'servico' | 'produto';
    quantity: number;
}

interface VendasViewProps {
    onAddTransaction: (t: FinancialTransaction) => void;
}

const VendasView: React.FC<VendasViewProps> = ({ onAddTransaction }) => {
    const [clients, setClients] = useState<Client[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [activeTab, setActiveTab] = useState<'servicos' | 'produtos'>('servicos');
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const showToast = useCallback((message: any, type: ToastType = 'success') => {
        let finalMessage = "";
        if (typeof message === 'string') {
            finalMessage = message;
        } else if (message?.message && typeof message.message === 'string') {
            finalMessage = message.message;
        } else {
            finalMessage = JSON.stringify(message) || "Erro inesperado";
        }
        setToast({ message: finalMessage, type });
    }, []);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [cRes, sRes, pRes] = await Promise.all([
                supabase.from('clients').select('*').order('nome'),
                supabase.from('services').select('*').eq('ativo', true).order('nome'),
                supabase.from('products').select('*').eq('ativo', true).order('nome')
            ]);
            setClients(cRes.data || []);
            setServices(sRes.data || []);
            setProducts(pRes.data || []);
        } catch (e: any) {
            showToast("Erro ao carregar dados do catálogo.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const addToCart = (item: any, type: 'servico' | 'produto') => {
        setCart(prev => {
            const exists = prev.find(i => i.id === item.id && i.type === type);
            if (exists) return prev.map(i => (i.id === item.id && i.type === type) ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { id: item.id, name: item.nome, price: item.preco, type, quantity: 1 }];
        });
    };

    const removeFromCart = (index: number) => setCart(prev => prev.filter((_, i) => i !== index));

    const total = useMemo(() => cart.reduce((acc, i) => acc + (i.price * i.quantity), 0), [cart]);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setIsSaving(true);
        try {
            // 1. Create Order
            const { data: order, error: oErr } = await supabase.from('orders').insert([{
                client_id: selectedClient?.id || null,
                total: total,
                status: 'fechada'
            }]).select().single();
            if (oErr) throw oErr;

            // 2. Create Transaction
            const { error: tErr } = await supabase.from('financial_transactions').insert([{
                description: `Venda #${order.id} - ${selectedClient?.nome || 'Cliente Balcão'}`,
                amount: total,
                type: 'receita',
                category: cart.some(i => i.type === 'produto') ? 'produto' : 'servico',
                payment_method: paymentMethod,
                date: new Date().toISOString(),
                status: 'pago'
            }]);
            if (tErr) throw tErr;

            // 3. Update Stock
            const productItems = cart.filter(i => i.type === 'produto');
            for (const item of productItems) {
                const prod = products.find(p => p.id === item.id);
                if (prod) {
                    const newQtd = prod.qtd - item.quantity;
                    const { error: stockErr } = await supabase.from('products').update({ qtd: newQtd }).eq('id', prod.id);
                    if (stockErr) console.warn("Aviso: Falha ao atualizar estoque de", prod.nome);
                }
            }

            showToast('Venda finalizada com sucesso!');
            setCart([]);
            setSelectedClient(null);
            fetchData();
        } catch (e: any) {
            console.error("Checkout error:", e);
            const msg = typeof e?.message === 'string' ? e.message : "Tente novamente.";
            showToast(`Erro ao finalizar: ${msg}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const filteredItems = useMemo(() => {
        const term = searchTerm.toLowerCase();
        if (activeTab === 'servicos') return services.filter(s => s.nome.toLowerCase().includes(term));
        return products.filter(p => p.nome.toLowerCase().includes(term));
    }, [activeTab, searchTerm, services, products]);

    return (
        <div className="h-full flex flex-col md:flex-row bg-slate-50 overflow-hidden relative font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Catálogo */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200">
                <div className="bg-white p-6 border-b border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-800">Novo Atendimento</h2>
                        <div className="flex gap-2">
                            <button onClick={() => setActiveTab('servicos')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'servicos' ? 'bg-orange-500 text-white shadow-lg' : 'bg-slate-100 text-slate-600'}`}>Serviços</button>
                            <button onClick={() => setActiveTab('produtos')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'produtos' ? 'bg-orange-500 text-white shadow-lg' : 'bg-slate-100 text-slate-600'}`}>Produtos</button>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" placeholder={`Buscar ${activeTab}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? <div className="flex h-full items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div> : (
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredItems.map(item => (
                                <button key={item.id} onClick={() => addToCart(item, activeTab === 'servicos' ? 'servico' : 'produto')} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm hover:border-orange-400 hover:shadow-md transition-all text-left flex flex-col h-full group">
                                    <div className="flex-1">
                                        <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">{activeTab}</span>
                                        <h4 className="font-bold text-slate-800 text-sm mt-1 leading-tight group-hover:text-orange-600">{item.nome}</h4>
                                    </div>
                                    <div className="mt-4 flex items-center justify-between">
                                        <p className="font-black text-slate-700">R$ {item.preco.toFixed(2)}</p>
                                        <div className="p-2 bg-orange-50 text-orange-500 rounded-xl group-hover:bg-orange-500 group-hover:text-white transition-colors"><Plus size={16} /></div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Carrinho */}
            <div className="w-full md:w-[420px] bg-white flex flex-col shadow-2xl z-10">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><ShoppingCart className="text-orange-500" size={20} /> Carrinho Atual</h3>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vincular Cliente (Opcional)</label>
                        <select className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 font-medium text-slate-700" value={selectedClient?.id || ''} onChange={(e) => setSelectedClient(clients.find(c => c.id === Number(e.target.value)) || null)}>
                            <option value="">Cliente Balcão</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-sm">Nenhum item selecionado.</div>
                    ) : cart.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm group">
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 text-sm truncate">{item.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">{item.type} • {item.quantity}x R$ {item.price.toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => removeFromCart(idx)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                <span className="font-black text-slate-800 text-sm">R$ {(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-slate-50 p-6 border-t border-slate-200 space-y-6">
                    <div className="space-y-4">
                        <div className="flex justify-between items-end"><span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Total a Pagar</span><span className="text-4xl font-black text-orange-600">R$ {total.toFixed(2)}</span></div>
                        <div className="grid grid-cols-2 gap-2">
                            {['pix', 'cartao_credito', 'cartao_debito', 'dinheiro'].map(m => (
                                <button key={m} onClick={() => setPaymentMethod(m as any)} className={`py-2.5 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest border-2 transition-all ${paymentMethod === m ? 'bg-orange-500 border-orange-500 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}>{m.replace('_', ' ')}</button>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleCheckout} disabled={cart.length === 0 || isSaving} className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 rounded-[24px] shadow-2xl shadow-slate-300 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50">
                        {isSaving ? <Loader2 className="animate-spin" /> : <><CheckCircle size={20} /> FINALIZAR VENDA</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VendasView;
