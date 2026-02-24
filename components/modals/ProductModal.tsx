
import React, { useState, useEffect, useRef } from 'react';
// FIX: Added 'Info' to the imports from lucide-react
import { X, Package, DollarSign, Tag, BarChart, Save, AlertTriangle, Truck, Hash, Info } from 'lucide-react';
import { Product, Supplier } from '../../types';
import ToggleSwitch from '../shared/ToggleSwitch';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';

// FIX: Added missing helper function formatCurrency
const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface ProductModalProps {
    product?: Product | null;
    onClose: () => void;
    onSave: (product: Product) => void;
}

const ProductModal: React.FC<ProductModalProps> = ({ product, onClose, onSave }) => {
    const { activeStudioId } = useStudio();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [formData, setFormData] = useState<Partial<Product>>({
        name: product?.name || '',
        sku: product?.sku || '',
        stock_quantity: product?.stock_quantity || 0,
        min_stock: product?.min_stock || 5,
        cost_price: product?.cost_price || 0,
        price: product?.price || 0,
        active: product?.active ?? true,
        category: product?.category || 'Geral',
        supplier_id: product?.supplier_id || null,
        ...product
    });
    const abortControllerRef = useRef<AbortController | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        const loadSuppliers = async () => {
            if (!activeStudioId) return;
            
            if (abortControllerRef.current) abortControllerRef.current.abort();
            abortControllerRef.current = new AbortController();

            try {
                const { data, error } = await supabase
                    .from('suppliers')
                    .select('*')
                    .eq('studio_id', activeStudioId)
                    .order('name')
                    .abortSignal(abortControllerRef.current.signal);
                if (error) throw error;
                if (isMounted.current && data) setSuppliers(data);
            } catch (e: any) {
                const isAbortError = e.name === 'AbortError' || e.message?.includes('aborted');
                if (isMounted.current && !isAbortError) {
                    console.error("Erro ao carregar fornecedores:", e);
                }
            }
        };
        loadSuppliers();
        return () => {
            isMounted.current = false;
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, [activeStudioId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...formData,
            id: product?.id || Date.now(),
            name: formData.name || 'Novo Produto',
            stock_quantity: Number(formData.stock_quantity),
            min_stock: Number(formData.min_stock),
            cost_price: Number(formData.cost_price),
            price: Number(formData.price),
        } as Product);
    };

    const profitMargin = formData.price && formData.cost_price 
        ? (((formData.price - formData.cost_price) / formData.price) * 100).toFixed(1) 
        : '0.0';

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <header className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-purple-100 text-purple-600 rounded-xl shadow-sm">
                            <Package size={24} />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800 text-xl uppercase tracking-tighter">
                                {product?.id ? 'Ficha do Produto' : 'Novo Item'}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Controle de Inventário</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-all"><X size={24} /></button>
                </header>
                
                <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar text-left">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição Comercial</label>
                                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-purple-50 focus:border-purple-400 outline-none font-black text-slate-700 transition-all" placeholder="Ex: Shampoo Pos-Quimica 300ml" />
                            </div>
                            
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none">
                                    <option value="Cabelo">Cabelo</option>
                                    <option value="Unhas">Unhas</option>
                                    <option value="Estética">Estética</option>
                                    <option value="Maquiagem">Maquiagem</option>
                                    <option value="Geral">Geral / Revenda</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SKU / Cód. Barras</label>
                                <input value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none transition-all uppercase" placeholder="REF-001" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fornecedor Preferencial</label>
                            <div className="relative">
                                <Truck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                <select 
                                    value={formData.supplier_id || ''} 
                                    onChange={e => setFormData({...formData, supplier_id: e.target.value || null})} 
                                    className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl pl-11 pr-4 py-3.5 font-bold text-slate-700 outline-none appearance-none"
                                >
                                    <option value="">Nenhum fornecedor selecionado</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preço Custo</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-xs">R$</span>
                                    <input type="number" step="0.01" required value={formData.cost_price} onChange={e => setFormData({...formData, cost_price: Number(e.target.value)})} className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl pl-11 pr-4 py-3.5 focus:border-purple-400 outline-none font-bold text-slate-700" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preço Venda</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-xs">R$</span>
                                    <input type="number" step="0.01" required value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl pl-11 pr-4 py-3.5 focus:border-purple-400 outline-none font-black text-slate-800" />
                                </div>
                            </div>
                            <div className="bg-emerald-50 rounded-2xl p-2 flex flex-col justify-center items-center border-2 border-emerald-100 shadow-inner">
                                <span className="text-[9px] text-emerald-600 uppercase font-black tracking-tighter">Margem Real</span>
                                <span className={`text-lg font-black ${Number(profitMargin) > 0 ? 'text-emerald-700' : 'text-rose-500'}`}>
                                    {profitMargin}%
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-6 bg-slate-50 border-2 border-slate-100 rounded-[32px] space-y-4 shadow-inner">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 flex items-center gap-1.5">
                                        <AlertTriangle size={12} className="text-orange-500" />
                                        Alerta de Estoque Mínimo
                                    </label>
                                    <input type="number" required value={formData.min_stock} onChange={e => setFormData({...formData, min_stock: Number(e.target.value)})} className="w-full border-2 border-orange-100 bg-white rounded-xl px-4 py-2.5 font-black text-orange-600 outline-none focus:border-orange-400" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Saldo Atual</label>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => setFormData(p => ({...p, stock_quantity: Math.max(0, (p.stock_quantity || 0) - 1)}))} className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 font-black hover:bg-slate-100 transition-all">-</button>
                                        <input type="number" required value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: Number(e.target.value)})} className="flex-1 bg-white border border-slate-200 rounded-xl px-2 py-2 text-center font-black text-slate-800" />
                                        <button type="button" onClick={() => setFormData(p => ({...p, stock_quantity: (p.stock_quantity || 0) + 1}))} className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 font-black hover:bg-slate-100 transition-all">+</button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col justify-center gap-4">
                                <div className="flex items-center justify-between p-5 bg-white border-2 border-slate-100 rounded-[28px] transition-all hover:border-purple-200">
                                    <div>
                                        <p className="font-black text-slate-800 text-xs">Ativo p/ Venda?</p>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-tight">Exibir no PDV e Comandas</p>
                                    </div>
                                    <ToggleSwitch on={!!formData.active} onClick={() => setFormData({...formData, active: !formData.active})} />
                                </div>
                                <div className="p-4 bg-blue-50 text-blue-700 rounded-2xl flex items-start gap-3 border border-blue-100">
                                    {/* FIX: Info icon and formatCurrency were missing */}
                                    <Info size={16} className="mt-0.5" />
                                    <p className="text-[9px] font-bold uppercase leading-tight">O custo total deste item hoje é de {formatCurrency(Number(formData.cost_price || 0) * Number(formData.stock_quantity || 0))}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>

                <footer className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                    <button type="button" onClick={onClose} className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest text-xs hover:bg-slate-200 rounded-2xl transition-all">Cancelar</button>
                    <button type="submit" onClick={handleSubmit} className="flex-[2] py-4 bg-slate-800 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-900 shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95">
                        <Save size={20} /> Confirmar Cadastro
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default ProductModal;
