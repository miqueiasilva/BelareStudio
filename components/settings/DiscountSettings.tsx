
import React, { useState, useEffect } from 'react';
import { Tag, Save, Loader2, ArrowLeft, Plus, Trash2, Edit2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import Card from '../shared/Card';
import Toast, { ToastType } from '../shared/Toast';
import ToggleSwitch from '../shared/ToggleSwitch';
import { useConfirm } from '../../utils/useConfirm';

interface DiscountRule {
    id: string;
    name: string;
    type: 'percentage' | 'fixed';
    value: number;
    active: boolean;
}

const DiscountSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { activeStudioId } = useStudio();
    const { confirm, ConfirmDialogComponent } = useConfirm();
    const [rules, setRules] = useState<DiscountRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingRule, setEditingRule] = useState<DiscountRule | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    useEffect(() => {
        if (!activeStudioId) return;

        const fetchDiscounts = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('studio_settings')
                    .select('discount_rules')
                    .eq('studio_id', activeStudioId)
                    .maybeSingle();

                if (error) throw error;
                if (data?.discount_rules) {
                    setRules(data.discount_rules as DiscountRule[]);
                }
            } catch (err: any) {
                console.error("Erro ao carregar descontos:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDiscounts();
    }, [activeStudioId]);

    const handleSaveRules = async (updatedRules: DiscountRule[]) => {
        if (!activeStudioId) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('studio_settings')
                .upsert({ 
                    studio_id: activeStudioId, 
                    discount_rules: updatedRules,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'studio_id' });

            if (error) throw error;
            setRules(updatedRules);
            setToast({ message: "Regras de desconto atualizadas!", type: 'success' });
            setEditingRule(null);
        } catch (err: any) {
            setToast({ message: "Erro ao salvar: " + err.message, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddOrEdit = () => {
        if (!editingRule) return;

        if (!editingRule.name.trim() || editingRule.value <= 0) {
            setToast({ message: "Preencha o nome e um valor válido.", type: 'error' });
            return;
        }

        let newRules: DiscountRule[];
        if (editingRule.id) {
            // Edit
            newRules = rules.map(r => r.id === editingRule.id ? editingRule : r);
        } else {
            // Add
            const newRule = { ...editingRule, id: Date.now().toString() };
            newRules = [...rules, newRule];
        }

        handleSaveRules(newRules);
    };

    const handleDelete = async (id: string) => {
        const isConfirmed = await confirm({
            title: 'Excluir Desconto',
            message: 'Deseja realmente remover esta regra de desconto?',
            confirmText: 'Excluir',
            cancelText: 'Cancelar',
            type: 'danger'
        });

        if (isConfirmed) {
            const newRules = rules.filter(r => r.id !== id);
            handleSaveRules(newRules);
        }
    };

    if (isLoading) {
        return (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="animate-spin mb-4 text-orange-500" size={40} />
                <p className="text-xs font-black uppercase tracking-widest">Carregando promoções...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-500 text-left pb-32">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <ConfirmDialogComponent />

            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack} 
                        className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-orange-600 transition-all shadow-sm"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-tight">Regras de Desconto</h1>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Gerencie cupons e descontos do PDV</p>
                    </div>
                </div>
                <button 
                    onClick={() => setEditingRule({ id: '', name: '', type: 'percentage', value: 0, active: true })}
                    className="w-full sm:w-auto bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95"
                >
                    <Plus size={18} /> Novo Desconto
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {rules.length === 0 ? (
                    <div className="md:col-span-2 py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                        <Tag size={48} className="opacity-10 mb-4" />
                        <p className="font-bold uppercase tracking-widest text-xs">Nenhum desconto cadastrado</p>
                    </div>
                ) : (
                    rules.map((rule) => (
                        <div 
                            key={rule.id}
                            className={`bg-white p-6 rounded-[32px] border-2 transition-all relative overflow-hidden group ${
                                rule.active ? 'border-slate-100 hover:border-orange-200 shadow-sm hover:shadow-xl' : 'border-slate-50 opacity-60'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-2xl ${rule.active ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <Tag size={20} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setEditingRule(rule)}
                                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-blue-600 transition-all"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(rule.id)}
                                        className="p-2 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-600 transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <h3 className="font-black text-slate-800 text-lg leading-tight">
                                    {rule.name}
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-wider">
                                        {rule.type === 'percentage' ? 'Percentual' : 'Valor Fixo'}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                        rule.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                        {rule.active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-4">
                                <div className="space-y-0.5">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Valor do Desconto</p>
                                    <p className="text-xl font-black text-slate-800">
                                        {rule.type === 'percentage' ? `${rule.value}%` : `R$ ${rule.value.toFixed(2)}`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {editingRule && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">
                                    {editingRule.id ? 'Editar Desconto' : 'Novo Desconto'}
                                </h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Configure as regras da promoção</p>
                            </div>
                            <button onClick={() => setEditingRule(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-all"><X size={24} /></button>
                        </header>

                        <div className="p-8 space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Nome do Desconto</label>
                                <input 
                                    value={editingRule.name}
                                    onChange={e => setEditingRule({...editingRule, name: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-100 transition-all"
                                    placeholder="Ex: Black Friday, Amigo Indica..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo</label>
                                    <select 
                                        value={editingRule.type}
                                        onChange={e => setEditingRule({...editingRule, type: e.target.value as any})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none appearance-none"
                                    >
                                        <option value="percentage">Percentual (%)</option>
                                        <option value="fixed">Valor Fixo (R$)</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Valor</label>
                                    <input 
                                        type="number"
                                        value={editingRule.value || ''}
                                        onChange={e => setEditingRule({...editingRule, value: parseFloat(e.target.value) || 0})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-slate-200">
                                <div>
                                    <p className="font-black text-slate-700 text-sm">Desconto Ativo?</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Habilita seleção no PDV</p>
                                </div>
                                <ToggleSwitch 
                                    on={editingRule.active} 
                                    onClick={() => setEditingRule({...editingRule, active: !editingRule.active})} 
                                />
                            </div>
                        </div>

                        <footer className="p-8 bg-slate-50 border-t border-slate-100">
                            <button 
                                onClick={handleAddOrEdit}
                                disabled={isSaving}
                                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                {editingRule.id ? 'Salvar Alterações' : 'Criar Desconto'}
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DiscountSettings;
