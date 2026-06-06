
import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, Calendar, Tag, Plus, Save, Loader2, Instagram, MapPin, Briefcase, CreditCard, Share2, Home, ShieldAlert, Users } from 'lucide-react';
import { Client } from '../../types';
import toast from 'react-hot-toast';
import { useStudio } from '../../contexts/StudioContext';
import { supabase } from '../../services/supabaseClient';

interface ClientModalProps {
  client?: Client | null;
  onClose: () => void;
  onSave: (client: Client) => Promise<void>;
}

const InputField = ({ label, name, value, type = "text", placeholder, icon: Icon, required = false, onChange }: any) => (
  <div className="space-y-1">
    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{label}</label>
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-100 focus-within:border-orange-300 transition-all">
      {Icon && <Icon size={16} className="text-slate-300" />}
      <input 
        name={name}
        type={type}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full bg-transparent outline-none text-sm text-slate-700 font-medium placeholder:text-slate-300"
      />
    </div>
  </div>
);

const SmileIcon = ({ size, className }: any) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
);

const ClientModal: React.FC<ClientModalProps> = ({ client, onClose, onSave }) => {
  const { activeStudioId } = useStudio();
  const [duplicateCandidate, setDuplicateCandidate] = useState<Client | null>(null);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  const [formData, setFormData] = useState<any>({
    nome: '',
    apelido: '',
    whatsapp: '',
    email: '',
    instagram: '',
    origem: '',
    nascimento: '',
    sexo: '',
    cpf: '',
    rg: '',
    profissao: '',
    cep: '',
    endereco: '',
    numero: '',
    bairro: '',
    cidade: '',
    tags: [],
    consent: true
  });
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (client) {
      setFormData({ 
        ...formData, 
        ...client,
        cep: client.cep || '',
        endereco: client.endereco || '',
        numero: client.numero || '',
        bairro: client.bairro || '',
        cidade: client.cidade || ''
      });
    }
  }, [client]);

  useEffect(() => {
    const cep = formData.cep.replace(/\D/g, '');
    if (cep.length === 8) {
      fetch(`https://viacep.com.br/ws/${cep}/json/`)
        .then(res => res.json())
        .then(data => {
          if (!data.erro) {
            setFormData((prev: any) => ({
              ...prev,
              endereco: data.logradouro || prev.endereco,
              bairro: data.bairro || prev.bairro,
              cidade: data.localidade || prev.cidade
            }));
          }
        })
        .catch(err => console.error("Erro ao buscar CEP:", err));
    }
  }, [formData.cep]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleManualSave = async () => {
    if (!formData.nome) {
        toast.error("Por favor, preencha o nome do cliente.");
        return;
    }

    // Checking for duplicates (skip if checking an edit)
    if (!client?.id && activeStudioId) {
        setIsSaving(true);
        try {
            const cleanPhone = formData.whatsapp ? String(formData.whatsapp).replace(/\D/g, '') : '';
            
            // 1. Check exact name match
            const { data: nameMatches } = await supabase
                .from('clients')
                .select('*')
                .eq('studio_id', activeStudioId)
                .ilike('nome', formData.nome.trim());

            if (nameMatches && nameMatches.length > 0) {
                setDuplicateCandidate(nameMatches[0]);
                setShowDuplicateWarning(true);
                setIsSaving(false);
                return;
            }

            // 2. Check smart phone match
            if (cleanPhone.length >= 8) {
                const { data: clients } = await supabase
                    .from('clients')
                    .select('*')
                    .eq('studio_id', activeStudioId);
                
                if (clients) {
                    const formatForCompare = (p: string) => {
                        let c = p.replace(/\D/g, '');
                        if (c.startsWith('55')) c = c.slice(2);
                        if (c.startsWith('0')) c = c.slice(1);
                        return c;
                    };
                    const targetClean = formatForCompare(cleanPhone);
                    const found = clients.find(c => {
                        const ph = c.whatsapp || c.telefone;
                        if (!ph) return false;
                        return formatForCompare(ph) === targetClean;
                    });
                    
                    if (found) {
                        setDuplicateCandidate(found);
                        setShowDuplicateWarning(true);
                        setIsSaving(false);
                        return;
                    }
                }
            }
        } catch (err) {
            console.error("Erro ao verificar duplicatas:", err);
        } finally {
            setIsSaving(false);
        }
    }

    setIsSaving(true);
    try {
        const sanitizedWhatsapp = formData.whatsapp ? String(formData.whatsapp).replace(/\D/g, '') : null;
        
        // Converte strings vazias em null para evitar erros no Postgres (principalmente em datas)
        const cleanedData = Object.entries(formData).reduce((acc: any, [key, value]) => {
            acc[key] = (value === '' || value === undefined) ? null : value;
            return acc;
        }, {});

        const savedClient: Client = {
            ...cleanedData,
            whatsapp: sanitizedWhatsapp,
            telefone: sanitizedWhatsapp,
            id: client?.id || undefined,
        };
        await onSave(savedClient);
    } catch (err) {
        console.error("Erro crítico no salvamento:", err);
        toast.error("Ocorreu um erro ao salvar os dados.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleConfirmMerge = async () => {
    if (!duplicateCandidate) return;
    setShowDuplicateWarning(false);
    setIsSaving(true);
    try {
        const sanitizedWhatsapp = formData.whatsapp ? String(formData.whatsapp).replace(/\D/g, '') : null;
        
        // Combine current input into the existing duplicate record, keeping the old database id
        const mergedData = { ...duplicateCandidate };
        Object.entries(formData).forEach(([key, val]) => {
            if (val !== '' && val !== null && val !== undefined) {
                mergedData[key] = val;
            }
        });

        const savedClient: Client = {
            ...mergedData,
            whatsapp: sanitizedWhatsapp || duplicateCandidate.whatsapp,
            telefone: sanitizedWhatsapp || duplicateCandidate.telefone,
            id: duplicateCandidate.id,
        };

        // This will update the existing record under duplicateCandidate.id
        await onSave(savedClient);
    } catch (err) {
        console.error("Erro de persistência na unificação:", err);
        toast.error("Não foi possível mesclar estes dados.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleSaveAnyway = async () => {
    setShowDuplicateWarning(false);
    setIsSaving(true);
    try {
        const sanitizedWhatsapp = formData.whatsapp ? String(formData.whatsapp).replace(/\D/g, '') : null;
        const cleanedData = Object.entries(formData).reduce((acc: any, [key, value]) => {
            acc[key] = (value === '' || value === undefined) ? null : value;
            return acc;
        }, {});

        const savedClient: Client = {
            ...cleanedData,
            whatsapp: sanitizedWhatsapp,
            telefone: sanitizedWhatsapp,
            id: client?.id || undefined,
        };
        
        await onSave(savedClient);
    } catch (err) {
        console.error("Erro salvando duplicado:", err);
        toast.error("Erro ao salvar cadastro.");
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        
        <header className="p-6 border-b border-slate-50 flex justify-between items-center flex-shrink-0">
          <div>
            <h3 className="text-xl font-extrabold text-slate-800">
                {client?.id ? 'Editar Perfil' : 'Novo Cliente'}
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Preencha os dados do cliente abaixo</p>
          </div>
          <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-all">
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="Nome Completo" name="nome" value={formData.nome} onChange={handleChange} placeholder="Ex: Maria das Dores" required icon={User} />
            <InputField label="Apelido" name="apelido" value={formData.apelido} onChange={handleChange} placeholder="Ex: Dona Maria" icon={SmileIcon} />
          </div>

          <div className="space-y-6">
            <h4 className="text-orange-500 font-black text-xs uppercase tracking-[0.2em] border-b border-orange-50 pb-2">Seção 1: Contato e Origem</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InputField label="Telefone / WhatsApp" name="whatsapp" value={formData.whatsapp} onChange={handleChange} placeholder="(00) 00000-0000" icon={Phone} />
                <InputField label="E-mail" name="email" value={formData.email} onChange={handleChange} type="email" placeholder="email@exemplo.com" icon={Mail} />
                <InputField label="Instagram" name="instagram" value={formData.instagram} onChange={handleChange} placeholder="@usuario" icon={Instagram} />
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-orange-500 font-black text-xs uppercase tracking-[0.2em] border-b border-orange-50 pb-2">Seção 2: Informações Pessoais</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InputField label="Data de Nascimento" name="nascimento" type="date" value={formData.nascimento} onChange={handleChange} icon={Calendar} />
                <InputField label="CPF" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="000.000.000-00" icon={CreditCard} />
                <InputField label="Profissão" name="profissao" value={formData.profissao} onChange={handleChange} placeholder="Ex: Designer" icon={Briefcase} />
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-orange-500 font-black text-xs uppercase tracking-[0.2em] border-b border-orange-50 pb-2">Seção 3: Localização</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InputField label="CEP" name="cep" value={formData.cep} onChange={handleChange} placeholder="00000-000" icon={MapPin} />
                <div className="md:col-span-2">
                    <InputField label="Logradouro" name="endereco" value={formData.endereco} onChange={handleChange} placeholder="Rua, Avenida, etc." icon={Home} />
                </div>
                <InputField label="Número" name="numero" value={formData.numero} onChange={handleChange} placeholder="123" />
                <InputField label="Bairro" name="bairro" value={formData.bairro} onChange={handleChange} placeholder="Bairro" />
                <InputField label="Cidade" name="cidade" value={formData.cidade} onChange={handleChange} placeholder="Cidade" />
            </div>
          </div>
        </div>

        <footer className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-2xl text-slate-500 font-bold hover:bg-slate-200 transition-all">
            Cancelar
          </button>
          <button 
            type="button"
            onClick={handleManualSave}
            disabled={isSaving || !formData.nome}
            className="px-8 py-3 rounded-2xl bg-orange-500 text-white font-black shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={20} />}
            {client?.id ? 'Salvar Alterações' : 'Finalizar Cadastro'}
          </button>
        </footer>
      </div>

      {showDuplicateWarning && duplicateCandidate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] p-6 shadow-2xl max-w-md w-full border border-orange-100 text-left animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-orange-600 mb-4">
              <div className="p-3 bg-orange-50 rounded-2xl flex-shrink-0">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-base">Cadastro Duplicado!</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Nome ou Telefone já existente</p>
              </div>
            </div>
            
            <p className="text-slate-600 text-xs font-semibold leading-relaxed mb-4">
              Encontramos um cliente já registrado no sistema com dados correspondentes:
            </p>
            
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 text-orange-600 font-black rounded-xl flex items-center justify-center text-sm flex-shrink-0">
                  {duplicateCandidate.nome[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-700">{duplicateCandidate.nome}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Contato: {duplicateCandidate.whatsapp || duplicateCandidate.telefone || 'Não preenchido'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <button 
                onClick={handleConfirmMerge}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Users size={16} /> Unificar com existente
              </button>
              <button 
                onClick={handleSaveAnyway}
                className="w-full py-3 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-bold rounded-2xl transition-all"
              >
                Salvar separado (Duplicar)
              </button>
              <button 
                onClick={() => setShowDuplicateWarning(false)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold rounded-2xl transition-all"
              >
                Voltar e Corrigir dados
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientModal;
