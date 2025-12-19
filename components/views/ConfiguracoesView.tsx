
import React, { useState, useMemo, useEffect } from 'react';
import { Settings, User, Scissors, Clock, Bell, Store, Save, Plus, Trash2, Edit2, Search, Filter, Download, FolderPen, ChevronLeft, Menu, ChevronRight, Database, CheckCircle, AlertTriangle, Camera } from 'lucide-react';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';
import { services as initialServices, professionals as initialProfessionals } from '../../data/mockData';
import { ServiceModal, ProfessionalModal } from '../modals/ConfigModals';
import { LegacyService, LegacyProfessional } from '../../types';
import ContextMenu from '../shared/ContextMenu';
import ProfessionalDetail from './ProfessionalDetail';
import { supabase, testConnection } from '../../services/supabaseClient';

const ConfiguracoesView: React.FC = () => {
    const [activeTab, setActiveTab] = useState('studio');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
    const [isLoading, setIsLoading] = useState(false);

    // FIX: Added missing showToast definition to fix 'Cannot find name' errors
    const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

    // --- State: Data ---
    const [studioData, setStudioData] = useState({
        name: 'Studio Jacilene Felix',
        cnpj: '12.345.678/0001-90',
        address: 'Rua das Flores, 123 - Centro, São Paulo/SP',
        phone: '(11) 99999-8888',
        email: 'contato@studiojacilene.com.br'
    });

    const [notifications, setNotifications] = useState({
        browser: true,
        email: true,
        whatsapp: true,
        dailySummary: true
    });

    const [servicesData, setServicesData] = useState<LegacyService[]>(Object.values(initialServices));
    const [colaboradores, setColaboradores] = useState<LegacyProfessional[]>([]);
    const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);
    const [serviceSearch, setServiceSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todas');
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; options: any[] } | null>(null);

    const [schedule, setSchedule] = useState(
        ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day, i) => ({
            day,
            start: '09:00', 
            end: i >= 5 ? '14:00' : '18:00',
            active: i !== 6 
        }))
    );

    const [serviceModal, setServiceModal] = useState<{ open: boolean; data: LegacyService | null }>({ open: false, data: null });
    const [profModal, setProfModal] = useState<{ open: boolean; data: LegacyProfessional | null }>({ open: false, data: null });

    const fetchColaboradores = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('professionals')
                .select('*')
                .order('name');
            
            if (error) throw error;
            
            if (data) {
                const mapped = data.map((p: any) => ({
                    ...p,
                    avatarUrl: p.photo_url 
                }));
                setColaboradores(mapped);
            }
        } catch (error) {
            console.error("Erro ao buscar colaboradores:", error);
            setColaboradores(initialProfessionals); 
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
        
        testConnection().then(connected => {
            setDbStatus(connected ? 'connected' : 'error');
            if (connected) fetchColaboradores();
            else setColaboradores(initialProfessionals);
        });
    }, []);

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        setSelectedProfessionalId(null);
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    };

    const handleUploadFoto = async (event: React.ChangeEvent<HTMLInputElement>, idProfissional: number) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validação básica de tamanho
        if (file.size > 5 * 1024 * 1024) {
            showToast("Imagem muito grande (máx 5MB)", "error");
            return;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${idProfissional}-${Date.now()}.${fileExt}`;
        showToast("Enviando foto...", "info");

        try {
            const { error: uploadError } = await supabase.storage
                .from('team-photos')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('team-photos')
                .getPublicUrl(fileName);

            const { error: updateError = null } = await supabase
                .from('professionals')
                .update({ photo_url: publicUrl })
                .eq('id', idProfissional);

            if (updateError) throw updateError;

            fetchColaboradores();
            showToast("Foto atualizada!", "success");
        } catch (error: any) {
            console.error("Erro no upload:", error);
            showToast("Erro ao atualizar foto", "error");
        }
    };

    const handleSaveProfessional = async (prof: LegacyProfessional) => {
        try {
            // PAYLOAD BLINDADO: Protege contra o envio de nulo na foto caso o avatarUrl esteja vazio
            // Mas permite nulo se for uma remoção intencional vinda de handlers específicos
            const payload: any = {
                name: prof.name,
                email: prof.email,
                phone: prof.phone,
                role: prof.role,
                active: prof.active,
                online_booking: prof.onlineBooking,
                pix_key: prof.pixKey,
                commission_rate: prof.commissionRate
            };

            // Apenas envia photo_url se houver um valor real no estado
            if (prof.avatarUrl) {
                payload.photo_url = prof.avatarUrl;
            }

            if (prof.id && prof.id < 1000000000) {
                const { error } = await supabase.from('professionals').update(payload).eq('id', prof.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('professionals').insert([payload]);
                if (error) throw error;
            }
            
            fetchColaboradores();
            setProfModal({ open: false, data: null });
            setSelectedProfessionalId(null);
            showToast(`Dados de "${prof.name}" salvos!`);
        } catch (error) {
            showToast("Erro ao salvar no banco", "error");
        }
    };

    const handleDeleteProfessional = async (id: number) => {
        if (window.confirm('Tem certeza?')) {
            try {
                await supabase.from('professionals').delete().eq('id', id);
                fetchColaboradores();
                showToast('Removido.', 'info');
            } catch (error) {
                showToast("Erro ao remover.", "error");
            }
        }
    };

    const tabs = [
        { id: 'studio', label: 'Estúdio', icon: Store },
        { id: 'services', label: 'Serviços', icon: Scissors },
        { id: 'team', label: 'Colaboradores', icon: User },
        { id: 'schedule', label: 'Horários', icon: Clock },
        { id: 'notifications', label: 'Avisos', icon: Bell },
    ];

    if (activeTab === 'team' && selectedProfessionalId) {
        const selectedProf = colaboradores.find(p => p.id === selectedProfessionalId);
        if (selectedProf) {
            return (
                <ProfessionalDetail 
                    professional={selectedProf}
                    services={servicesData}
                    onBack={() => setSelectedProfessionalId(null)}
                    onSave={handleSaveProfessional}
                />
            );
        }
    }

    return (
        <div className="flex h-full bg-slate-50 overflow-hidden relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} options={contextMenu.options} onClose={() => setContextMenu(null)} />}

            <aside className={`bg-white border-r border-slate-200 flex-col flex-shrink-0 transition-all duration-300 ease-in-out fixed md:relative z-30 h-full ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:w-0 md:translate-x-0 overflow-hidden'}`}>
                <div className="p-6 border-b border-slate-100 flex justify-between items-center h-20">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 truncate">
                        <Settings className="w-6 h-6 text-slate-400" /> Config
                    </h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 p-1 hover:bg-slate-100 rounded-full"><ChevronLeft size={20} /></button>
                </div>
                <nav className="flex-1 overflow-y-auto p-4 space-y-1 w-64">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => handleTabChange(tab.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-orange-50 text-orange-600' : 'text-slate-600 hover:bg-slate-100'}`}>
                            <tab.icon className="w-5 h-5" />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </aside>

            <main className="flex-1 overflow-y-auto w-full">
                <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                                {isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
                            </button>
                            <h3 className="text-2xl font-bold text-slate-800">{tabs.find(t => t.id === activeTab)?.label}</h3>
                        </div>
                        {activeTab === 'team' && (
                             <button onClick={() => setProfModal({ open: true, data: null })} className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition-all">
                                <Plus size={18} /> Novo Colaborador
                            </button>
                        )}
                    </div>

                    {activeTab === 'team' && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b border-slate-100">
                                <h3 className="font-bold text-slate-800">Equipe ({colaboradores.length})</h3>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input type="text" placeholder="Filtrar..." className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300" />
                                </div>
                            </div>
                            <ul className="divide-y divide-slate-50">
                                {colaboradores.map(colab => (
                                    <li key={colab.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => setSelectedProfessionalId(colab.id)}>
                                        <div className="flex items-center gap-4">
                                            <div className="relative group/avatar cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                                {colab.photo_url ? (
                                                    <img src={colab.photo_url} alt={colab.name} className="w-12 h-12 rounded-full object-cover border-2 border-orange-500 shadow-sm" />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold border-2 border-orange-500 shadow-sm">
                                                        {colab.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleUploadFoto(e, colab.id)} />
                                                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity text-white pointer-events-none">
                                                    <Camera size={14} />
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm">{colab.name}</h4>
                                                <p className="text-xs text-slate-500">Toque na foto para atualizar</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className="text-slate-300" />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {activeTab === 'studio' && (
                        <Card title="Dados">
                            <p className="text-slate-500 text-sm">Configurações do Studio Jacilene Felix...</p>
                        </Card>
                    )}
                </div>
            </main>

            {serviceModal.open && <ServiceModal service={serviceModal.data} availableCategories={[]} onClose={() => setServiceModal({ open: false, data: null })} onSave={() => {}} />}
            {profModal.open && <ProfessionalModal professional={profModal.data} onClose={() => setProfModal({ open: false, data: null })} onSave={handleSaveProfessional} />}
        </div>
    );
};

export default ConfiguracoesView;
