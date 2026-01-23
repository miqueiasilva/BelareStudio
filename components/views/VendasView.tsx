
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, 
    Banknote, Smartphone, CheckCircle, Package, Scissors, 
    Calendar, User, X, Printer, ArrowRight, Loader2,
    Eraser
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { FinancialTransaction, PaymentMethod, Client } from '../../types';
import Toast, { ToastType } from '../shared/Toast';
import { format } from 'date-fns';

interface CartItem {
    uuid: string;
    id: number;
    name: string;
    price: number;
    type: 'servico' | 'produto';
    quantity: number;
}

interface VendasViewProps {
    onAddTransaction: (t: FinancialTransaction) => void;
}

const ReceiptModal = ({ transaction, onClose, onNewSale }: { transaction: any, onClose: () => void, onNewSale: () => void }) => (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-green-500 p-6 text-center text-white">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                    <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold">Venda Realizada!</h2>
                <p className="text-green-100 text-sm">Transação registrada com sucesso.</p>
            </div>
            
            <div className="p-6 space-y-4">
                <div className="text-center space-y-1 border-b border-slate-100 pb-4">
                    <p className="text-xs text-slate-400 uppercase font-bold">Valor Total</p>
                    <p className="text-3xl font-extrabold text-slate-800">R$ {Number(transaction.amount || 0).toFixed(2)}</p>
                    <p className="text-sm text-slate-500 capitalize">{transaction.payment_method?.replace('_', ' ') || 'Pix'}</p>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex justify-between">
                        <span>Data:</span>
                        <span className="font-medium">{format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                    <button onClick={onClose} className="flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition">
                        <Printer size={18} /> Imprimir
                    </button>
                    <button onClick={onNewSale} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 shadow-orange-200 shadow-sm transition">
                        Nova Venda <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    </div>
);

const VendasView: React.FC<VendasViewProps> = ({ onAddTransaction }) => {
    const { activeStudioId } = useStudio();
    const [activeTab, setActiveTab] = useState<'servicos' | 'produtos' | 'agenda'>('servicos');
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
    const [discount, setDiscount] = useState<string>('');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [lastTransaction, setLastTransaction] = useState<any | null>(null);

    const [dbServices, setDbServices] = useState<any[]>([]);
    const [dbProducts, setDbProducts] = useState<any[]>([]);
    const [dbAppointments, setDbAppointments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFinishing, setIsFinishing] = useState(false);

    const fetchPOSData = async () => {
        if (!activeStudioId) return;
        setIsLoading(true);
        try {
            const today = new Date();
            const startOfToday = new Date(today.setHours(0, 0, 0, 0)).toISOString();
            const endOfToday = new Date(today.setHours(23, 59, 59, 999)).toISOString();

            const [servicesRes, productsRes, appointmentsRes] = await Promise.all([
                supabase.from('services').select('*').eq('studio_id', activeStudioId).eq('ativo', true).order('nome'),
                supabase.from('products').select('*').eq('studio_id', activeStudioId).eq('ativo', true).order('name'),
                supabase.from('appointments').select('*').eq('studio_id', activeStudioId).gte('date', startOfToday).lte('date', endOfToday).neq('status', 'cancelado').order('date')
            ]);

            if (servicesRes.data) setDbServices(servicesRes.data);
            if (productsRes.data) setDbProducts(productsRes.data);
            if (appointmentsRes.data) setDbAppointments(appointmentsRes.data);
        } catch (e) {
            setToast({ message: "Erro ao sincronizar produtos.", type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchPOSData(); }, [activeStudioId]);

    const resetSaleState = () => {
        setCart([]);
        setDiscount('');
        setSelectedClient(null);
        setPaymentMethod('pix');
        setLastTransaction(null);
        setSearchTerm('');
    };

    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const discountValue = parseFloat(discount) || 0;
    const total = Math.max(0, subtotal - discountValue);

    const addToCart = (item: any, type: 'servico' | 'produto') => {
        setCart(prev => {
            const itemId = item.id;
            const itemName = item.nome || item.name || 'Item';
            const itemPrice = Number(item.preco || item.price || 0);
            const existingIndex = prev.findIndex(i => i.id === itemId && i.type === type);
            if (existingIndex >= 0) {
                const newCart = [...prev];
                newCart[existingIndex].quantity += 1;
                return newCart;
            }
            return [...prev, { uuid: Math.random().toString(36).substring(2, 11), id: itemId, name: itemName, price: itemPrice, type, quantity: 1 }];
        });
    };

    const handleFinishSale = async () => {
        if (cart.length === 0 || isFinishing || !activeStudioId) return;
        setIsFinishing(true);

        try {
            const methodMapping: Record<string, string> = { 'pix': 'pix', 'dinheiro': 'cash', 'cartao_credito': 'credit', 'cartao_debito': 'debit' };

            const payload = {
                p_studio_id: String(activeStudioId),
                p_professional_id: null,
                p_amount: Number(total),
                p_method: methodMapping[paymentMethod] || 'pix',
                p_brand: '',
                p_installments: 1,
                p_command_id: null,
                p_client_id: null,
                p_description: 'Venda Rápida (PDV)'
            };

            // LOG DE INTERCEPTAÇÃO REQUISITADO
            console.log('--- RPC INVOCATION: register_payment_transaction_v2 ---');
            console.log('Payload:', payload);
            Object.entries(payload).forEach(([key, value]) => {
                console.log(`Field: ${key} | Value: ${value} | Type: ${typeof value}`);
            });

            // Execução exata da linha RPC
            const { error: rpcError } = await supabase.rpc('register_payment_transaction_v2', payload);

            if (rpcError) throw rpcError;

            setLastTransaction({ amount: total, payment_method: paymentMethod });
            setToast({ message: "Venda finalizada com sucesso!", type: 'success' });
            fetchPOSData(); 

        } catch (error: any) {
            setToast({ message: `Erro ao finalizar: ${error.message}`, type: 'error' });
        } finally {
            setIsFinishing(false);
        }
    };

    const filteredItems = useMemo(() => {
        const term = searchTerm.toLowerCase();
        if (activeTab === 'servicos') return dbServices.filter(s => (s.nome || '').toLowerCase().includes(term));
        if (activeTab === 'produtos') return dbProducts.filter(p => (p.name || '').toLowerCase().includes(term));
        return dbAppointments.filter(a => (a.client_name || '').toLowerCase().includes(term));
    }, [activeTab, searchTerm, dbServices, dbProducts, dbAppointments]);

    const paymentMethodsConfig = [
        { id: 'pix', label: 'Pix', icon: Smartphone, color: 'text-teal-500' },
        { id: 'cartao_credito', label: 'Crédito', icon: CreditCard, color: 'text-blue-500' },
        { id: 'cartao_debito', label: 'Débito', icon: CreditCard, color: 'text-cyan-500' },
        { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: 'text-green-500' },
    ];

    return (
        <div className="h-full flex flex-col md:flex-row bg-slate-50 overflow-hidden relative font-sans text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {lastTransaction && (
                <ReceiptModal 
                    transaction={lastTransaction} 
                    onClose={() => resetSaleState()} 
                    onNewSale={resetSaleState} 
                />
            )}

            <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200">
                <div className="bg-white p-4 border-b border-slate-200 space-y-4">
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                        <button onClick={() => setActiveTab('servicos')} className={`flex-1 py-2 rounded-lg font-black text-xs uppercase transition-all ${activeTab === 'servicos' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-50'}`}><Scissors size={16} /> Serviços</button>
                        <button onClick={() => setActiveTab('produtos')} className={`flex-1 py-2 rounded-lg font-black text-xs uppercase transition-all ${activeTab === 'produtos' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-50'}`}><Package size={16} /> Produtos</button>
                        <button onClick={() => setActiveTab('agenda')} className={`flex-1 py-2 rounded-lg font-black text-xs uppercase transition-all ${activeTab === 'agenda' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-50'}`}><Calendar size={16} /> Agenda</button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input type="text" placeholder={`Buscar em ${activeTab}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-200 font-bold text-slate-700" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400"><Loader2 className="animate-spin text-orange-500 mb-2" /><p className="text-[10px] font-black uppercase">Sincronizando...</p></div>
                    ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredItems.map((item: any) => (
                                <button key={item.id} onClick={() => addToCart(item, activeTab === 'servicos' ? 'servico' : 'produto')} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-orange-400 hover:shadow-md transition-all text-left flex flex-col h-full group">
                                    <div className="flex-1">
                                        <span className="text-[9px] uppercase font-black text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{item.categoria || activeTab}</span>
                                        <h4 className="font-black text-slate-800 text-sm leading-tight mt-2 line-clamp-2">{item.nome || item.name || item.client_name}</h4>
                                    </div>
                                    <div className="mt-4 flex items-center justify-between">
                                        <span className="font-black text-lg text-slate-800">R$ {Number(item.preco || item.price || item.value).toFixed(2)}</span>
                                        <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all"><Plus size={20} /></div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="w-full md:w-[420px] bg-white flex flex-col shadow-2xl z-10">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div><h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg flex items-center gap-2"><ShoppingCart className="text-orange-500" size={22} /> Carrinho</h3><p className="text-[10px] text-slate-400 font-bold uppercase">{cart.length} itens</p></div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60"><ShoppingCart size={40} /><p className="font-black text-xs uppercase mt-4">Carrinho vazio</p></div>
                    ) : (
                        cart.map((item, index) => (
                            <div key={item.uuid} className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm animate-in slide-in-from-right-4">
                                <div className="flex-1 min-w-0"><p className="font-black text-slate-800 text-sm truncate">{item.name}</p><p className="text-[10px] text-slate-400 font-bold">R$ {item.price.toFixed(2)}</p></div>
                                <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-100">
                                    <button onClick={() => setCart(cart.filter((_, i) => i !== index))} className="p-2 text-slate-200 hover:text-rose-500"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="bg-slate-50/80 p-6 border-t border-slate-200 space-y-4">
                    <div className="flex justify-between items-center border-t pt-4">
                        <span className="text-xs font-black uppercase text-slate-400">Total</span>
                        <span className="text-3xl font-black text-slate-800">R$ {total.toFixed(2)}</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {paymentMethodsConfig.map(pm => (
                            <button key={pm.id} onClick={() => setPaymentMethod(pm.id as PaymentMethod)} className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${paymentMethod === pm.id ? 'border-orange-500 bg-orange-50/50 shadow-md ring-4 ring-orange-50' : 'bg-white border-slate-100 text-slate-400'}`}>
                                <pm.icon size={20} className="mb-1" />
                                <span className="text-[8px] font-black uppercase">{pm.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button onClick={handleFinishSale} disabled={cart.length === 0 || isFinishing} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 text-lg uppercase transition-all disabled:opacity-50">
                            {isFinishing ? <Loader2 className="animate-spin" /> : <><CheckCircle size={24} /> Finalizar Venda</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VendasView;
