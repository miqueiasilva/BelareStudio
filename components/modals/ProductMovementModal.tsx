import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { Product } from '../../types';

interface ProductMovementModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const ProductMovementModal: React.FC<ProductMovementModalProps> = ({ onClose, onSuccess }) => {
    const { activeStudioId } = useStudio();
    const [products, setProducts] = useState<Product[]>([]);
    const [saving, setSaving] = useState(false);
    
    const [formData, setFormData] = useState({
        product_id: '',
        type: 'in' as 'in' | 'out',
        quantity: 1,
        reason: ''
    });

    useEffect(() => {
        const fetchProducts = async () => {
            if (!activeStudioId) return;
            try {
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .eq('studio_id', activeStudioId)
                    .eq('active', true)
                    .order('name');
                if (error) throw error;
                setProducts(data || []);
            } catch (error) {
                console.error("Erro ao buscar produtos:", error);
            }
        };
        fetchProducts();
    }, [activeStudioId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeStudioId || !formData.product_id) return;

        setSaving(true);
        try {
            // 1. Get current product to update stock
            const product = products.find(p => p.id === parseInt(formData.product_id));
            if (!product) throw new Error("Produto não encontrado");

            const newQuantity = formData.type === 'in' 
                ? product.stock_quantity + formData.quantity 
                : product.stock_quantity - formData.quantity;

            if (newQuantity < 0) {
                alert("Estoque insuficiente para esta saída.");
                setSaving(false);
                return;
            }

            // 2. Insert movement record
            const { error: moveError } = await supabase
                .from('product_movements')
                .insert([{
                    product_id: parseInt(formData.product_id),
                    type: formData.type,
                    quantity: formData.quantity,
                    reason: formData.reason,
                    studio_id: activeStudioId
                }]);

            if (moveError) throw moveError;

            // 3. Update product stock
            const { error: prodError } = await supabase
                .from('products')
                .update({ stock_quantity: newQuantity })
                .eq('id', product.id);

            if (prodError) throw prodError;

            onSuccess();
            onClose();
        } catch (error) {
            console.error("Erro ao salvar movimentação:", error);
            alert("Erro ao salvar movimentação.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <header className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Movimentar Estoque</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Entradas e Saídas Manuais</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400">
                        <X size={20} />
                    </button>
                </header>

                <form onSubmit={handleSave} className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Produto</label>
                        <select
                            required
                            value={formData.product_id}
                            onChange={e => setFormData({ ...formData, product_id: e.target.value })}
                            className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-purple-50 focus:border-purple-400 outline-none font-bold text-slate-700 transition-all"
                        >
                            <option value="">Selecione um produto...</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} (Saldo: {p.stock_quantity})</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, type: 'in' })}
                            className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border-2 ${formData.type === 'in' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg shadow-emerald-100' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                        >
                            <ArrowUpCircle size={18} /> Entrada
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, type: 'out' })}
                            className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border-2 ${formData.type === 'out' ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-lg shadow-rose-100' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                        >
                            <ArrowDownCircle size={18} /> Saída
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantidade</label>
                            <input
                                type="number"
                                required
                                min="1"
                                value={formData.quantity}
                                onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-purple-50 focus:border-purple-400 outline-none font-bold text-slate-700 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo</label>
                            <select
                                required
                                value={formData.reason}
                                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-purple-50 focus:border-purple-400 outline-none font-bold text-slate-700 transition-all"
                            >
                                <option value="">Selecione...</option>
                                {formData.type === 'in' ? (
                                    <>
                                        <option value="Compra">Compra / Reposição</option>
                                        <option value="Devolução">Devolução de Cliente</option>
                                        <option value="Ajuste">Ajuste de Inventário (+)</option>
                                        <option value="Brinde">Brinde de Fornecedor</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="Venda">Venda</option>
                                        <option value="Uso Interno">Uso Interno / Profissional</option>
                                        <option value="Avaria">Avaria / Quebra</option>
                                        <option value="Vencimento">Produto Vencido</option>
                                        <option value="Ajuste">Ajuste de Inventário (-)</option>
                                    </>
                                )}
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={saving || !formData.product_id || !formData.reason}
                        className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Confirmar Movimentação
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ProductMovementModal;
