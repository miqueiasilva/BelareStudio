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
    const [professionalsData, setProfessionalsData] = useState<LegacyProfessional[]>([]);
    
    // --- Professional Detail State ---
    const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);

    // --- Services Filters State ---
    const [serviceSearch, setServiceSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todas');
    
    // --- Context Menu State ---
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; options: any[] } | null>(null);

    const [schedule, setSchedule] = useState(
        ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day, i) => ({
            day,
            start: i >= 5 ? '09:00' : '09:00', 
            end: i >= 5 ? '14:00' : '18:00',
            active: i !== 6 
        }))
    );

    // --- State: Modals ---
    const [serviceModal, setServiceModal] = useState<{ open: boolean; data: LegacyService | null }>({ open: false, data: null });
    const [profModal, setProfModal] = useState<{ open: boolean; data: LegacyProfessional | null }>({ open: false, data: null });

    // --- Data Fetching Logic ---
    const fetchProfessionals = async () => {
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
                    avatarUrl: p.photo_url || p.avatarUrl || `https://ui-avatars.com/api/?name=${p.name}&background=random`
                }));
                setProfessionalsData(mapped);
            }
        } catch (error) {
            console.error("Erro ao buscar colaboradores:", error);
            setProfessionalsData(initialProfessionals); // Fallback
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
            if (connected) fetchProfessionals();
            else setProfessionalsData(initialProfessionals);
        });
    }, []);

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        setSelectedProfessionalId(null);
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    };

    // --- Logic: Photo Upload ---
    const handleUploadFoto = async (event: React.ChangeEvent<HTMLInputElement>, idProfissional: number) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const fileName = `${idProfissional}-${Date.now()}.jpg`;
        showToast("Enviando foto...", "info");

        try {
            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('team-photos')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('team-photos')
                .getPublicUrl(fileName);

            // 3. Update Database
            const { error: updateError } = await supabase
                .from('professionals')
                .update({ photo_url: publicUrl })
                .eq('id', idProfissional);

            if (updateError) throw updateError;

            // 4. Refresh UI
            fetchProfessionals();
            showToast("Foto atualizada com sucesso!", "success");
        } catch (error: any) {
            console.error("Erro no upload:", error);
            showToast("Erro ao atualizar foto: " + error.message, "error");
        }
    };

    // --- Helpers ---
    const formatDuration = (min: number) => {
        const h = Math.floor(min / 60);
        const m = min % 60;
        if (h > 0 && m > 0) return `${h}h${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    };

    const categories = useMemo(() => {
        const cats = new Set(servicesData.map(s => s.category || 'Geral'));
        return ['Todas', ...Array.from(cats).sort()];
    }, [servicesData]);

    const filteredServices = useMemo(() => {
        return servicesData.filter(service => {
            const matchesSearch = service.name.toLowerCase().includes(serviceSearch.toLowerCase());
            const matchesCategory = selectedCategory === 'Todas' || (service.category || 'Geral') === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [servicesData, serviceSearch, selectedCategory]);

    // --- Actions ---
    const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

    const handleSaveStudio = () => showToast('Dados do estúdio salvos com sucesso!');
    const handleSaveNotifications = () => showToast('Preferências de notificação atualizadas!');
    const handleSaveSchedule = () => showToast('Horário de funcionamento atualizado!');

    const handleSaveService = (service: LegacyService) => {
        setServicesData(prev => {
            const exists = prev.find(s => s.id === service.id);
            if (exists) return prev.map(s => s.id === service.id ? service : s);
            return [...prev, service];
        });
        setServiceModal({ open: false, data: null });
        showToast(`Serviço "${service.name}" salvo com sucesso!`);
    };

    const handleDeleteService = (id: number) => {
        if (window.confirm('Tem certeza que deseja excluir este serviço?')) {
            setServicesData(prev => prev.filter(s => s.id !== id));
            showToast('Serviço removido.', 'info');
        }
    };

    const handleSaveProfessional = async (prof: LegacyProfessional) => {
        try {
            const payload = {
                name: prof.name,
                email: prof.email,
                phone: prof.phone,
                role: prof.role,
                photo_url: prof.avatarUrl,
                active: prof.active,
                online_booking: prof.onlineBooking,
                pix_key: prof.pixKey,
                commission_rate: prof.commissionRate
            };

            if (prof.id && prof.id < 1000000000) {
                await supabase.from('professionals').update(payload).eq('id', prof.id);
            } else {
                await supabase.from('professionals').insert([payload]);
            }
            
            fetchProfessionals();
            setProfModal({ open: false, data: null });
            setSelectedProfessionalId(null);
            showToast(`Dados de "${prof.name}" salvos com sucesso!`);
        } catch (error) {
            showToast("Erro ao salvar no banco.", "error");
        }
    };

    const handleDeleteProfessional = async (id: number) => {
        if (window.confirm('Tem certeza que deseja remover este profissional?')) {
            try {
                await supabase.from('professionals').delete().eq('id', id);
                fetchProfessionals();
                showToast('Profissional removido.', 'info');
            } catch (error) {
                showToast("Erro ao remover.", "error");
            }
        }
    };

    const toggleDay = (index: number) => {
        setSchedule(prev => prev.map((item, i) => i === index ? { ...item, active: !item.active } : item));
    };

    const updateScheduleTime = (index: number, field: 'start' | 'end', value: string) => {
        setSchedule(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };
    
    const handleServiceContextMenu = (e: React.MouseEvent, service: LegacyService) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            options: [
                { label: 'Editar serviço', icon: <Edit2 size={16}/>, onClick: () => setServiceModal({ open: true, data: service }) },
                { label: 'Remover serviço', icon: <Trash2 size={16}/>, className: 'text-red-600', onClick: () => handleDeleteService(service.id) },
                { label: 'Editar categoria', icon: <FolderPen size={16}/>, onClick: () => showToast('Editar categoria - Em breve', 'info') },
                { label: 'Remover categoria', icon: <Trash2 size={16}/>, className: 'text-red-600', onClick: () => showToast('Remover categoria - Em breve', 'info') },
            ]
        });
    };

    const tabs = [
        { id: 'studio', label: 'Dados do Estúdio', icon: Store },
        { id: 'services', label: 'Serviços', icon: Scissors },
        { id: 'team', label: 'Colaboradores', icon: User },
        { id: 'schedule', label: 'Horário de Funcionamento', icon: Clock },
        { id: 'notifications', label: 'Notificações', icon: Bell },
    ];

    if (activeTab === 'team' && selectedProfessionalId) {
        const selectedProf = professionalsData.find(p => p.id === selectedProfessionalId);
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

            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/20 z-20 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <aside className={`
                bg-white border-r border-slate-200 flex-col flex-shrink-0 transition-all duration-300 ease-in-out
                fixed md:relative z-30 h-full
                ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:w-0 md:translate-x-0 overflow-hidden'}
            `}>
                <div className="p-6 border-b border-slate-100 flex justify-between items-center h-20">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 truncate">
                        <Settings className="w-6 h-6 text-slate-400" />
                        Configurações
                    </h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 p-1 hover:bg-slate-100 rounded-full">
                        <ChevronLeft size={20} />
                    </button>
                </div>
                <nav className="flex-1 overflow-y-auto p-4 space-y-1 w-64">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                                activeTab === tab.id 
                                ? 'bg-orange-50 text-orange-600' 
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <tab.icon className="w-5 h-5" />
                            {tab.label}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-slate-100">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Banco de Dados</p>
                        <div className="flex items-center gap-2 text-sm font-medium">
                            {dbStatus === 'checking' && <span className="text-slate-500">Verificando...</span>}
                            {dbStatus === 'connected' && (
                                <span className="text-green-600 flex items-center gap-1">
                                    <CheckCircle size={14} /> Conectado (Supabase)
                                </span>
                            )}
                            {dbStatus === 'error' && (
                                <span className="text-red-500 flex items-center gap-1">
                                    <AlertTriangle size={14} /> Modo Demo (Offline)
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </aside>

            <main className="flex-1 overflow-y-auto w-full">
                <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
                    
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                            >
                                {isSidebarOpen ? <ChevronLeft size={20} className="hidden md:block" /> : <Menu size={20} />}
                                {isSidebarOpen && <ChevronLeft size={20} className="md:hidden" />}
                            </button>
                            <div>
                                <h3 className="text-2xl font-bold text-slate-800">{tabs.find(t => t.id === activeTab)?.label}</h3>
                                {activeTab !== 'services' && activeTab !== 'team' && <p className="text-slate-500 text-sm mt-1 hidden sm:block">Gerencie as preferências e informações do sistema.</p>}
                            </div>
                        </div>
                        
                        {activeTab === 'studio' && (
                             <button onClick={handleSaveStudio} className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition-all">
                                <Save size={18} /> <span className="hidden sm:inline">Salvar Alterações</span><span className="sm:hidden">Salvar</span>
                            </button>
                        )}
                        {activeTab === 'notifications' && (
                             <button onClick={handleSaveNotifications} className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition-all">
                                <Save size={18} /> <span className="hidden sm:inline">Salvar Preferências</span><span className="sm:hidden">Salvar</span>
                            </button>
                        )}
                         {activeTab === 'schedule' && (
                             <button onClick={handleSaveSchedule} className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition-all">
                                <Save size={18} /> <span className="hidden sm:inline">Atualizar Horários</span><span className="sm:hidden">Salvar</span>
                            </button>
                        )}
                         {activeTab === 'team' && (
                             <button onClick={() => setProfModal({ open: true, data: null })} className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition-all">
                                <Plus size={18} /> <span className="hidden sm:inline">Novo Profissional</span><span className="sm:hidden">Novo</span>
                            </button>
                        )}
                    </div>

                    {activeTab === 'studio' && (
                        <Card>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Estabelecimento</label>
                                        <input 
                                            type="text" 
                                            value={studioData.name}
                                            onChange={(e) => setStudioData({...studioData, name: e.target.value})}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none transition-all" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">CNPJ / CPF</label>
                                        <input 
                                            type="text" 
                                            value={studioData.cnpj}
                                            onChange={(e) => setStudioData({...studioData, cnpj: e.target.value})}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none transition-all" 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Endereço Completo</label>
                                    <input 
                                        type="text" 
                                        value={studioData.address}
                                        onChange={(e) => setStudioData({...studioData, address: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none transition-all" 
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
                                        <input 
                                            type="text" 
                                            value={studioData.phone}
                                            onChange={(e) => setStudioData({...studioData, phone: e.target.value})}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none transition-all" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">E-mail de Contato</label>
                                        <input 
                                            type="email" 
                                            value={studioData.email}
                                            onChange={(e) => setStudioData({...studioData, email: e.target.value})}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none transition-all" 
                                        />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {activeTab === 'services' && (
                        <div className="space-y-4">
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <div className="relative">
                                        <select 
                                            value={selectedCategory}
                                            onChange={(e) => setSelectedCategory(e.target.value)}
                                            className="appearance-none bg-white border border-slate-300 rounded-lg pl-4 pr-10 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer shadow-sm w-full md:w-auto"
                                        >
                                            <option value="Todas">Todas as categorias</option>
                                            {categories.filter(c => c !== 'Todas').map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <Filter className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                    <div className="relative flex-1 w-full md:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500" />
                                        <input 
                                            type="text" 
                                            value={serviceSearch}
                                            onChange={(e) => setServiceSearch(e.target.value)}
                                            placeholder="Procurar por serviço..." 
                                            className="w-full pl-9 pr-4 py-2.5 bg-white border-b-2 border-slate-100 focus:border-orange-500 focus:outline-none text-sm transition-colors"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                     <button className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
                                        <Filter size={20} />
                                    </button>
                                    <button 
                                        onClick={() => setServiceModal({ open: true, data: null })}
                                        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        <Plus size={20} />
                                    </button>
                                     <button className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
                                        <Download size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left min-w-[600px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
                                                <th className="px-6 py-4 w-10"></th>
                                                <th className="px-6 py-4">Categoria</th>
                                                <th className="px-6 py-4">Serviço</th>
                                                <th className="px-6 py-4 text-right">Duração</th>
                                                <th className="px-6 py-4 text-right">Preço (R$)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {filteredServices.map((service) => (
                                                <tr 
                                                    key={service.id} 
                                                    className="group hover:bg-slate-50 transition-colors cursor-pointer"
                                                    onContextMenu={(e) => handleServiceContextMenu(e, service)}
                                                >
                                                    <td className="px-6 py-4">
                                                        <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500 cursor-pointer" />
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: service.color }}></span>
                                                            <span className="text-sm font-medium text-slate-700">{service.category || 'Geral'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-medium text-slate-800">{service.name}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-sm text-slate-600">{formatDuration(service.duration)}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-sm font-semibold text-slate-800">{service.price.toFixed(2).replace('.', ',')}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'team' && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b border-slate-100">
                                <h3 className="font-bold text-slate-800">Ativos ({professionalsData.length})</h3>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input 
                                        type="text" 
                                        placeholder="Procurar por nome..." 
                                        className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                                    />
                                </div>
                            </div>
                            <ul className="divide-y divide-slate-50">
                                {professionalsData.map(prof => (
                                    <li 
                                        key={prof.id} 
                                        className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                                        onClick={() => setSelectedProfessionalId(prof.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Foto com Upload Button */}
                                            <div className="relative group/avatar cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                                <img 
                                                    src={prof.avatarUrl} 
                                                    alt={prof.name} 
                                                    className="w-12 h-12 rounded-full object-cover border border-slate-200" 
                                                />
                                                <input 
                                                    type="file" 
                                                    accept="image/*"
                                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                    onChange={(e) => handleUploadFoto(e, prof.id)}
                                                />
                                                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity text-white pointer-events-none">
                                                    <Camera size={14} />
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm">{prof.name}</h4>
                                                <p className="text-xs text-slate-500">{prof.email || 'e-mail não cadastrado'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="hidden md:inline-block px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-semibold">
                                                Ativo
                                            </span>
                                            <button 
                                                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200"
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {activeTab === 'schedule' && (
                        <Card>
                            <div className="divide-y divide-slate-100">
                                {schedule.map((item, index) => (
                                    <div key={item.day} className={`flex items-center justify-between py-4 first:pt-0 last:pb-0 ${!item.active ? 'opacity-50' : ''}`}>
                                        <span className="font-medium text-slate-700 w-32">{item.day}</span>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="time" 
                                                value={item.start} 
                                                onChange={(e) => updateScheduleTime(index, 'start', e.target.value)}
                                                disabled={!item.active}
                                                className={`border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-orange-500 w-24 ${!item.active ? 'bg-slate-100 text-slate-400' : 'bg-white'}`} 
                                            />
                                            <span className="text-slate-400 font-medium">até</span>
                                            <input 
                                                type="time" 
                                                value={item.end} 
                                                onChange={(e) => updateScheduleTime(index, 'end', e.target.value)}
                                                disabled={!item.active}
                                                className={`border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-orange-500 w-24 ${!item.active ? 'bg-slate-100 text-slate-400' : 'bg-white'}`} 
                                            />
                                        </div>
                                        <div className="w-16 flex justify-end">
                                            <ToggleSwitch on={item.active} onClick={() => toggleDay(index)} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {activeTab === 'notifications' && (
                        <Card>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-slate-800">Notificações no Navegador</p>
                                        <p className="text-sm text-slate-500">Receba alertas pop-up quando estiver com o app aberto.</p>
                                    </div>
                                    <ToggleSwitch on={notifications.browser} onClick={() => setNotifications(prev => ({...prev, browser: !prev.browser}))} />
                                </div>
                                <hr className="border-slate-100"/>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-slate-800">Alertas por E-mail</p>
                                        <p className="text-sm text-slate-500">Resumo de agendamentos e cancelamentos importantes.</p>
                                    </div>
                                    <ToggleSwitch on={notifications.email} onClick={() => setNotifications(prev => ({...prev, email: !prev.email}))} />
                                </div>
                                <hr className="border-slate-100"/>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-slate-800">Integração WhatsApp (JaciBot)</p>
                                        <p className="text-sm text-slate-500">Permitir que o bot envie notificações para o seu número.</p>
                                    </div>
                                    <ToggleSwitch on={notifications.whatsapp} onClick={() => setNotifications(prev => ({...prev, whatsapp: !prev.whatsapp}))} />
                                </div>
                                <hr className="border-slate-100"/>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-slate-800">Resumo Diário</p>
                                        <p className="text-sm text-slate-500">Receba um relatório de desempenho todo dia às 20h.</p>
                                    </div>
                                    <ToggleSwitch on={notifications.dailySummary} onClick={() => setNotifications(prev => ({...prev, dailySummary: !prev.dailySummary}))} />
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            </main>

            {serviceModal.open && (
                <ServiceModal 
                    service={serviceModal.data}
                    availableCategories={categories.filter(c => c !== 'Todas')} 
                    onClose={() => setServiceModal({ open: false, data: null })} 
                    onSave={handleSaveService} 
                />
            )}
            {profModal.open && (
                <ProfessionalModal 
                    professional={profModal.data} 
                    onClose={() => setProfModal({ open: false, data: null })} 
                    onSave={handleSaveProfessional} 
                />
            )}
        </div>
    );
};

export default ConfiguracoesView;