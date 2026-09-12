
import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { LegacyAppointment, Client, LegacyProfessional, LegacyService } from '../../types';
import { ChevronLeft, User, Calendar, Tag, Clock, DollarSign, Info, PlusCircle, Repeat, X, Loader2, AlertCircle, Briefcase, CheckSquare, Mail, Trash2, Edit2 } from 'lucide-react';
import { format, addMinutes } from 'date-fns';
import SelectionModal from './SelectionModal';
import ClientSearchModal from './ClientSearchModal'; 
import ClientModal from './ClientModal';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useStudio } from '../../contexts/StudioContext';

interface AppointmentModalProps {
  appointment: LegacyAppointment | Partial<LegacyAppointment> | null;
  onClose: () => void;
  onSave: (appointment: LegacyAppointment, force?: boolean) => void | Promise<void>;
}

const AppointmentModal: React.FC<AppointmentModalProps> = ({ appointment, onClose, onSave }) => {
  const { user } = useAuth();
  const { activeStudioId } = useStudio();
  
  const [dbServices, setDbServices] = useState<LegacyService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [dbProfessionals, setDbProfessionals] = useState<LegacyProfessional[]>([]);
  const [loadingProfessionals, setLoadingProfessionals] = useState(false);

  const [formData, setFormData] = useState<Partial<LegacyAppointment>>({
    status: 'agendado',
    ...appointment,
    start: appointment?.start || new Date(),
  });
  
  const [selectedServices, setSelectedServices] = useState<LegacyService[]>(
    appointment?.service ? [appointment.service] : []
  );

  const [manualPrice, setManualPrice] = useState<number | ''>(0);
  const [hours, setHours] = useState<number | ''>(0);
  const [minutes, setMinutes] = useState<number | ''>(0);
  const manualDuration = (Number(hours) || 0) * 60 + (Number(minutes) || 0);

  const [selectionModal, setSelectionModal] = useState<'client' | 'service' | 'professional' | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOverlapConfirm, setShowOverlapConfirm] = useState(false);
  const [showDayOffConfirm, setShowDayOffConfirm] = useState(false);
  const [clientEmail, setClientEmail] = useState('');

  const fetchServices = async () => {
    if (!activeStudioId) return;
    setLoadingServices(true);
    try {
      const { data, error: sbError } = await supabase
        .from('services')
        .select('*')
        .eq('studio_id', activeStudioId)
        .eq('ativo', true)
        .order('nome');

      if (sbError) throw sbError;

      if (data) {
        const mapped: LegacyService[] = data.map((s: any) => ({
          id: s.id,
          name: s.nome || 'Serviço sem nome',
          duration: s.duracao_min != null ? Number(s.duracao_min) : 30,
          price: s.preco != null ? Number(s.preco) : 0,
          color: s.cor_hex || '#3b82f6',
          category: s.categoria
        }));
        setDbServices(mapped);
      }
    } catch (e: any) {
      console.error("Erro ao carregar serviços:", e.message);
    } finally {
      setLoadingServices(false);
    }
  };

  const fetchProfessionals = async () => {
    if (!activeStudioId) return;
    setLoadingProfessionals(true);
    try {
      const { data, error: sbError } = await supabase
        .from('team_members')
        .select('id, name, photo_url, role, active, services_enabled, work_schedule')
        .eq('studio_id', activeStudioId)
        .eq('active', true)
        .order('name');

      if (sbError) throw sbError;

      if (data) {
        const mapped: LegacyProfessional[] = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${p.name}&background=random`,
          role: p.role,
          services_enabled: p.services_enabled || [],
          work_schedule: p.work_schedule || {}
        }));
        setDbProfessionals(mapped);
      }
    } catch (e: any) {
      console.error("Erro ao carregar profissionais:", e.message);
    } finally {
      setLoadingProfessionals(false);
    }
  };

  useEffect(() => {
    fetchServices();
    fetchProfessionals();
  }, [activeStudioId]);

  const filteredServicesToSelect = useMemo(() => {
    if (!formData.professional) return [];
    const profSkills = formData.professional.services_enabled;
    if (profSkills && Array.isArray(profSkills) && profSkills.length > 0) {
      return dbServices.filter(s => profSkills.includes(s.id));
    }
    return dbServices;
  }, [dbServices, formData.professional]);

  useEffect(() => {
      setFormData({
          status: 'agendado',
          ...appointment,
          start: appointment?.start || new Date(),
      });
      
      const apptPrice = appointment?.service?.price !== undefined && appointment.service.price !== null
          ? Number(appointment.service.price)
          : ((appointment as any)?.value !== undefined && (appointment as any)?.value !== null ? Number((appointment as any).value) : undefined);

      let initialServices = appointment?.services && appointment.services.length > 0
          ? appointment.services.map(s => ({ ...s }))
          : (appointment?.service ? [{ ...appointment.service }] : []);

      // Sincronizar dados do serviço com o cadastro oficial (duracao_min cadastrada)
      if (dbServices && dbServices.length > 0) {
          initialServices = initialServices.map(s => {
              const match = dbServices.find(d => String(d.id) === String(s.id) || (d.name && s.name && d.name.trim().toLowerCase() === s.name.trim().toLowerCase()));
              if (match) {
                  return {
                      ...s,
                      id: match.id || s.id,
                      duration: match.duration,
                      color: match.color || s.color,
                      category: match.category || s.category
                  };
              }
              return s;
          });
      }

      if (apptPrice !== undefined && !isNaN(apptPrice)) {
          if (initialServices.length === 1) {
              initialServices = [{ ...initialServices[0], price: apptPrice }];
          } else if (initialServices.length > 1) {
              const curSum = initialServices.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
              if (Math.abs(curSum - apptPrice) > 0.01) {
                  const diff = apptPrice - curSum;
                  initialServices[initialServices.length - 1] = {
                      ...initialServices[initialServices.length - 1],
                      price: Math.max(0, (Number(initialServices[initialServices.length - 1].price) || 0) + diff)
                  };
              }
          }
      }
      setSelectedServices(initialServices);
      
      if (apptPrice !== undefined && !isNaN(apptPrice)) {
          setManualPrice(apptPrice);
      } else if (initialServices.length > 0) {
          setManualPrice(initialServices.reduce((acc, s) => acc + (Number(s.price) || 0), 0));
      } else {
          setManualPrice(0);
      }

      // Duração: calcula a soma exata dos serviços selecionados de acordo com o cadastro
      let dur = 0;
      if (initialServices.length > 0) {
          dur = initialServices.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
      } else if (appointment?.id) {
          dur = Number(appointment.service?.duration) || (appointment.end && appointment.start ? Math.round((new Date(appointment.end).getTime() - new Date(appointment.start).getTime()) / 60000) : 0);
      }

      setHours(Math.floor(dur / 60));
      setMinutes(dur % 60);

      setClientEmail(appointment?.client?.email || '');
      setError(null);
  }, [appointment, dbServices]);

  useEffect(() => {
    if (selectedServices.length > 0) {
        setFormData(prev => ({ ...prev, service: selectedServices[0] }));
    }
  }, [selectedServices]);

  useEffect(() => {
    if (formData.start && (manualDuration > 0 || manualDuration === 0)) {
        const end = addMinutes(new Date(formData.start), manualDuration);
        if (!formData.end || formData.end.getTime() !== end.getTime()) {
          setFormData(prev => ({ ...prev, end }));
        }
    }
  }, [formData.start, manualDuration]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
    setShowOverlapConfirm(false);
    setShowDayOffConfirm(false);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    const currentStart = formData.start || new Date();
    if (dateValue) {
        const [year, month, day] = dateValue.split('-').map(Number);
        const newStart = new Date(currentStart);
        newStart.setFullYear(year, month - 1, day);
        setFormData(prev => ({...prev, start: newStart}));
    }
    setShowOverlapConfirm(false);
    setShowDayOffConfirm(false);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const timeValue = e.target.value;
     const currentStart = formData.start || new Date();
     if (timeValue) {
        const [hour, minute] = timeValue.split(':').map(Number);
        const newStart = new Date(currentStart);
        newStart.setHours(hour, minute);
        setFormData(prev => ({...prev, start: newStart}));
     }
     setShowOverlapConfirm(false);
     setShowDayOffConfirm(false);
  };

  const handleSave = async () => {
    setError(null);
    console.log('🔘 Botão Salvar clicado no Modal. Dados:', {
        client: formData.client?.nome,
        professional: formData.professional?.name,
        services: selectedServices.map(s => s.name)
    });

    if (!formData.client) return setError('Por favor, selecione um cliente.');
    if (selectedServices.length === 0) return setError('Por favor, selecione pelo menos um serviço.');
    if (!formData.professional) return setError('Por favor, selecione um profissional.');

    // Validar se o profissional trabalha neste dia
    const prof = formData.professional as LegacyProfessional;
    if (prof.work_schedule && !showDayOffConfirm) {
        const start = new Date(formData.start!);
        const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][start.getDay()];
        const config = prof.work_schedule[dayKey];
        if (!config || !config.active) {
            setShowDayOffConfirm(true);
            return setError(`⚠️ Este profissional não atende neste dia de semana. Deseja abrir uma exceção e agendar mesmo assim?`);
        }
    }

    // Validar intervalo do profissional (Aviso apenas no admin)
    if (prof.work_schedule && !showOverlapConfirm) {
        const start = new Date(formData.start!);
        const end = addMinutes(start, manualDuration);
        const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][start.getDay()];
        const config = prof.work_schedule[dayKey];
        
        if (config?.active && config.break_active) {
            const bS = config.break_start || '12:00';
            const bE = config.break_end || '13:00';
            const [bSH, bSM] = bS.split(':').map(Number);
            const [bEH, bEM] = bE.split(':').map(Number);
            
            const bStart = new Date(start);
            bStart.setHours(bSH, bSM, 0, 0);
            const bEnd = new Date(start);
            bEnd.setHours(bEH, bEM, 0, 0);

            if (start < bEnd && end > bStart) {
                setShowOverlapConfirm(true);
                return setError(`⚠️ Horário em conflito com o intervalo (${bS} - ${bE}). Deseja salvar como encaixe?`);
            }
        }
    }

    setIsSaving(true);
    try {
        const finalPrice = manualPrice === '' ? 0 : Math.max(0, Number(manualPrice));
        let finalServices = selectedServices.map(s => ({ ...s, price: Number(s.price) || 0 }));
        
        if (finalServices.length === 1) {
            finalServices = [{
                ...finalServices[0],
                price: finalPrice,
                duration: manualDuration
            }];
        } else if (finalServices.length > 1) {
            const currentSum = finalServices.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
            const diff = finalPrice - currentSum;
            if (Math.abs(diff) > 0.001) {
                finalServices = finalServices.map((s, idx) => {
                    if (idx === finalServices.length - 1) {
                        return { ...s, price: Math.max(0, (Number(s.price) || 0) + diff) };
                    }
                    return s;
                });
            }
        }

        const compositeService: LegacyService = {
            ...(finalServices[0] || {}),
            name: finalServices.length > 1 
                ? `${finalServices[0].name} + ${finalServices.length - 1}` 
                : (finalServices[0]?.name || 'Serviço'),
            price: finalPrice,
            duration: manualDuration
        };

        const start = new Date(formData.start || new Date());
        const end = addMinutes(start, Math.max(5, manualDuration));

        const finalAppointment = {
            ...formData,
            start,
            end,
            client: { ...formData.client, email: clientEmail },
            service: compositeService,
            services: finalServices,
            value: finalPrice,
            notas: finalServices.length > 1 
                ? `${formData.notas || ''} \n[Serviços: ${finalServices.map(s => s.name).join(', ')}]`
                : formData.notas,
            bypassScheduleCheck: showDayOffConfirm || showOverlapConfirm,
            isForce: showDayOffConfirm || showOverlapConfirm
        } as any;

        console.log('🚀 Chamando onSave com valor atualizado:', finalPrice, finalAppointment);
        await onSave(finalAppointment, showDayOffConfirm || showOverlapConfirm);
        console.log('✅ onSave concluído com sucesso');
    } catch (err: any) {
        console.error("❌ Erro ao salvar no Modal:", err);
        const msg = err.message || err.details || "Ocorreu um erro ao salvar o agendamento.";
        setError(msg);
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleSelectClient = (client: Client) => {
    setFormData(prev => ({ ...prev, client }));
    setClientEmail(client.email || ''); 
    setSelectionModal(null);
  };

  const handlePersistAndSelectClient = async (clientData: Client) => {
    setIsSaving(true);
    try {
        const studioIdToUse = (activeStudioId && activeStudioId !== 'default-studio') 
            ? activeStudioId 
            : '558b07c9-5e8f-4315-81e5-0446547d36df';

        // Limpa o whatsapp/telefone (apenas números)
        const sanitizedPhone = clientData.whatsapp ? String(clientData.whatsapp).replace(/\D/g, '') : null;
        
        // Converte strings vazias em null para evitar erros no Postgres
        const cleanedData = Object.entries(clientData).reduce((acc: any, [key, value]) => {
            acc[key] = (value === '' || value === undefined) ? null : value;
            return acc;
        }, {});

        // NUNCA passar id: null para o Postgres ao inserir cliente novo pois 'id' é serial/identity NOT NULL
        const { id, ...dataWithoutId } = cleanedData;

        let resultClient: any = null;

        if (clientData.id) {
            const { data, error } = await supabase
                .from('clients')
                .update({ 
                    ...dataWithoutId, 
                    nome: clientData.nome,
                    name: clientData.nome,
                    apelido: clientData.apelido || clientData.nome,
                    whatsapp: sanitizedPhone, 
                    telefone: sanitizedPhone,
                    referral_source: (clientData as any).origem || (clientData as any).referral_source || 'Outros',
                    studio_id: studioIdToUse 
                })
                .eq('id', clientData.id)
                .select()
                .single();
            
            if (error) throw error;
            resultClient = data;
            toast.success("Cliente atualizado com sucesso!");
        } else {
            const { data, error } = await supabase
                .from('clients')
                .insert([{ 
                    ...dataWithoutId, 
                    nome: clientData.nome,
                    name: clientData.nome,
                    apelido: clientData.apelido || clientData.nome,
                    whatsapp: sanitizedPhone, 
                    telefone: sanitizedPhone,
                    referral_source: (clientData as any).origem || (clientData as any).referral_source || 'Outros',
                    studio_id: studioIdToUse 
                }])
                .select()
                .single();
            
            if (error) throw error;
            resultClient = data;
            toast.success("Cliente cadastrado com sucesso!");
        }
        
        handleSelectClient(resultClient);
        setIsClientModalOpen(false);
        setError(null);
    } catch (err: any) {
        console.error("Erro ao cadastrar cliente:", err);
        const errMsg = err.message || "Tente novamente";
        toast.error("Erro ao cadastrar cliente: " + errMsg);
        setError("Erro ao cadastrar cliente: " + errMsg);
        throw err;
    } finally {
        setIsSaving(false);
    }
  };

  const handleAddService = (service: LegacyService) => {
    setSelectedServices(prev => {
        const next = [...prev, service];
        const newTotal = next.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
        setManualPrice(newTotal);
        const totalDuration = next.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
        setHours(Math.floor(totalDuration / 60));
        setMinutes(totalDuration % 60);
        return next;
    });
    setSelectionModal(null);
  };

  const handleRemoveService = (index: number) => {
    setSelectedServices(prev => {
        const next = prev.filter((_, i) => i !== index);
        const newTotal = next.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
        setManualPrice(newTotal);
        const totalDuration = next.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
        setHours(Math.floor(totalDuration / 60));
        setMinutes(totalDuration % 60);
        return next;
    });
  };

  const handleServicePriceChange = (index: number, newPrice: number) => {
    setSelectedServices(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], price: Math.max(0, newPrice) };
        const total = updated.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
        setManualPrice(total);
        return updated;
    });
  };

  const handleManualPriceChange = (val: string) => {
    if (val === '') {
        setManualPrice('');
        return;
    }
    const num = parseFloat(val);
    const safeNum = isNaN(num) ? 0 : Math.max(0, num);
    setManualPrice(safeNum);
    if (selectedServices.length === 1) {
        setSelectedServices(prev => [{ ...prev[0], price: safeNum }]);
    }
  };

  const handleSelectProfessional = (professional: LegacyProfessional) => {
    if (!professional) return;
    if (formData.professional && String(formData.professional.id) !== String(professional.id)) {
        setSelectedServices([]);
        setManualPrice(0);
        setHours(0);
        setMinutes(0);
    }
    setFormData(prev => ({ ...prev, professional }));
    setSelectionModal(null);
    setShowOverlapConfirm(false);
    setShowDayOffConfirm(false);
  };
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-200" style={{height: '95vh'}} onClick={(e) => e.stopPropagation()}>
        <header className="p-4 border-b flex items-center gap-4 flex-shrink-0 bg-slate-50">
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800"><ChevronLeft size={24} /></button>
          <h3 className="text-lg font-bold text-slate-800">{formData.id ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
        </header>
        <main className="flex-1 p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm animate-pulse">
                <AlertCircle size={16} />
                <span>{error}</span>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Cliente <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setSelectionModal('client')}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${formData.client ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}><User className="w-5 h-5" /></div>
                <div className="flex-1 border-b border-slate-200 pb-2 group-hover:border-orange-300 transition-colors">
                    <input type="text" readOnly value={formData.client ? (formData.client.apelido ? `${formData.client.nome} (${formData.client.apelido})` : formData.client.nome) : ''} placeholder="Selecione o cliente" className="w-full bg-transparent cursor-pointer focus:outline-none font-medium text-slate-800 placeholder:font-normal" />
                </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2"><Calendar className="w-4 h-4 text-slate-400" /><input type="date" value={formData.start ? format(new Date(formData.start), 'yyyy-MM-dd') : ''} onChange={handleDateChange} className="w-full bg-transparent focus:outline-none text-sm font-medium" /></div>
             </div>
             <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Horário</label>
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2"><Clock className="w-4 h-4 text-slate-400" /><input type="time" value={formData.start ? format(new Date(formData.start), 'HH:mm') : ''} onChange={handleTimeChange} className="w-full bg-transparent focus:outline-none text-sm font-medium" /></div>
             </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Profissional <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setSelectionModal('professional')}>
                {formData.professional?.avatarUrl ? (<img src={formData.professional.avatarUrl} className="w-10 h-10 rounded-full object-cover shadow-sm" alt="Profissional" />) : (<div className={`w-10 h-10 rounded-full flex items-center justify-center ${formData.professional ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-400'}`}><Briefcase className="w-5 h-5" /></div>)}
                <div className="flex-1 border-b border-slate-200 pb-2 group-hover:border-teal-300 transition-colors flex justify-between items-center"><input type="text" readOnly value={formData.professional?.name || ''} placeholder="Selecione o profissional" className="w-full bg-transparent cursor-pointer focus:outline-none font-medium text-slate-800 placeholder:font-normal" /></div>
            </div>
          </div>
          <div className="space-y-2">
             <label className="text-xs font-bold text-slate-500 uppercase">Serviços <span className="text-red-500">*</span></label>
             {selectedServices.map((service, index) => (
                <div key={index} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 group hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{service.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center gap-1 bg-white border border-slate-200 px-1.5 py-0.5 rounded text-xs font-bold text-slate-700 shadow-2xs">
                          <span className="text-slate-400 font-normal">R$</span>
                          <input 
                            type="number"
                            step="any"
                            min="0"
                            value={service.price}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleServicePriceChange(index, parseFloat(e.target.value) || 0)}
                            className="w-16 bg-transparent outline-none border-none p-0 text-xs font-bold text-slate-800 focus:ring-0"
                            title="Clique para alterar o valor deste serviço"
                          />
                        </div>
                        <span className="text-xs text-slate-500">• {service.duration} min</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleRemoveService(index)} className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors" title="Remover serviço">
                    <Trash2 size={16} />
                  </button>
                </div>
             ))}
             <button onClick={() => setSelectionModal('service')} disabled={loadingServices || !formData.professional} className="w-full py-2 border border-dashed border-blue-300 rounded-lg text-blue-600 text-sm font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">{loadingServices ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle size={16} />}{!formData.professional ? 'Selecione um profissional primeiro' : (loadingServices ? 'Carregando...' : 'Adicionar Serviço')}</button>
          </div>
          <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 flex-1 bg-white p-2 rounded-lg border border-slate-200 shadow-sm h-[64px]">
                <div className="p-1.5 bg-green-50 rounded text-green-600">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div className="flex flex-col w-full">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Valor Total</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-500">R$</span>
                    <input 
                      type="number" 
                      step="any"
                      min="0"
                      value={manualPrice === '' ? '' : manualPrice} 
                      onFocus={(e) => e.target.select()} 
                      onChange={(e) => handleManualPriceChange(e.target.value)} 
                      className="font-bold text-slate-800 bg-transparent outline-none w-full p-0 border-none focus:ring-0 text-sm" 
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-1 bg-white p-2 rounded-lg border border-slate-200 shadow-sm h-[64px]"><div className="p-1.5 bg-blue-50 rounded text-blue-600"><Clock className="w-4 h-4" /></div><div className="flex flex-col w-full"><span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Duração</span><div className="flex items-center gap-1"><div className="flex items-center gap-0.5"><input type="number" min="0" value={hours === '' ? '' : hours} onFocus={(e) => e.target.select()} onChange={(e) => setHours(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))} className="w-7 font-black text-slate-800 bg-transparent outline-none p-0 border-none focus:ring-0 text-sm text-center font-mono" placeholder="0" /><span className="text-[9px] font-black text-slate-300 uppercase">h</span></div><span className="font-bold text-slate-200 mx-0.5">:</span><div className="flex items-center gap-0.5"><input type="number" min="0" max="59" value={minutes === '' ? '' : minutes} onFocus={(e) => e.target.select()} onChange={(e) => setMinutes(e.target.value === '' ? '' : Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))} className="w-7 font-black text-slate-800 bg-transparent outline-none p-0 border-none focus:ring-0 text-sm text-center font-mono" placeholder="00" /><span className="text-[9px] font-black text-slate-300 uppercase">m</span></div></div></div></div>
          </div>
          <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Status</label><div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200"><CheckSquare className="w-5 h-5 text-slate-400" /><select name="status" value={formData.status} onChange={handleChange} className="w-full bg-transparent focus:outline-none text-sm font-medium text-slate-700"><option value="agendado">Agendado</option><option value="confirmado">Confirmado Manualmente</option><option value="confirmado_whatsapp">Confirmado via WhatsApp *</option><option value="chegou">Cliente Chegou</option><option value="em_atendimento">Em Atendimento</option><option value="concluido">Concluído</option><option value="faltou">Faltou</option><option value="cancelado">Cancelado</option></select></div></div>
          <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Observações</label><div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200"><textarea name="notas" placeholder="Observações..." value={formData.notas || ''} onChange={handleChange} className="w-full bg-transparent focus:outline-none text-sm text-slate-700 resize-none" rows={2} /></div></div>
        </main>
        <footer className="p-4 bg-white border-t flex justify-end items-center gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" disabled={isSaving}>Cancelar</button>
          
          {showDayOffConfirm ? (
            <button 
              onClick={handleSave} 
              disabled={isSaving} 
              className="px-6 py-2.5 text-sm font-bold bg-rose-500 text-white rounded-lg hover:bg-rose-600 shadow-lg shadow-rose-100 flex items-center gap-2 animate-bounce animate-duration-1000"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar com Exceção'}
            </button>
          ) : showOverlapConfirm ? (
            <button 
              onClick={handleSave} 
              disabled={isSaving} 
              className="px-6 py-2.5 text-sm font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 shadow-lg shadow-amber-100 flex items-center gap-2 animate-bounce"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Encaixe'}
            </button>
          ) : (
            <button 
              onClick={handleSave} 
              disabled={isSaving} 
              className="px-6 py-2.5 text-sm font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 shadow-lg shadow-orange-200 disabled:opacity-70 flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Agendamento'}
            </button>
          )}
        </footer>
        {selectionModal === 'client' && (<ClientSearchModal onClose={() => setSelectionModal(null)} onSelect={handleSelectClient} onNewClient={() => { setSelectionModal(null); setIsClientModalOpen(true); }} />)}
        {selectionModal === 'service' && (<SelectionModal title={formData.professional ? `Serviços de ${formData.professional.name}` : "Selecione o Serviço"} items={filteredServicesToSelect} onClose={() => setSelectionModal(null)} onSelect={(item) => handleAddService(item as LegacyService)} searchPlaceholder="Buscar Serviço..." renderItemIcon={() => <Tag size={20}/>} />)}
        {selectionModal === 'professional' && (<SelectionModal title="Selecione o Profissional" items={dbProfessionals} onClose={() => setSelectionModal(null)} onSelect={(item) => handleSelectProfessional(item as LegacyProfessional)} searchPlaceholder="Buscar Profissional..." renderItemIcon={() => <Briefcase size={20}/>} />)}
        {isClientModalOpen && (<ClientModal client={null} onClose={() => setIsClientModalOpen(false)} onSave={handlePersistAndSelectClient} />)}
      </div>
    </div>
  );
};

export default AppointmentModal;
