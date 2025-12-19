
import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Scissors, 
  Users, 
  Clock, 
  Bell, 
  CreditCard, 
  Save, 
  Plus, 
  Trash2,
  DollarSign
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Componentes internos das abas
const StudioTab = () => {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    studio_name: '',
    address: '',
    phone: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('studio_settings').select('*').single();
    if (data) setSettings(data);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('studio_settings')
        .update(settings)
        .eq('id', (await supabase.from('studio_settings').select('id').single()).data?.id);

      if (error) throw error;
      alert('Dados do estúdio salvos com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-orange-500" />
        Dados do Estúdio
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Nome Comercial</label>
          <input 
            type="text" 
            value={settings.studio_name}
            onChange={e => setSettings({...settings, studio_name: e.target.value})}
            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Whatsapp de Contato</label>
          <input 
            type="text" 
            value={settings.phone}
            onChange={e => setSettings({...settings, phone: e.target.value})}
            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Endereço Completo</label>
          <input 
            type="text" 
            value={settings.address}
            onChange={e => setSettings({...settings, address: e.target.value})}
            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button 
          onClick={handleSave}
          disabled={loading}
          className="bg-orange-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center gap-2"
        >
          <Save size={18} />
          {loading ? 'Salvando...' : 'Salvar Informações'}
        </button>
      </div>
    </div>
  );
};

const FinanceiroTab = () => {
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMethods();
  }, []);

  const fetchMethods = async () => {
    const { data } = await supabase.from('payment_methods').select('*').order('name');
    if (data) setMethods(data);
  };

  const updateRate = (id: string, rate: string) => {
    setMethods(methods.map(m => m.id === id ? { ...m, fee_percentage: rate } : m));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      for (const method of methods) {
        await supabase
          .from('payment_methods')
          .update({ fee_percentage: parseFloat(method.fee_percentage) })
          .eq('id', method.id);
      }
      alert('Taxas atualizadas com sucesso!');
    } catch (error) {
      alert('Erro ao salvar taxas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          Configurações Financeiras
        </h3>
        <div className="mt-2 p-4 bg-blue-50 text-blue-700 text-sm rounded-lg flex items-start gap-3">
          <CreditCard className="w-5 h-5 mt-0.5 shrink-0" />
          <p>
            <strong>Maquininha de Cartão:</strong> Defina as taxas cobradas pela sua operadora. 
            Essas taxas serão descontadas das comissões se a opção de abatimento estiver ativa no perfil do colaborador.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {methods.map(method => (
          <div key={method.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white border rounded-md text-gray-500">
                {method.name.includes('Pix') ? '💠' : method.name.includes('Dinheiro') ? '💵' : method.name.includes('Débito') ? '💳' : '💳'}
              </div>
              <div>
                <p className="font-semibold text-gray-800">{method.name}</p>
                <p className="text-xs text-gray-400">TAXA DE OPERAÇÃO</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                step="0.01"
                value={method.fee_percentage}
                onChange={(e) => updateRate(method.id, e.target.value)}
                className="w-20 p-2 text-right border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-orange-500 outline-none"
              />
              <span className="text-gray-500 font-medium">%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button 
          onClick={handleSave}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Save size={18} />
          {loading ? 'Salvando...' : 'Salvar Taxas'}
        </button>
      </div>
    </div>
  );
};

const ServicosTab = () => {
  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('services').select('*').then(({ data }) => {
      if (data) setServices(data);
    });
  }, []);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Scissors className="w-5 h-5 text-orange-500" />
          Catálogo de Serviços
        </h3>
        <button className="text-orange-500 hover:bg-orange-50 px-3 py-1 rounded-md text-sm font-medium transition-colors">
          + Novo Serviço
        </button>
      </div>

      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 font-medium uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Nome do Serviço</th>
              <th className="px-4 py-3 text-center">Duração</th>
              <th className="px-4 py-3 text-right">Preço</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {services.map(service => (
              <tr key={service.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{service.name}</td>
                <td className="px-4 py-3 text-center text-gray-500">{service.duration} min</td>
                <td className="px-4 py-3 text-right font-semibold text-green-600">
                  R$ {service.price?.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Componente Principal
const ConfiguracoesView = () => {
  const [activeTab, setActiveTab] = useState('studio');

  const menuItems = [
    { id: 'studio', label: 'Estúdio', icon: Building2 },
    { id: 'services', label: 'Serviços', icon: Scissors },
    { id: 'collaborators', label: 'Colaboradores', icon: Users },
    { id: 'finance', label: 'Financeiro', icon: DollarSign }, // Nova Aba
    { id: 'schedule', label: 'Horários', icon: Clock },
    { id: 'notices', label: 'Mural de Avisos', icon: Bell },
  ];

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      {/* Sidebar de Navegação */}
      <aside className="w-full md:w-64 bg-white rounded-lg shadow-sm border border-gray-100 p-4 h-fit">
        <h2 className="text-xs font-bold text-gray-400 uppercase mb-4 px-2">Configurações</h2>
        <nav className="space-y-1">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.id 
                  ? 'bg-orange-50 text-orange-600 shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 min-w-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {menuItems.find(i => i.id === activeTab)?.label}
          </h1>
          <p className="text-gray-500 text-sm">
            Ajuste as preferências globais do BelaApp
          </p>
        </div>

        {activeTab === 'studio' && <StudioTab />}
        {activeTab === 'finance' && <FinanceiroTab />}
        {activeTab === 'services' && <ServicosTab />}
        
        {activeTab === 'collaborators' && (
           /* Aqui você deve usar o seu componente de Lista de Colaboradores existente ou redirecionar */
           <div className="bg-white p-10 text-center rounded-lg border border-dashed border-gray-300">
             <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
             <p className="text-gray-500">Gerencie a equipe através do menu "Colaboradores" principal para mais detalhes.</p>
           </div>
        )}

        {/* Placeholder para as outras abas (pode implementar depois) */}
        {(activeTab === 'schedule' || activeTab === 'notices') && (
          <div className="bg-white p-12 text-center rounded-lg border border-gray-100">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 mb-4">
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Em Desenvolvimento</h3>
            <p className="text-gray-500 mt-2">Esta funcionalidade estará disponível na próxima atualização.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ConfiguracoesView;
