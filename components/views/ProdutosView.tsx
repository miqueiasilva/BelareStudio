import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
    Package, Search, Plus, Filter, Edit2, Trash2, 
    AlertTriangle, TrendingUp, Archive, LayoutGrid, List,
    Loader2, History, Save, X, RefreshCw, Truck,
    ShoppingBag, ChevronRight, MoreVertical, DollarSign,
    Box, ChevronDown, PlusCircle, MinusCircle
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import ProductModal from '../modals/ProductModal';
import SupplierManagerModal from '../modals/SupplierManagerModal';
import Toast, { ToastType } from '../shared/Toast';
import { Product } from '../../types';

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
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const fetchProducts = useCallback(async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('studio_id', activeStudioId)
                .order('name');
            if (error) throw error;
            setProducts(data || []);
        } catch (e: any) {
            setToast({ message: "Erro ao sincronizar estoque.", type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [activeStudioId]);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

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
        } catch (e) {
            fetchProducts(); // Revert on failure
            setToast({ message: "Falha ao ajustar saldo.", type: 'error' });
        }
    };

    const handleSaveProduct = async (productData: Product) => {
        if (!activeStudioId) return;
        try {
            const payload = { ...productData, studio_id: activeStudioId };
            const isEdit = !!productData.id && products.some(p => p.id === productData.id);
            const { error } = isEdit 
                ? await supabase.from('products').update(payload).eq('id', productData.id)
                : await supabase.from('products').insert([payload]);
            if (error) throw error;
            setToast({ message: isEdit ? 'Produto atualizado!' : 'Produto cadastrado!', type: 'success' });
            setIsProductModalOpen(false);
            fetchProducts();
        } catch (e: any) { setToast({ message: e.message, type: 'error' }); }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm("⚠️ EXCLUSÃO PERMANENTE\n\nDeseja realmente excluir este produto?")) {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (!error) { fetchProducts(); setToast({ message: "Produto removido.", type: 'info' }); }
        }
    };

    const metrics = useMemo(() => {
        const lowStock = products.filter(p => p.stock_quantity <= (p.min_stock || 0)).length;
        const totalValue = products.reduce((acc, p) => acc + (Number(p.cost_price || 0) * Number(p.stock_quantity)), 0);
        const totalUnits = products.reduce((acc, p) => acc + Number(p.stock_quantity), 0);
        const categories = Array.from(new Set(products.map(p => p.category || 'Geral')));
        
        return { lowStock, totalValue, totalUnits, categories };
    }, [products]);

    const filteredAndGrouped = useMemo(() => {
        const filtered = products.filter(p => {
            const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
            return matchSearch && matchCat;
        });

        const groups: Record<string, Product[]> = {};
        filtered.forEach(p => {
            const cat = p.category || 'Geral';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(p);
        });
        return groups;
    }, [products, searchTerm, selectedCategory]);

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col lg:flex-row justify-between items-center gap-4 shadow-sm z-30 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl shadow-inner border border-purple-100">
                        <Package size={26} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">Módulo de Estoque</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Gestão de Insumos e Revenda</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <button onClick={() => setIsSupplierModalOpen(true)} className="flex-1 lg:flex-none px-5 py-3 bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm">
                        <Truck size={16} /> Fornecedores
                    </button>
                    <button onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }} className="flex-1 lg:flex-none bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-purple-100 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <Plus size={18} /> Novo Produto
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                
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
                    <div className="relative min-w-[200px]">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none">
                            <Filter size={18} />
                        </div>
                        <select 
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full pl-11 pr-10 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl appearance-none outline-none focus:ring-4 focus:ring-purple-50 font-black text-[10px] uppercase tracking-widest text-slate-600 cursor-pointer"
                        >
                            <option value="all">Todas as Categorias</option>
                            {metrics.categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    </div>
                </div>

                {/* PRODUCT LIST */}
                <div className="space-y-10 pb-20">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                            <Loader2 className="animate-spin text-purple-500 mb-4" size={48} />
                            <p className="text-xs font-black uppercase tracking-[0.3em] animate-pulse">Sincronizando Inventário...</p>
                        </div>
                    ) : Object.keys(filteredAndGrouped).length === 0 ? (
                        <div className="py-32 text-center bg-white rounded-[48px] border-2 border-dashed border-slate-200">
                            <Archive size={48} className="mx-auto text-slate-200 mb-4" />
                            <h3 className="font-black text-slate-400 uppercase tracking-widest">Estoque Vazio</h3>
                        </div>
                    ) : (
                        (Object.entries(filteredAndGrouped) as [string, Product[]][]).map(([category, items]) => (
                            <section key={category} className="animate-in fade-in duration-500">
                                <header className="flex items-center gap-4 mb-4 px-2">
                                    <div className="h-px flex-1 bg-slate-200"></div>
                                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">{category}</h2>
                                    {/* FIX: Explicitly casting 'items' to Product[] to fix the 'unknown' type error */}
                                    <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-lg text-[9px] font-black">{(items as Product[]).length} ITENS</span>
                                    <div className="h-px flex-1 bg-slate-200"></div>
                                </header>

                                <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                            <tr>
                                                <th className="px-8 py-5">Produto / SKU</th>
                                                <th className="px-8 py-5 text-center">Saúde do Estoque</th>
                                                <th className="px-8 py-5 text-center">Saldo Atual</th>
                                                <th className="px-8 py-5 text-right">Preço Venda</th>
                                                <th className="px-8 py-5 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {/* FIX: Explicitly casting 'items' to Product[] to fix the 'unknown' type error */}
                                            {(items as Product[]).map(p => {
                                                const isLow = p.stock_quantity <= (p.min_stock || 0);
                                                const isWarning = p.stock_quantity <= (p.min_stock || 0) * 1.5;
                                                const progress = Math.min(100, (p.stock_quantity / ((p.min_stock || 1) * 3)) * 100);

                                                return (
                                                    <tr key={p.id} className="hover:bg-slate-50 group transition-all">
                                                        <td className="px-8 py-5">
                                                            <div>
                                                                <p className="font-black text-slate-800 text-sm uppercase tracking-tight group-hover:text-purple-600 transition-colors">{p.name}</p>
                                                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{p.sku || 'S/ SKU'}</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-5 text-center min-w-[180px]">
                                                            <div className="flex flex-col gap-1 px-4">
                                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
                                                                    <div 
                                                                        className={`h-full transition-all duration-1000 ${isLow ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : isWarning ? 'bg-amber-400' : 'bg-emerald-500'}`} 
                                                                        style={{ width: `${progress}%` }}
                                                                    />
                                                                </div>
                                                                <span className={`text-[9px] font-black uppercase tracking-widest ${isLow ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-emerald-600'}`}>
                                                                    {isLow ? 'Reposição Urgente' : isWarning ? 'Atenção' : 'Saudável'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <div className="flex items-center justify-center gap-3">
                                                                <button onClick={() => handleQuickStockUpdate(p.id, -1)} className="p-1 text-slate-300 hover:text-rose-500 transition-all active:scale-90"><MinusCircle size={22} /></button>
                                                                <div className={`min-w-[60px] py-1.5 rounded-xl font-black text-sm text-center shadow-inner border ${isLow ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-slate-50 text-slate-700 border-slate-100'}`}>
                                                                    {p.stock_quantity}
                                                                </div>
                                                                <button onClick={() => handleQuickStockUpdate(p.id, 1)} className="p-1 text-slate-300 hover:text-emerald-500 transition-all active:scale-90"><PlusCircle size={22} /></button>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-5 text-right">
                                                            <p className="font-black text-slate-800 text-base">{formatCurrency(p.price)}</p>
                                                            <p className="text-[9px] text-slate-400 font-bold uppercase">Custo: {formatCurrency(p.cost_price || 0)}</p>
                                                        </td>
                                                        <td className="px-8 py-5 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <button onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all shadow-sm"><Edit2 size={16} /></button>
                                                                <button onClick={() => handleDelete(p.id)} className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-sm"><Trash2 size={18} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        ))
                    )}
                </div>
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
        </div>
    );
};

export default ProdutosView;