
import React, { useState, useMemo, useEffect } from 'react';
// FIX: Added missing 'Eraser' import from lucide-react.
import { 
    Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, 
    Banknote, Smartphone, CheckCircle, Package, Scissors, 
    ChevronRight, Calendar, User, X, Printer, ArrowRight, Loader2,
    Eraser
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { FinancialTransaction, PaymentMethod, Client, LegacyAppointment } from '../../types';
import Toast, { ToastType } from '../shared/Toast';
import { format, isSameDay } from 'date-fns';

interface CartItem {
    uuid: string; // ID único para a instância do item no carrinho
    id: number;
    name: string;
    price: number;
    type: 'servico' | 'produto';
    quantity: number;
}

interface VendasViewProps {
    onAddTransaction: (t: FinancialTransaction) => void;
}

const ReceiptModal = ({ transaction, onClose, onNewSale }: { transaction: FinancialTransaction, onClose: () => void, onNewSale: () => void }) => (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-green-50 p-6 text-center text-white">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                    <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold">Venda Realizada!</h2>
                <p className="text-green-100 text-sm">Transação registrada com sucesso.</p>
            </div>
            
            <div className="p-6 space-y-4">
                <div className="text-center space-y-1 border-b border-slate-100 pb-4">
                    <p className="text-xs text-slate-400 uppercase font-bold">Valor Total</p>
                    <p className="text-3xl font-extrabold text-slate-800">R$ {transaction.amount.toFixed(2)}</p>
                    <p className="text-sm text-slate-500 capitalize">{transaction.paymentMethod.replace('_', ' ')}</p>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex justify-between">
                        <span>Data:</span>
                        <span className="font-medium">{format(transaction.date, 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Itens:</span>
                        <span className="font-medium truncate max-w-[200px]">{transaction.description.replace('Venda PDV: ', '')}</span>
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
    const [activeTab, setActiveTab] = useState<'servicos' | 'produtos' | 'agenda'>('servicos');
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
    const [discount, setDiscount] = useState<string>('');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [lastTransaction, setLastTransaction] = useState<FinancialTransaction | null>(null);

    // Estados para dados reais do banco
    const [dbServices, setDbServices] = useState<any[]>([]);
    const [dbProducts, setDbProducts] = useState<any[]>([]);
    const [dbAppointments, setDbAppointments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 1. Fetch de Dados do Supabase
    const fetchPOSData = async () => {
        setIsLoading(true);
        try {
            const today = new Date();
            const startOfToday = new Date(today.setHours(0, 0, 0, 0)).toISOString();
            const endOfToday = new Date(today.setHours(23, 59, 59, 999)).toISOString();

            const [servicesRes, productsRes, appointmentsRes] = await Promise.all([
                supabase.from('services').select('*').eq('ativo', true).order('nome'),
                supabase.from('products').select('*').eq('ativo', true).order('nome'),
                supabase.from('appointments')
                    .select('*')
                    .gte('date', startOfToday)
                    .lte('date', endOfToday)
                    .neq('status', 'cancelado')
                    .order('date')
            ]);

            if (servicesRes.data) setDbServices(servicesRes.data);
            if (productsRes.data) setDbProducts(productsRes.data);
            if (appointmentsRes.data) setDbAppointments(appointmentsRes.data);

        } catch (e) {
            console.error("Erro ao carregar dados do PDV:", e);
            setToast({ message: "Erro ao sincronizar produtos e serviços.", type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPOSData();
    }, []);

    // --- Dados Filtrados baseados na Aba Ativa ---
    const filteredItems = useMemo(() => {
        const term = searchTerm.toLowerCase();
        if (activeTab === 'servicos') {
            return dbServices.filter(s => (s.nome || s.name || '').toLowerCase().includes(term));
        } else if (activeTab === 'produtos') {
            return dbProducts.filter(p => (p.nome || p.name || '').toLowerCase().includes(term));
        } else {
            return dbAppointments.filter(a => (a.client_name || '').toLowerCase().includes(term));
        }
    }, [activeTab, searchTerm, dbServices, dbProducts, dbAppointments]);

    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const discountValue = parseFloat(discount) || 0;
    const total = Math.max(0, subtotal - discountValue);

    // --- Handlers ---

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
            return [...prev, {
                uuid: Math.random().toString(36).substring(2, 11),
                id: itemId,
                name: itemName,
                price: itemPrice,
                type,
                quantity: 1
            }];
        });
    };

    const importAppointment = (app: any) => {
        // Busca o serviço correspondente na lista do banco para pegar os dados completos
        const service = dbServices.find(s => s.nome === app.service_name) || {
            id: app.service_id || 0,
            nome: app.service_name,
            preco: app.value
        };
        
        addToCart(service, 'servico');
        if (app.client_name) {
            setSelectedClient({ nome: app.client_name, id: app.client_id } as any);
            setToast({ message: `Agendamento de ${app.client_name} vinculado!`, type: 'info' });
        }
    };

    const updateQuantity = (index: number, delta: number) => {
        setCart(prev => {
            const newCart = [...prev];
            const item = newCart[index];
            item.quantity += delta;
            if (item.quantity <= 0) return prev.filter((_, i) => i !== index);
            return newCart;
        });
    };

    const removeFromCart = (index: number) => {
        setCart(prev => prev.filter((_, i) => i !== index));
    };

    const clearCart = () => {
        if (cart.length === 0) return;
        if (window.confirm('Tem certeza que deseja cancelar esta venda e limpar o carrinho?')) {
            resetSaleState();
        }
    };

    const resetSaleState = () => {
        setCart([]);
        setDiscount('');
        setSelectedClient(null);
        setPaymentMethod('pix');
        setLastTransaction(null);
    };

    const handleCheckout = () => {
        if (cart.length === 0) return;

        const description = selectedClient 
            ? `Venda PDV - ${selectedClient.nome}: ${cart.map(i => i.name).join(', ')}`
            : `Venda PDV: ${cart.map(i => `${i.quantity}x ${i.name}`).join(', ')}`;

        const transaction: FinancialTransaction = {
            id: Date.now(),
            description: description,
            amount: total,
            type: 'receita',
            category: cart.some(i => i.type === 'produto') ? 'produto' : 'servico',
            date: new Date(),
            paymentMethod: paymentMethod,
            status: 'pago',
            clientId: selectedClient?.id
        };

        onAddTransaction(transaction);
        setLastTransaction(transaction);
    };

    const paymentMethodsConfig = [
        { id: 'pix', label: 'Pix', icon: Smartphone, color: 'bg-teal-500' },
        { id: 'cartao_credito', label: 'Crédito', icon: CreditCard, color: 'bg-blue-500' },
        { id: 'cartao_debito', label: 'Débito', icon: CreditCard, color: 'bg-cyan-500' },
        { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: 'bg-green-500' },
    ];

    return (
        <div className="h-full flex flex-col md:flex-row bg-slate-50 overflow-hidden relative font-sans text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* Modal de Sucesso */}
            {lastTransaction && (
                <ReceiptModal 
                    transaction={lastTransaction} 
                    onClose={() => setLastTransaction(null)} 
                    onNewSale={resetSaleState} 
                />
            )}

            {/* COLUNA ESQUERDA: CATÁLOGO */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200">
                {/* Cabeçalho e Tabs */}
                <div className="bg-white p-4 border-b border-slate-200 space-y-4">
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                        <button 
                            onClick={() => setActiveTab('servicos')}
                            className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'servicos' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Scissors size={16} /> Serviços
                        </button>
                        <button 
                            onClick={() => setActiveTab('produtos')}
                            className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'produtos' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Package size={16} /> Produtos
                        </button>
                        <button 
                            onClick={() => setActiveTab('agenda')}
                            className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'agenda' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Calendar size={16} /> Agenda
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input 
                            type="text" 
                            placeholder={activeTab === 'agenda' ? "Buscar agendamento..." : `Buscar em ${activeTab}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 transition-all font-bold text-slate-700"
                        />
                    </div>
                </div>

                {/* Conteúdo da Grade */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Loader2 className="animate-spin text-orange-500 mb-2" size={32} />
                            <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando catálogo...</p>
                        </div>
                    ) : (
                        activeTab === 'agenda' ? (
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Próximos da Agenda</h3>
                                {filteredItems.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400">
                                        <Calendar className="mx-auto w-12 h-12 mb-2 opacity-20"/>
                                        <p className="text-xs font-bold">Nenhum agendamento para hoje.</p>
                                    </div>
                                ) : (
                                    filteredItems.map((app: any) => (
                                        <button 
                                            key={app.id}
                                            onClick={() => importAppointment(app)}
                                            className="w-full bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-orange-400 hover:shadow-md transition-all text-left flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-slate-50 rounded-xl flex flex-col items-center justify-center text-slate-600 font-black border border-slate-100">
                                                    <span className="text-[10px]">{format(new Date(app.date), 'HH:mm')}</span>
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-800 text-sm">{app.client_name || 'Cliente'}</h4>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{app.service_name} • {app.professional_name}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-black text-slate-700">R$ {Number(app.value).toFixed(2)}</span>
                                                <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center group-hover:bg-green-500 group-hover:text-white transition-colors">
                                                    <Plus size={18} />
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        ) : (
                            /* VISÃO CATÁLOGO (Produtos/Serviços Reais) */
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                {filteredItems.map((item: any) => (
                                    <button 
                                        key={item.id}
                                        onClick={() => addToCart(item, activeTab === 'servicos' ? 'servico' : 'produto')}
                                        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-orange-400 hover:shadow-md transition-all text-left flex flex-col h-full group"
                                    >
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                                    {item.categoria || (activeTab === 'servicos' ? 'Serviço' : 'Produto')}
                                                </span>
                                                {activeTab === 'produtos' && (
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${Number(item.qtd) < 5 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                        Estoque: {item.qtd}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="font-black text-slate-800 text-sm leading-tight mb-2 line-clamp-2">{item.nome}</h4>
                                        </div>
                                        <div className="mt-4 flex items-center justify-between">
                                            <span className="font-black text-lg text-slate-800 tracking-tighter">
                                                R$ {Number(item.preco).toFixed(2)}
                                            </span>
                                            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all shadow-sm">
                                                <Plus size={20} />
                                            </div>
                                        </div>
                                    </button>
                                ))}
                                {filteredItems.length === 0 && (
                                    <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400">
                                        <Search size={48} className="mb-2 opacity-20" />
                                        <p className="text-xs font-bold uppercase tracking-widest">Nenhum item encontrado.</p>
                                    </div>
                                )}
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* COLUNA DIREITA: CARRINHO E CHECKOUT */}
            <div className="w-full md:w-[420px] bg-white flex flex-col shadow-2xl z-10">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter text-lg">
                            <ShoppingCart className="text-orange-500" size={22} />
                            Carrinho
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{cart.length} itens selecionados</p>
                    </div>
                    {selectedClient && (
                        <div className="flex items-center gap-2 text-[10px] bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-black uppercase border border-blue-100 shadow-sm animate-in zoom-in">
                            <User size={12} /> {selectedClient.nome}
                            <button onClick={() => setSelectedClient(null)} className="hover:text-rose-500 transition-colors"><X size={12}/></button>
                        </div>
                    )}
                </div>

                {/* Lista de Itens do Carrinho */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 opacity-60">
                            <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center border-2 border-dashed border-slate-100">
                                <ShoppingCart size={40} />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-xs uppercase tracking-widest">Carrinho vazio</p>
                                <p className="text-[10px] font-medium mt-1">Toque nos itens do catálogo para vender.</p>
                            </div>
                        </div>
                    ) : (
                        cart.map((item, index) => (
                            <div key={item.uuid} className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm animate-in slide-in-from-right-4 duration-300">
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-slate-800 text-sm truncate">{item.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">R$ {item.price.toFixed(2)} un.</p>
                                </div>
                                <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-100">
                                    <button onClick={() => updateQuantity(index, -1)} className="p-2 hover:bg-white hover:shadow-sm text-slate-400 hover:text-rose-500 rounded-xl transition-all">
                                        <Minus size={14} strokeWidth={3} />
                                    </button>
                                    <span className="w-8 text-center text-xs font-black text-slate-800">{item.quantity}</span>
                                    <button onClick={() => updateQuantity(index, 1)} className="p-2 hover:bg-white hover:shadow-sm text-slate-400 hover:text-emerald-500 rounded-xl transition-all">
                                        <Plus size={14} strokeWidth={3} />
                                    </button>
                                </div>
                                <div className="text-right min-w-[70px]">
                                    <p className="font-black text-slate-800 text-sm tracking-tight">R$ {(item.price * item.quantity).toFixed(2)}</p>
                                </div>
                                <button onClick={() => removeFromCart(index)} className="p-2 text-slate-200 hover:text-rose-500 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Resumo e Checkout */}
                <div className="bg-slate-50/80 backdrop-blur-md p-6 border-t border-slate-200 space-y-6">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                            <span>Subtotal</span>
                            <span className="text-slate-800 font-black">R$ {subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Desconto Especial</span>
                            <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">R$</span>
                                <input 
                                    type="number" 
                                    placeholder="0,00"
                                    value={discount}
                                    onChange={(e) => setDiscount(e.target.value)}
                                    className="w-24 pl-6 pr-2 py-1.5 text-right text-sm font-black border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all text-orange-600"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="h-px bg-slate-200 w-full"></div>
                    
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-slate-400 tracking-[0.2em]">Total a Receber</span>
                        <span className="text-3xl font-black text-slate-800 tracking-tighter">R$ {total.toFixed(2)}</span>
                    </div>

                    {/* Seletor de Pagamento */}
                    <div className="space-y-3">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Método de Recebimento</label>
                        <div className="grid grid-cols-4 gap-2">
                            {paymentMethodsConfig.map(pm => (
                                <button
                                    key={pm.id}
                                    onClick={() => setPaymentMethod(pm.id as PaymentMethod)}
                                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
                                        paymentMethod === pm.id 
                                        ? 'border-orange-500 bg-orange-50/50 shadow-lg shadow-orange-100 ring-2 ring-orange-50' 
                                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                    }`}
                                >
                                    <pm.icon size={22} className={`mb-1.5 ${paymentMethod === pm.id ? 'text-orange-500' : 'text-slate-300'}`} />
                                    <span className="text-[9px] font-black uppercase tracking-tighter">{pm.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={clearCart}
                            disabled={cart.length === 0}
                            className="p-4 bg-white border border-slate-200 text-slate-300 hover:text-rose-500 hover:border-rose-200 rounded-2xl transition-all disabled:opacity-50"
                            title="Limpar Tudo"
                        >
                            <Eraser size={24} />
                        </button>
                        <button 
                            onClick={handleCheckout}
                            disabled={cart.length === 0}
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-orange-100 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3 text-lg uppercase tracking-widest"
                        >
                            <CheckCircle size={24} />
                            Finalizar Venda
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VendasView;
