
import React, { useState, useEffect, useMemo } from 'react';
import { LegacyAppointment, Client, LegacyProfessional, LegacyService } from '../../types';
import { professionals } from '../../data/mockData';
import { ChevronLeft, User, Calendar, Tag, Clock, DollarSign, Info, PlusCircle, Repeat, X, Loader2, AlertCircle, Briefcase, CheckSquare, Mail, Trash2, Edit2 } from 'lucide-react';
import { format, addMinutes } from 'date-fns';
import SelectionModal from './SelectionModal';
import ClientSearchModal from './ClientSearchModal'; // Importado Novo Modal
import ClientModal from './ClientModal';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

interface AppointmentModalProps {
  appointment: LegacyAppointment | Partial<LegacyAppointment> | null;
  onClose: () => void;
  onSave: (appointment: LegacyAppointment) => void;
}

const AppointmentModal: React.FC<AppointmentModalProps> = ({ appointment, onClose, onSave }) => {
  const { user } = useAuth();
  
  const [dbServices, setDbServices] = useState<LegacyService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  const [formData, setFormData] = useState<Partial<LegacyAppointment>>({
    status: 'agendado',
    ...appointment,
    start: appointment?.start || new Date(),
  });
  
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

  const fetchServices = async () => {
    setLoadingServices(true);
    try {
      const { data, error: sbError } = await supabase
        .from('services')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (sbError) throw sbError;

      if (data) {
        const mapped: LegacyService[] = data.map((s: any) => ({
          id: s.id,
          name: s.nome || 'Serviço sem nome',
          duration: s.duracao_min || 30,
          price: s.preco || 0,
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

  useEffect(() => {
    fetchServices();
  }, []);

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

  const handleSave = async () => {
    setError(null);
    setEmailError('');
    
    if (!formData.client) {
      setError('Por favor, selecione um cliente.');
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

    setIsSaving(true);
    
    try {
        const compositeService: LegacyService = {
            ...selectedServices[0],
            name: selectedServices.length > 1 
                ? `${selectedServices[0].name} + ${selectedServices.length - 1}` 
                : selectedServices[0].name,
            price: manualPrice,
            duration: manualDuration
        };

        const finalAppointment = {
            ...formData,
            client: { ...formData.client, email: clientEmail },
            service: compositeService,
            notas: selectedServices.length > 1 
                ? `${formData.notas || ''} \n[Serviços: ${selectedServices.map(s => s.name).join(', ')}]`
                : formData.notas
        } as LegacyAppointment;

        onSave(finalAppointment);
        
    } catch (err) {
        console.error("Error saving appointment:", err);
        setError("Ocorreu um erro ao salvar o agendamento.");
        setIsSaving(false);
    }
  };
  
  const handleSelectClient = (client: Client) => {
    setFormData(prev => ({ ...prev, client }));
    setClientEmail(client.email || ''); 
    setSelectionModal(null);
  };

  const handleAddService = (service: LegacyService) => {
    setSelectedServices(prev => [...prev, service]);
    setSelectionModal(null);
  };

  const handleRemoveService = (index: number) => {
    const newServices = [...selectedServices];
    newServices.splice(index, 1);
    setSelectedServices(newServices);
  };

  const handleSelectProfessional = (professional: LegacyProfessional) => {
    setFormData(prev => ({ ...prev, professional }));
    setSelectionModal(null);
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

          {/* Client Selection */}
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

          {/* Professional Selection */}
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
                </div>
            </div>
          </div>

          {/* Service Selection */}
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
                disabled={loadingServices}
                className="w-full py-2 border border-dashed border-blue-300 rounded-lg text-blue-600 text-sm font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
             >
                {loadingServices ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle size={16} />}
                {loadingServices ? 'Carregando...' : 'Adicionar Serviço'}
             </button>
          </div>

          <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 flex-1 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                  <div className="p-1.5 bg-green-50 rounded text-green-600"><DollarSign className="w-4 h-4" /></div>
                  <div className="flex flex-col w-full">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Valor Total</span>
                      <input type="number" value={manualPrice} onChange={(e) => setManualPrice(Number(e.target.value))} className="font-bold text-slate-800 bg-transparent outline-none w-full p-0 border-none focus:ring-0 text-sm" />
                  </div>
              </div>
               <div className="flex items-center gap-3 flex-1 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                  <div className="p-1.5 bg-blue-50 rounded text-blue-600"><Clock className="w-4 h-4" /></div>
                  <div className="flex flex-col w-full">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Duração (min)</span>
                      <input type="number" value={manualDuration} onChange={(e) => setManualDuration(Number(e.target.value))} className="font-bold text-slate-800 bg-transparent outline-none w-full p-0 border-none focus:ring-0 text-sm" />
                  </div>
              </div>
          </div>
          
          <div className="space-y-1">
             <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
             <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                 <CheckSquare className="w-5 h-5 text-slate-400" />
                 <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-transparent focus:outline-none text-sm font-medium text-slate-700">
                    <option value="agendado">Agendado</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="chegou">Cliente Chegou</option>
                    <option value="em_atendimento">Em Atendimento</option>
                    <option value="concluido">Concluído</option>
                    <option value="faltou">Faltou</option>
                    <option value="cancelado">Cancelado</option>
                 </select>
             </div>
          </div>

          <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Observações</label>
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <textarea name="notas" placeholder="Observações..." value={formData.notas || ''} onChange={handleChange} className="w-full bg-transparent focus:outline-none text-sm text-slate-700 resize-none" rows={2} />
              </div>
          </div>
        </main>
        
        <footer className="p-4 bg-white border-t flex justify-end items-center gap-3 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" disabled={isSaving}>Cancelar</button>
            <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 text-sm font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 shadow-lg shadow-orange-200 disabled:opacity-70 flex items-center gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Agendamento'}
            </button>
        </footer>

        {/* MODAIS DE SELEÇÃO */}
        {selectionModal === 'client' && (
          <ClientSearchModal 
            onClose={() => setSelectionModal(null)} 
            onSelect={handleSelectClient}
            onNewClient={() => { setSelectionModal(null); setIsClientModalOpen(true); }}
          />
        )}

        {selectionModal === 'service' && (
          <SelectionModal
            title="Selecione o Serviço"
            items={dbServices}
            onClose={() => setSelectionModal(null)}
            onSelect={(item) => handleAddService(dbServices.find(s=>s.id === item.id)!)}
            searchPlaceholder="Buscar Serviço..."
            renderItemIcon={() => <Tag size={20}/>}
          />
        )}

        {selectionModal === 'professional' && (
          <SelectionModal
            title="Selecione o Profissional"
            items={professionals}
            onClose={() => setSelectionModal(null)}
            onSelect={(item) => handleSelectProfessional(professionals.find(p => p.id === item.id)!)}
            searchPlaceholder="Buscar Profissional..."
            renderItemIcon={() => <Briefcase size={20}/>}
          />
        )}

        {isClientModalOpen && (
            <ClientModal client={null} onClose={() => setIsClientModalOpen(false)} onSave={async (c) => handleSelectClient(c)} />
        )}
      </div>
    </div>
  );
};

export default AppointmentModal;
