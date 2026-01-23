
import React, { useState, useEffect, useMemo } from 'react';
import { LegacyAppointment, Client, LegacyProfessional, LegacyService } from '../../types';
import { ChevronLeft, User, Calendar, Tag, Clock, DollarSign, Info, PlusCircle, Repeat, X, Loader2, AlertCircle, Briefcase, CheckSquare, Mail, Trash2, Edit2, AlertTriangle, Save, Scissors } from 'lucide-react';
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
  onSave: (appointment: LegacyAppointment) => void;
}

const AppointmentModal: React.FC<AppointmentModalProps> = ({ appointment, onClose, onSave }) => {
  const { activeStudioId } = useStudio();
  
  const [dbServices, setDbServices] = useState<LegacyService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [dbProfessionals, setDbProfessionals] = useState<LegacyProfessional[]>([]);
  
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

  const fetchData = async () => {
    if (!activeStudioId) return;
    setLoadingServices(true);
    try {
      const [svcsRes, profsRes] = await Promise.all([
        supabase.from('services').select('*').eq('studio_id', activeStudioId).eq('ativo', true).order('nome'),
        supabase.from('team_members').select('*').eq('studio_id', activeStudioId).eq('active', true).order('name')
      ]);

      if (svcsRes.data) {
        setDbServices(svcsRes.data.map((s: any) => ({
          id: s.id,
          name: s.nome,
          duration: s.duracao_min || 30,
          price: s.preco || 0,
          color: s.cor_hex || '#3b82f6',
          category: s.categoria
        })));
      }

      if (profsRes.data) {
        setDbProfessionals(profsRes.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          avatarUrl: p.photo_url,
          role: p.role,
          services_enabled: p.services_enabled || []
        })));
      }
    } finally {
      setLoadingServices(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeStudioId]);

  const filteredServicesToSelect = useMemo(() => {
    if (!formData.professional?.id) return [];
    const prof = dbProfessionals.find(p => String(p.id) === String(formData.professional?.id));
    const enabledIds = prof?.services_enabled || [];
    if (enabledIds.length === 0) return [];
    return dbServices.filter(s => enabledIds.includes(s.id));
  }, [dbServices, dbProfessionals, formData.professional]);

  useEffect(() => {
      if (selectedServices.length > 0) {
          setManualPrice(selectedServices.reduce((acc, s) => acc + s.price, 0));
          setManualDuration(selectedServices.reduce((acc, s) => acc + s.duration, 0));
          setFormData(prev => ({ ...prev, service: selectedServices[0] }));
      }
  }, [selectedServices]);

  const handleSave = async () => {
    if (!formData.client?.id) return setError('Selecione um cliente.');
    if (selectedServices.length === 0) return setError('Selecione ao menos um serviço.');
    if (!formData.professional?.id) return setError('Selecione um profissional.');

    setIsSaving(true);
    try {
        const compositeService: LegacyService = {
            ...selectedServices[0],
            name: selectedServices.length > 1 ? `${selectedServices[0].name} + ${selectedServices.length - 1}` : selectedServices[0].name,
            price: manualPrice,
            duration: manualDuration
        };

        const finalAppointment = {
            ...formData,
            service: compositeService,
            notas: formData.notas
        } as LegacyAppointment;

        onSave(finalAppointment);
    } finally {
        setIsSaving(false);
    }
  };

  const handleSelectProfessional = (prof: LegacyProfessional) => {
    setFormData(prev => ({ ...prev, professional: prof }));
    setSelectedServices([]); 
    setSelectionModal(null);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col relative overflow-hidden h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <header className="p-4 border-b flex items-center gap-4 bg-slate-50">
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800"><ChevronLeft size={24} /></button>
          <h3 className="text-lg font-bold text-slate-800">{formData.id ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
        </header>

        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {error && <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-lg flex items-center gap-2"><AlertTriangle size={14}/> {error}</div>}
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</label>
            <button onClick={() => setSelectionModal('client')} className="w-full flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">{formData.client?.nome?.charAt(0) || 'C'}</div>
                <span className="font-bold text-slate-700">{formData.client?.nome || 'Selecionar Cliente'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</label>
                <input type="date" value={formData.start ? format(new Date(formData.start), 'yyyy-MM-dd') : ''} onChange={e => setFormData({...formData, start: new Date(e.target.value + 'T' + format(formData.start!, 'HH:mm'))})} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 font-bold" />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horário</label>
                <input type="time" value={formData.start ? format(new Date(formData.start), 'HH:mm') : ''} onChange={e => { const [h,m] = e.target.value.split(':'); const d = new Date(formData.start!); d.setHours(Number(h), Number(m)); setFormData({...formData, start: d}); }} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 font-bold" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profissional</label>
            <button onClick={() => setSelectionModal('professional')} className="w-full flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center"><Briefcase size={20}/></div>
                <span className="font-bold text-slate-700">{formData.professional?.name || 'Selecionar Profissional'}</span>
            </button>
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Serviços Habilitados</label>
             {selectedServices.map((s, i) => (
                <div key={i} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100"><span className="text-sm font-bold text-slate-700">{s.name}</span><button onClick={() => setSelectedServices(prev => prev.filter((_, idx) => idx !== i))} className="text-rose-500"><X size={16}/></button></div>
             ))}
             <button disabled={!formData.professional?.id} onClick={() => setSelectionModal('service')} className="w-full p-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:border-orange-200 hover:text-orange-500 transition-all flex items-center justify-center gap-2">
                <PlusCircle size={20}/> {formData.professional?.id ? 'Adicionar Serviço' : 'Escolha o profissional primeiro'}
             </button>
             {formData.professional?.id && filteredServicesToSelect.length === 0 && !loadingServices && (
                <p className="text-[10px] text-rose-500 font-bold uppercase text-center mt-2">Nenhum serviço habilitado para este membro.</p>
             )}
          </div>
        </main>

        <footer className="p-6 border-t bg-white flex flex-col gap-4">
            <div className="flex justify-between items-center px-2">
                <span className="text-xs font-black text-slate-400 uppercase">Total Estimado</span>
                <span className="text-xl font-black text-slate-800">R$ {manualPrice.toFixed(2)}</span>
            </div>
            <button onClick={handleSave} disabled={isSaving} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black shadow-xl shadow-orange-100 flex items-center justify-center gap-2 disabled:opacity-50">
                {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Salvar Agendamento
            </button>
        </footer>

        {selectionModal === 'client' && <ClientSearchModal onClose={() => setSelectionModal(null)} onSelect={c => { setFormData({...formData, client: c}); setSelectionModal(null); }} onNewClient={() => { setSelectionModal(null); setIsClientModalOpen(true); }} />}
        {selectionModal === 'professional' && <SelectionModal title="Profissional" items={dbProfessionals} onClose={() => setSelectionModal(null)} onSelect={handleSelectProfessional} searchPlaceholder="Buscar..." renderItemIcon={() => <User size={20}/>} />}
        {selectionModal === 'service' && <SelectionModal title="Serviços Habilitados" items={filteredServicesToSelect} onClose={() => setSelectionModal(null)} onSelect={s => { setSelectedServices(prev => [...prev, s as any]); setSelectionModal(null); }} searchPlaceholder="Buscar..." renderItemIcon={() => <Scissors size={20}/>} />}
        {isClientModalOpen && <ClientModal onClose={() => setIsClientModalOpen(false)} onSave={async (c) => { setFormData({...formData, client: c}); setIsClientModalOpen(false); }} />}
      </div>
    </div>
  );
};

export default AppointmentModal;
