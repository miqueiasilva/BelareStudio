
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, Mail, Phone, MapPin, Calendar, Clock, DollarSign, 
  CheckCircle, List, User, Save, Upload, Plus, Trash2, Globe, Camera, Scissors, 
  Loader2, Shield, Bell, Search, AlertCircle, Coffee 
} from 'lucide-react';
import { LegacyProfessional, LegacyService } from '../../types';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import { supabase } from '../../services/supabaseClient';

// --- Constantes de Configuração ---

const PERMISSION_GROUPS = {
  agenda: {
    title: 'Agenda e Atendimentos',
    icon: Calendar,
    keys: [
      { key: 'view_calendar', label: 'Ver própria agenda' },
      { key: 'view_others_calendar', label: 'Ver agenda da equipe' },
      { key: 'edit_calendar', label: 'Editar agendamentos' },
      { key: 'block_time', label: 'Bloquear horários' }
    ]
  },
  financeiro: {
    title: 'Financeiro e Vendas',
    icon: DollarSign,
    keys: [
      { key: 'view_sales', label: 'Ver histórico de vendas' },
      { key: 'perform_checkout', label: 'Realizar vendas/pagamentos' },
      { key: 'give_discount', label: 'Aplicar descontos manuais' },
      { key: 'view_reports', label: 'Acessar relatórios financeiros' }
    ]
  },
  clientes: {
    title: 'Gestão de Clientes',
    icon: User,
    keys: [
      { key: 'view_clients', label: 'Visualizar lista de clientes' },
      { key: 'edit_clients', label: 'Editar cadastro de clientes' },
      { key: 'delete_clients', label: 'Remover clientes' }
    ]
  },
  config: {
    title: 'Configurações do Sistema',
    icon: Shield,
    keys: [
      { key: 'manage_services', label: 'Gerenciar Serviços' },
      { key: 'manage_team', label: 'Gerenciar Equipe' },
      { key: 'manage_settings', label: 'Acessar Configurações Gerais' }
    ]
  }
};

interface ProfessionalDetailProps {
  professional: LegacyProfessional;
  onBack: () => void;
  onUpdate: () => void;
}

