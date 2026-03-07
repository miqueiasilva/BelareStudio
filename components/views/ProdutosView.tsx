import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
    Package, Search, Plus, Filter, Edit2, Trash2, 
    AlertTriangle, Loader2, Truck, ArrowRightLeft,
    DollarSign, Box, ChevronDown, PlusCircle, MinusCircle,
    Archive
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import ProductModal from '../modals/ProductModal';
import SupplierManagerModal from '../modals/SupplierManagerModal';
import ProductMovementModal from '../modals/ProductMovementModal';
import Toast, { ToastType } from '../shared/Toast';
import { Product } from '../../types';
import { useConfirm } from '../../utils/useConfirm';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const StatCard = ({ title, value, icon: Icon, color, isDanger }: any) => (
    <div className={`p-6 rounded-[32px] border shadow-sm transition-all group ${isDanger ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-2xl shadow-lg text-white ${color}`}>
                <Icon size={20} />
            </div>
            {isDanger && (
                <span className="px-2 py-1 rounded-lg bg-rose-500 text-white text-[9px] font-black uppercase animate-pulse">Ação Necessária</span>
            )}
        </div>
        <p className={`text-[10px] font-black uppercase tracking-widest ${isDanger ? 'text-rose-400' : 'text-slate-400'}`}>{title}</p>
        <h3 className={`text-2xl font-black mt-1 ${isDanger ? 'text-rose-700' : 'text-slate-800'}`}>{value}</h3>
    </div>
);

