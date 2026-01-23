
import React, { useState, useEffect } from 'react';
import { X, Truck, Plus, Trash2, Save, Loader2, Phone, Mail, User } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { Supplier } from '../../types';
import Toast, { ToastType } from '../shared/Toast';

interface SupplierManagerModalProps {
    onClose: () => void;
}

const SupplierManagerModal: React.FC<SupplierManagerModalProps> = ({ onClose }) => {
    const { activeStudioId } = useStudio();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const [newSupplier, setNewSupplier] = useState({
        name: '',
        contact_person: '',
        phone: '',
        email: ''
    });

    const fetchSuppliers = async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .eq('studio_id', activeStudioId)
                .order('name');
            if (error) throw error;
            setSuppliers(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSuppliers(); }, [activeStudioId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSupplier.name.trim() || !activeStudioId) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('suppliers')
                .insert([{ ...newSupplier, studio_id: activeStudioId }]);
            if (error) throw error;

            setNewSupplier({ name: '', contact_person: '', phone: '', email: '' });
            setToast({ message: "Fornecedor cadastrado!", type: 'success' });
            fetchSuppliers();
        } catch (e: any) {
            setToast({ message: e.message, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Remover este fornecedor? Produtos associados não serão apagados.")) return;
        try {
            const { error } = await supabase.from('suppliers').delete().eq('id', id);
            if (error) throw error;
            setSuppliers(prev => prev.filter(s => s.id !== id));
            setToast({ message: "Fornecedor removido.", type: 'info' });
        } catch (e: any) {
            setToast({ message: "Erro ao excluir.", type: 'error' });
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
                <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
                            <Truck className="text-orange-500" size={24} />
                            Fornecedores
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={24} /></button>
                </header>

                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <form onSubmit={handleSave} className="space-y-4 bg-slate-50 p-6 rounded-[32px] border-2 border-slate-100 shadow-inner">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Novo Parceiro Comercial</h3>
                        <div className="space-y-3">
                            <div className="relative group">
                                <Truck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input required value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-100" placeholder="Nome da Empresa" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative group">
                                    <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input value={newSupplier.phone} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-100" placeholder="Telefone" />
                                </div>
                                <div className="relative group">
                                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input value={newSupplier.email} onChange={e => setNewSupplier({...newSupplier, email: e.target.value})} className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-100" placeholder="E-mail" />
                                </div>
                            </div>
                        </div>
                        <button type="submit" disabled={isSaving || !newSupplier.name} className="w-full bg-slate-800 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-slate-900 disabled:opacity-50">
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Cadastrar Fornecedor
                        </button>
                    </form>

                    <div className="space-y-2">
                        {loading ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div> : suppliers.length === 0 ? (
                            <div className="text-center p-10 text-slate-400 italic text-sm">Sem fornecedores cadastrados.</div>
                        ) : (
                            suppliers.map(s => (
                                <div key={s.id} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-3xl group hover:border-orange-200 transition-all">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-black text-slate-800 text-sm uppercase tracking-tighter truncate">{s.name}</h4>
                                        <div className="flex gap-4 mt-1 text-[10px] font-bold text-slate-400 uppercase">
                                            {s.phone && <span className="flex items-center gap-1"><Phone size={10} /> {s.phone}</span>}
                                            {s.email && <span className="flex items-center gap-1"><Mail size={10} /> {s.email}</span>}
                                        </div>
                                    </div>
                                    <button onClick={() => handleDelete(s.id)} className="p-2.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupplierManagerModal;