const ProfessionalDetail: React.FC<ProfessionalDetailProps> = ({ professional, onBack, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [services, setServices] = useState<LegacyService[]>([]);
  
  // Estados do Formulário (Inicializados com segurança)
  const [formData, setFormData] = useState({
    name: professional.name || '',
    email: professional.email || '',
    phone: professional.phone || '',
    role: professional.role || '',
    cpf: professional.cpf || '',
    birth_date: professional.birth_date || '',
    bio: professional.bio || '',
    photo_url: professional.avatarUrl || '',
    online_booking: professional.online_booking !== false // Default true
  });

  // Estados JSON (Inicializados com {} para evitar crash)
  const [permissions, setPermissions] = useState<any>(professional.permissions || {});
  const [servicesEnabled, setServicesEnabled] = useState<any>(professional.services_enabled || []);
  const [commissionConfig, setCommissionConfig] = useState<any>(professional.commission_config || {});
  const [notificationSettings, setNotificationSettings] = useState<any>(professional.notification_settings || {});
  const [workSchedule, setWorkSchedule] = useState<any>(professional.work_schedule || {});

  // Carregar Serviços do Banco
  useEffect(() => {
    const loadServices = async () => {
      const { data } = await supabase.from('services').select('*');
      if (data) setServices(data);
    };
    loadServices();
  }, []);

  // --- Handlers ---

  const handlePermissionChange = (group: string, key: string) => {
    setPermissions((prev: any) => ({
      ...prev,
      [group]: {
        ...(prev?.[group] || {}),
        [key]: !prev?.[group]?.[key]
      }
    }));
  };

  const handleServiceToggle = (serviceId: string) => {
    setServicesEnabled((prev: string[]) => {
      if (prev.includes(serviceId)) return prev.filter(id => id !== serviceId);
      return [...prev, serviceId];
    });
  };

  const handleScheduleChange = (day: string, field: string, value: any) => {
    setWorkSchedule((prev: any) => ({
      ...prev,
      [day]: {
        ...(prev?.[day] || { active: false, start: '09:00', end: '18:00' }),
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        cpf: formData.cpf,
        birth_date: formData.birth_date || null, // Evita erro de data vazia
        bio: formData.bio,
        photo_url: formData.photo_url,
        online_booking: formData.online_booking,
        permissions,
        services_enabled: servicesEnabled,
        commission_config: commissionConfig,
        notification_settings: notificationSettings,
        work_schedule: workSchedule
      };

      const { error } = await supabase
        .from('professionals')
        .update(payload)
        .eq('id', professional.id);

      if (error) throw error;
      
      alert('Dados salvos com sucesso!');
      onUpdate();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Renderização ---

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-orange-500" /> Informações Pessoais
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome Completo</label>
                  <input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cargo / Função</label>
                  <input 
                    value={formData.role} 
                    onChange={e => setFormData({...formData, role: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    placeholder="Ex: Cabeleireira"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">CPF</label>
                  <input 
                    value={formData.cpf} 
                    onChange={e => setFormData({...formData, cpf: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Data de Nascimento</label>
                  <input 
                    type="date"
                    value={formData.birth_date} 
                    onChange={e => setFormData({...formData, birth_date: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Phone className="w-5 h-5 text-green-500" /> Contato
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label>
                  <input 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Whatsapp</label>
                  <input 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'services':
        return (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-orange-500" /> Serviços Habilitados
                </h3>
                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                  {servicesEnabled.length} selecionados
                </span>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
               {services.map(service => (
                 <label key={service.id} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${servicesEnabled.includes(service.id) ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-orange-300'}`}>
                   <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${servicesEnabled.includes(service.id) ? 'bg-orange-500 border-orange-500' : 'border-slate-300 bg-white'}`}>
                      {servicesEnabled.includes(service.id) && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                   </div>
                   <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={servicesEnabled.includes(service.id)}
                      onChange={() => handleServiceToggle(service.id)}
                   />
                   <span className="font-medium text-slate-700">{service.name}</span>
                 </label>
               ))}
             </div>
          </div>
        );

      case 'schedule':
        const days = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
        return (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in space-y-4">
             <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" /> Horário de Trabalho
             </h3>
             {days.map(day => {
                const schedule = workSchedule[day] || { active: false, start: '09:00', end: '18:00' };
                return (
                  <div key={day} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${schedule.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-70'}`}>
                    <div className="flex items-center gap-4">
                      <ToggleSwitch 
                        checked={schedule.active} 
                        onChange={(val) => handleScheduleChange(day, 'active', val)} 
                      />
                      <span className="capitalize font-bold text-slate-700 w-24">{day}</span>
                    </div>
                    {schedule.active && (
                      <div className="flex items-center gap-2">
                        <input 
                          type="time" 
                          value={schedule.start}
                          onChange={(e) => handleScheduleChange(day, 'start', e.target.value)}
                          className="p-2 border border-slate-200 rounded-lg text-sm"
                        />
                        <span className="text-slate-400">até</span>
                        <input 
                          type="time" 
                          value={schedule.end}
                          onChange={(e) => handleScheduleChange(day, 'end', e.target.value)}
                          className="p-2 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                    )}
                  </div>
                );
             })}
          </div>
        );

      case 'permissions':
        return (
          <div className="grid grid-cols-1 gap-6 animate-in fade-in">
             {Object.entries(PERMISSION_GROUPS).map(([groupKey, groupData]) => (
               <div key={groupKey} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-50 pb-3">
                    <groupData.icon className="w-5 h-5 text-purple-500" />
                    {groupData.title}
                  </h3>
                  <div className="space-y-3">
                    {groupData.keys.map((perm) => (
                      <div key={perm.key} className="flex items-center justify-between py-2">
                        <span className="text-sm font-medium text-slate-600">{perm.label}</span>
                        <ToggleSwitch 
                           checked={permissions?.[groupKey]?.[perm.key] || false}
                           onChange={() => handlePermissionChange(groupKey, perm.key)}
                        />
                      </div>
                    ))}
                  </div>
               </div>
             ))}
          </div>
        );

      case 'commissions':
        return (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in space-y-6">
             <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                <label className="block text-xs font-bold text-orange-600 uppercase mb-2">Comissão Padrão (%)</label>
                <div className="flex items-center gap-2">
                   <input 
                     type="number" 
                     value={commissionConfig.rate || 0}
                     onChange={(e) => setCommissionConfig({...commissionConfig, rate: parseFloat(e.target.value)})}
                     className="text-3xl font-black text-orange-600 bg-transparent outline-none w-24"
                   />
                   <span className="text-orange-400 font-bold">%</span>
                </div>
                <p className="text-xs text-orange-400 mt-2">Aplicada a todos os serviços, exceto exceções.</p>
             </div>

             <div className="space-y-4">
                <div className="flex justify-between items-center p-3 border rounded-xl">
                   <span className="font-medium text-slate-700">Descontar Taxa de Cartão?</span>
                   <ToggleSwitch 
                      checked={commissionConfig.deduct_fees || false}
                      onChange={(val) => setCommissionConfig({...commissionConfig, deduct_fees: val})}
                   />
                </div>
                <div className="flex justify-between items-center p-3 border rounded-xl">
                   <span className="font-medium text-slate-700">Receber Gorjetas?</span>
                   <ToggleSwitch 
                      checked={commissionConfig.allow_tips || false}
                      onChange={(val) => setCommissionConfig({...commissionConfig, allow_tips: val})}
                   />
                </div>
             </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-4">
           <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
             <ChevronLeft size={24} className="text-slate-600" />
           </button>
           <div>
             <h1 className="text-xl font-bold text-slate-800">{professional.name}</h1>
             <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Configurações do Profissional</p>
           </div>
        </div>
        <button 
          onClick={handleSave}
          disabled={isLoading}
          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-200 transition-all active:scale-95 flex items-center gap-2"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={20} />}
          {isLoading ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Esquerda (Card Fixo) */}
        <div className="w-80 p-6 border-r border-slate-200 bg-white overflow-y-auto hidden md:block">
           <div className="text-center mb-6">
              <div className="w-32 h-32 mx-auto bg-slate-100 rounded-full mb-4 relative group cursor-pointer">
                 {formData.photo_url ? (
                   <img src={formData.photo_url} className="w-full h-full rounded-full object-cover border-4 border-white shadow-md" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-3xl font-black text-slate-300">
                     {formData.name.substring(0,2).toUpperCase()}
                   </div>
                 )}
                 <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium">
                   <Camera size={24} />
                 </div>
              </div>
              <h2 className="text-lg font-bold text-slate-800">{formData.name}</h2>
              <p className="text-sm text-slate-500">{formData.email}</p>
              
              <div className="mt-4 flex flex-col gap-2">
                 {servicesEnabled.length > 0 && (
                   <span className="inline-flex items-center justify-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-100">
                     <CheckCircle size={12} /> Executa Atendimentos
                   </span>
                 )}
                 {permissions?.financeiro?.perform_checkout && (
                   <span className="inline-flex items-center justify-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-100">
                     <CheckCircle size={12} /> Realiza Vendas
                   </span>
                 )}
              </div>
           </div>

           <div className="mt-8 border-t border-slate-100 pt-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Informações Rápidas</h4>
              <div className="space-y-3">
                 <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Calendar size={16} className="text-slate-400" />
                    <span>Nasc: {formData.birth_date ? new Date(formData.birth_date).toLocaleDateString('pt-BR') : '-'}</span>
                 </div>
                 <div className="flex items-center gap-3 text-sm text-slate-600">
                    <AlertCircle size={16} className="text-slate-400" />
                    <span>CPF: {formData.cpf || '-'}</span>
                 </div>
              </div>
           </div>
        </div>

        {/* Conteúdo Principal (Abas) */}
        <div className="flex-1 flex flex-col bg-slate-50">
           {/* Menu de Abas */}
           <div className="bg-white border-b border-slate-200 px-6">
              <div className="flex gap-6 overflow-x-auto no-scrollbar">
                 {[
                   { id: 'profile', label: 'Perfil', icon: User },
                   { id: 'services', label: 'Serviços', icon: Scissors },
                   { id: 'schedule', label: 'Horários', icon: Clock },
                   { id: 'commissions', label: 'Comissões', icon: DollarSign },
                   { id: 'permissions', label: 'Permissões', icon: Shield },
                   { id: 'notifications', label: 'Notificações', icon: Bell },
                 ].map(tab => (
                   <button
                     key={tab.id}
                     onClick={() => setActiveTab(tab.id)}
                     className={`flex items-center gap-2 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                       activeTab === tab.id 
                         ? 'border-orange-500 text-orange-600' 
                         : 'border-transparent text-slate-500 hover:text-slate-800'
                     }`}
                   >
                     <tab.icon size={18} />
                     {tab.label}
                   </button>
                 ))}
              </div>
           </div>

           {/* Área de Conteúdo */}
           <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto">
                 {renderTabContent()}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalDetail;
