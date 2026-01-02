
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Package, Search, Plus, Filter, Edit2, Trash2, 
    AlertTriangle, TrendingUp, Archive, LayoutGrid, List,
    Loader2, History, Save, X, RefreshCw,
    ShoppingBag, ChevronRight, MoreVertical
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import ProductModal from '../modals/ProductModal';
import Toast, { ToastType } from '../shared/Toast';
import { Product } from '../../types';

// Modal de Ajuste Rápido de Estoque (Auditável)
const AdjustStockModal = ({ product, onClose, onSave, isSaving }: any) => {
    const [newQty, setNewQty] = useState(product.stock_quantity);
    const [reason, setReason] = useState('Entrada');

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <header className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Ajustar Inventário</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X size={18} /></button>
                </header>
                <div className="p-8 space-y-6">
                    <div className="text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Produto</p>
                        <h4 className="font-bold text-slate-700">{product.name}</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Qtd. Atual</label>
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl py-3 text-center font-black text-slate-400">{product.stock_quantity}</div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nova Qtd.</label>
                            <input 
                                type="number" 
                                value={newQty} 
                                onChange={e => setNewQty(Number(e.target.value))}
                                className="w-full bg-white border-2 border-orange-200 rounded-2xl py-3 text-center font-black text-orange-600 focus:border-orange-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Motivo do Ajuste</label>
                        <select 
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-100 transition-all"
                        >
                            <option value="Entrada">Entrada de Mercadoria</option>
                            <option value="Perda/Quebra">Perda ou Quebra</option>
                            <option value="Correção">Correção de Inventário</option>
                            <option value="Uso Interno">Uso Interno / Insumo</option>
                        </select>
                    </div>

                    <button 
                        onClick={() => onSave(newQty, reason)}
                        disabled={isSaving}
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                        Confirmar Ajuste
                    </button>
                </div>
            </div>
        </div>
    );
};

