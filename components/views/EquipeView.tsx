
import React, { useState, useEffect } from 'react';
import { 
    Plus, Users, Loader2, Search, ArrowRight, User as UserIcon, 
    Briefcase, ShieldCheck, Mail, Phone, ExternalLink, Shield 
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { LegacyProfessional, LegacyService } from '../../types';
import ProfessionalDetail from './ProfessionalDetail';
import Toast, { ToastType } from '../shared/Toast';

const EquipeView: React.FC = () => {
    const [professionals, setProfessionals] = useState<LegacyProfessional[]>([]);
    const [services, setServices] = useState<LegacyService[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProf, setSelectedProf] = useState<LegacyProfessional | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [profsRes, servicesRes] = await Promise.all([
                supabase.from('professionals').select('*').order('name', { ascending: true }),
                supabase.from('services').select('*').order('nome')
            ]);
            
            if (profsRes.error) throw profsRes.error;
            if (servicesRes.error) throw servicesRes.error;

            setProfessionals(profsRes.data || []);
            setServices(servicesRes.data || []);
        } catch (error: any) {
            setToast({ message: `Error: ${error.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateNew = async () => {
        try {
            const payload = {
                name: 'Novo Colaborador',
                role: 'Profissional',
                active: true,
                online_booking: true,
                commission_rate: 30,
                email: '',
                phone: ''
            };
            
            const { data, error } = await supabase
                .from('professionals')
                .insert([payload])
                .select()
                .single();
            
            if (error) throw error;
            
            setSelectedProf(data as any);
            setToast({ message: 'Rascunho de colaborador criado!', type: 'success' });
            fetchData();
        } catch (error: any) {
            setToast({ message: `Erro ao criar: ${error.message}`, type: 'error' });
        }
    };

    if (selectedProf) {
        return (
            <ProfessionalDetail 
                professional={selectedProf}
                services={services}
                onBack={() => {
                    setSelectedProf(null);
                    fetchData();
                }}
                onSave={() => {
                    setSelectedProf(null);
                    fetchData();
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
                        <Shield className="text-orange-500" />
                        Equipe & Colaboradores
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">Gerencie o time, permissões e comissões.</p>
                </div>
                
                <button 
                    onClick={handleCreateNew}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-orange-200 flex items-center gap-2 transition-all active:scale-95"
                >
                    <Plus size={20} />
                    Novo Profissional
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
                            <p className="font-medium">Sincronizando equipe...</p>
                        </div>
                    ) : filteredProfessionals.length === 0 ? (
                        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 border-dashed">
                            <Users size={64} className="mx-auto text-slate-200 mb-4" />
                            <h3 className="text-lg font-bold text-slate-600">Sua equipe está vazia</h3>
                            <p className="text-slate-400 mt-2">Adicione colaboradores para habilitar a agenda.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredProfessionals.map(prof => (
                                <div 
                                    key={prof.id} 
                                    onClick={() => setSelectedProf(prof)}
                                    className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col items-center text-center relative overflow-hidden"
                                >
                                    <div className={`absolute top-0 right-0 px-4 py-1 text-[10px] font-black uppercase tracking-widest ${prof.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {prof.active ? 'Ativo' : 'Inativo'}
                                    </div>
                                    
                                    <div className="relative mb-6">
                                        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md bg-slate-100 flex items-center justify-center">
                                            {prof.avatarUrl ? (
                                                <img src={prof.avatarUrl} className="w-full h-full object-cover" alt={prof.name} />
                                            ) : (
                                                <UserIcon size={40} className="text-slate-300" />
                                            )}
                                        </div>
                                        <div className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center ${prof.active ? 'bg-green-500' : 'bg-slate-300'}`}>
                                            <ShieldCheck size={12} className="text-white" />
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-slate-800 leading-tight mb-1 group-hover:text-orange-600 transition-colors">{prof.name}</h3>
                                    <p className="text-slate-500 font-bold mb-6 uppercase tracking-widest text-[10px]">{prof.role || 'Colaborador'}</p>

                                    <div className="w-full grid grid-cols-2 gap-2 mb-6">
                                        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                            <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Comissão</p>
                                            <p className="text-lg font-black text-slate-700">{prof.commissionRate || (prof as any).commission_rate || 0}%</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                            <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Status</p>
                                            <p className={`text-xs font-bold mt-1 ${prof.onlineBooking ? 'text-green-600' : 'text-slate-400'}`}>
                                                {prof.onlineBooking ? 'Agenda Aberta' : 'Agenda Fechada'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-auto flex items-center gap-2 text-orange-500 font-black text-xs uppercase tracking-widest py-2 px-4 rounded-full bg-orange-50 transition-colors group-hover:bg-orange-500 group-hover:text-white">
                                        Gerenciar Perfil <ArrowRight size={14} />
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