const ProdutosView: React.FC = () => {
    const { activeStudioId } = useStudio();
    const { confirm, ConfirmDialogComponent } = useConfirm();
    const [activeTab, setActiveTab] = useState<'inventory' | 'movements'>('inventory');
    const [products, setProducts] = useState<Product[]>([]);
    const [movements, setMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, []);

    const fetchProducts = useCallback(async () => {
        if (!activeStudioId) return;
        
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();
        
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('studio_id', activeStudioId)
                .order('name')
                .abortSignal(abortControllerRef.current.signal);
            if (error) throw error;
            if (isMounted.current) setProducts(data || []);
        } catch (error: any) {
            const isAbortError = error.name === 'AbortError' || error.message?.includes('aborted');
            if (isMounted.current && !isAbortError) {
                setToast({ message: "Erro ao sincronizar estoque.", type: 'error' });
            }
        } finally {
            if (isMounted.current) setLoading(false);
        }
    }, [activeStudioId]);

    const fetchMovements = useCallback(async () => {
        if (!activeStudioId) return;
        try {
            const { data, error } = await supabase
                .from('product_movements')
                .select('*, products(name)')
                .eq('studio_id', activeStudioId)
                .order('created_at', { ascending: false })
                .limit(50);
            if (error) throw error;
            if (isMounted.current) setMovements(data || []);
        } catch (error: any) {
            console.error("Erro ao buscar movimentações:", error);
        }
    }, [activeStudioId]);

    useEffect(() => { 
        fetchProducts(); 
        if (activeTab === 'movements') fetchMovements();
    }, [fetchProducts, fetchMovements, activeTab]);

    const handleQuickStockUpdate = async (id: number, delta: number) => {
        const product = products.find(p => p.id === id);
        if (!product) return;
        
        const newQty = Math.max(0, product.stock_quantity + delta);
        
        // Update local state first (Optimistic)
        setProducts(prev => prev.map(p => p.id === id ? { ...p, stock_quantity: newQty } : p));

        try {
            const { error } = await supabase
                .from('products')
                .update({ stock_quantity: newQty })
                .eq('id', id);
            if (error) throw error;
        } catch (error: any) {
            console.error("Erro ao ajustar saldo:", error);
            fetchProducts(); // Revert on failure
            setToast({ message: "Falha ao ajustar saldo.", type: 'error' });
        }
    };

    const handleSaveProduct = async (productData: Product) => {
        if (!activeStudioId) return;
        try {
            const isEdit = !!productData.id && products.some(p => p.id === productData.id);
            
            // Only use fields present in the products table schema
            const payload = {
                studio_id: activeStudioId,
                name: productData.name,
                price: productData.price,
                stock_quantity: productData.stock_quantity,
                sku: productData.sku,
                cost_price: productData.cost_price,
                min_stock: productData.min_stock,
                active: productData.active,
                ativo: productData.active,
                image_url: (productData as any).image_url || null
            };

            const { error } = isEdit 
                ? await supabase.from('products').update(payload).eq('id', productData.id)
                : await supabase.from('products').insert([payload]);
            if (error) throw error;
            setToast({ message: isEdit ? 'Produto atualizado!' : 'Produto cadastrado!', type: 'success' });
            setIsProductModalOpen(false);
            fetchProducts();
        } catch (error: any) { setToast({ message: error.message, type: 'error' }); }
    };

    const handleDelete = async (id: number) => {
        const isConfirmed = await confirm({
            title: 'Excluir Produto',
            message: '⚠️ EXCLUSÃO PERMANENTE\n\nDeseja realmente excluir este produto?',
            confirmText: 'Excluir',
            cancelText: 'Cancelar',
            type: 'danger'
        });

        if (isConfirmed) {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (!error) { 
                fetchProducts(); 
                toast.success("Produto removido."); 
            } else {
                toast.error("Erro ao remover produto.");
            }
        }
    };

    const metrics = useMemo(() => {
        const lowStock = products.filter(p => p.stock_quantity <= (p.min_stock || 0)).length;
        const totalValue = products.reduce((acc, p) => acc + (Number(p.cost_price || 0) * Number(p.stock_quantity)), 0);
        const totalUnits = products.reduce((acc, p) => acc + Number(p.stock_quantity), 0);
        
        return { lowStock, totalValue, totalUnits };
    }, [products]);

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
            return matchSearch;
        });
    }, [products, searchTerm]);

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-4 py-3 shadow-sm z-30 flex-shrink-0">
                {/* Linha 1: Ícone + Título */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
                            <Package size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-base font-black text-slate-800 tracking-tighter uppercase leading-none">Estoque</h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Insumos e Revenda</p>
                        </div>
                    </div>
                    {/* Novo Produto sempre visível */}
                    <button 
                        onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }} 
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-purple-100 transition-all active:scale-95 flex items-center gap-1.5"
                    >
                        <Plus size={14} /> Novo
                    </button>
                </div>

                {/* Linha 2: Ações secundárias */}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsMovementModalOpen(true)} 
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-wider rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                        <ArrowRightLeft size={13} /> Movimentar
                    </button>
                    <button 
                        onClick={() => setIsSupplierModalOpen(true)} 
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-wider rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                        <Truck size={13} /> Fornecedores
                    </button>
                </div>
            </header>

            {/* TAB SELECTOR */}
            <div className="bg-white border-b border-slate-200 px-6 flex gap-8 flex-shrink-0">
                <button 
                    onClick={() => setActiveTab('inventory')}
                    className={`py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all ${activeTab === 'inventory' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Estoque Atual
                </button>
                <button 
                    onClick={() => setActiveTab('movements')}
                    className={`py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all ${activeTab === 'movements' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Histórico de Movimentações
                </button>
            </div>

            <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                
                {activeTab === 'inventory' ? (
                    <>
                        {/* INDICATORS DASHBOARD */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StatCard title="Itens em Baixa" value={metrics.lowStock} icon={AlertTriangle} color="bg-rose-500" isDanger={metrics.lowStock > 0} />
                            <StatCard title="Capital Imobilizado" value={formatCurrency(metrics.totalValue)} icon={DollarSign} color="bg-emerald-500" />
                            <StatCard title="Total de Unidades" value={metrics.totalUnits} icon={Box} color="bg-blue-500" />
                        </div>

                        {/* FILTERS */}
                        <div className="bg-white border border-slate-200 rounded-[32px] p-4 flex flex-col md:flex-row gap-4 shadow-sm">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-purple-500 transition-colors" size={20} />
                                <input 
                                    type="text" 
                                    placeholder="Pesquisar por nome ou SKU..." 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)} 
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-purple-50 focus:border-purple-400 focus:bg-white outline-none font-bold text-slate-700 transition-all shadow-inner" 
                                />
                            </div>
                        </div>

                        {/* PRODUCT LIST */}
                        <div className="space-y-10 pb-20">
                            {loading ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                                    <Loader2 className="animate-spin text-purple-500 mb-4" size={48} />
                                    <p className="text-xs font-black uppercase tracking-[0.3em] animate-pulse">Sincronizando Inventário...</p>
                                </div>
                            ) : filteredProducts.length === 0 ? (
                                <div className="py-32 text-center bg-white rounded-[48px] border-2 border-dashed border-slate-200">
                                    <Archive size={48} className="mx-auto text-slate-200 mb-4" />
                                    <h3 className="font-black text-slate-400 uppercase tracking-widest">Estoque Vazio</h3>
                                </div>
                            ) : (
                                <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                                    {/* Header visível só em desktop */}
                                    <div className="hidden md:grid grid-cols-5 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 px-8 py-5">
                                        <span>Produto / SKU</span>
                                        <span className="text-center">Saúde</span>
                                        <span className="text-center">Saldo</span>
                                        <span className="text-right">Preço</span>
                                        <span className="text-right">Ações</span>
                                    </div>
                                    <div className="divide-y divide-slate-50">
                                        {filteredProducts.map(p => {
                                            const isLow = p.stock_quantity <= (p.min_stock || 0);
                                            const isWarning = p.stock_quantity <= (p.min_stock || 0) * 1.5;
                                            const progress = Math.min(100, (p.stock_quantity / ((p.min_stock || 1) * 3)) * 100);

                                            return (
                                                <div key={p.id} className="hover:bg-slate-50 group transition-all">
                                                    {/* Mobile: card layout */}
                                                    <div className="md:hidden p-4 space-y-3">
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <p className="font-black text-slate-800 text-sm uppercase tracking-tight group-hover:text-purple-600">{p.name}</p>
                                                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{p.sku || 'S/ SKU'}</p>
                                                            </div>
                                                            <div className="flex gap-2 ml-2">
                                                                <button onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }} className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all"><Edit2 size={14} /></button>
                                                                <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={14} /></button>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1 space-y-1">
                                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                                                    <div className={`h-full transition-all duration-1000 ${isLow ? 'bg-rose-500' : isWarning ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }} />
                                                                </div>
                                                                <span className={`text-[9px] font-black uppercase ${isLow ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-emerald-600'}`}>
                                                                    {isLow ? 'Reposição Urgente' : isWarning ? 'Atenção' : 'Saudável'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={() => handleQuickStockUpdate(p.id, -1)} className="p-1 text-slate-300 hover:text-rose-500 transition-all"><MinusCircle size={20} /></button>
                                                                <div className={`w-12 py-1 rounded-xl font-black text-sm text-center shadow-inner border ${isLow ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-slate-50 text-slate-700 border-slate-100'}`}>{p.stock_quantity}</div>
                                                                <button onClick={() => handleQuickStockUpdate(p.id, 1)} className="p-1 text-slate-300 hover:text-emerald-500 transition-all"><PlusCircle size={20} /></button>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-slate-400 font-bold">Custo: {formatCurrency(p.cost_price || 0)}</span>
                                                            <span className="font-black text-slate-800">{formatCurrency(p.price)}</span>
                                                        </div>
                                                    </div>

                                                    {/* Desktop: linha de tabela */}
                                                    <div className="hidden md:grid grid-cols-5 items-center px-8 py-5">
                                                        <div>
                                                            <p className="font-black text-slate-800 text-sm uppercase tracking-tight group-hover:text-purple-600 transition-colors">{p.name}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{p.sku || 'S/ SKU'}</p>
                                                        </div>
                                                        <div className="flex flex-col gap-1 px-4">
                                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
                                                                <div className={`h-full transition-all duration-1000 ${isLow ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : isWarning ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }} />
                                                            </div>
                                                            <span className={`text-[9px] font-black uppercase tracking-widest ${isLow ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-emerald-600'}`}>
                                                                {isLow ? 'Reposição Urgente' : isWarning ? 'Atenção' : 'Saudável'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-center gap-3">
                                                            <button onClick={() => handleQuickStockUpdate(p.id, -1)} className="p-1 text-slate-300 hover:text-rose-500 transition-all active:scale-90"><MinusCircle size={22} /></button>
                                                            <div className={`min-w-[60px] py-1.5 rounded-xl font-black text-sm text-center shadow-inner border ${isLow ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-slate-50 text-slate-700 border-slate-100'}`}>{p.stock_quantity}</div>
                                                            <button onClick={() => handleQuickStockUpdate(p.id, 1)} className="p-1 text-slate-300 hover:text-emerald-500 transition-all active:scale-90"><PlusCircle size={22} /></button>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-black text-slate-800 text-base">{formatCurrency(p.price)}</p>
                                                            <p className="text-[9px] text-slate-400 font-bold uppercase">Custo: {formatCurrency(p.cost_price || 0)}</p>
                                                        </div>
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all shadow-sm"><Edit2 size={16} /></button>
                                                            <button onClick={() => handleDelete(p.id)} className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-sm"><Trash2 size={18} /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Desktop header */}
                        <div className="hidden md:grid grid-cols-5 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 px-8 py-5">
                            <span>Data / Hora</span>
                            <span>Produto</span>
                            <span className="text-center">Tipo</span>
                            <span className="text-center">Qtd</span>
                            <span>Motivo</span>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {movements.length === 0 ? (
                                <div className="px-8 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                                    Nenhuma movimentação registrada
                                </div>
                            ) : movements.map(m => (
                                <div key={m.id} className="hover:bg-slate-50 transition-all">
                                    {/* Mobile */}
                                    <div className="md:hidden p-4 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="font-black text-slate-700 text-sm">{m.products?.name || 'Produto Removido'}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${m.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                {m.type === 'in' ? 'Entrada' : 'Saída'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400 font-bold">{format(new Date(m.created_at), "dd/MM/yy HH:mm")}</span>
                                            <span className={`font-black ${m.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {m.type === 'in' ? '+' : '-'}{m.quantity} un.
                                            </span>
                                        </div>
                                        {m.reason && <p className="text-[10px] text-slate-400 italic">{m.reason}</p>}
                                    </div>
                                    {/* Desktop */}
                                    <div className="hidden md:grid grid-cols-5 items-center px-8 py-5">
                                        <span className="text-xs font-bold text-slate-500">{format(new Date(m.created_at), "dd/MM/yyyy HH:mm")}</span>
                                        <span className="font-black text-slate-700 text-sm">{m.products?.name || 'Produto Removido'}</span>
                                        <span className="text-center">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${m.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                {m.type === 'in' ? 'Entrada' : 'Saída'}
                                            </span>
                                        </span>
                                        <span className={`text-center font-black ${m.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {m.type === 'in' ? '+' : '-'}{m.quantity}
                                        </span>
                                        <span className="text-xs text-slate-500 font-medium italic">{m.reason}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {isProductModalOpen && (
                <ProductModal 
                    product={editingProduct} 
                    onClose={() => setIsProductModalOpen(false)} 
                    onSave={handleSaveProduct} 
                />
            )}

            {isSupplierModalOpen && (
                <SupplierManagerModal 
                    onClose={() => setIsSupplierModalOpen(false)} 
                />
            )}

            {isMovementModalOpen && (
                <ProductMovementModal 
                    onClose={() => setIsMovementModalOpen(false)}
                    onSuccess={() => {
                        fetchProducts();
                        if (activeTab === 'movements') fetchMovements();
                    }}
                />
            )}
            <ConfirmDialogComponent />
        </div>
    );
};

export default ProdutosView;