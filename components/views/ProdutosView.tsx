
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Package, Search, Plus, Filter, Edit2, Trash2, 
    AlertTriangle, DollarSign, Archive, RefreshCw, Loader2
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { Product } from '../../types';
import ProductModal from '../modals/ProductModal';
import Toast, { ToastType } from '../shared/Toast';
import Card from '../shared/Card';

const ProdutosView: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'todos' | 'baixo_estoque' | 'ativos'>('todos');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('nome', { ascending: true });
            
            if (error) throw error;
            setProducts(data || []);
        } catch (error: any) {
            setToast({ message: 'Erro ao carregar estoque.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const stats = useMemo(() => {
        const totalItems = products.length;
        // Assume min_qtd is 5 if not in DB for now, or use a dynamic field if it exists
        const lowStock = products.filter(p => p.qtd <= 3).length; 
        const totalValue = products.reduce((acc, p) => acc + (Number(p.custo) || 0) * p.qtd, 0);
        return { totalItems, lowStock, totalValue };
    }, [products]);

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
            
            if (filterStatus === 'baixo_estoque') return matchesSearch && p.qtd <= 3;
            if (filterStatus === 'ativos') return matchesSearch && p.ativo;
            return matchesSearch;
        });
    }, [products, searchTerm, filterStatus]);

    const handleSaveProduct = async (productData: Product) => {
        setIsLoading(true);
        try {
            const payload = {
                nome: productData.nome,
                sku: productData.sku,
                qtd: Number(productData.qtd),
                custo: Number(productData.custo),
                preco: Number(productData.preco),
                ativo: productData.ativo
            };

            let res;
            if (editingProduct) {
                res = await supabase.from('products').update(payload).eq('id', editingProduct.id);
            } else {
                res = await supabase.from('products').insert([payload]);
            }

            if (res.error) throw res.error;

            setToast({ message: 'Estoque atualizado!', type: 'success' });
            setIsModalOpen(false);
            setEditingProduct(null);
            fetchProducts();
        } catch (error: any) {
            const errorMsg = error?.message || (typeof error === 'string' ? error : 'Erro desconhecido');
            setToast({ message: `Erro ao salvar: ${errorMsg}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteProduct = async (id: number) => {
        if (!window.confirm('Excluir este produto permanentemente?')) return;
        try {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;
            setToast({ message: 'Produto removido.', type: 'info' });
            fetchProducts();
        } catch (error: any) {
            setToast({ message: 'Erro ao remover.', type: 'error' });
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Package className="text-orange-500" /> Estoque de Produtos
                    </h1>
                    <p className="text-slate-500 text-sm">Controle real de insumos e itens para revenda.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchProducts} className="p-2.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all"><RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} /></button>
                    <button onClick={() => { setEditingProduct(null); setIsModalOpen(true); }} className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2">
                        <Plus size={20} /> Novo Produto
                    </button>
                </div>
            </header>

            <main className="flex-1 p-6 space-y-6 overflow-hidden flex flex-col">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                        <div><p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Custo em Estoque</p><p className="text-2xl font-bold text-slate-800 mt-1">R$ {stats.totalValue.toFixed(2)}</p></div>
                        <div className="p-3 bg-blue-500 rounded-xl text-white"><DollarSign size={20} /></div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                        <div><p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Produtos</p><p className="text-2xl font-bold text-slate-800 mt-1">{stats.totalItems}</p></div>
                        <div className="p-3 bg-slate-800 rounded-xl text-white"><Archive size={20} /></div>
                    </div>
                    <div className={`p-5 rounded-2xl border shadow-sm flex items-center justify-between ${stats.lowStock > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
                        <div><p className={`text-xs font-bold uppercase tracking-wider ${stats.lowStock > 0 ? 'text-red-600' : 'text-slate-400'}`}>Estoque Crítico</p><p className={`text-2xl font-bold mt-1 ${stats.lowStock > 0 ? 'text-red-700' : 'text-slate-800'}`}>{stats.lowStock} itens</p></div>
                        <div className={`p-3 rounded-xl ${stats.lowStock > 0 ? 'bg-red-600' : 'bg-green-500'} text-white`}><AlertTriangle size={20} /></div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center mb-4 shrink-0">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" placeholder="Buscar por nome ou SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                    </div>
                </div>

                <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    {isLoading && products.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400"><Loader2 className="animate-spin mb-4" size={40} /><p>Buscando estoque...</p></div>
                    ) : (
                        <div className="overflow-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 sticky top-0 z-10 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                                    <tr>
                                        <th className="p-4 pl-8">Produto</th>
                                        <th className="p-4">Preço Venda</th>
                                        <th className="p-4">Custo</th>
                                        <th className="p-4">Estoque</th>
                                        <th className="p-4 pr-8 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredProducts.map(p => (
                                        <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 pl-8"><p className="font-bold text-slate-800">{p.nome}</p><p className="text-[10px] text-slate-400 font-mono">{p.sku || 'SEM SKU'}</p></td>
                                            <td className="p-4 font-bold text-slate-700">R$ {p.preco.toFixed(2)}</td>
                                            <td className="p-4 text-slate-500 font-medium">R$ {p.custo?.toFixed(2)}</td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-full font-black text-[11px] ${p.qtd <= 3 ? 'bg-red-100 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                                    {p.qtd} unidades
                                                </span>
                                            </td>
                                            <td className="p-4 pr-8">
                                                <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setEditingProduct(p); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"><Edit2 size={16} /></button>
                                                    <button onClick={() => handleDeleteProduct(p.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {isModalOpen && <ProductModal product={editingProduct} onClose={() => setIsModalOpen(false)} onSave={handleSaveProduct} />}
        </div>
    );
};

export default ProdutosView;
