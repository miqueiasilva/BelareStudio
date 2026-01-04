
import React, { useState, useEffect } from 'react';
import { 
    CreditCard, Plus, Trash2, Save, X, Loader2, 
    Smartphone, Banknote, Percent, Info, ChevronRight,
    ArrowLeft, CheckCircle2
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import ToggleSwitch from '../shared/ToggleSwitch';

const PaymentSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [methods, setMethods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingMethod, setEditingMethod] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const fetchMethods = async () => {
        setLoading(true);
        const { data } = await supabase.from('payment_methods_config').select('*').order('name');
        if (data) setMethods(data);
        setLoading(false);
    };

    useEffect(() => { fetchMethods(); }, []);

    const handleSave = async () => {
        if (!editingMethod.name) return alert("Dê um nome ao método.");
        setIsSaving(true);
        const { error } = await supabase
            .from('payment_methods_config')
            .upsert(editingMethod);
        
        setIsSaving(false);
        if (!error) {
            setEditingMethod(null);
            fetchMethods();
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'pix': return <Smartphone className="text-teal-500" />;
            case 'money': return <Banknote className="text-green-500" />;
            default: return <CreditCard className="text-blue-500" />;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 text-left">
            <header className="flex items-center justify-between mb-8">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-800 font-bold transition-colors">
                    <ArrowLeft size={20} /> Voltar ao Menu
                </button>
                <button 
                    onClick={() => setEditingMethod({ name: '', type: 'credit', fee_at_sight: 0, allow_installments: false, installment_fees: {} })}
                    className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg shadow-orange-100 transition-all active:scale-95"
                >
                    <Plus size={18} /> Novo Método
                </button>
            </header>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="animate-spin mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando taxas...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {methods.map(method => (
                        <div 
                            key={method.id}
                            onClick={() => setEditingMethod(method)}
                            className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                                    {getIcon(method.type)}
                                </div>
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{method.type}</span>
                            </div>
                            <h3 className="font-black text-slate-800 text-lg leading-tight">{method.name}</h3>
                            <div className="mt-4 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Taxa à vista</p>
                                    <p className="font-black text-orange-600">{method.fee_at_sight}%</p>
                                </div>
                                <div className="text-right space-y-0.5">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Parcelas</p>
                                    <p className="text-xs font-bold text-slate-600">{method.allow_installments ? 'Ativo' : 'Não'}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Edição (Drawer Style) */}
            {editingMethod && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Configurar Método</h2>
                            <button onClick={() => setEditingMethod(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X size={24} /></button>
                        </header>

                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar text-left">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome de Exibição (Ex: Master)</label>
                                    <input 
                                        value={editingMethod.name}
                                        onChange={e => setEditingMethod({...editingMethod, name: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 font-bold outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo</label>
                                        <select 
                                            value={editingMethod.type}
                                            onChange={e => setEditingMethod({...editingMethod, type: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 font-bold outline-none"
                                        >
                                            <option value="credit">Crédito</option>
                                            <option value="debit">Débito</option>
                                            <option value="pix">PIX</option>
                                            <option value="money">Dinheiro</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Taxa à Vista (%)</label>
                                        <input 
                                            type="number"
                                            value={editingMethod.fee_at_sight}
                                            onChange={e => setEditingMethod({...editingMethod, fee_at_sight: parseFloat(e.target.value)})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 font-black text-orange-600 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-5 bg-slate-50 rounded-[28px] border border-slate-200">
                                    <div>
                                        <p className="font-black text-slate-700 text-sm">Permitir Parcelamento?</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Exibir opções de 2x a 12x</p>
                                    </div>
                                    <ToggleSwitch 
                                        on={editingMethod.allow_installments} 
                                        onClick={() => setEditingMethod({...editingMethod, allow_installments: !editingMethod.allow_installments})} 
                                    />
                                </div>

                                {editingMethod.allow_installments && (
                                    <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                                        <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mb-4 text-center">Configuração de Taxas por Parcela</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {[2,3,4,5,6,7,8,9,10,11,12].map(p => (
                                                <div key={p} className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
                                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">{p}x (%)</label>
                                                    <input 
                                                        type="number"
                                                        placeholder="0.00"
                                                        value={editingMethod.installment_fees?.[p] || ''}
                                                        onChange={(e) => {
                                                            const fees = { ...(editingMethod.installment_fees || {}) };
                                                            fees[p] = parseFloat(e.target.value);
                                                            setEditingMethod({...editingMethod, installment_fees: fees});
                                                        }}
                                                        className="w-full bg-slate-50 border-transparent rounded-lg px-2 py-1.5 text-xs font-black text-slate-700 focus:bg-white focus:border-orange-200 transition-all outline-none"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <footer className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                            <button 
                                onClick={async () => {
                                    if(confirm("Excluir este método?")) {
                                        await supabase.from('payment_methods_config').delete().eq('id', editingMethod.id);
                                        setEditingMethod(null);
                                        fetchMethods();
                                    }
                                }}
                                className="p-4 bg-white border border-slate-200 text-rose-500 rounded-2xl hover:bg-rose-50 transition-all shadow-sm"
                            >
                                <Trash2 size={24} />
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                                Salvar Configuração
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentSettings;
