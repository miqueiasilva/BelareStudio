import React, { useState, useEffect } from 'react';
import { 
    ArrowLeft, Save, Loader2, Scale, ShieldCheck, AlertCircle, 
    TrendingUp, Info, Sparkles, Building, Landmark, Settings, 
    FileSpreadsheet, HelpCircle, FileText, CheckCircle
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import Toast, { ToastType } from '../shared/Toast';

const FiscalSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { activeStudioId } = useStudio();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Estado principal de configuração fiscal
    const [formData, setFormData] = useState({
        regime_tributor: 'mei', // mei | simples_nacional | lucro_presumido | pessoa_fisica
        cnpj_cpf: '',
        inscricao_municipal: '',
        mei_anual_revenue_offset: 0, // Outros faturamentos fora do sistema para o termômetro do MEI
        auto_emission_on_checkout: false, // Emissão automática ao finalizar comanda
        has_salao_parceiro_contract: false, // Ativa a Lei do Salão Parceiro (redução de bitributação)
        aliquota_simples: 6.0, // Alíquota padrão se for Simples (Serviços)
        
        // Padrão Nacional NFS-e (Emissor do GOV)
        gov_api_client_id: '',
        gov_api_client_secret: '',
        gov_api_environment: 'homologacao', // producao | homologacao
        gov_municipal_code: '', // Código IBGE da cidade
        
        // Dados de suporte tributário
        tax_services_code: '14.01', // Código CNAE predominante para salão (geralmente serviços estéticos / cabeleireiros)
        service_aliquot_deduct_commission: true, // Descontar valor do repasse da base tributária
    });

    // Estado do Faturamento do Ano Atual calculando comandas liquidadas no sistema
    const [yearSalesTotal, setYearSalesTotal] = useState(0);

    useEffect(() => {
        if (!activeStudioId) return;

        const loadFiscalConfig = async () => {
            setIsLoading(true);
            try {
                // 1. Carregar preferências da tabela studio_settings
                const { data: settingsData, error: settingsError } = await supabase
                    .from('studio_settings')
                    .select('fiscal_config')
                    .eq('studio_id', activeStudioId)
                    .maybeSingle();

                if (settingsError) throw settingsError;

                if (settingsData?.fiscal_config) {
                    const parsedConfig = typeof settingsData.fiscal_config === 'string' 
                        ? JSON.parse(settingsData.fiscal_config) 
                        : settingsData.fiscal_config;
                    
                    setFormData(prev => ({
                        ...prev,
                        ...parsedConfig
                    }));
                }

                // 2. Calcular o faturamento total acumulado no ano vigente do estúdio ativo (comandas pagas)
                const currentYearStart = `${new Date().getFullYear()}-01-01T00:00:00`;
                const currentYearEnd = `${new Date().getFullYear()}-12-31T23:59:59`;

                const { data: commands, error: commandsError } = await supabase
                    .from('commands')
                    .select('total_amount')
                    .eq('studio_id', activeStudioId)
                    .eq('status', 'paid')
                    .gte('closed_at', currentYearStart)
                    .lte('closed_at', currentYearEnd);

                if (!commandsError && commands) {
                    const total = commands.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
                    setYearSalesTotal(total);
                }

            } catch (err: any) {
                console.error("Erro ao carregar configurações fiscais:", err);
            } finally {
                setIsLoading(false);
            }
        };

        loadFiscalConfig();
    }, [activeStudioId]);

    const handleSave = async () => {
        if (!activeStudioId) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('studio_settings')
                .upsert({ 
                    studio_id: activeStudioId, 
                    fiscal_config: formData,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'studio_id' });

            if (error) throw error;
            
            setToast({ message: "Configurações de infraestrutura fiscal salvas!", type: 'success' });
            setTimeout(onBack, 1200);
        } catch (err: any) {
            setToast({ message: "Erro ao atualizar infraestrutura fiscal: " + err.message, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    // Cálculos de termômetro de MEI
    const meiAnnualLimit = 81000;
    const totalMeiRevenue = yearSalesTotal + (Number(formData.mei_anual_revenue_offset) || 0);
    const meiPercent = Math.min((totalMeiRevenue / meiAnnualLimit) * 100, 100);
    const hasExceededMei = totalMeiRevenue > meiAnnualLimit;
    const alertThreshold = meiAnnualLimit * 0.8; // Alerta aos 80% do limite (R$ 64.800)
    const isUnderAlert = totalMeiRevenue >= alertThreshold && totalMeiRevenue <= meiAnnualLimit;

    if (isLoading) {
        return (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="animate-spin mb-4 text-orange-500" size={40} />
                <p className="text-xs font-black uppercase tracking-widest">Sincronizando infraestrutura fiscal...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-32 animate-in fade-in duration-500 text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* Cabeçalho */}
            <header className="flex items-center gap-4 mb-8">
                <button 
                    onClick={onBack} 
                    className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-orange-600 transition-all shadow-sm"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-tight flex items-center gap-2">
                        <Scale size={24} className="text-orange-500" /> Regime Tributário & Notas Fiscais
                    </h1>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Estrutura e escalonamento fiscal da sua empresa</p>
                </div>
            </header>

            {/* Banner Informativo sobre Autônomos e MEI */}
            <div className="bg-slate-900 text-white rounded-[32px] p-8 mb-8 relative overflow-hidden shadow-2xl border border-white/5">
                <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pr-8 pointer-events-none">
                    <Sparkles size={160} className="text-orange-400" />
                </div>
                <div className="max-w-xl text-left z-10 relative">
                    <span className="bg-orange-500/20 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full text-[8px] tracking-wider uppercase font-black">
                        PROJETADO PARA MEI & AUTO-ESCALABILIDADE
                    </span>
                    <h3 className="text-2xl font-black text-white tracking-tighter mt-3">Pronto para emitir ou se preparar para o crescimento</h3>
                    <p className="text-slate-300 text-xs leading-relaxed mt-2.5 font-medium">
                        O Belare nasceu para autônomos e MEIs da beleza que, em sua maioria, não emitem notas fiscais rotineiramente. No entanto, para garantir que seu sistema escale perfeitamente, estruturamos este painel. Aqui você conecta o <strong>Emissor Padrão Nacional (NFS-e GOV)</strong> ou monitora de forma inteligente o seu limite fiscal anual!
                    </p>
                </div>
            </div>

            {/* Grid Bento Principal */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Coluna 1 e 2: Formulários e Regimes */}
                <div className="md:col-span-2 space-y-6">
                    
                    {/* Card 1: Seleção de Regime Tributário */}
                    <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
                                <Building size={18} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider">Regime da Empresa</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Como sua empresa responde tributariamente</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                            {[
                                { id: 'mei', label: 'MEI (Microempreendedor)', desc: 'Isento se emitido para pessoa física' },
                                { id: 'simples_nacional', label: 'Simples Nacional', desc: 'Anexo III - Alíquotas iniciais de 6%' },
                                { id: 'lucro_presumido', label: 'Lucro Presumido', desc: 'Regimes maiores para redes corporativas' },
                                { id: 'pessoa_fisica', label: 'Autônomo (CPF)', desc: 'Prestador de Serviço Autônomo' }
                            ].map((reg) => (
                                <button
                                    key={reg.id}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, regime_tributor: reg.id })}
                                    className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col justify-between ${
                                        formData.regime_tributor === reg.id 
                                            ? 'border-orange-500 bg-orange-50/20' 
                                            : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                                    }`}
                                >
                                    <span className={`text-xs font-black uppercase ${formData.regime_tributor === reg.id ? 'text-orange-600' : 'text-slate-700'}`}>
                                        {reg.label}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium mt-1">
                                        {reg.desc}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Campos de Cadastro Fiscal */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CNPJ / CPF da Empresa</label>
                                <input 
                                    type="text"
                                    value={formData.cnpj_cpf} 
                                    onChange={e => setFormData({ ...formData, cnpj_cpf: e.target.value })}
                                    placeholder="00.000.000/0000-00"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500/30 transition-all"
                                />
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Inscrição Municipal (I.M)</label>
                                <input 
                                    type="text"
                                    value={formData.inscricao_municipal} 
                                    onChange={e => setFormData({ ...formData, inscricao_municipal: e.target.value })}
                                    placeholder="Inscrição Municipal"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500/30 transition-all"
                                />
                            </div>

                            {formData.regime_tributor === 'simples_nacional' && (
                                <div className="space-y-1.5 text-left animate-in fade-in slide-in-from-top-1 duration-200">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alíquota Efetiva do Simples (%)</label>
                                    <input 
                                        type="number"
                                        step="0.1"
                                        value={formData.aliquota_simples} 
                                        onChange={e => setFormData({ ...formData, aliquota_simples: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500/30 transition-all"
                                    />
                                </div>
                            )}

                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código de Serviço CNAE</label>
                                <input 
                                    type="text"
                                    value={formData.tax_services_code} 
                                    onChange={e => setFormData({ ...formData, tax_services_code: e.target.value })}
                                    placeholder="Ex: 14.01 (Serviços de Cabeleireiro, manicure, etc.)"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500/30 transition-all"
                                />
                            </div>
                        </div>
                    </div>


                    {/* Card 2: Evitando Bitributação - Lei do Salão Parceiro de Beleza */}
                    <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl animate-pulse">
                                    <ShieldCheck size={18} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider">Lei do Salão Parceiro (LEI 13.352)</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Redução Legal da Carga de Imposto de Salões de Beleza</p>
                                </div>
                            </div>
                            
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={formData.has_salao_parceiro_contract}
                                    onChange={e => setFormData({ ...formData, has_salao_parceiro_contract: e.target.checked })}
                                    className="sr-only peer" 
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                            </label>
                        </div>

                        <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4 text-left">
                            Sob a <strong>Lei do Salão Parceiro (Nº 13.352)</strong>, a cota-parte destinada ao profissional parceiro (comissão/repasse) não entra no cálculo de receita tributável do estúdio. Isso significa que você <strong>apenas paga imposto sobre a parte do Salão</strong>, impedindo a dupla tributação abusiva!
                        </p>

                        {formData.has_salao_parceiro_contract && (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-left space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="flex items-start gap-2.5">
                                    <CheckCircle size={16} className="text-emerald-600 grow-0 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-black text-emerald-800 uppercase tracking-wide">Cálculo de Base Tributária Ativo</p>
                                        <p className="text-[11px] text-emerald-700 leading-relaxed mt-0.5">
                                            O sistema Belare já está pré-configurado estruturalmente para abater as comissões pagas aos profissionais das vendas liquidadas ao gerar as exportações e notas.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white border border-emerald-100 rounded-xl">
                                    <span className="text-[10px] font-black text-slate-500 uppercase">Deduzir repasses das notas de faturamento automático</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.service_aliquot_deduct_commission}
                                            onChange={e => setFormData({ ...formData, service_aliquot_deduct_commission: e.target.checked })}
                                            className="sr-only peer" 
                                        />
                                        <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Card 3: Padrão Nacional de NFS-e (Integração) */}
                    <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                    <Landmark size={18} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider">API do Emissor Nacional (NFS-e GOV)</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Conexão direta com a Secretaria da Receita Federal</p>
                                </div>
                            </div>
                            
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={formData.auto_emission_on_checkout}
                                    onChange={e => setFormData({ ...formData, auto_emission_on_checkout: e.target.checked })}
                                    className="sr-only peer" 
                                />
                                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6 text-left">
                            O padrão nacional de Notas Fiscais Eletrônicas simplifica a emissão para Microempreendedores e estúdios que precisam automatizar o processo. Ative este recurso para permitir emissões instantâneas na finalização do serviço.
                        </p>

                        {formData.auto_emission_on_checkout && (
                            <div className="space-y-4 border-t border-slate-100 pt-6 animate-in fade-in slide-in-from-top-1 duration-200 text-left">
                                <div className="p-4 bg-indigo-50 rounded-2xl flex items-start gap-3 text-indigo-800">
                                    <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-wider text-indigo-700">Modo de Testes Ativado por Padrão</p>
                                        <p className="text-[11px] text-indigo-600 leading-relaxed mt-1">
                                            As emissões são iniciadas no ambiente de <strong>Homologação</strong> para garantir total consistência e testes do seu fluxo antes de passar à chave de produção.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Client ID Secretaria Municipal / Gov</label>
                                        <input 
                                            type="text"
                                            value={formData.gov_api_client_id} 
                                            onChange={e => setFormData({ ...formData, gov_api_client_id: e.target.value })}
                                            placeholder="Ex: id-integracao-12154"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 transition-all font-mono"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Client Secret Autenticador</label>
                                        <input 
                                            type="password"
                                            value={formData.gov_api_client_secret} 
                                            onChange={e => setFormData({ ...formData, gov_api_client_secret: e.target.value })}
                                            placeholder="••••••••••••••••"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 transition-all font-mono"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código de Município (IBGE)</label>
                                        <input 
                                            type="text"
                                            value={formData.gov_municipal_code} 
                                            onChange={e => setFormData({ ...formData, gov_municipal_code: e.target.value })}
                                            placeholder="Ex: 3550308 (São Paulo)"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ambiente de Transmissão</label>
                                        <select 
                                            value={formData.gov_api_environment} 
                                            onChange={e => setFormData({ ...formData, gov_api_environment: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="homologacao">Homologação (Testes Sem Valor Fiscal)</option>
                                            <option value="producao font-bold text-emerald-600">Produção (Com Valor Fiscal Real)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                {/* Coluna 3: Painel Lateral Termômetro de MEI */}
                <div className="space-y-6">
                    
                    {/* Alerta de MEI e Barra de Faturamento anual */}
                    <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm text-left relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                                <TrendingUp size={18} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 uppercase text-xs tracking-tight">Termômetro MEI</h3>
                                <p className="text-[9px] text-slate-400 font-bold uppercase">Sua saúde fiscal anual</p>
                            </div>
                        </div>

                        {/* Barra de progresso circular ou linear */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mt-1">Total Acumulado (2026)</span>
                                    <span className={`text-2xl font-black tracking-tight ${hasExceededMei ? 'text-red-500' : 'text-slate-800'}`}>
                                        {totalMeiRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                </div>
                                <span className="text-[10px] font-black text-slate-400">Limite: R$ 81k</span>
                            </div>

                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden relative shadow-inner">
                                <div 
                                    className={`h-full transition-all duration-1000 ease-out shadow-sm rounded-full ${
                                        hasExceededMei 
                                            ? 'bg-gradient-to-r from-red-600 to-rose-400' 
                                            : isUnderAlert 
                                                ? 'bg-gradient-to-r from-amber-600 to-orange-400' 
                                                : 'bg-gradient-to-r from-emerald-600 to-teal-400'
                                    }`}
                                    style={{ width: `${meiPercent}%` }}
                                />
                            </div>

                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                                <span>{meiPercent.toFixed(1)}% utilizado</span>
                                <span>Restam {(Math.max(meiAnnualLimit - totalMeiRevenue, 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>

                            {/* Alerta de ultrapassagem ou segurança */}
                            {hasExceededMei ? (
                                <div className="p-4 bg-red-50 border border-red-100 text-red-800 rounded-2xl text-[11px] leading-relaxed font-medium mt-4">
                                    <div className="flex gap-2 items-start">
                                        <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                                        <p>
                                            <strong>Atenção!</strong> Você ultrapassou o limite anual do MEI (R$ 81.000). Para não sofrer multas tributárias, é altamente recomendado iniciar o processo de transição para <strong>Microempresa (Simples Nacional)</strong>.
                                        </p>
                                    </div>
                                </div>
                            ) : isUnderAlert ? (
                                <div className="p-4 bg-amber-50 border border-amber-100 text-slate-700 rounded-2xl text-[11px] leading-relaxed font-medium mt-4">
                                    <div className="flex gap-2 items-start">
                                        <AlertCircle size={16} className="text-orange-500 shrink-0 mt-0.5" />
                                        <p>
                                            <strong>Alerta de Limite:</strong> Você ultrapassou 80% do teto anual do MEI. Considere consultar sua contabilidade para preparar a migração sem interrupção nas vendas!
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl text-[11px] leading-relaxed font-medium mt-4">
                                    <div className="flex gap-2 items-start">
                                        <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                                        <p>
                                            <strong>Status Seguro:</strong> Faturamento dentro do esperado para manter-se elegível ao MEI no exercício atual.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Campo de receita manual de offset */}
                            <div className="mt-8 border-t border-slate-100 pt-6">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 leading-none">Receitas Fora do Belare (Opcional)</label>
                                <p className="text-[9px] text-slate-400 leading-tight block mt-1 mb-3">Valor de faturamento anual obtido em outros canais para somar ao termômetro fiscal.</p>
                                
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-xs text-slate-400">R$</span>
                                    <input 
                                        type="number"
                                        value={formData.mei_anual_revenue_offset || ''}
                                        onChange={e => setFormData({ ...formData, mei_anual_revenue_offset: parseFloat(e.target.value) || 0 })}
                                        placeholder="0,00"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-xs font-black text-slate-700 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Guia pedagógica / educacional */}
                    <div className="bg-slate-50 border border-slate-200 rounded-[32px] p-6 text-left">
                        <div className="flex items-center gap-2 mb-3 text-slate-700">
                            <HelpCircle size={14} className="text-orange-500" />
                            <h4 className="text-[10px] font-black uppercase tracking-wider">Como funciona o fluxo?</h4>
                        </div>
                        <ul className="space-y-2 text-[11px] text-slate-500 font-medium leading-relaxed">
                            <li className="flex items-start gap-1.5">
                                <span className="text-orange-500 font-bold">•</span>
                                <div><strong>Baixas:</strong> O faturamento é preenchido automaticamente ao liquidar comandas no sistema.</div>
                            </li>
                            <li className="flex items-start gap-1.5">
                                <span className="text-orange-500 font-bold">•</span>
                                <div><strong>NFS-e Nacional:</strong> O padrão nacional unifica a comunicação tributária de todas as prefeituras aptas.</div>
                            </li>
                            <li className="flex items-start gap-1.5">
                                <span className="text-orange-500 font-bold">•</span>
                                <div><strong>Bitributação:</strong> Usando a Lei do Salão Parceiro, você reduz consideravelmente seu ISSQN e imposto DAS/Simples!</div>
                            </li>
                        </ul>
                    </div>

                </div>

            </div>

            {/* Barra de Ações Fixas no Rodapé */}
            <div className="sticky bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent flex justify-center pointer-events-none z-50 mt-8">
                <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="pointer-events-auto min-w-[240px] px-12 py-5 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-[24px] shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    {isSaving ? 'Salvando Infraestrutura...' : 'Salvar Infraestrutura Fiscal'}
                </button>
            </div>
        </div>
    );
};

export default FiscalSettings;
