import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Upload, User, Scissors, DollarSign, Clock, Palette, Tag, Trash2, Camera } from 'lucide-react';
import { LegacyService, LegacyProfessional } from '../../types';

// --- Professional Modal ---

interface ProfessionalModalProps {
    professional?: LegacyProfessional | null;
    onClose: () => void;
    onSave: (professional: LegacyProfessional) => void;
}

export const ProfessionalModal: React.FC<ProfessionalModalProps> = ({ professional, onClose, onSave }) => {
    const [name, setName] = useState(professional?.name || '');
    const [avatarUrl, setAvatarUrl] = useState(professional?.avatarUrl || '');
    const fileInputRef = useRef<HTMLInputElement>(null);

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