
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
    Package, Search, Plus, Filter, Edit2, Trash2, 
    AlertTriangle, DollarSign, Archive, RefreshCw, Loader2
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { Product } from '../../types';
import ProductModal from '../modals/ProductModal';
import Toast, { ToastType } from '../shared/Toast';

const ProdutosView: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'todos' | 'baixo_estoque' | 'ativos'>('todos');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchProducts = useCallback(async () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('nome', { ascending: true })
                .abortSignal(controller.signal);
            
            if (error) throw error;
            setProducts(data || []);
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message?.includes('aborted')) return;
            setToast({ message: 'Erro ao carregar estoque.', type: 'error' });
        } finally {
            if (abortControllerRef.current === controller) {
                setIsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchProducts();
        return () => abortControllerRef.current?.abort();
    }, [fetchProducts]);

    const stats = useMemo(() => {
        const totalItems = products.length;
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
                sku: productData.sku || null,
                qtd: Number(productData.qtd),
                custo: Number(productData.custo),
                preco: Number(productData.preco),
                ativo: productData.ativo
            };

            const res = editingProduct
                ? await supabase.from('products').update(payload).eq('id', editingProduct.id)
                : await supabase.from('products').insert([payload]);

            if (res.error) throw res.error;

            setToast({ message: 'Estoque atualizado!', type: 'success' });
            setIsModalOpen(false);
            setEditingProduct(null);
            fetchProducts();
        } catch (error: any) {
            alert("Erro ao salvar produto: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteProduct = async (id: number) => {
        if (!window.confirm('Excluir este produto?')) return;
        try {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;
            setToast({ message: 'Produto removido.', type: 'info' });
            fetchProducts();
        } catch (error: any) {
            alert("Erro ao remover: " + error.message);
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 relative font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Package className="text-orange-500" /> Estoque de Produtos
                    </h1>
                    <p className="text-slate-500 text-sm">Controle de insumos e itens para revenda.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchProducts} className="p-2.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all"><RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} /></button>
                    <button onClick={() => { setEditingProduct(null); setIsModalOpen(true); }} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-100 flex items-center gap-2 active:scale-95 transition-all">
                        <Plus size={20} /> Novo Produto
                    </button>
                </div>
            </header>

            <main className="flex-1 p-6 space-y-6 overflow-hidden flex flex-col">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
                    <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-between">
                        <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Custo em Estoque</p><p className="text-2xl font-black text-slate-800 mt-1">R$ {stats.totalValue.toFixed(2)}</p></div>
                        <div className="p-3 bg-blue-500 rounded-2xl text-white shadow-lg shadow-blue-100"><DollarSign size={20} /></div>
                    </div>
                    <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-between">
                        <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Produtos Ativos</p><p className="text-2xl font-black text-slate-800 mt-1">{stats.totalItems}</p></div>
                        <div className="p-3 bg-slate-800 rounded-2xl text-white shadow-lg shadow-slate-100"><Archive size={20} /></div>
                    </div>
                    <div className={`p-5 rounded-[24px] border shadow-sm flex items-center justify-between transition-colors ${stats.lowStock > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
                        <div><p className={`text-[10px] font-black uppercase tracking-widest ${stats.lowStock > 0 ? 'text-red-600' : 'text-slate-400'}`}>Estoque Crítico</p><p className={`text-2xl font-black mt-1 ${stats.lowStock > 0 ? 'text-red-700' : 'text-slate-800'}`}>{stats.lowStock} itens</p></div>
                        <div className={`p-3 rounded-2xl ${stats.lowStock > 0 ? 'bg-red-600' : 'bg-green-500'} text-white shadow-lg`}><AlertTriangle size={20} /></div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center mb-4 shrink-0">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" placeholder="Buscar por nome ou SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                    </div>
                    <div className="flex gap-2">
                        {['todos', 'baixo_estoque', 'ativos'].map((st: any) => (
                            <button key={st} onClick={() => setFilterStatus(st)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${filterStatus === st ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>
                                {st.replace('_', ' ').toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    {isLoading && products.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400"><Loader2 className="animate-spin mb-4" size={40} /><p className="font-medium text-sm">Sincronizando inventário...</p></div>
                    ) : (
                        <div className="overflow-auto scrollbar-hide">
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
                                            <td className="p-4 pl-8">
                                                <p className="font-bold text-slate-800">{p.nome}</p>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">{p.sku || 'Sem Código'}</p>
                                            </td>
                                            <td className="p-4 font-black text-slate-800">R$ {p.preco.toFixed(2)}</td>
                                            <td className="p-4 text-slate-500 font-medium italic">R$ {p.custo?.toFixed(2)}</td>
                                            <td className="p-4">
                                                <span className={`px-4 py-1 rounded-full font-black text-[11px] uppercase ${p.qtd <= 3 ? 'bg-red-100 text-red-600' : 'bg-green-50 text-green-700'}`}>
                                                    {p.qtd} un
                                                </span>
                                            </td>
                                            <td className="p-4 pr-8 text-center">
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
