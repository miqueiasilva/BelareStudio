
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Plus, Users, Loader2, Search, ArrowRight, User as UserIcon, 
    Briefcase, RefreshCw, AlertTriangle, LayoutGrid, List,
    ChevronRight, Settings2, MapPin
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { LegacyProfessional } from '../../types';
import ProfessionalDetail from './ProfessionalDetail';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';

const EquipeView: React.FC = () => {
    const [professionals, setProfessionals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedProf, setSelectedProf] = useState<any | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    
    const isMounted = useRef(true);
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchProfessionals = async () => {
        if (!isMounted.current) return;
        
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        setLoading(true);
        setError(null);
        
        const watchdog = setTimeout(() => {
            if (isMounted.current && loading) {
                setLoading(false);
                setError("O servidor demorou a responder. Tente carregar novamente.");
            }
        }, 8000);

        try {
            const { data, error: sbError } = await supabase
                .from('team_members')
                .select('*, resources(name)')
                .order('name', { ascending: true })
                .abortSignal(abortControllerRef.current.signal);
            
            if (sbError) throw sbError;
            if (isMounted.current) {
                setProfessionals(data || []);
            }
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
            const { data, error } = await supabase
                .from('team_members')
                .insert([{ 
                    name: 'Novo Profissional', 
                    role: 'Colaborador', 
                    active: true, 
                    online_booking_enabled: true, 
                    commission_rate: 30.00,
                    pix_key: null
                }])
                .select('*, resources(name)')
                .single();

            if (error) throw error;
            if (isMounted.current) {
                setSelectedProf(data);
                setToast({ message: 'Colaborador criado!', type: 'success' });
                fetchProfessionals();
            }
        } catch (e: any) { 
            setToast({ message: e.message, type: 'error' }); 
        }
    };

    const handleToggleActive = async (e: React.MouseEvent, id: number | string, currentStatus: boolean) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        try {
            const { error } = await supabase
                .from('team_members')
                .update({ active: !currentStatus })
                .eq('id', id);

            if (error) throw error;
            if (isMounted.current) {
                setProfessionals(prev => prev.map(p => p.id === id ? { ...p, active: !currentStatus } : p));
                setToast({ message: `Acesso ${!currentStatus ? 'ativado' : 'bloqueado'} com sucesso.`, type: 'info' });
            }
        } catch (e) { 
            setToast({ message: 'Erro ao atualizar status.', type: 'error' }); 
        }
    };

    const filteredProfessionals = useMemo(() => {
        return professionals.filter(p => {
            const name = (p.name || '').toLowerCase();
            const role = (p.role || '').toLowerCase();
            const term = searchTerm.toLowerCase();
            return name.includes(term) || role.includes(term);
        });
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
        <div className="h-full flex flex-col bg-slate-50 relative font-sans overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-20 shadow-sm flex-shrink-0">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Users className="text-orange-500" size={28} /> Equipe
                    </h1>
                    <p className="hidden sm:block text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{professionals.length} profissionais</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden md:flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Ver em Cards"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Ver em Lista"
                        >
                            <List size={18} />
                        </button>
                    </div>

                    <button onClick={handleCreateNew} className="bg-orange-500 hover:bg-orange-600 text-white px-4 md:px-6 py-2.5 rounded-2xl font-black text-sm shadow-lg shadow-orange-100 flex items-center gap-2 transition-all active:scale-95">
                        <Plus size={20} /> <span className="hidden sm:inline">Adicionar</span>
                    </button>
                </div>
            </header>

            <div className="p-4 bg-white border-b border-slate-100 flex-shrink-0">
                <div className="relative group max-w-2xl mx-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 w-5 h-5 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Pesquisar por nome ou cargo..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-[20px] focus:ring-4 focus:ring-orange-100 focus:border-orange-400 focus:bg-white outline-none font-bold text-slate-700 transition-all shadow-inner" 
                    />
                </div>
            </div>

            <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                <div className="max-w-7xl mx-auto pb-24">
                    {error && (
                        <div className="mb-6 p-8 bg-white border border-rose-100 rounded-[32px] flex flex-col items-center text-center shadow-sm">
                           <AlertTriangle size={48} className="mb-4 text-rose-500" />
                           <h3 className="font-black text-slate-800 text-lg">Houve um problema técnico</h3>
                           <p className="text-slate-400 text-sm mb-6 max-w-md">{error}</p>
                           <button onClick={fetchProfessionals} className="bg-slate-800 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-slate-900 transition-all shadow-lg">
                                <RefreshCw size={18} /> Recarregar Equipe
                           </button>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Loader2 className="animate-spin mb-4 text-orange-500" size={48} />
                            <p className="text-xs font-black uppercase tracking-widest">Sincronizando equipe...</p>
                        </div>
                    ) : filteredProfessionals.length === 0 ? (
                        !error && (
                            <div className="bg-white rounded-[40px] p-20 text-center border-2 border-slate-100 border-dashed">
                                <Users size={64} className="mx-auto text-slate-100 mb-6" />
                                <h3 className="text-xl font-black text-slate-800">Nenhum profissional por aqui</h3>
                                <p className="text-slate-400 text-sm mt-2 mb-8">Comece agora montando seu time de especialistas.</p>
                                <button onClick={handleCreateNew} className="bg-orange-500 text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-orange-100">Contratar Agora</button>
                            </div>
                        )
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredProfessionals.map(prof => (
                                <div key={prof.id} className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm hover:shadow-xl hover:border-orange-100 transition-all group relative overflow-hidden cursor-pointer" onClick={() => setSelectedProf(prof)}>
                                    <div className="absolute top-6 right-6">
                                        <ToggleSwitch on={!!prof.active} onClick={(e: React.MouseEvent<HTMLButtonElement>) => { handleToggleActive(e, prof.id, !!prof.active); }} />
                                    </div>
                                    <div className="flex flex-col items-center text-center">
                                        <div className="relative mb-6">
                                            <div className="w-24 h-24 rounded-[28px] overflow-hidden border-4 border-white shadow-md bg-slate-100 flex items-center justify-center transition-transform group-hover:scale-105">
                                                {prof.photo_url ? (
                                                    <img src={prof.photo_url} className="w-full h-full object-cover" alt={prof.name} />
                                                ) : (
                                                    <UserIcon size={40} className="text-slate-300" />
                                                )}
                                            </div>
                                        </div>
                                        <h3 className="font-black text-slate-800 text-lg leading-tight truncate w-full px-2">{prof.name}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold mb-4 uppercase tracking-[0.2em]">{prof.role || 'Colaborador'}</p>
                                        
                                        {/* Badge da Sala */}
                                        <div className="mb-6">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-200">
                                                <MapPin size={10} className="text-orange-500" />
                                                {prof.resources?.name || 'Sem Sala Padrão'}
                                            </span>
                                        </div>

                                        <div className="mt-auto flex items-center gap-2 text-orange-500 font-black text-[10px] uppercase tracking-widest py-3 px-6 rounded-2xl bg-orange-50 group-hover:bg-orange-500 group-hover:text-white transition-all shadow-sm">
                                            Gerenciar Perfil <ChevronRight size={14} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-[28px] border border-slate-200 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50/50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargo / Função</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sala Padrão</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acesso</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredProfessionals.map(prof => (
                                            <tr 
                                                key={prof.id} 
                                                onClick={() => setSelectedProf(prof)}
                                                className="hover:bg-orange-50/30 cursor-pointer transition-colors group"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm flex-shrink-0 ${prof.photo_url ? 'bg-white' : 'bg-slate-200 text-slate-500'}`}>
                                                            {prof.photo_url ? <img src={prof.photo_url} className="w-full h-full object-cover rounded-xl" alt="" /> : prof.name.charAt(0)}
                                                        </div>
                                                        <span className="font-bold text-slate-700 group-hover:text-orange-600 transition-colors">{prof.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{prof.role || 'Geral'}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-medium text-slate-400">{prof.resources?.name || 'Não vinculada'}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                                                        <ToggleSwitch on={!!prof.active} onClick={(e: React.MouseEvent<HTMLButtonElement>) => { handleToggleActive(e, prof.id, !!prof.active); }} />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all">
                                                        <Settings2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default EquipeView;
