
import React, { useState, useEffect, useRef } from 'react';
import { 
    Plus, Users, Loader2, Search, ArrowRight, User as UserIcon, 
    Briefcase, ShieldCheck, ShieldAlert, RefreshCw, AlertTriangle,
    LayoutGrid, List, Phone, Mail, Edit2, Trash2, MoreVertical
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
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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
        
        const watchdog = setTimeout(() => {
            if (isMounted.current && loading) {
                setLoading(false);
                setError("O carregamento demorou demais (Timeout 8s). Verifique sua conexão ou tente novamente.");
            }
        }, 8000);

        try {
            const { data, error: sbError } = await supabase
                .from('professionals')
                .select('*')
                .order('name', { ascending: true })
                .abortSignal(abortControllerRef.current.signal);
            
            if (sbError) throw sbError;
            if (isMounted.current) {
                setProfessionals(data || []);
            }
        } catch (error: any) {
            if (isMounted.current && error.name !== 'AbortError') {
                setError(error.message || "Erro ao carregar equipe. O servidor pode estar ocupado.");
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
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    /**
     * FUNÇÃO CORRIGIDA: handleSave
     * Garante que o ID não seja enviado em novos registros para que o banco gere automaticamente.
     */
    const handleSave = async (profData: any) => {
        if (!profData.name || profData.name.trim() === "") {
            setToast({ message: 'O nome do profissional é obrigatório.', type: 'error' });
            return;
        }

        try {
            const payload = { ...profData };
            const isEditing = !!payload.id;

            if (isEditing) {
                // UPDATE
                const { error } = await supabase
                    .from('professionals')
                    .update(payload)
                    .eq('id', payload.id);
                
                if (error) throw error;
                setToast({ message: 'Profissional atualizado com sucesso!', type: 'success' });
            } else {
                // INSERT - REMOÇÃO EXPLÍCITA DO ID PARA AUTO-GERAÇÃO NO BANCO
                delete payload.id; 
                
                const { data, error } = await supabase
                    .from('professionals')
                    .insert([payload])
                    .select()
                    .single();
                
                if (error) throw error;
                setToast({ message: 'Novo colaborador cadastrado!', type: 'success' });
                
                // Se o componente de detalhe estiver aberto e for uma criação, sincroniza o ID
                if (data) setSelectedProf(data as any);
            }
            fetchProfessionals();
        } catch (e: any) { 
            console.error("Erro ao salvar profissional:", e);
            setToast({ message: `Erro ao salvar: ${e.message}`, type: 'error' }); 
        }
    };

    /**
     * FUNÇÃO CORRIGIDA: safeCreateNew
     * Inserção imediata de placeholder sem enviar ID.
     */
    const safeCreateNew = async () => {
        try {
            const { data, error } = await supabase
                .from('professionals')
                .insert([{ 
                    name: 'Novo Profissional', 
                    role: 'Colaborador', 
                    active: true, 
                    online_booking: true, 
                    commission_rate: 30 
                }]) // Note: id omitido propositalmente
                .select()
                .single();

            if (error) throw error;
            setSelectedProf(data as any);
            fetchProfessionals();
        } catch (e: any) {
            setToast({ message: `Erro ao criar: ${e.message}`, type: 'error' });
        }
    };

    const handleToggleActive = async (id: number, currentStatus: boolean) => {
        try {
            await supabase.from('professionals').update({ active: !currentStatus }).eq('id', id);
            if (isMounted.current) {
                setProfessionals(prev => prev.map(p => p.id === id ? { ...p, active: !currentStatus } : p));
                setToast({ message: `Status atualizado com sucesso.`, type: 'success' });
            }
        } catch (e) { 
            setToast({ message: 'Erro ao atualizar status.', type: 'error' }); 
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Deseja realmente excluir este profissional?")) return;
        try {
            const { error } = await supabase.from('professionals').delete().eq('id', id);
            if (error) throw error;
            setToast({ message: 'Profissional removido.', type: 'info' });
            fetchProfessionals();
        } catch (e: any) {
            setToast({ message: e.message, type: 'error' });
        }
    };

    if (selectedProf && selectedProf.id) {
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
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 leading-none">
                        <Users className="text-orange-500" size={28} /> Gestão de Equipe
                    </h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{professionals.length} Colaboradores</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Toggle de Visualização */}
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Ver em Grid"
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

                    <button onClick={safeCreateNew} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-black text-sm shadow-lg shadow-orange-100 flex items-center gap-2 transition-all active:scale-95">
                        <Plus size={20} /> Novo Colaborador
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto">
                    {error && (
                        <div className="mb-6 p-6 bg-rose-50 border border-rose-200 rounded-3xl flex flex-col items-center text-center text-rose-800">
                           <AlertTriangle size={40} className="mb-4 text-rose-500" />
                           <h3 className="font-bold text-lg mb-1">Ops! Ocorreu um problema</h3>
                           <p className="text-sm mb-6 max-w-md">{error}</p>
                           <button 
                                onClick={fetchProfessionals} 
                                className="bg-rose-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-rose-700 transition-colors shadow-lg shadow-rose-100"
                           >
                                <RefreshCw size={18} /> Tentar Novamente
                           </button>
                        </div>
                    )}

                    {!error && (
                        <div className="mb-8 relative max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Buscar colaborador pelo nome ou cargo..." 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all font-medium" 
                            />
                        </div>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <Loader2 className="animate-spin mb-4 text-orange-500" size={48} />
                            <p className="font-bold uppercase tracking-widest text-[10px]">Sincronizando equipe...</p>
                        </div>
                    ) : filteredProfessionals.length === 0 ? (
                        !error && (
                            <div className="bg-white rounded-[32px] p-20 text-center border-2 border-slate-200 border-dashed">
                                <Users size={64} className="mx-auto text-slate-100 mb-6" />
                                <h3 className="text-xl font-black text-slate-800 mb-2">Nenhum colaborador encontrado</h3>
                                <p className="text-slate-400 text-sm mb-8">Refine sua busca ou cadastre um novo integrante para seu estúdio.</p>
                                <button onClick={safeCreateNew} className="bg-orange-500 text-white px-8 py-3 rounded-2xl font-black shadow-lg">Cadastrar Agora</button>
                            </div>
                        )
                    ) : viewMode === 'grid' ? (
                        /* VIEW: GRID (CARDS) */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                            {filteredProfessionals.map(prof => (
                                <div key={prof.id} className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col items-center text-center">
                                    <div className="absolute top-6 right-6">
                                        <ToggleSwitch on={!!prof.active} onClick={() => handleToggleActive(prof.id, !!prof.active)} />
                                    </div>
                                    <div className="relative mb-6 cursor-pointer" onClick={() => setSelectedProf(prof)}>
                                        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md bg-slate-100 flex items-center justify-center transition-transform group-hover:scale-110">
                                            {(prof as any).photo_url ? (
                                                <img src={(prof as any).photo_url} className="w-full h-full object-cover" alt={prof.name} />
                                            ) : (
                                                <UserIcon size={40} className="text-slate-300" />
                                            )}
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-black text-slate-800 mb-1 leading-tight">{prof.name}</h3>
                                    <p className="text-slate-400 font-bold mb-6 uppercase tracking-widest text-[9px]">{prof.role || 'Colaborador'}</p>
                                    
                                    <div className="mt-auto w-full pt-4 border-t border-slate-50 flex items-center justify-center gap-6">
                                        <div className="text-center">
                                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-wider">Comissão</p>
                                            <p className="text-sm font-black text-slate-700">{(prof as any).commission_rate || 0}%</p>
                                        </div>
                                        <div className="w-px h-6 bg-slate-100"></div>
                                        <button 
                                            onClick={() => setSelectedProf(prof)}
                                            className="flex items-center gap-2 text-orange-500 font-black text-[10px] uppercase tracking-widest hover:text-orange-600 transition-colors"
                                        >
                                            Ver Perfil <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* VIEW: LISTA (TABELA) */
                        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-300">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Profissional</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contato</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredProfessionals.map(prof => (
                                        <tr key={prof.id} className="group hover:bg-orange-50/30 transition-all cursor-pointer" onClick={() => setSelectedProf(prof)}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-white shadow-sm">
                                                        {(prof as any).photo_url ? (
                                                            <img src={(prof as any).photo_url} className="w-full h-full object-cover" alt={prof.name} />
                                                        ) : (
                                                            <UserIcon size={20} className="text-slate-300" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 leading-none mb-1 group-hover:text-orange-600 transition-colors">{prof.name}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{prof.role || 'Colaborador'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                                    <ToggleSwitch on={!!prof.active} onClick={() => handleToggleActive(prof.id, !!prof.active)} />
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${prof.active ? 'text-green-600' : 'text-slate-300'}`}>
                                                        {prof.active ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-slate-500">
                                                        <Phone size={12} className="text-slate-300" />
                                                        <span className="text-xs font-medium">{(prof as any).phone || '---'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-slate-500">
                                                        <Mail size={12} className="text-slate-300" />
                                                        <span className="text-xs font-medium">{(prof as any).email || '---'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                                    <button onClick={() => setSelectedProf(prof)} className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all" title="Editar"><Edit2 size={16}/></button>
                                                    <button onClick={() => handleDelete(prof.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all" title="Excluir"><Trash2 size={16}/></button>
                                                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"><MoreVertical size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default EquipeView;
