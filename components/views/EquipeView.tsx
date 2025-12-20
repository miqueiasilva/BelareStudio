
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Plus, Users, Loader2, Search, ArrowRight, User as UserIcon, 
    Briefcase, ShieldCheck, ShieldAlert, RefreshCw 
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { LegacyProfessional } from '../../types';
import ProfessionalDetail from './ProfessionalDetail';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';

const EquipeView: React.FC = () => {
    const [professionals, setProfessionals] = useState<LegacyProfessional[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProf, setSelectedProf] = useState<LegacyProfessional | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const showToast = useCallback((message: any, type: ToastType = 'success') => {
        let finalMessage = "";
        if (typeof message === 'string') {
            finalMessage = message;
        } else if (message?.message && typeof message.message === 'string') {
            finalMessage = message.message;
        } else {
            finalMessage = JSON.stringify(message) || "Erro inesperado";
        }
        setToast({ message: finalMessage, type });
    }, []);

    const fetchProfessionals = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data, error: sbError } = await supabase
                .from('professionals')
                .select('*')
                .order('name', { ascending: true });
            
            if (sbError) throw sbError;
            setProfessionals(data || []);
        } catch (err: any) {
            console.error("Fetch Staff Error:", err);
            setError(typeof err?.message === 'string' ? err.message : "Erro inesperado ao carregar equipe.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProfessionals();
    }, [fetchProfessionals]);

    const handleCreateNew = useCallback(async () => {
        setIsLoading(true);
        try {
            const payload = {
                name: 'Novo Profissional',
                role: 'Colaborador',
                active: true,
                online_booking: true,
                commission_rate: 30,
                permissions: {},
                work_schedule: {},
                services_enabled: []
            };
            
            const { data, error } = await supabase.from('professionals').insert([payload]).select().single();
            if (error) throw error;
            
            setProfessionals(prev => [...prev, data as any]);
            setSelectedProf(data as any);
            showToast('Novo rascunho criado!');
        } catch (error: any) {
            const msg = typeof error?.message === 'string' ? error.message : "Falha no banco.";
            showToast(`Erro ao criar: ${msg}`, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    const handleToggleActive = useCallback(async (id: number, currentStatus: boolean) => {
        try {
            const { error } = await supabase.from('professionals').update({ active: !currentStatus }).eq('id', id);
            if (error) throw error;
            setProfessionals(prev => prev.map(p => p.id === id ? { ...p, active: !currentStatus } : p));
            showToast(`Status atualizado com sucesso.`);
        } catch (error: any) {
            const msg = typeof error?.message === 'string' ? error.message : "Falha no servidor.";
            showToast(`Erro ao atualizar status: ${msg}`, 'error');
        }
    }, [showToast]);

    // Otimização de busca com useMemo
    const filteredProfessionals = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return professionals.filter(p => 
            p.name.toLowerCase().includes(term) ||
            (p.role && p.role.toLowerCase().includes(term))
        );
    }, [professionals, searchTerm]);

    if (selectedProf) {
        return (
            <ProfessionalDetail 
                professional={selectedProf}
                onBack={() => { setSelectedProf(null); fetchProfessionals(); }}
                onSave={() => { setSelectedProf(null); fetchProfessionals(); }}
            />
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50 relative font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Users className="text-orange-500" size={28} /> Gestão de Equipe
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">Controle de profissionais, permissões e disponibilidades.</p>
                </div>
                <button 
                    onClick={handleCreateNew}
                    disabled={isLoading}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                    <Plus size={20} /> Adicionar Colaborador
                </button>
            </header>

            <main className="flex-1 overflow-y-auto p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="mb-8 relative max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar profissional..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        />
                    </div>

                    {isLoading && professionals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <Loader2 className="animate-spin mb-4" size={48} />
                            <p className="font-medium">Carregando sua equipe...</p>
                        </div>
                    ) : error ? (
                        <div className="bg-white rounded-3xl p-16 text-center border border-red-100 flex flex-col items-center">
                            <RefreshCw size={64} className="text-red-200 mb-4" />
                            <h3 className="text-lg font-bold text-slate-700">Ops! Algo deu errado.</h3>
                            <p className="text-slate-400 mt-2 mb-6">{error}</p>
                            <button onClick={fetchProfessionals} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900">Tentar Novamente</button>
                        </div>
                    ) : filteredProfessionals.length === 0 ? (
                        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 border-dashed">
                            <Users size={64} className="mx-auto text-slate-200 mb-4" />
                            <h3 className="text-lg font-bold text-slate-600">Nenhum resultado</h3>
                            <p className="text-slate-400 mt-2">Nenhum colaborador encontrado para os termos buscados.</p>
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
                                                {(prof as any).photo_url || prof.avatarUrl ? <img src={(prof as any).photo_url || prof.avatarUrl} className="w-full h-full object-cover" alt="" /> : <UserIcon size={40} className="text-slate-300" />}
                                            </div>
                                            <div className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center ${prof.active ? 'bg-green-500' : 'bg-slate-300'}`}><ShieldCheck size={12} className="text-white" /></div>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 leading-tight mb-1 group-hover:text-orange-600 transition-colors">{prof.name}</h3>
                                        <p className="text-slate-500 font-bold mb-6 uppercase tracking-widest text-[10px]">{prof.role || 'Colaborador'}</p>
                                        <div className="mt-auto flex items-center gap-2 text-orange-500 font-black text-xs uppercase tracking-widest py-2 px-4 rounded-full bg-orange-50 group-hover:bg-orange-500 group-hover:text-white transition-all">
                                            Gerenciar Perfil <ArrowRight size={14} />
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
