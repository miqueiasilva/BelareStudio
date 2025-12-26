import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, Calendar, Tag, Plus, Save, Loader2, Instagram, MapPin, Briefcase, CreditCard, Share2 } from 'lucide-react';
import { Client } from '../../types';

interface ClientModalProps {
  client?: Client | null;
  onClose: () => void;
  onSave: (client: Client) => void;
}

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
      setFormData({ ...formData, ...client });
    }
  }, [client]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) return;

    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 600));

    const savedClient: Client = {
      ...formData,
      id: client?.id || Date.now(),
    };

    onSave(savedClient);
    setIsSaving(false);
  };

  const InputField = ({ label, name, value, type = "text", placeholder, icon: Icon, required = false }: any) => (
    <div className="space-y-1">
      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{label}</label>
      <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-100 focus-within:border-orange-300 transition-all">
        {Icon && <Icon size={16} className="text-slate-300" />}
        <input 
          name={name}
          type={type}
          value={value || ''}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          className="w-full bg-transparent outline-none text-sm text-slate-700 font-medium placeholder:text-slate-300"
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        
        <header className="p-6 border-b border-slate-50 flex justify-between items-center flex-shrink-0">
          <div>
            <h3 className="text-xl font-extrabold text-slate-800">
                {client ? 'Editar Perfil' : 'Novo Cliente'}
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Preencha os dados do cliente abaixo</p>
          </div>
          <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-all">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          
          {/* CABEÇALHO: Nome e Apelido */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="Nome Completo" name="nome" value={formData.nome} placeholder="Ex: Maria das Dores" required icon={User} />
            <InputField label="Apelido" name="apelido" value={formData.apelido} placeholder="Ex: Dona Maria" icon={Smile} />
          </div>

          {/* SEÇÃO 1: CONTATO E ORIGEM */}
          <div className="space-y-6">
            <h4 className="text-orange-500 font-black text-xs uppercase tracking-[0.2em] border-b border-orange-50 pb-2">Seção 1: Contato e Origem</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InputField label="Telefone / WhatsApp" name="whatsapp" value={formData.whatsapp} placeholder="(00) 00000-0000" icon={Phone} />
                <InputField label="E-mail" name="email" value={formData.email} type="email" placeholder="email@exemplo.com" icon={Mail} />
                <InputField label="Instagram" name="instagram" value={formData.instagram} placeholder="@usuario" icon={Instagram} />
                
                <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Origem do Cliente</label>
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-100 focus-within:border-orange-300 transition-all">
                        <Share2 size={16} className="text-slate-300" />
                        <select 
                            name="origem" 
                            value={formData.origem} 
                            onChange={handleChange}
                            className="w-full bg-transparent outline-none text-sm text-slate-700 font-medium"
                        >
                            <option value="">Selecione a Origem</option>
                            <option value="instagram">Instagram</option>
                            <option value="indicacao">Indicação</option>
                            <option value="google">Google</option>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="trafego_pago">Tráfego Pago (Anúncio)</option>
                            <option value="passagem">Passagem / Vitrine</option>
                            <option value="outros">Outros</option>
                        </select>
                    </div>
                </div>
            </div>
          </div>

          {/* SEÇÃO 2: INFORMAÇÕES PESSOAIS */}
          <div className="space-y-6">
            <h4 className="text-orange-500 font-black text-xs uppercase tracking-[0.2em] border-b border-orange-50 pb-2">Seção 2: Informações Pessoais</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InputField label="Data de Nascimento" name="nascimento" type="date" value={formData.nascimento} icon={Calendar} />
                <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Sexo</label>
                    <select 
                        name="sexo" 
                        value={formData.sexo} 
                        onChange={handleChange}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 outline-none text-sm text-slate-700 font-medium focus:ring-2 focus:ring-orange-100 focus:border-orange-300 transition-all"
                    >
                        <option value="">Selecione</option>
                        <option value="feminino">Feminino</option>
                        <option value="masculino">Masculino</option>
                        <option value="outro">Outro / Prefere não dizer</option>
                    </select>
                </div>
                <InputField label="CPF" name="cpf" value={formData.cpf} placeholder="000.000.000-00" icon={CreditCard} />
                <InputField label="RG" name="rg" value={formData.rg} placeholder="00.000.000-0" />
                <InputField label="Profissão" name="profissao" value={formData.profissao} placeholder="Ex: Designer" icon={Briefcase} />
            </div>
          </div>

          {/* SEÇÃO 3: ENDEREÇO */}
          <div className="space-y-6">
            <h4 className="text-orange-500 font-black text-xs uppercase tracking-[0.2em] border-b border-orange-50 pb-2">Seção 3: Endereço</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-1">
                    <InputField label="CEP" name="cep" value={formData.cep} placeholder="00000-000" icon={MapPin} />
                </div>
                <div className="md:col-span-2">
                    <InputField label="Logradouro / Endereço" name="endereco" value={formData.endereco} placeholder="Rua, Av..." />
                </div>
                <div className="md:col-span-1">
                    <InputField label="Número" name="numero" value={formData.numero} placeholder="123" />
                </div>
                <div className="md:col-span-2">
                    <InputField label="Bairro" name="bairro" value={formData.bairro} placeholder="Seu bairro" />
                </div>
                <div className="md:col-span-2">
                    <InputField label="Cidade / UF" name="cidade" value={formData.cidade} placeholder="Cidade - UF" />
                </div>
            </div>
          </div>

        </form>

        <footer className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-2xl text-slate-500 font-bold hover:bg-slate-200 transition-all">
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSaving || !formData.nome}
            className="px-8 py-3 rounded-2xl bg-orange-500 text-white font-black shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={20} />}
            {client ? 'Salvar Alterações' : 'Finalizar Cadastro'}
          </button>
        </footer>
      </div>
    </div>
  );
};

// Helper for generic Smile icon
const Smile = ({ size, className }: any) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
);

export default ClientModal;