
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
            const { data, error } = await supabase
                .from('team_members')
                .select('*, resources(name)')
                .eq('studio_id', activeStudioId)
                .order('name', { ascending: true });
            
            if (error) throw error;
            setProfessionals(data || []);
        } catch (error: any) {
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
                .from('team_members')
                .insert([{ studio_id: activeStudioId, name: 'Novo Profissional', role: 'Colaborador', active: true }])
                .select().single();
            if (error) throw error;
            setSelectedProf(data);
            fetchProfessionals();
        } catch (e: any) { setToast({ message: e.message, type: 'error' }); }
    };

    const handleToggleActive = async (e: any, id: any, current: any) => {
        e.stopPropagation();
        const { error } = await supabase.from('team_members').update({ active: !current }).eq('id', id);
        if (!error) {
            setProfessionals(prev => prev.map(p => p.id === id ? { ...p, active: !current } : p));
        }
    };

    const filtered = professionals.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (selectedProf) return <ProfessionalDetail professional={selectedProf} onBack={() => setSelectedProf(null)} onSave={() => { setSelectedProf(null); fetchProfessionals(); }} />;

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans overflow-hidden text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
                <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Users className="text-orange-500" /> Equipe</h1>
                <button onClick={handleCreateNew} className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-black text-xs shadow-lg active:scale-95">NOVO MEMBRO</button>
            </header>
            <div className="p-4 bg-white border-b border-slate-100">
                <input type="text" placeholder="Buscar profissional..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full max-w-md px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
            </div>
            <main className="flex-1 overflow-y-auto p-6">
                {loading ? <div className="flex justify-center p-20"><Loader2 className="animate-spin text-orange-500" size={40} /></div> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map(p => (
                            <div key={p.id} onClick={() => setSelectedProf(p)} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm cursor-pointer hover:border-orange-200 transition-all flex items-center gap-4">
                                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden">{p.photo_url ? <img src={p.photo_url} className="w-full h-full object-cover" /> : <UserIcon className="text-slate-300" />}</div>
                                <div className="flex-1 min-w-0"><h3 className="font-black text-slate-800 truncate">{p.name}</h3><p className="text-[10px] text-slate-400 font-bold uppercase">{p.role}</p></div>
                                <ToggleSwitch on={p.active} onClick={e => handleToggleActive(e, p.id, p.active)} />
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default EquipeView;