const ProdutosView: React.FC = () => {
    const { user } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [filterStatus, setFilterStatus] = useState<'todos' | 'baixo_estoque' | 'ativos'>('todos');
    
    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdjusting, setIsAdjusting] = useState<Product | null>(null);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const isAdmin = useMemo(() => user?.papel === 'admin' || user?.papel === 'gestor', [user]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('name');
            
            if (error) throw error;
            setProducts(data || []);
        } catch (e: any) {
            console.error("Erro ao carregar estoque:", e);
            setToast({ message: "Erro ao sincronizar estoque.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProducts(); }, []);

    const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

    const handleOpenNewProduct = () => {
        setEditingProduct(null);
        setIsModalOpen(true);
    };

    const handleEditProduct = (product: Product) => {
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    const handleDeleteProduct = async (id: number) => {
        if (!isAdmin) return showToast("Apenas administradores podem excluir itens.", "error");
        
        const confirmed = window.confirm('⚠️ ATENÇÃO: Esta ação é irreversível. Deseja realmente excluir este produto permanentemente?');
        if (confirmed) {
            try {
                const { error } = await supabase.from('products').delete().eq('id', id);
                if (error) throw error;
                showToast('Produto removido com sucesso!', 'info');
                fetchProducts();
            } catch (e: any) {
                showToast(`Erro ao excluir: ${e.message}`, 'error');
            }
        }
    };

    const handleSaveProduct = async (productData: Product) => {
        setIsSaving(true);
        try {
            const payload = {
                name: productData.name,
                sku: productData.sku || null,
                price: parseFloat(productData.price.toString()),
                cost_price: productData.cost_price ? parseFloat(productData.cost_price.toString()) : 0,
                stock_quantity: parseInt(productData.stock_quantity.toString(), 10),
                min_stock: parseInt(productData.min_stock.toString(), 10),
                active: Boolean(productData.active)
            };

            const isRealEdit = productData.id && products.some(p => p.id === productData.id);

            const { error } = isRealEdit 
                ? await supabase.from('products').update(payload).eq('id', productData.id)
                : await supabase.from('products').insert([payload]);

            if (error) throw error;
            
            showToast(isRealEdit ? 'Produto atualizado!' : 'Produto cadastrado!');
            setIsModalOpen(false);
            fetchProducts();
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAdjustStock = async (newQuantity: number, reason: string) => {
        if (!isAdjusting) return;
        setIsSaving(true);
        try {
            const { error: prodError } = await supabase
                .from('products')
                .update({ stock_quantity: newQuantity })
                .eq('id', isAdjusting.id);

            if (prodError) throw prodError;

            // Registro histórico (Opcional - se a tabela existir)
            try {
                await supabase.from('stock_adjustments').insert([{
                    product_id: isAdjusting.id,
                    user_id: user?.id,
                    previous_quantity: isAdjusting.stock_quantity,
                    new_quantity: newQuantity,
                    reason: reason
                }]);
            } catch (e) {
                console.warn("Log de estoque não registrado: tabela ausente.");
            }

            showToast("Estoque ajustado com sucesso!");
            setIsAdjusting(null);
            fetchProducts();
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            const isLow = p.stock_quantity <= (p.min_stock || 0);
            
            if (filterStatus === 'baixo_estoque') return matchesSearch && isLow;
            if (filterStatus === 'ativos') return matchesSearch && p.active;
            return matchesSearch;
        });
    }, [products, searchTerm, filterStatus]);

    const stats = useMemo(() => {
        return {
            totalItems: products.length,
            lowStock: products.filter(p => p.stock_quantity <= (p.min_stock || 0)).length,
            totalValue: products.reduce((acc, p) => acc + (Number(p.cost_price) || 0) * p.stock_quantity, 0)
        };
    }, [products]);

    return (
        <div className="h-full flex flex-col bg-slate-50 relative font-sans overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-20 flex-shrink-0 shadow-sm">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Archive className="text-purple-500" size={28} />
                        Gestão de Estoque
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Controle total de entradas, saídas e patrimônio</p>
                </div>
                
                <div className="flex gap-2">
                    <button onClick={fetchProducts} className="p-3 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-all" title="Atualizar Lista">
                        <RefreshCw size={20}/>
                    </button>
                    <button 
                        onClick={handleOpenNewProduct}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-purple-100 transition-all active:scale-95"
                    >
                        <Plus size={20} /> <span className="hidden sm:inline">Adicionar Produto</span>
                    </button>
                </div>
            </header>

            {/* KPI Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 pt-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Patrimônio (Custo)</p>
                        <p className="text-2xl font-black text-slate-800">R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <TrendingUp className="text-emerald-500 opacity-20" size={40} />
                </div>
                <div className={`p-6 rounded-3xl border shadow-sm flex items-center justify-between transition-all ${stats.lowStock > 0 ? 'bg-rose-50 border-rose-100 shadow-rose-100' : 'bg-white border-slate-100'}`}>
                    <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${stats.lowStock > 0 ? 'text-rose-500' : 'text-slate-400'}`}>Itens em Alerta</p>
                        <p className={`text-2xl font-black ${stats.lowStock > 0 ? 'text-rose-700' : 'text-slate-800'}`}>{stats.lowStock} reposições pendentes</p>
                    </div>
                    <AlertTriangle className={stats.lowStock > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-200'} size={32} />
                </div>
                <div className="bg-slate-800 p-6 rounded-3xl text-white shadow-xl shadow-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1">Catálogo Ativo</p>
                        <p className="text-2xl font-black">{stats.totalItems} referências</p>
                    </div>
                    <Package className="text-purple-400" size={32} />
                </div>
            </div>

            {/* Filters */}
            <div className="p-6 bg-slate-50 flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative group flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-500 transition-colors" size={18} />
                    <input 
                        type="text" 
                        placeholder="Pesquisar por nome ou código SKU..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-purple-100 focus:border-purple-400 outline-none font-bold text-slate-700 transition-all shadow-sm"
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                        onClick={() => setFilterStatus(filterStatus === 'baixo_estoque' ? 'todos' : 'baixo_estoque')}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                            filterStatus === 'baixo_estoque' 
                            ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-100' 
                            : 'bg-white border-slate-200 text-slate-500 hover:border-rose-200 hover:text-rose-500'
                        }`}
                    >
                        <ShoppingBag size={16} /> Estoque Baixo
                    </button>
                    <div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-slate-100 text-purple-600' : 'text-slate-400'}`}><LayoutGrid size={20}/></button>
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-slate-100 text-purple-600' : 'text-slate-400'}`}><List size={20}/></button>
                    </div>
                </div>
            </div>

            {/* Main List */}
            <div className="flex-1 overflow-y-auto px-6 pb-24 custom-scrollbar">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                        <Loader2 className="animate-spin text-purple-500 mb-4" size={40} />
                        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Sincronizando inventário real...</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center bg-white rounded-[40px] border-2 border-dashed border-slate-100 shadow-sm">
                        <Package size={64} className="text-slate-100 mb-4" />
                        <h3 className="font-black text-slate-700 uppercase tracking-widest">Nada encontrado por aqui</h3>
                        <p className="text-slate-400 text-sm mt-1 mb-6">Cadastre seus produtos reais para começar o controle.</p>
                        <button onClick={handleOpenNewProduct} className="px-8 py-3 bg-purple-600 text-white font-black rounded-xl shadow-lg">Cadastrar Primeiro Produto</button>
                    </div>
                ) : (
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
                        <table className="w-full text-left text-sm min-w-[900px]">
                            <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th className="px-6 py-5">Produto / Marca</th>
                                    <th className="px-6 py-5">Cód. SKU</th>
                                    <th className="px-6 py-5 text-center">Saldo Atual</th>
                                    <th className="px-6 py-5 text-center">Mínimo</th>
                                    <th className="px-6 py-5 text-right">Venda (R$)</th>
                                    <th className="px-6 py-5 text-center">Visibilidade</th>
                                    <th className="px-6 py-5 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredProducts.map(p => {
                                    const isLow = p.stock_quantity <= (p.min_stock || 0);
                                    return (
                                        <tr key={p.id} className={`hover:bg-slate-50/50 group transition-colors ${isLow ? 'bg-rose-50/20' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className={`font-bold text-slate-700 transition-colors ${isLow ? 'text-rose-700' : 'group-hover:text-purple-600'}`}>{p.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase">{(p as any).category || 'Item de Venda'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 font-mono text-xs">{p.sku || '-'}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center">
                                                    <div 
                                                        onClick={() => setIsAdjusting(p)}
                                                        title="Clique para ajustar estoque"
                                                        className={`px-5 py-2.5 rounded-2xl font-black text-xs min-w-[80px] text-center border-2 cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                                                            isLow ? 'bg-rose-100 text-rose-600 border-rose-200 shadow-sm shadow-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                        }`}
                                                    >
                                                        {p.stock_quantity} un
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-[11px] font-black text-slate-400">{p.min_stock || 0} un</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="font-black text-slate-800">R$ {Number(p.price || 0).toFixed(2)}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center">
                                                    {p.active ? (
                                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                                                            Ativo
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-400 text-[9px] font-black uppercase tracking-widest border border-slate-200">
                                                            Inativo
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button 
                                                        onClick={() => setIsAdjusting(p)}
                                                        className="p-2.5 bg-slate-50 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all border border-slate-100"
                                                        title="Ajuste de Inventário"
                                                    >
                                                        <History size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleEditProduct(p)}
                                                        className="p-2.5 bg-slate-50 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all border border-slate-100"
                                                        title="Editar Produto"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteProduct(p.id)}
                                                        className="p-2.5 bg-slate-50 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-slate-100"
                                                        title="Excluir Permanentemente"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modals */}
            {isModalOpen && (
                <ProductModal 
                    product={editingProduct}
                    onClose={() => { setIsModalOpen(false); setEditingProduct(null); }}
                    onSave={handleSaveProduct}
                />
            )}

            {isAdjusting && (
                <AdjustStockModal 
                    product={isAdjusting}
                    isSaving={isSaving}
                    onClose={() => setIsAdjusting(null)}
                    onSave={handleAdjustStock}
                />
            )}
        </div>
    );
};

export default ProdutosView;
