
import React, { useState, useEffect, useMemo } from 'react';
import { LegacyAppointment, Client, LegacyProfessional, LegacyService } from '../../types';
import { clients as initialClients, services as serviceMap, professionals } from '../../data/mockData';
import { ChevronLeft, User, Calendar, Tag, Clock, DollarSign, Info, PlusCircle, Repeat, X, Loader2, AlertCircle, Briefcase, CheckSquare, Mail, Trash2, Edit2, Save as SaveIcon } from 'lucide-react';
import { format, addMinutes } from 'date-fns';
import SelectionModal from './SelectionModal';
import ClientModal from './ClientModal';
import { supabase } from '../../services/supabaseClient';

const services = Object.values(serviceMap);

interface AppointmentModalProps {
  appointment: LegacyAppointment | Partial<LegacyAppointment> | null;
  onClose: () => void;
  onSave?: (appointment: LegacyAppointment) => void;
  onSuccess?: () => void;
}

const AppointmentModal: React.FC<AppointmentModalProps> = ({ appointment, onClose, onSave, onSuccess }) => {
  const [formData, setFormData] = useState<Partial<LegacyAppointment>>({
    status: 'agendado',
    ...appointment,
    start: appointment?.start || new Date(),
  });
  
  const [localClients, setLocalClients] = useState<Client[]>(initialClients);
  const [selectedServices, setSelectedServices] = useState<LegacyService[]>(
    appointment?.service ? [appointment.service] : []
  );

  const [manualPrice, setManualPrice] = useState<number>(0);
  const [manualDuration, setManualDuration] = useState<number>(0);
  const [selectionModal, setSelectionModal] = useState<'client' | 'service' | 'professional' | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientEmail, setClientEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
      setFormData({
          status: 'agendado',
          ...appointment,
          start: appointment?.start || new Date(),
      });
      
      const initialServices = appointment?.service ? [appointment.service] : [];
      setSelectedServices(initialServices);
      
      if (appointment?.service) {
          setManualPrice(appointment.service.price);
          setManualDuration(appointment.service.duration);
      } else {
          setManualPrice(0);
          setManualDuration(0);
      }

      setClientEmail(appointment?.client?.email || '');
      setError(null);
      setEmailError('');
  }, [appointment]);

  useEffect(() => {
    if (selectedServices.length > 0) {
        setFormData(prev => ({ ...prev, service: selectedServices[0] }));
    }
  }, [selectedServices]);

  useEffect(() => {
      if (selectedServices.length > 0) {
          const price = selectedServices.reduce((acc, s) => acc + s.price, 0);
          const duration = selectedServices.reduce((acc, s) => acc + s.duration, 0);
          setManualPrice(price);
          setManualDuration(duration);
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

  const clientItemsForSelection = useMemo(() => localClients.map(c => ({ ...c, name: c.nome })), [localClients]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
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
  };

  const validateEmail = (email: string) => {
    if (!email) return true;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSave = async () => {
    setError(null);
    setEmailError('');
    
    if (!formData.client) {
      setError('Por favor, selecione um cliente.');
      return;
    }

    if (clientEmail && !validateEmail(clientEmail)) {
        setEmailError('Formato de e-mail inválido.');
        return;
    }

    if (selectedServices.length === 0) {
      setError('Por favor, selecione pelo menos um serviço.');
      return;
    }
    if (!formData.professional) {
      setError('Por favor, selecione um profissional.');
      return;
    }
    if (!formData.start) {
      setError('Horário inválido.');
      return;
    }

    setIsSaving(true);
    
    try {
        const payload = {
            client_name: formData.client?.nome,
            resource_id: formData.professional.id,
            professional_name: formData.professional.name,
            service_name: selectedServices.map(s => s.name).join(', '),
            value: manualPrice,
            duration: manualDuration,
            date: formData.start.toISOString(),
            status: formData.status,
            notes: formData.notas,
            origem: 'interno'
        };

        let result;
        if (formData.id) {
            result = await supabase.from('appointments').update(payload).eq('id', formData.id);
        } else {
            result = await supabase.from('appointments').insert([payload]);
        }

        if (result.error) throw result.error;
        
        // ORDEM CORRIGIDA: 1. Fecha o modal primeiro | 2. Dispara o refresh depois
        onClose();
        if (onSuccess) onSuccess();
        
    } catch (err: any) {
        console.error("Error saving appointment:", err);
        setError(err.message || "Ocorreu um erro ao salvar o agendamento.");
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleSelectClient = (client: Client) => {
    setTimeout(() => {
        setFormData(prev => ({ ...prev, client }));
        setClientEmail(client.email || ''); 
        setSelectionModal(null);
        if (error) setError(null);
    }, 0);
  };

  const handleOpenNewClientModal = () => {
      setTimeout(() => {
          setSelectionModal(null);
          setIsClientModalOpen(true);
      }, 0);
  };

  const handleSaveNewClient = (newClient: Client) => {
      setLocalClients(prev => [...prev, newClient]);
      setFormData(prev => ({ ...prev, client: newClient }));
      setClientEmail(newClient.email || '');
      setIsClientModalOpen(false);
  };
  
  const handleAddService = (service: LegacyService) => {
    setTimeout(() => {
        setSelectedServices(prev => [...prev, service]);
        setSelectionModal(null);
        if (error) setError(null);
    }, 0);
  };

  const handleRemoveService = (index: number) => {
    const newServices = [...selectedServices];
    newServices.splice(index, 1);
    setSelectedServices(newServices);
  };

  const handleSelectProfessional = (professional: LegacyProfessional) => {
    setTimeout(() => {
        setFormData(prev => ({ ...prev, professional }));
        setSelectionModal(null);
        if (error) setError(null);
    }, 0);
  };
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-200" style={{height: '95vh'}} onClick={(e) => e.stopPropagation()}>
        
        <header className="p-4 border-b flex items-center gap-4 flex-shrink-0 bg-slate-50">
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800"><ChevronLeft size={24} /></button>
          <h3 className="text-lg font-bold text-slate-800">
             {formData.id ? 'Editar Agendamento' : 'Novo Agendamento'}
          </h3>
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
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${formData.client ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>
                    <User className="w-5 h-5" />
                </div>
                <div className="flex-1 border-b border-slate-200 pb-2 group-hover:border-orange-300 transition-colors">
                    <input type="text" readOnly value={formData.client?.nome || ''} placeholder="Selecione o cliente" className="w-full bg-transparent cursor-pointer focus:outline-none font-medium text-slate-800 placeholder:font-normal" />
                </div>
            </div>
          </div>

          {formData.client && (
            <div className="space-y-1 animate-in slide-in-from-top-2">
                <label className="text-xs font-bold text-slate-500 uppercase">E-mail de Contato</label>
                <div className={`flex items-center gap-3 border-b pb-2 transition-colors ${emailError ? 'border-red-300' : 'border-slate-200 focus-within:border-orange-300'}`}>
                    <Mail className={`w-4 h-4 ${emailError ? 'text-red-400' : 'text-slate-400'}`} />
                    <input 
                        type="email" 
                        value={clientEmail} 
                        onChange={(e) => {
                            setClientEmail(e.target.value);
                            if(emailError) setEmailError('');
                        }} 
                        placeholder="email@exemplo.com" 
                        className="w-full bg-transparent focus:outline-none text-sm text-slate-700" 
                    />
                </div>
                {emailError && <p className="text-xs text-red-500 font-medium">{emailError}</p>}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <input type="date" value={formData.start ? format(new Date(formData.start), 'yyyy-MM-dd') : ''} onChange={handleDateChange} className="w-full bg-transparent focus:outline-none text-sm font-medium" />
                </div>
             </div>
             <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Horário</label>
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <input type="time" value={formData.start ? format(new Date(formData.start), 'HH:mm') : ''} onChange={handleTimeChange} className="w-full bg-transparent focus:outline-none text-sm font-medium" />
                </div>
             </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Profissional <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setSelectionModal('professional')}>
                {formData.professional?.avatarUrl ? (
                     <img src={formData.professional.avatarUrl} className="w-10 h-10 rounded-full object-cover shadow-sm" alt="Profissional" />
                ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${formData.professional ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-400'}`}>
                        <Briefcase className="w-5 h-5" />
                    </div>
                )}
                <div className="flex-1 border-b border-slate-200 pb-2 group-hover:border-teal-300 transition-colors flex justify-between items-center">
                    <input 
                        type="text" 
                        readOnly 
                        value={formData.professional?.name || ''} 
                        placeholder="Selecione o profissional" 
                        className="w-full bg-transparent cursor-pointer focus:outline-none font-medium text-slate-800 placeholder:font-normal" 
                    />
                    {formData.professional && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setFormData(prev => ({...prev, professional: undefined}));
                            }} 
                            className="text-slate-300 hover:text-slate-500"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>
          </div>

          <div className="space-y-2">
             <label className="text-xs font-bold text-slate-500 uppercase">Serviços <span className="text-red-500">*</span></label>
             {selectedServices.map((service, index) => (
                <div key={index} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 group">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <Tag className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-800">{service.name}</p>
                            <p className="text-xs text-slate-500">R$ {service.price.toFixed(2)} • {service.duration} min</p>
                        </div>
                    </div>
                    <button onClick={() => handleRemoveService(index)} className="text-slate-400 hover:text-red-500 p-1">
                        <Trash2 size={16} />
                    </button>
                </div>
             ))}
             <button 
                onClick={() => setSelectionModal('service')}
                className="w-full py-2 border border-dashed border-blue-300 rounded-lg text-blue-600 text-sm font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
             >
                <PlusCircle size={16} />
                Adicionar Serviço
             </button>
          </div>

          <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 flex-1 bg-white p-2 rounded-lg border border-slate-200 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100 transition-all shadow-sm">
                  <div className="p-1.5 bg-green-50 rounded text-green-600">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col w-full">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Valor Total</span>
                      <input 
                        type="number" 
                        value={manualPrice} 
                        onChange={(e) => setManualPrice(Number(e.target.value))}
                        className="font-bold text-slate-800 bg-transparent outline-none w-full p-0 border-none focus:ring-0 text-sm"
                      />
                  </div>
                  <Edit2 className="w-3 h-3 text-slate-300" />
              </div>
               <div className="flex items-center gap-3 flex-1 bg-white p-2 rounded-lg border border-slate-200 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100 transition-all shadow-sm">
                  <div className="p-1.5 bg-blue-50 rounded text-blue-600">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col w-full">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Duração (min)</span>
                      <input 
                        type="number" 
                        value={manualDuration} 
                        onChange={(e) => setManualDuration(Number(e.target.value))}
                        className="font-bold text-slate-800 bg-transparent outline-none w-full p-0 border-none focus:ring-0 text-sm"
                      />
                  </div>
                  <Edit2 className="w-3 h-3 text-slate-300" />
              </div>
          </div>
          
          <div className="space-y-1">
             <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
             <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                 <CheckSquare className="w-5 h-5 text-slate-400" />
                 <select 
                    name="status" 
                    value={formData.status} 
                    onChange={handleChange}
                    className="w-full bg-transparent focus:outline-none text-sm font-medium text-slate-700"
                 >
                    <option value="agendado">Agendado</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="confirmado_whatsapp">Confirmado (WhatsApp)</option>
                    <option value="em_espera">Em Espera (Lista)</option>
                    <option value="chegou">Cliente Chegou</option>
                    <option value="em_atendimento">Em Atendimento</option>
                    <option value="concluido">Concluído</option>
                    <option value="faltou">Faltou</option>
                    <option value="cancelado">Cancelado</option>
                 </select>
             </div>
          </div>

          <div className="space-y-1">
              <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase">Observações</label>
                  <span className={`text-[10px] font-medium ${ (formData.notas?.length || 0) > 200 ? 'text-red-500' : 'text-slate-400'}`}>
                      {formData.notas?.length || 0}/200
                  </span>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 focus-within:ring-2 focus-within:ring-orange-100 focus-within:border-orange-300 transition-all">
                  <Info className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <textarea 
                    name="notas" 
                    placeholder="Alguma observação especial para este atendimento?" 
                    value={formData.notas || ''} 
                    onChange={handleChange}
                    maxLength={200} 
                    className="w-full bg-transparent focus:outline-none text-sm text-slate-700 resize-none"
                    rows={2}
                  />
              </div>
          </div>
        </main>
        
        <footer className="p-4 bg-white border-t space-y-3 flex-shrink-0">
            <div className="flex justify-end items-center gap-3">
                <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" disabled={isSaving}>
                    Cancelar
                </button>
                <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="px-6 py-2.5 text-sm font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 shadow-lg shadow-orange-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveIcon size={20} />}
                    Salvar Agendamento
                </button>
            </div>
        </footer>

        {selectionModal && (
          <SelectionModal
            title={
                selectionModal === 'client' ? 'Selecione o Cliente' :
                selectionModal === 'service' ? 'Selecione o Serviço' :
                'Selecione o Profissional'
            }
            items={
                selectionModal === 'client' ? clientItemsForSelection :
                selectionModal === 'service' ? services :
                professionals
            }
            onClose={() => setSelectionModal(null)}
            onSelect={
                selectionModal === 'client' ? (item) => handleSelectClient(localClients.find(c => c.id === item.id)!) :
                selectionModal === 'service' ? (item) => handleAddService(services.find(s=>s.id === item.id)!) :
                (item) => handleSelectProfessional(professionals.find(p => p.id === item.id)!)
            }
            onNew={selectionModal === 'client' ? handleOpenNewClientModal : undefined}
            searchPlaceholder={
                selectionModal === 'client' ? 'Buscar Cliente...' :
                selectionModal === 'service' ? 'Buscar Serviço...' :
                'Buscar Profissional...'
            }
            renderItemIcon={() => 
                selectionModal === 'client' ? <User size={20} /> : 
                selectionModal === 'service' ? <Tag size={20}/> :
                <Briefcase size={20} />
            }
          />
        )}

        {isClientModalOpen && (
            <ClientModal 
                client={null} 
                onClose={() => setIsClientModalOpen(false)} 
                onSave={handleSaveNewClient}
            />
        )}
      </div>
    </div>
  );
};

export default AppointmentModal;
