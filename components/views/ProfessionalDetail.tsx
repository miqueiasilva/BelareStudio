
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, Calendar, Clock, DollarSign, 
  CheckCircle, User, Save, Scissors, 
  Loader2, Shield, Bell, AlertCircle, Camera 
} from 'lucide-react';
import { LegacyProfessional, LegacyService } from '../../types';
import ToggleSwitch from '../shared/ToggleSwitch'; 
import { supabase } from '../../services/supabaseClient';

// --- Constantes ---
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
    title: 'Configurações',
    icon: Shield,
    keys: [
      { key: 'manage_services', label: 'Gerenciar Serviços' },
      { key: 'manage_team', label: 'Gerenciar Equipe' }
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
  const [isFetching, setIsFetching] = useState(true);
  const [services, setServices] = useState<LegacyService[]>([]);
  
  // Estados do Formulário
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', role: '', cpf: '', birth_date: '', bio: '', photo_url: '', online_booking: true
  });

  // Estados JSON
  const [permissions, setPermissions] = useState<any>({});
  const [servicesEnabled, setServicesEnabled] = useState<string[]>([]);
  const [commissionConfig, setCommissionConfig] = useState<any>({});
  const [notificationSettings, setNotificationSettings] = useState<any>({});
  const [workSchedule, setWorkSchedule] = useState<any>({});

  // 1. Carregar Serviços Globais
  useEffect(() => {
    supabase.from('services').select('*').then(({ data }) => {
      if (data) setServices(data);
    });
  }, []);

  // 2. BUSCAR DADOS COMPLETOS
  useEffect(() => {
    const fetchFullData = async () => {
      setIsFetching(true);
      try {
        const { data, error } = await supabase
          .from('professionals')
          .select('*')
          .eq('id', professional.id)
          .single();

        if (error) throw error;
        if (data) {
          setFormData({
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || '',
            role: data.role || '',
            cpf: data.cpf || '',
            birth_date: data.birth_date || '',
            bio: data.bio || '',
            photo_url: data.photo_url || '',
            online_booking: data.online_booking !== false
          });
          setPermissions(data.permissions || {});
          
          // Tratamento seguro para services_enabled
          let sEnabled = data.services_enabled;
          if (typeof sEnabled === 'string') {
             try { sEnabled = JSON.parse(sEnabled); } catch { sEnabled = []; }
          }
          setServicesEnabled(Array.isArray(sEnabled) ? sEnabled : []);

          setCommissionConfig(data.commission_config || {});
          setNotificationSettings(data.notification_settings || {});
          setWorkSchedule(data.work_schedule || {});
        }
      } catch (err) {
        console.error("Erro ao carregar detalhes:", err);
      } finally {
        setIsFetching(false);
      }
    };

    fetchFullData();
  }, [professional.id]);

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
    const idStr = serviceId.toString();
    setServicesEnabled((prev) => {
      if (prev.includes(idStr)) return prev.filter(id => id !== idStr);
      return [...prev, idStr];
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

  // Função Helper para evitar valores NaN na comissão
  const handleCommissionRateChange = (value: string) => {
    const floatVal = parseFloat(value);
    // Se o usuário limpar o campo ou digitar algo inválido, definimos como 0 temporariamente no estado
    // Mas mantemos como string no input para permitir digitação
    setCommissionConfig({ ...commissionConfig, rate: isNaN(floatVal) ? 0 : floatVal });
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // PREPARAÇÃO SEGURA DOS DADOS (Evita travamentos)
      const cleanBirthDate = formData.birth_date && formData.birth_date.trim() !== '' ? formData.birth_date : null;
      
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        cpf: formData.cpf,
        bio: formData.bio,
        photo_url: formData.photo_url,
        online_booking: formData.online_booking,
        
        birth_date: cleanBirthDate, // Envia NULL se estiver vazio, evita erro de data inválida
        
        permissions: permissions || {},
        services_enabled: servicesEnabled || [],
        
        // Garante que a comissão seja um número válido
        commission_config: {
            ...commissionConfig,
            rate: typeof commissionConfig.rate === 'number' ? commissionConfig.rate : 0
        },
        
        notification_settings: notificationSettings || {},
        work_schedule: workSchedule || {}
      };

      console.log("Enviando Payload:", payload); // Para debug no console F12

      const { error } = await supabase
        .from('professionals')
        .update(payload)
        .eq('id', professional.id);

      if (error) throw error;
      
      alert('Dados salvos com sucesso!');
      onUpdate();
    } catch (error: any) {
      console.error("Erro no salvamento:", error);
      alert('Erro ao salvar: ' + (error.message || 'Verifique sua conexão'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <span className="ml-3 text-slate-500 font-medium">Carregando perfil...</span>
      </div>
    );
  }

  // --- Renderização das Abas ---

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-orange-500" /> Informações Pessoais
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome Completo</label>
                  <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cargo</label>
                  <input value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="Ex: Cabeleireira" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">CPF</label>
                  <input value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nascimento</label>
                  <input type="date" value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
               <h3 className="text-lg font-bold text-slate-800 mb-4">Contato</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Email" />
                 <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Whatsapp" />
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
                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{servicesEnabled.length} ativos</span>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
               {services.map(service => {
                 const isChecked = servicesEnabled.includes(service.id.toString());
                 return (
                   <label key={service.id} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${isChecked ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-orange-300'}`}>
                     <div className={`w-5 h-5 flex items-center justify-center border rounded ${isChecked ? 'bg-orange-500 border-orange-500' : 'bg-white border-slate-300'}`}>
                        {isChecked && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                     </div>
                     <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={isChecked} 
                        onChange={() => handleServiceToggle(service.id.toString())} 
                     />
                     <span className="font-medium text-slate-700">{service.name}</span>
                   </label>
                 );
               })}
             </div>
          </div>
        );

      case 'schedule':
        const days = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
        return (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in space-y-4">
             <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-blue-500" /> Horário de Trabalho</h3>
             {days.map(day => {
                const schedule = workSchedule[day] || { active: false, start: '09:00', end: '18:00' };
                return (
                  <div key={day} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${schedule.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                    <div className="flex items-center gap-4">
                      <ToggleSwitch checked={schedule.active} onChange={(val) => handleScheduleChange(day, 'active', val)} />
                      <span className="capitalize font-bold text-slate-700 w-24">{day}</span>
                    </div>
                    {schedule.active && (
                      <div className="flex items-center gap-2">
                        <input type="time" value={schedule.start} onChange={(e) => handleScheduleChange(day, 'start', e.target.value)} className="p-2 border border-slate-200 rounded-lg text-sm" />
                        <span className="text-slate-400">até</span>
                        <input type="time" value={schedule.end} onChange={(e) => handleScheduleChange(day, 'end', e.target.value)} className="p-2 border border-slate-200 rounded-lg text-sm" />
                      </div>
                    )}
                  </div>
                );
             })}
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
                      value={commissionConfig.rate || ''} 
                      onChange={(e) => handleCommissionRateChange(e.target.value)} 
                      placeholder="0"
                      className="text-3xl font-black text-orange-600 bg-transparent outline-none w-24 placeholder-orange-300" 
                   />
                   <span className="text-orange-400 font-bold">%</span>
                </div>
             </div>
             <div className="space-y-4">
                <div className="flex justify-between items-center p-3 border rounded-xl">
                   <span className="font-medium text-slate-700">Descontar Taxa de Cartão?</span>
                   <ToggleSwitch checked={commissionConfig.deduct_fees || false} onChange={(val) => setCommissionConfig({...commissionConfig, deduct_fees: val})} />
                </div>
                <div className="flex justify-between items-center p-3 border rounded-xl">
                   <span className="font-medium text-slate-700">Receber Gorjetas?</span>
                   <ToggleSwitch checked={commissionConfig.allow_tips || false} onChange={(val) => setCommissionConfig({...commissionConfig, allow_tips: val})} />
                </div>
             </div>
          </div>
        );

      case 'permissions':
        return (
          <div className="grid grid-cols-1 gap-6 animate-in fade-in">
             {Object.entries(PERMISSION_GROUPS).map(([groupKey, groupData]) => (
               <div key={groupKey} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-50 pb-3">
                    <groupData.icon className="w-5 h-5 text-purple-500" /> {groupData.title}
                  </h3>
                  <div className="space-y-3">
                    {groupData.keys.map((perm) => (
                      <div key={perm.key} className="flex items-center justify-between py-2">
                        <span className="text-sm font-medium text-slate-600">{perm.label}</span>
                        <ToggleSwitch checked={permissions?.[groupKey]?.[perm.key] || false} onChange={() => handlePermissionChange(groupKey, perm.key)} />
                      </div>
                    ))}
                  </div>
               </div>
             ))}
          </div>
        );
        
        case 'notifications':
            return (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in space-y-4">
                 <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Bell className="w-5 h-5 text-yellow-500" /> Preferências de Notificação</h3>
                 <div className="flex items-center justify-between p-3 border rounded-xl">
                    <span className="font-medium text-slate-700">Notificar novos agendamentos (App)</span>
                    <ToggleSwitch checked={notificationSettings.app_booking || false} onChange={(val) => setNotificationSettings({...notificationSettings, app_booking: val})} />
                 </div>
                 <div className="flex items-center justify-between p-3 border rounded-xl">
                    <span className="font-medium text-slate-700">Receber emails de resumo diário</span>
                    <ToggleSwitch checked={notificationSettings.email_daily || false} onChange={(val) => setNotificationSettings({...notificationSettings, email_daily: val})} />
                 </div>
              </div>
            );

      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-4">
           <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft size={24} className="text-slate-600" /></button>
           <div>
             <h1 className="text-xl font-bold text-slate-800">{formData.name || 'Novo Profissional'}</h1>
             <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Configurações do Profissional</p>
           </div>
        </div>
        <button onClick={handleSave} disabled={isLoading} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-200 transition-all active:scale-95 flex items-center gap-2">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={20} />} {isLoading ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Esquerda */}
        <div className="w-80 p-6 border-r border-slate-200 bg-white overflow-y-auto hidden md:block">
           <div className="text-center mb-6">
              <div className="w-32 h-32 mx-auto bg-slate-100 rounded-full mb-4 relative group cursor-pointer overflow-hidden border-4 border-white shadow-md">
                 {formData.photo_url ? (
                   <img src={formData.photo_url} className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-3xl font-black text-slate-300">{formData.name.substring(0,2).toUpperCase()}</div>
                 )}
              </div>
              <h2 className="text-lg font-bold text-slate-800">{formData.name}</h2>
              <p className="text-sm text-slate-500">{formData.role}</p>
              <div className="mt-4 flex flex-col gap-2 items-center">
                 {servicesEnabled.length > 0 && <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-100 flex items-center gap-1"><CheckCircle size={10} /> Executa Serviços</span>}
              </div>
           </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 flex flex-col bg-slate-50">
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
                   <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                     <tab.icon size={18} /> {tab.label}
                   </button>
                 ))}
              </div>
           </div>
           <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto">{renderTabContent()}</div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalDetail;
