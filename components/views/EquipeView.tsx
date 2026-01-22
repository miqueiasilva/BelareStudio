
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Plus, Users, Loader2, Search, ArrowRight, User as UserIcon, 
    Briefcase, RefreshCw, AlertTriangle, LayoutGrid, List,
    ChevronRight, Settings2, MapPin
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import ProfessionalDetail from './ProfessionalDetail';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';

const EquipeView: React.FC = () => {
    const { activeStudioId } = useStudio();
    const [professionals, setProfessionals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProf, setSelectedProf] = useState<any | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    
    const fetchProfessionals = async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            // ✅ UNIFICAÇÃO: Tabela professionals com colunas canônicas
            const { data, error } = await supabase
                .from('professionals')
                .select('*')
                .eq('studio_id', activeStudioId)
                .order('nome', { ascending: true });
            
            if (error) throw error;
            setProfessionals(data || []);
        } catch (error: any) {
            console.error("EquipeView:", error);
            setToast({ message: "Erro ao carregar equipe.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProfessionals(); }, [activeStudioId]);

    const handleCreateNew = async () => {
        if (!activeStudioId) return;
        try {
            const { data, error } = await supabase
                .from('professionals')
                .insert([{ studio_id: activeStudioId, nome: 'Novo Profissional', role: 'Colaborador', active: true }])
                .select().single();
            if (error) throw error;
            setSelectedProf(data);
            fetchProfessionals();
        } catch (e: any) { 
            console.error("handleCreateNew:", e);
            setToast({ message: e.message, type: 'error' }); 
        }
    };

    const handleToggleActive = async (e: any, id: any, current: any) => {
        e.stopPropagation();
        const { error } = await supabase.from('professionals').update({ active: !current }).eq('id_uuid', id);
        if (!error) {
            setProfessionals(prev => prev.map(p => p.id_uuid === id ? { ...p, active: !current } : p));
        }
    };

    const filtered = professionals.filter(p => (p.nome || '').toLowerCase().includes(searchTerm.toLowerCase()));

    if (selectedProf) return (
        <ProfessionalDetail 
            professional={{...selectedProf, id: selectedProf.id_uuid, name: selectedProf.nome, avatarUrl: selectedProf.photo_url || ''}} 
            onBack={() => setSelectedProf(null)} 
            onSave={() => { setSelectedProf(null); fetchProfessionals(); }} 
        />
    );

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans overflow-hidden text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Users className="text-orange-500" /> Equipe</h1>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Sincronizado com Unidade Ativa</p>
                </div>
                <button onClick={handleCreateNew} className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-black text-xs shadow-lg active:scale-95">NOVO MEMBRO</button>
            </header>
            <div className="p-4 bg-white border-b border-slate-100">
                <div className="relative group max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={18} />
                    <input type="text" placeholder="Buscar profissional..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white transition-all outline-none" />
                </div>
            </div>
            <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {loading ? <div className="flex flex-col items-center justify-center p-20 text-slate-400"><Loader2 className="animate-spin text-orange-500 mb-4" size={40} /><p className="text-[10px] font-black uppercase tracking-widest">Consultando Profissionais...</p></div> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map(p => (
                            <div key={p.id_uuid} onClick={() => setSelectedProf(p)} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm cursor-pointer hover:border-orange-200 hover:shadow-md transition-all flex items-center gap-4 group">
                                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-white shadow-sm group-hover:border-orange-100 transition-colors">
                                    {p.photo_url ? <img src={p.photo_url} className="w-full h-full object-cover" /> : <UserIcon className="text-slate-300" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-black text-slate-800 truncate group-hover:text-orange-600 transition-colors">{p.nome}</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{p.role || 'Colaborador'}</p>
                                </div>
                                <ToggleSwitch on={p.active} onClick={e => handleToggleActive(e, p.id_uuid, p.active)} />
                            </div>
                        ))}
                        {filtered.length === 0 && (
                            <div className="col-span-full py-20 text-center text-slate-400">
                                <Users size={48} className="mx-auto opacity-10 mb-4" />
                                <p className="font-bold uppercase text-xs tracking-widest">Nenhum profissional encontrado.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default EquipeView;
