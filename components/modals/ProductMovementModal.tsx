import React from 'react';
import { X } from 'lucide-react';

interface ProductMovementModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const ProductMovementModal: React.FC<ProductMovementModalProps> = ({ onClose, onSuccess }) => {
    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Movimentação de Estoque</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
                </div>
                <div className="p-10 text-center">
                    <p className="text-slate-500 text-sm">Funcionalidade de movimentação em desenvolvimento.</p>
                    <button 
                        onClick={onClose}
                        className="mt-6 px-8 py-3 bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductMovementModal;
