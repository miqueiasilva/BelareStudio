import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Upload, User, Scissors, DollarSign, Clock, Palette, Tag, Trash2, Camera } from 'lucide-react';
import { LegacyService, LegacyProfessional } from '../../types';

// --- Service Modal ---

interface ServiceModalProps {
    service?: LegacyService | null;
    availableCategories: string[];
    onClose: () => void;
    onSave: (service: LegacyService) => void;
}

export const ServiceModal: React.FC<ServiceModalProps> = ({ service, availableCategories, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<LegacyService>>({
        name: '',
        price: 0,
        duration: 30,
        color: '#3b82f6',
        category: ''
    });

    // Local state for split duration (HH:MM)
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(30);

    useEffect(() => {
        if (service) {
            setFormData(service);
            setHours(Math.floor(service.duration / 60));
            setMinutes(service.duration % 60);
        } else {
            setFormData({
                name: '',
                price: 0,
                duration: 30,
                color: '#3b82f6',
                category: ''
            });
            setHours(0);
            setMinutes(30);
        }
    }, [service]);

    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#10b981', '#64748b'];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const totalDuration = (Number(hours) * 60) + Number(minutes);
        onSave({
            id: service?.id || Date.now(),
            name: formData.name || 'Novo Serviço',
            price: Number(formData.price),
            duration: totalDuration,
            color: formData.color || '#3b82f6',
            category: formData.category || 'Geral'
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Scissors className="w-5 h-5 text-orange-500" />
                        {service ? 'Editar Serviço' : 'Novo Serviço'}
                    </h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
                </header>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Serviço</label>
                        <input 
                            required
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
                            placeholder="Ex: Corte Feminino"
                        />
                    </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria</label>
                        <div className="relative">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                value={formData.category}
                                onChange={e => setFormData({...formData, category: e.target.value})}
                                className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="Selecione ou digite uma nova..."
                                list="categories-list"
                            />
                            <datalist id="categories-list">
                                {availableCategories.map(cat => (
                                    <option key={cat} value={cat} />
                                ))}
                            </datalist>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preço (R$)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="number"
                                    required
                                    value={formData.price}
                                    onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                                    className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Duração do Serviço</label>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <input 
                                        type="number"
                                        min="0"
                                        value={hours}
                                        onChange={e => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                                        className="w-full border border-slate-300 rounded-lg px-2 py-2 text-center font-mono font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold uppercase">h</span>
                                </div>
                                <span className="text-xl font-bold text-slate-300">:</span>
                                <div className="relative flex-1">
                                    <input 
                                        type="number"
                                        min="0"
                                        max="59"
                                        value={minutes}
                                        onChange={e => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                                        className="w-full border border-slate-300 rounded-lg px-2 py-2 text-center font-mono font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                                        placeholder="00"
                                    />
                                    <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold uppercase">m</span>
                                </div>
                            </div>
                            <p className="text-[9px] text-slate-400 mt-1 text-right">Total: {(Number(hours) * 60) + Number(minutes)} min</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cor na Agenda</label>
                        <div className="flex gap-3">
                            {colors.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setFormData({...formData, color: c})}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${formData.color === c ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-110'}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-lg">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 shadow-sm flex items-center gap-2 transition-all active:scale-95">
                            <Save size={18} /> Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Professional Modal ---

interface ProfessionalModalProps {
    professional?: LegacyProfessional | null;
    onClose: () => void;
    onSave: (professional: LegacyProfessional) => void;
}

export const ProfessionalModal: React.FC<ProfessionalModalProps> = ({ professional, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (professional) {
            setName(professional.name);
            setAvatarUrl(professional.avatarUrl);
        } else {
            setName('');
            setAvatarUrl('');
        }
    }, [professional]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setAvatarUrl(url);
        }
    };

    const handleRemovePhoto = (e: React.MouseEvent) => {
        e.stopPropagation();
        setAvatarUrl('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: professional?.id || Date.now(),
            name,
            avatarUrl: avatarUrl || `https://ui-avatars.com/api/?name=${name}&background=random`
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-500" />
                        {professional ? 'Editar Profissional' : 'Novo Profissional'}
                    </h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
                </header>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="flex flex-col items-center gap-3">
                        <div 
                            className="relative group cursor-pointer w-28 h-28" 
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-4 border-slate-50 shadow-sm group-hover:border-blue-100 transition-colors">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-12 h-12 text-slate-300" />
                                )}
                            </div>
                            <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="w-8 h-8 text-white" />
                            </div>
                            {avatarUrl && (
                                <button 
                                    type="button"
                                    onClick={handleRemovePhoto}
                                    className="absolute bottom-0 right-0 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md transition-transform hover:scale-110"
                                    title="Remover foto"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                        
                        <div className="flex gap-2">
                            <button 
                                type="button"
                                className="text-xs text-blue-600 font-bold hover:underline" 
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {avatarUrl ? 'Alterar Foto' : 'Adicionar Foto'}
                            </button>
                        </div>

                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                        <input 
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ex: Ana Silva"
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-3 border-t border-slate-100 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-lg">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-2 transition-all active:scale-95">
                            <Save size={18} /> Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};