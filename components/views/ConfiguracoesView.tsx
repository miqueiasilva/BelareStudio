
import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import SettingsHub from '../settings/SettingsHub';
import PaymentSettings from '../settings/PaymentSettings';
import BusinessSettings from '../settings/BusinessSettings';
import BlocksSettings from '../settings/BlocksSettings';
import ResourcesSettings from '../settings/ResourcesSettings';
import UnderConstruction from '../settings/UnderConstruction';

const ConfiguracoesView: React.FC = () => {
    const [subView, setSubView] = useState<'hub' | 'profile' | 'payments' | 'theme' | 'resources' | 'discounts' | 'blocks'>('hub');
    
    // Função para renderizar o conteúdo dinâmico
    const renderSubView = () => {
        switch (subView) {
            case 'hub':
                return (
                    <SettingsHub 
                        onNavigate={(v: any) => setSubView(v)} 
                        onTopLevelNavigate={(view: any) => {
                            if (view === 'dashboard') window.location.hash = '#/';
                        }}
                    />
                );
            case 'profile':
                return <BusinessSettings onBack={() => setSubView('hub')} />;
            case 'payments':
                return <PaymentSettings onBack={() => setSubView('hub')} />;
            case 'blocks':
                return <BlocksSettings onBack={() => setSubView('hub')} />;
            case 'resources':
                return <ResourcesSettings onBack={() => setSubView('hub')} />;
            case 'theme':
                return <UnderConstruction title="Tema do Sistema" onBack={() => setSubView('hub')} />;
            case 'resources':
                return <ResourcesSettings onBack={() => setSubView('hub')} />;
            case 'discounts':
                return <UnderConstruction title="Cupons e Descontos" onBack={() => setSubView('hub')} />;
            default:
                return <SettingsHub onNavigate={(v: any) => setSubView(v)} onTopLevelNavigate={() => {}} />;
        }
    };

    return (
        <div className="h-full bg-slate-50 flex flex-col font-sans overflow-hidden text-left">
            <header className="bg-white border-b border-slate-200 px-8 py-6 flex-shrink-0 z-20 shadow-sm text-left">
                <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3 leading-none">
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                        <Settings size={24} />
                    </div>
                    {subView === 'hub' ? 'Configurações' : 'Ajustes Técnicos'}
                </h1>
                <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-2 ml-12 leading-none">
                    {subView === 'hub' ? 'Gestão da sua marca e regras do negócio.' : `Menu / Configurações / ${subView === 'profile' ? 'Perfil' : subView}`}
                </p>
            </header>

            <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                <div className="max-w-4xl mx-auto">
                    {renderSubView()}
                </div>
            </main>
        </div>
    );
};

export default ConfiguracoesView;
