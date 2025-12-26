import React, { useState, useEffect, useRef } from 'react';
import { 
    Plus, Users, Loader2, Search, ArrowRight, User as UserIcon, 
    Briefcase, ShieldCheck, ShieldAlert, RefreshCw, AlertTriangle
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { LegacyProfessional } from '../../types';
import ProfessionalDetail from './ProfessionalDetail';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';

const EquipeView: React.FC = () => {
    const [professionals, setProfessionals] = useState<LegacyProfessional[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProf, setSelectedProf] = useState<LegacyProfessional | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    
    const isMounted = useRef(true);
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchProfessionals = async () => {
        if (!isMounted.current) return;
        
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        setLoading(true);
        setError(null);
        
        // Watchdog Timer: Destrava a UI se demorar mais de 8s
        const watchdog = setTimeout(() => {
            if (isMounted.current && loading) {
                setLoading(false);
                setError("O carregamento excedeu 8 segundos. Verifique sua conexão com o banco de dados.");
            }
        }, 8000);

        try {
            const { data, error: sbError } = await supabase
                .from('professionals')
                .select('*')
                .order('name', { ascending: true });
            
            if (sbError) throw sbError;
            if (isMounted.current) setProfessionals(data || []);
        } catch (error: any) {
            if (isMounted.current && error.name !== 'AbortError') {
                setError(error.message || "Erro ao carregar equipe.");
            }
        } finally {
            clearTimeout(watchdog);
            if (isMounted.current) setLoading(false);
        }
    };

    useEffect(() => {
        isMounted.current = true;
        fetchProfessionals();
        return () => {
            isMounted.current = false;
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, []);

    const handleCreateNew = async () => {
        try {
            const { data, error } = await supabase.from('professionals').insert([{ name: 'Novo Profissional', role: 'Colaborador', active: true, online_booking: true, commission_rate: 30 }]).select().single();
            if (error) throw error;
            if (isMounted.current) {
                setSelectedProf(data as any);
                setToast({ message: 'Colaborador criado!', type: 'success' });
                fetchProfessionals();
            }
        } catch (e: any) { setToast({ message: e.message, type: 'error' }); }
    };

    const handleToggleActive = async (id: number, currentStatus: boolean) => {
        try {
            await supabase.from('professionals').update({ active: !currentStatus }).eq('id', id);
            if (isMounted.current) {
                setProfessionals(prev => prev.map(p => p.id === id ? { ...p, active: !currentStatus } : p));
                setToast({ message: `Status atualizado.`, type: 'success' });
            }
        } catch (e) { setToast({ message: 'Erro ao atualizar.', type: 'error' }); }
    };

    if (selectedProf) {
        return (
            <ProfessionalDetail 
                professional={selectedProf}
                onBack={() => { setSelectedProf(null); fetchProfessionals(); }}
                onSave={() => { setSelectedProf(null); fetchProfessionals(); }}
            />
        );
    }

    const filteredProfessionals = professionals.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.role && p.role.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="h-full flex flex-col bg-slate-50 relative font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Users className="text-orange-500" size={28} /> Gestão de Equipe
                    </h1>
                </div>
                <button onClick={handleCreateNew} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2">
                    <Plus size={20} /> Novo Colaborador
                </button>
            </header>

            <main className="flex-1 overflow-y-auto p-8">
                <div className="max-w-6xl mx-auto">
                    {error && (
                        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-amber-800">
                           <div className="flex items-center gap-3"><AlertTriangle size={20} /><span>{error}</span></div>
                           <button onClick={fetchProfessionals} className="p-2 hover:bg-amber-100 rounded-lg transition-colors"><RefreshCw size={18} /></button>
                        </div>
                    )}

                    <div className="mb-8 relative max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <Loader2 className="animate-spin mb-4" size={48} />
                            <p className="font-medium">Carregando...</p>
                        </div>
                    ) : filteredProfessionals.length === 0 ? (
                        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 border-dashed">
                            <Users size={64} className="mx-auto text-slate-200 mb-4" />
                            <h3 className="text-lg font-bold text-slate-600">Nenhum colaborador</h3>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredProfessionals.map(prof => (
                                <div key={prof.id} className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all group relative">
                                    <div className="absolute top-6 right-6">
                                        <ToggleSwitch on={!!prof.active} onClick={() => handleToggleActive(prof.id, !!prof.active)} />
                                    </div>
                                    <div className="flex flex-col items-center text-center cursor-pointer" onClick={() => setSelectedProf(prof)}>
                                        <div className="relative mb-6">
                                            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md bg-slate-100 flex items-center justify-center">
                                                {(prof as any).photo_url ? <img src={(prof as any).photo_url} className="w-full h-full object-cover" /> : <UserIcon size={40} className="text-slate-300" />}
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-1">{prof.name}</h3>
                                        <p className="text-slate-500 font-bold mb-6 uppercase tracking-widest text-[10px]">{prof.role}</p>
                                        <div className="mt-auto flex items-center gap-2 text-orange-500 font-black text-xs uppercase tracking-widest py-2 px-4 rounded-full bg-orange-50 group-hover:bg-orange-500 group-hover:text-white transition-all">
                                            Gerenciar <ArrowRight size={14} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default EquipeView;