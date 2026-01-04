
import React from 'react';
import { Construction, ArrowLeft, Sparkles } from 'lucide-react';

interface UnderConstructionProps {
    title: string;
    onBack: () => void;
}

const UnderConstruction: React.FC<UnderConstructionProps> = ({ title, onBack }) => {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="relative mb-8">
                <div className="w-24 h-24 bg-orange-100 rounded-[32px] flex items-center justify-center text-orange-500 shadow-xl shadow-orange-50">
                    <Construction size={48} strokeWidth={1.5} className="animate-bounce" />
                </div>
                <div className="absolute -top-2 -right-2 bg-slate-800 text-white p-2 rounded-full shadow-lg">
                    <Sparkles size={16} />
                </div>
            </div>

            <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tighter">
                {title}
            </h2>
            <p className="text-slate-400 font-bold text-sm text-center max-w-sm mb-10 leading-relaxed">
                Estamos preparando algo incrível para o seu estúdio. Esta funcionalidade estará disponível na próxima atualização!
            </p>

            <button 
                onClick={onBack}
                className="flex items-center gap-2 px-8 py-4 bg-slate-800 text-white font-black rounded-2xl hover:bg-slate-900 transition-all active:scale-95 shadow-xl shadow-slate-100"
            >
                <ArrowLeft size={20} /> Voltar ao Menu
            </button>
        </div>
    );
};

export default UnderConstruction;
