import React, { useState, useEffect } from 'react';
import { 
    X, User, Phone, Mail, Calendar, Edit2, Save, 
    ArrowLeft, Globe, ShoppingBag, History, MoreVertical,
    Plus, CheckCircle, MapPin, Tag, Smartphone, MessageCircle
} from 'lucide-react';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import { Client } from '../../types';

interface ClientProfileProps {
    client: Client;
    onClose: () => void;
    onSave: (client: any) => Promise<void>;
}

const ReadField = ({ label, value, icon: Icon }: any) => (
    <div className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0 group">
        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
            <Icon size={18} />
        </div>
        <div className="flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
            <p className="text-sm font-semibold text-slate-700">{value || 'Não informado'}</p>
        </div>
    </div>
);

const ClientProfile: React.FC<ClientProfileProps> = ({ client, onClose, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<'geral' | 'consumo' | 'atividades'>('geral');
    
    // Estado do formulário
    const [formData, setFormData] = useState<any>({
        ...client,
        online_booking_enabled: (client as any).online_booking_enabled ?? true,
        origem: (client as any).origem || 'Instagram'
    });

    const handleSave = async () => {
        await onSave(formData);
        setIsEditing(false);
    };

    return (
        <div className="fixed inset-0 bg-slate-100 z-[100] flex flex-col font-sans animate-in slide-in-from-right duration-300">
            {/* 1. HEADER ESTATÍSTICO (DESIGN CLEAN) */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-6 shadow-sm z-10">
                <div className="flex items-center justify-between">
                    <button onClick={onClose} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="flex gap-2">
                        {!isEditing ? (
                            <button onClick={() => setIsEditing(true)} className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-orange-50 hover:text-orange-600 transition-all border border-slate-100">
                                <Edit2 size={20} />
                            </button>
                        ) : (
                            <button onClick={handleSave} className="px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-green-100 transition-all active:scale-95">
                                <Save size={18} /> Salvar
                            </button>
                        )}
                        <button className="p-2.5 text-slate-400 hover:bg-slate-50 rounded-xl"><MoreVertical size={20}/></button>
                    </div>
                </div>

                <div className="flex items-center gap-5">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-[24px] bg-orange-100 flex items-center justify-center text-orange-600 text-2xl font-black border-4 border-white shadow-xl">
                            {client.nome.charAt(0)}
                        </div>
                        {formData.online_booking_enabled && (
                            <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-1 rounded-full border-2 border-white shadow-sm" title="Agendamento Online Habilitado">
                                <Globe size={12} />
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-black text-slate-800 leading-tight">{client.nome}</h2>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200">
                                {formData.origem}
                            </span>
                            <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
                                <History size={12}/> Desde 2023
                            </span>
                        </div>
                    </div>
                </div>

                {/* KPIs de Consumo */}
                <div className="grid grid-cols-3 gap-2 py-2">
                    <div className="text-center p-3 bg-slate-50/50 rounded-2xl border border-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Atendimentos</p>
                        <p className="text-lg font-black text-slate-700">12</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50/50 rounded-2xl border border-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Ticket Médio</p>
                        <p className="text-lg font-black text-slate-700">R$ 85</p>
                    </div>
                    <div className="text-center p-3 bg-rose-50 rounded-2xl border border-rose-100">
                        <p className="text-[10px] font-bold text-rose-400 uppercase tracking-tighter">Saldo</p>
                        <p className="text-lg font-black text-rose-600">R$ 0</p>
                    </div>
                </div>
            </header>

            {/* 2. NAVEGAÇÃO POR ABAS */}
            <nav className="bg-white border-b border-slate-200 flex px-6 flex-shrink-0 overflow-x-auto scrollbar-hide">
                <button 
                    onClick={() => setActiveTab('geral')}
                    className={`py-4 px-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === 'geral' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400'}`}
                >
                    Geral
                </button>
                <button 
                    onClick={() => setActiveTab('consumo')}
                    className={`py-4 px-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === 'consumo' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400'}`}
                >
                    Serviços
                </button>
                <button 
                    onClick={() => setActiveTab('atividades')}
                    className={`py-4 px-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === 'atividades' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400'}`}
                >
                    Log de Atividade
                </button>
            </nav>

            {/* 3. CONTEÚDO (TRANSICAO READ/EDIT) */}
            <main className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                <div className="max-w-2xl mx-auto">
                    {activeTab === 'geral' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            <Card title="Dados de Contato" className="shadow-sm">
                                {!isEditing ? (
                                    <div className="divide-y divide-slate-50">
                                        <ReadField label="Telefone" value={formData.whatsapp} icon={Smartphone} />
                                        <ReadField label="E-mail" value={formData.email} icon={Mail} />
                                        <ReadField label="Localização" value={`${formData.endereco || ''} ${formData.numero || ''}`} icon={MapPin} />
                                    </div>
                                ) : (
                                    <div className="space-y-4 py-2">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">WhatsApp</label>
                                            <input value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-100" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">E-mail</label>
                                            <input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-100" />
                                        </div>
                                    </div>
                                )}
                            </Card>

                            <Card title="Configurações e Origem" className="shadow-sm">
                                <div className="space-y-6 py-2">
                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Globe size={20}/></div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">Agendamento Online</p>
                                                <p className="text-[10px] text-slate-500 uppercase font-bold">Permitir via link público</p>
                                            </div>
                                        </div>
                                        <ToggleSwitch 
                                            on={formData.online_booking_enabled} 
                                            onClick={() => setFormData({...formData, online_booking_enabled: !formData.online_booking_enabled})} 
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Como Conheceu? (Origem)</label>
                                        <select 
                                            disabled={!isEditing}
                                            value={formData.origem}
                                            onChange={e => setFormData({...formData, origem: e.target.value})}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-100 disabled:bg-slate-50 disabled:text-slate-400 transition-all appearance-none"
                                        >
                                            <option>Instagram</option>
                                            <option>Indicação</option>
                                            <option>Google / Maps</option>
                                            <option>Facebook</option>
                                            <option>Passagem</option>
                                        </select>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'consumo' && (
                         <div className="text-center py-20 text-slate-400">
                            <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="font-bold">Histórico de Serviços em breve</p>
                         </div>
                    )}
                </div>
            </main>

            {/* BOTÃO FLUTUANTE (ADD SERVIÇO) */}
            <div className="fixed bottom-6 right-6">
                <button className="w-16 h-16 bg-orange-500 text-white rounded-3xl shadow-2xl flex items-center justify-center hover:scale-110 transition-all active:scale-95">
                    <Plus size={32} />
                </button>
            </div>
        </div>
    );
};

export default ClientProfile;