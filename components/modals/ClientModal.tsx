
import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, Calendar, Tag, Plus, Save, Loader2, Instagram, MapPin, Briefcase, CreditCard, Share2, Home } from 'lucide-react';
import { Client } from '../../types';

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleManualSave = async () => {
    if (!formData.nome) {
        alert("Por favor, preencha o nome do cliente.");
        return;
    }

    setIsSaving(true);
    try {
        const savedClient: Client = {
            ...formData,
            id: client?.id || undefined,
        };
        await onSave(savedClient);
        // O fechamento ocorre no callback onSave do pai se bem sucedido
    } catch (err) {
        console.error("Erro crítico no salvamento:", err);
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
    </div>
  );
};

export default ClientModal;
