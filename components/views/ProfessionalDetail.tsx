
import React, { useState } from 'react';
import { 
    ChevronLeft, Mail, Phone, MapPin, Calendar, Clock, DollarSign, 
    CheckCircle, List, User, Save, Upload, Plus, Trash2, Globe
} from 'lucide-react';
import { LegacyProfessional, LegacyService } from '../../types';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';

interface ProfessionalDetailProps {
    professional: LegacyProfessional;
    services: LegacyService[];
    onBack: () => void;
    onSave: (prof: LegacyProfessional) => void;
}

const ProfessionalDetail: React.FC<ProfessionalDetailProps> = ({ professional: initialProf, services, onBack, onSave }) => {
    // Merge initial data with defaults if missing
    const [prof, setProf] = useState<LegacyProfessional>({
        ...initialProf,
        email: initialProf.email || '',
        phone: initialProf.phone || '',
        role: initialProf.role || 'Especialista',
        bio: initialProf.bio || '',
        active: initialProf.active ?? true,
        onlineBooking: initialProf.onlineBooking ?? true,
        commissionRate: initialProf.commissionRate || 50,
        pixKey: initialProf.pixKey || '',
        services: initialProf.services || services.map(s => s.id), // Enable all by default for demo
        schedule: initialProf.schedule || ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map(d => ({
            day: d, start: '09:00', end: '18:00', active: true
        }))
    });

    const [activeTab, setActiveTab] = useState<'perfil' | 'servicos' | 'horarios' | 'comissoes'>('perfil');

    const handleSave = () => {
        onSave(prof);
    };

    const toggleService = (serviceId: number) => {
        setProf(prev => {
            const currentServices = prev.services || [];
            if (currentServices.includes(serviceId)) {
                return { ...prev, services: currentServices.filter(id => id !== serviceId) };
            } else {
                return { ...prev, services: [...currentServices, serviceId] };
            }
        });
    };

    const updateSchedule = (index: number, field: string, value: any) => {
        setProf(prev => {
            const newSchedule = [...(prev.schedule || [])];
            newSchedule[index] = { ...newSchedule[index], [field]: value };
            return { ...prev, schedule: newSchedule };
        });
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* Header / Top Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                        <ChevronLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold text-slate-800">Colaborador</h2>
                </div>
                <button 
                    onClick={handleSave}
                    className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-200 transition-all active:scale-95 flex items-center gap-2"
                >
                    <Save size={18} /> Salvar
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto p-6 space-y-6">
                    
                    {/* Profile Header Card */}
                    <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-slate-100 to-slate-50 z-0"></div>
                        
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-32 h-32 rounded-full border-4 border-white shadow-md overflow-hidden bg-slate-200 group cursor-pointer relative">
                                <img src={prof.avatarUrl} alt={prof.name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Upload className="text-white w-8 h-8" />
                                </div>
                            </div>
                        </div>

                        <div className="relative z-10 flex-1 text-center md:text-left pt-2">
                            <h1 className="text-3xl font-bold text-slate-800">{prof.name}</h1>
                            <p className="text-slate-500 font-medium">{prof.email || 'Sem e-mail cadastrado'}</p>
                            
                            <div className="flex items-center justify-center md:justify-start gap-2 mt-3 text-sm">
                                {prof.onlineBooking ? (
                                    <span className="flex items-center gap-1 text-orange-600 bg-orange-50 px-3 py-1 rounded-full font-bold border border-orange-100">
                                        <Globe size={14} /> Agendamento Online Habilitado
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-medium">
                                        Agendamento Online Desativado
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="border-b border-slate-200">
                        <nav className="-mb-px flex gap-8 overflow-x-auto scrollbar-hide">
                            {[
                                { id: 'perfil', label: 'PERFIL' },
                                { id: 'servicos', label: 'SERVIÇOS' }, // AKA Configurações in screenshot
                                { id: 'horarios', label: 'HORÁRIOS' }, // AKA Atividades context but fits better
                                { id: 'comissoes', label: 'COMISSÕES' }, // AKA Salários
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`pb-4 text-sm font-bold tracking-wide transition-colors whitespace-nowrap ${
                                        activeTab === tab.id
                                            ? 'border-b-2 border-orange-500 text-orange-600'
                                            : 'border-transparent text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Tab Content */}
                    
                    {/* --- PERFIL --- */}
                    {activeTab === 'perfil' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-2">
                            <Card title="Informações Pessoais">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                                        <input 
                                            value={prof.name} 
                                            onChange={e => setProf({...prof, name: e.target.value})}
                                            className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition-all" 
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cargo / Função</label>
                                            <input 
                                                value={prof.role} 
                                                onChange={e => setProf({...prof, role: e.target.value})}
                                                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition-all" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label>
                                            <input 
                                                value={prof.phone} 
                                                onChange={e => setProf({...prof, phone: e.target.value})}
                                                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition-all" 
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail</label>
                                        <input 
                                            value={prof.email} 
                                            onChange={e => setProf({...prof, email: e.target.value})}
                                            className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition-all" 
                                        />
                                    </div>
                                </div>
                            </Card>

                            <div className="space-y-6">
                                <Card title="Dados Bancários (Pix)">
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4">
                                        <p className="text-sm text-slate-600 mb-2">Chave Pix para pagamento de comissões:</p>
                                        <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2">
                                            <div className="p-1 bg-green-100 rounded text-green-600"><DollarSign size={16}/></div>
                                            <input 
                                                value={prof.pixKey} 
                                                onChange={e => setProf({...prof, pixKey: e.target.value})}
                                                placeholder="CPF, E-mail ou Aleatória"
                                                className="flex-1 outline-none text-slate-800 font-medium" 
                                            />
                                        </div>
                                    </div>
                                </Card>

                                <Card title="Configurações de Acesso">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-slate-800">Status do Colaborador</p>
                                                <p className="text-xs text-slate-500">Se desativado, não aparecerá na agenda.</p>
                                            </div>
                                            <ToggleSwitch on={prof.active || false} onClick={() => setProf({...prof, active: !prof.active})} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-slate-800">Agendamento Online</p>
                                                <p className="text-xs text-slate-500">Permitir que clientes agendem pelo link.</p>
                                            </div>
                                            <ToggleSwitch on={prof.onlineBooking || false} onClick={() => setProf({...prof, onlineBooking: !prof.onlineBooking})} />
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* --- SERVIÇOS --- */}
                    {activeTab === 'servicos' && (
                        <div className="animate-in slide-in-from-bottom-2">
                            <Card title="Serviços Habilitados" icon={<List size={20}/>}>
                                <p className="text-sm text-slate-500 mb-6">Selecione quais serviços {prof.name.split(' ')[0]} pode realizar.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {services.map(service => {
                                        const isSelected = (prof.services || []).includes(service.id);
                                        return (
                                            <div 
                                                key={service.id} 
                                                onClick={() => toggleService(service.id)}
                                                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between group ${
                                                    isSelected 
                                                    ? 'border-orange-500 bg-orange-50' 
                                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${isSelected ? 'bg-orange-500 border-orange-500' : 'border-slate-300 bg-white'}`}>
                                                        {isSelected && <CheckCircle size={14} className="text-white" />}
                                                    </div>
                                                    <div>
                                                        <p className={`font-bold text-sm ${isSelected ? 'text-orange-900' : 'text-slate-700'}`}>{service.name}</p>
                                                        <p className="text-xs text-slate-500">{service.duration} min • R$ {service.price.toFixed(2)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* --- HORÁRIOS --- */}
                    {activeTab === 'horarios' && (
                        <div className="animate-in slide-in-from-bottom-2">
                            <Card title="Horários de Trabalho" icon={<Clock size={20}/>}>
                                <div className="space-y-4">
                                    {(prof.schedule || []).map((slot, index) => (
                                        <div key={index} className={`flex items-center justify-between p-3 rounded-xl border ${slot.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                            <div className="flex items-center gap-4 w-32">
                                                <ToggleSwitch on={slot.active} onClick={() => updateSchedule(index, 'active', !slot.active)} />
                                                <span className="font-bold text-slate-700 text-sm">{slot.day}</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 flex-1 justify-center">
                                                <input 
                                                    type="time" 
                                                    value={slot.start} 
                                                    disabled={!slot.active}
                                                    onChange={(e) => updateSchedule(index, 'start', e.target.value)}
                                                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none bg-white"
                                                />
                                                <span className="text-slate-400 text-xs">até</span>
                                                <input 
                                                    type="time" 
                                                    value={slot.end} 
                                                    disabled={!slot.active}
                                                    onChange={(e) => updateSchedule(index, 'end', e.target.value)}
                                                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none bg-white"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* --- COMISSÕES --- */}
                    {activeTab === 'comissoes' && (
                        <div className="animate-in slide-in-from-bottom-2">
                            <Card title="Comissões e Gorjetas" icon={<DollarSign size={20}/>}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Comissão Padrão (%)</label>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="number" 
                                                value={prof.commissionRate}
                                                onChange={e => setProf({...prof, commissionRate: Number(e.target.value)})}
                                                className="w-32 border border-slate-300 rounded-xl px-4 py-3 text-lg font-bold text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none"
                                            />
                                            <span className="text-slate-500 text-sm">por serviço realizado</span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2">
                                            Essa taxa será aplicada automaticamente ao fechar o caixa, salvo se o serviço tiver regra específica.
                                        </p>
                                    </div>
                                    
                                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                                        <h4 className="font-bold text-blue-800 mb-2">Exceções de Serviço</h4>
                                        <p className="text-sm text-blue-600 mb-4">
                                            Configure comissões diferentes para serviços específicos (ex: produtos vs serviços).
                                        </p>
                                        <button className="text-xs bg-white text-blue-600 px-3 py-2 rounded-lg font-bold border border-blue-200 hover:bg-blue-50 shadow-sm flex items-center gap-2">
                                            <Plus size={14}/> Adicionar Regra
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default ProfessionalDetail;
