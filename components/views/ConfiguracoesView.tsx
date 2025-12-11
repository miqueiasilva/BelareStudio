import React, { useState, useMemo, useEffect } from 'react';
import { Settings, User, Scissors, Clock, Bell, Store, Save, Plus, Trash2, Edit2, Search, Filter, Download, FolderPen, ChevronLeft, Menu } from 'lucide-react';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';
import { services as initialServices, professionals as initialProfessionals } from '../../data/mockData';
import { ServiceModal, ProfessionalModal } from '../modals/ConfigModals';
import { LegacyService, LegacyProfessional } from '../../types';
import ContextMenu from '../shared/ContextMenu';

const ConfiguracoesView: React.FC = () => {
    const [activeTab, setActiveTab] = useState('studio');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Initial check for mobile
    useEffect(() => {
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    }, []);

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    };

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
    const [professionalsData, setProfessionalsData] = useState<LegacyProfessional[]>(initialProfessionals);
    
    // --- Services Filters State ---
    const [serviceSearch, setServiceSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todas');
    
    // --- Context Menu State ---
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; options: any[] } | null>(null);

    const [schedule, setSchedule] = useState(
        ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day, i) => ({
            day,
            start: i >= 5 ? '09:00' : '09:00', // Weekend vs Weekday logic (simplified)
            end: i >= 5 ? '14:00' : '18:00',
            active: i !== 6 // Sunday inactive by default
        }))
    );

    // --- State: Modals ---
    const [serviceModal, setServiceModal] = useState<{ open: boolean; data: LegacyService | null }>({ open: false, data: null });
    const [profModal, setProfModal] = useState<{ open: boolean; data: LegacyProfessional | null }>({ open: false, data: null });

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

    // Studio & Notifications
    const handleSaveStudio = () => showToast('Dados do estúdio salvos com sucesso!');
    const handleSaveNotifications = () => showToast('Preferências de notificação atualizadas!');
    const handleSaveSchedule = () => showToast('Horário de funcionamento atualizado!');

    // Services CRUD
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

    // Professionals CRUD
    const handleSaveProfessional = (prof: LegacyProfessional) => {
        setProfessionalsData(prev => {
            const exists = prev.find(p => p.id === prof.id);
            if (exists) return prev.map(p => p.id === prof.id ? prof : p);
            return [...prev, prof];
        });
        setProfModal({ open: false, data: null });
        showToast(`Profissional "${prof.name}" salvo com sucesso!`);
    };

    const handleDeleteProfessional = (id: number) => {
        if (window.confirm('Tem certeza que deseja remover este profissional?')) {
            setProfessionalsData(prev => prev.filter(p => p.id !== id));
            showToast('Profissional removido.', 'info');
        }
    };

    // Schedule Logic
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
        { id: 'team', label: 'Profissionais', icon: User },
        { id: 'schedule', label: 'Horário de Funcionamento', icon: Clock },
        { id: 'notifications', label: 'Notificações', icon: Bell },
    ];

    return (
        <div className="flex h-full bg-slate-50 overflow-hidden relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} options={contextMenu.options} onClose={() => setContextMenu(null)} />}

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/20 z-20 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar Settings */}
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
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto w-full">
                <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
                    
                    {/* Header for current tab */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                                title={isSidebarOpen ? "Ocultar menu" : "Mostrar menu"}
                            >
                                {isSidebarOpen ? <ChevronLeft size={20} className="hidden md:block" /> : <Menu size={20} />}
                                {isSidebarOpen && <ChevronLeft size={20} className="md:hidden" />}
                            </button>
                            <div>
                                <h3 className="text-2xl font-bold text-slate-800">{tabs.find(t => t.id === activeTab)?.label}</h3>
                                {activeTab !== 'services' && <p className="text-slate-500 text-sm mt-1 hidden sm:block">Gerencie as preferências e informações do sistema.</p>}
                            </div>
                        </div>
                        
                        {/* Dynamic Actions */}
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

                    {/* Content Areas */}
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
                            {/* Toolbar */}
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

                            {/* Service List Table */}
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
                                            {filteredServices.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                                        Nenhum serviço encontrado.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Pagination (Static for Mock) */}
                                <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
                                    <span className="text-xs font-bold bg-white text-slate-800 border border-slate-200 w-8 h-8 flex items-center justify-center rounded-lg shadow-sm">
                                        {filteredServices.length}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'team' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {professionalsData.map(prof => (
                                <div key={prof.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-orange-200 transition-colors">
                                    <div className="relative group">
                                        <img src={prof.avatarUrl} alt={prof.name} className="w-14 h-14 rounded-full object-cover border-2 border-slate-100" />
                                        <button 
                                            onClick={() => setProfModal({ open: true, data: prof })} 
                                            className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-xs"
                                        >
                                            <Edit2 size={16}/>
                                        </button>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-800">{prof.name}</h4>
                                        <p className="text-xs text-slate-500">Especialista</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">Ativo</span>
                                            <span className="text-[10px] text-slate-400">ID: #{prof.id}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <button 
                                            onClick={() => setProfModal({ open: true, data: prof })} 
                                            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                        >
                                            <Edit2 size={16}/>
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteProfessional(prof.id)} 
                                            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                             {professionalsData.length === 0 && (
                                <div className="col-span-2 text-center p-8 text-slate-500">Nenhum profissional cadastrado.</div>
                            )}
                        </div>
                    )}

                    {activeTab === 'schedule' && (
                        <Card>
                            <div className="divide-y divide-slate-100">
                                {schedule.map((item, index) => {
                                    return (
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
                                    );
                                })}
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

            {/* Modals */}
            {serviceModal.open && (
                <ServiceModal 
                    service={serviceModal.data} 
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
