
import React, { useState, useEffect } from 'react';
import { 
    CreditCard, Plus, Trash2, Save, X, Loader2, 
    Smartphone, Banknote, ArrowLeft, CheckCircle2, AlertCircle, Info,
    ChevronDown, CreditCard as CardIcon, Percent, Layers
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';

interface PaymentMethod {
    id?: number;
    name: string;
    type: 'credit' | 'debit' | 'pix' | 'money';
    brand?: string;
    rate_cash: number;
    allow_installments: boolean;
    max_installments: number;
    installment_rates: Record<string, number>;
    is_active: boolean;
}

const CARD_BRANDS = ['VISA', 'MASTER', 'ELO', 'HIPER', 'AMEX', 'OUTRAS'];
const INSTALLMENT_OPTIONS = Array.from({ length: 11 }, (_, i) => i + 2); // 2x até 12x

const PaymentSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [methods, setMethods] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const fetchMethods = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('payment_methods_config')
                .select('*')
                .order('name');
            
            if (error) throw error;
            if (data) setMethods(data.map(m => ({
                ...m,
                installment_rates: m.installment_rates || {}
            })));
        } catch (err: any) {
            console.error("Erro ao buscar métodos:", err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchMethods(); }, []);

    const handleSaveMethod = async () => {
        if (!editingMethod || !editingMethod.name) {
            setToast({ message: "O nome do método é obrigatório.", type: 'error' });
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                id: editingMethod.id,
                name: editingMethod.name,
                type: editingMethod.type,
                brand: (editingMethod.type === 'credit' || editingMethod.type === 'debit') ? editingMethod.brand : null,
                rate_cash: Number(editingMethod.rate_cash) || 0,
                allow_installments: editingMethod.type === 'credit' ? editingMethod.allow_installments : false,
                max_installments: editingMethod.type === 'credit' ? Number(editingMethod.max_installments) : 1,
                installment_rates: editingMethod.type === 'credit' ? editingMethod.installment_rates : {},
                is_active: editingMethod.is_active,
                updated_at: new Date()
            };

            const { error } = await supabase
                .from('payment_methods_config')
                .upsert(payload);

            if (error) throw error;

            setToast({ message: "Configuração de taxas salva!", type: 'success' });
            setEditingMethod(null);
            fetchMethods();
        } catch (err: any) {
            setToast({ message: `Erro ao salvar: ${err.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Deseja excluir este método de pagamento permanentemente?")) return;
        
        try {
            const { error } = await supabase
                .from('payment_methods_config')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setToast({ message: "Método removido.", type: 'info' });
            fetchMethods();
            setEditingMethod(null);
        } catch (err: any) {
            setToast({ message: "Erro ao excluir método.", type: 'error' });
        }
    };

    const handleRateChange = (installment: number, value: string) => {
        if (!editingMethod) return;
        setEditingMethod({
            ...editingMethod,
            installment_rates: {
                ...editingMethod.installment_rates,
                [installment.toString()]: parseFloat(value) || 0
            }
        });
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'pix': return <Smartphone className="text-teal-500" />;
            case 'money': return <Banknote className="text-green-500" />;
            default: return <CreditCard className="text-blue-500" />;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 text-left pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Cabeçalho */}
            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack} 
                        className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-orange-500 hover:border-orange-200 transition-all shadow-sm group"
                    >
                        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter leading-tight">Pagamentos & Taxas</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gestão de adquirentes e parcelamento</p>
                    </div>
                </div>
                <button 
                    onClick={() => setEditingMethod({ 
                        name: '', 
                        type: 'credit', 
                        brand: 'VISA', 
                        rate_cash: 0, 
                        allow_installments: false,
                        max_installments: 1,
                        installment_rates: {},
                        is_active: true 
                    })}
                    className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-orange-100 transition-all active:scale-95"
                >
                    <Plus size={18} /> Novo Método
                </button>
            </header>

            {loading ? (
                <div className="py-24 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="animate-spin mb-4 text-orange-500" size={32} />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Sincronizando taxas...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {methods.map(method => (
                        <div 
                            key={method.id}
                            onClick={() => setEditingMethod(method)}
                            className={`bg-white p-6 rounded-[32px] border-2 transition-all cursor-pointer group relative overflow-hidden ${method.is_active ? 'border-slate-100 hover:border-orange-200 hover:shadow-xl' : 'border-slate-100 opacity-60'}`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                                    {getIcon(method.type)}
                                </div>
                                <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${method.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {method.is_active ? 'Ativo' : 'Inativo'}
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <h3 className="font-black text-slate-800 text-lg leading-tight group-hover:text-orange-600 transition-colors">
                                    {method.name}
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {(method.type === 'credit' || method.type === 'debit') && method.brand && (
                                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-wider">
                                            {method.type === 'credit' ? 'Crédito' : 'Débito'} • {method.brand}
                                        </span>
                                    )}
                                    {method.allow_installments && (
                                        <span className="inline-block px-2 py-0.5 bg-orange-50 text-orange-600 rounded text-[9px] font-black uppercase tracking-wider">
                                            Até {method.max_installments}x
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-4">
                                <div className="space-y-0.5">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Taxa 1x (Vista)</p>
                                    <p className="text-sm font-black text-slate-700">{method.rate_cash}%</p>
                                </div>
                                {method.allow_installments && (
                                    <div className="text-right space-y-0.5">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Taxa Máx ({method.max_installments}x)</p>
                                        <p className="text-sm font-black text-orange-600">
                                            {method.installment_rates[method.max_installments.toString()] || 0}%
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Edição */}
            {editingMethod && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
                        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Configurar Adquirente</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ajuste de taxas e parcelas</p>
                            </div>
                            <button onClick={() => setEditingMethod(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-all"><X size={24} /></button>
                        </header>

                        <div className="p-8 space-y-8 text-left max-h-[75vh] overflow-y-auto custom-scrollbar">
                            
                            {/* Seção 1: Básicos */}
                            <div className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Nome Identificador</label>
                                    <input 
                                        value={editingMethod.name}
                                        onChange={e => setEditingMethod({...editingMethod, name: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 transition-all"
                                        placeholder="Ex: Stone - Visa"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo</label>
                                        <select 
                                            value={editingMethod.type}
                                            onChange={e => setEditingMethod({...editingMethod, type: e.target.value as any})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-100 appearance-none"
                                        >
                                            <option value="credit">Crédito</option>
                                            <option value="debit">Débito</option>
                                            <option value="pix">PIX</option>
                                            <option value="money">Dinheiro</option>
                                        </select>
                                    </div>

                                    {(editingMethod.type === 'credit' || editingMethod.type === 'debit') && (
                                        <div className="space-y-1.5 animate-in fade-in">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Bandeira</label>
                                            <div className="relative">
                                                <select 
                                                    value={editingMethod.brand || 'VISA'}
                                                    onChange={e => setEditingMethod({...editingMethod, brand: e.target.value})}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none appearance-none"
                                                >
                                                    {CARD_BRANDS.map(brand => (
                                                        <option key={brand} value={brand}>{brand}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5 max-w-[200px]">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Taxa à Vista / 1x (%)</label>
                                    <div className="relative">
                                        <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                        <input 
                                            type="number" step="0.01" value={editingMethod.rate_cash}
                                            onChange={e => setEditingMethod({...editingMethod, rate_cash: parseFloat(e.target.value)})}
                                            className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-emerald-600 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Seção 2: Parcelamento (Apenas Crédito) */}
                            {editingMethod.type === 'credit' && (
                                <div className="pt-6 border-t border-slate-100 space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex items-center justify-between p-5 bg-orange-50/30 rounded-3xl border border-orange-100">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                                                <Layers size={18} />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 text-sm">Vendas Parceladas</p>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Habilitar múltiplas parcelas</p>
                                            </div>
                                        </div>
                                        <ToggleSwitch 
                                            on={editingMethod.allow_installments} 
                                            onClick={() => setEditingMethod({...editingMethod, allow_installments: !editingMethod.allow_installments})} 
                                        />
                                    </div>

                                    {editingMethod.allow_installments && (
                                        <div className="space-y-6 animate-in fade-in">
                                            <div className="space-y-1.5 max-w-[240px]">
                                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Parcelamento Máximo</label>
                                                <div className="relative">
                                                    <select 
                                                        value={editingMethod.max_installments}
                                                        onChange={e => setEditingMethod({...editingMethod, max_installments: parseInt(e.target.value)})}
                                                        className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none appearance-none shadow-sm"
                                                    >
                                                        {INSTALLMENT_OPTIONS.map(opt => (
                                                            <option key={opt} value={opt}>{opt} Vezes</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                                                </div>
                                            </div>

                                            {/* Grid Dinâmico de Taxas */}
                                            <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-200">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <Percent size={12} /> Tabela de Taxas por Parcela
                                                </h4>
                                                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                                    {Array.from({ length: editingMethod.max_installments - 1 }, (_, i) => i + 2).map(n => (
                                                        <div key={n} className="flex flex-col gap-1.5">
                                                            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">{n}x (em %)</label>
                                                            <input 
                                                                type="number" step="0.01"
                                                                value={editingMethod.installment_rates[n.toString()] || ''}
                                                                onChange={e => handleRateChange(n, e.target.value)}
                                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 focus:ring-4 focus:ring-orange-50 focus:border-orange-200 outline-none"
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Status Ativo/Inativo */}
                            <div className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-slate-200">
                                <div>
                                    <p className="font-black text-slate-700 text-sm">Método Ativo?</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Disponível para seleção no PDV</p>
                                </div>
                                <ToggleSwitch 
                                    on={editingMethod.is_active} 
                                    onClick={() => setEditingMethod({...editingMethod, is_active: !editingMethod.is_active})} 
                                />
                            </div>
                        </div>

                        <footer className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
                            {editingMethod.id && (
                                <button 
                                    onClick={() => handleDelete(editingMethod.id!)}
                                    className="p-4 bg-white border border-slate-200 text-rose-500 rounded-2xl hover:bg-rose-50 transition-all shadow-sm active:scale-90"
                                >
                                    <Trash2 size={24} />
                                </button>
                            )}
                            <button 
                                onClick={handleSaveMethod}
                                disabled={isSaving}
                                className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                Salvar Tabela de Taxas
                            </button>
                        </footer>
                    </div>
                </div>
            )}
            
            {/* Aviso */}
            <div className="bg-blue-50 border border-blue-100 p-6 rounded-[32px] flex gap-4 max-w-2xl mx-auto">
                <div className="p-2 bg-blue-100 rounded-xl h-fit">
                    <Info className="text-blue-600" size={20} />
                </div>
                <div className="space-y-1">
                    <p className="text-xs text-blue-900 font-bold">Importante</p>
                    <p className="text-xs text-blue-700 leading-relaxed font-medium">
                        As taxas configuradas serão aplicadas automaticamente nos cálculos de fechamento de caixa e relatórios de lucratividade líquida. Mantenha os valores atualizados conforme o contrato com sua operadora.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PaymentSettings;
