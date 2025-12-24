
import React, { useState, useEffect } from 'react';
import { 
    Plus, Users, Loader2, Search, ArrowRight, User as UserIcon, 
    Briefcase, ShieldCheck, ShieldAlert 
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { LegacyProfessional } from '../../types';
import ProfessionalDetail from './ProfessionalDetail';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';

const EquipeView: React.FC = () => {
    const [professionals, setProfessionals] = useState<LegacyProfessional[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProf, setSelectedProf] = useState<LegacyProfessional | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const fetchProfessionals = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('professionals')
                .select('*')
                .order('name', { ascending: true });
            
            if (error) throw error;
            setProfessionals(data || []);
        } catch (error: any) {
            setToast({ message: `Erro ao carregar equipe: ${error.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfessionals();
    }, []);

    const handleCreateNew = async () => {
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
            
            const { data, error } = await supabase
                .from('professionals')
                .insert([payload])
                .select()
                .single();
            
            if (error) throw error;
            
            setSelectedProf(data as any);
            setToast({ message: 'Rascunho de colaborador criado!', type: 'success' });
            fetchProfessionals();
        } catch (error: any) {
            setToast({ message: `Erro ao criar: ${error.message}`, type: 'error' });
        }
    };

    const handleToggleActive = async (id: number, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('professionals')
                .update({ active: !currentStatus })
                .eq('id', id);
            
            if (error) throw error;
            setProfessionals(prev => prev.map(p => p.id === id ? { ...p, active: !currentStatus } : p));
            setToast({ message: `Profissional ${!currentStatus ? 'ativado' : 'desativado'}.`, type: 'success' });
        } catch (error: any) {
            setToast({ message: 'Erro ao atualizar status.', type: 'error' });
        }
    };

    if (selectedProf) {
        return (
            <ProfessionalDetail 
                professional={selectedProf}
                onBack={() => {
                    setSelectedProf(null);
                    fetchProfessionals();
                }}
                onSave={() => {
                    setSelectedProf(null);
                    fetchProfessionals();
                }}
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
                        <Users className="text-orange-500" size={28} />
                        Gestão de Equipe
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">Controle de profissionais, permissões e disponibilidades.</p>
                </div>
                
                <button 
                    onClick={handleCreateNew}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-orange-200 flex items-center gap-2 transition-all active:scale-95"
                >
                    <Plus size={20} />
                    Adicionar Colaborador
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

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <Loader2 className="animate-spin mb-4" size={48} />
                            <p className="font-medium">Carregando sua equipe...</p>
                        </div>
                    ) : filteredProfessionals.length === 0 ? (
                        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 border-dashed">
                            <Users size={64} className="mx-auto text-slate-200 mb-4" />
                            <h3 className="text-lg font-bold text-slate-600">Equipe vazia</h3>
                            <p className="text-slate-400 mt-2">Nenhum colaborador encontrado para os termos buscados.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredProfessionals.map(prof => (
                                <div 
                                    key={prof.id} 
                                    className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all group relative"
                                >
                                    <div className="absolute top-6 right-6">
                                        <ToggleSwitch 
                                            on={!!prof.active} 
                                            onClick={() => handleToggleActive(prof.id, !!prof.active)} 
                                        />
                                    </div>
                                    
                                    <div className="flex flex-col items-center text-center cursor-pointer" onClick={() => setSelectedProf(prof)}>
                                        <div className="relative mb-6">
                                            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md bg-slate-100 flex items-center justify-center">
                                                {prof.avatarUrl || (prof as any).photo_url ? (
                                                    <img src={prof.avatarUrl || (prof as any).photo_url} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <UserIcon size={40} className="text-slate-300" />
                                                )}
                                            </div>
                                            <div className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center ${prof.active ? 'bg-green-500' : 'bg-slate-300'}`}>
                                                {prof.active ? <ShieldCheck size={12} className="text-white" /> : <ShieldAlert size={12} className="text-white" />}
                                            </div>
                                        </div>

                                        <h3 className="text-xl font-bold text-slate-800 leading-tight mb-1 group-hover:text-orange-600 transition-colors">
                                            {prof.name}
                                        </h3>
                                        <p className="text-slate-500 font-bold mb-6 uppercase tracking-widest text-[10px]">
                                            {prof.role || 'Colaborador'}
                                        </p>

                                        <div className="w-full grid grid-cols-2 gap-2 mb-6">
                                            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                                <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Comissão</p>
                                                <p className="text-lg font-black text-slate-700">{(prof as any).commission_rate || 0}%</p>
                                            </div>
                                            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                                <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Status</p>
                                                <p className={`text-xs font-bold mt-1 ${prof.active ? 'text-green-600' : 'text-slate-400'}`}>
                                                    {prof.active ? 'Ativo' : 'Pausado'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-auto flex items-center gap-2 text-orange-500 font-black text-xs uppercase tracking-widest py-2 px-4 rounded-full bg-orange-50 transition-colors group-hover:bg-orange-500 group-hover:text-white">
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
