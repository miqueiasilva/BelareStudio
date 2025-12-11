
import React, { useState, useMemo, useRef } from 'react';
import { UserPlus, Search, Filter, Phone, Mail, Tag, Edit, Trash2, User, FileUp } from 'lucide-react';
import { clients as initialClients, initialAppointments } from '../../data/mockData';
import { Client } from '../../types';
import ClientModal from '../modals/ClientModal';
import Toast, { ToastType } from '../shared/Toast';
import { format, differenceInDays } from 'date-fns';

const ClientesView: React.FC = () => {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // CSV Import Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Logic for Derived Stats ---
  
  const enrichedClients = useMemo(() => {
    return clients.map(client => {
      const clientApps = initialAppointments.filter(app => app.client?.id === client.id && app.status === 'concluido');
      
      // Calculate Stats
      const totalSpent = clientApps.reduce((acc, app) => acc + app.service.price, 0);
      const visits = clientApps.length;
      
      // Get Last Visit
      const lastVisitDate = clientApps.length > 0 
        ? new Date(Math.max(...clientApps.map(a => new Date(a.start).getTime())))
        : null;
        
      const daysSinceLastVisit = lastVisitDate 
        ? differenceInDays(new Date(), lastVisitDate) 
        : null;

      let status: 'Novo' | 'Ativo' | 'Inativo' | 'Recuperar' = 'Novo';
      if (visits > 0) {
        if (daysSinceLastVisit !== null && daysSinceLastVisit < 30) status = 'Ativo';
        else if (daysSinceLastVisit !== null && daysSinceLastVisit < 90) status = 'Inativo';
        else status = 'Recuperar';
      }

      return {
        ...client,
        stats: {
          totalSpent,
          visits,
          lastVisitDate,
          status
        }
      };
    });
  }, [clients]);

  const filteredClients = useMemo(() => {
    return enrichedClients.filter(client => 
      client.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.whatsapp?.includes(searchTerm) ||
      client.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [enrichedClients, searchTerm]);

  // --- Handlers ---

  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

  const handleSaveClient = (client: Client) => {
    setClients(prev => {
      const exists = prev.find(c => c.id === client.id);
      if (exists) {
        return prev.map(c => c.id === client.id ? client : c);
      }
      return [...prev, client];
    });
    setIsModalOpen(false);
    setSelectedClient(null);
    showToast(selectedClient ? 'Cliente atualizado!' : 'Novo cliente cadastrado!');
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja remover este cliente?')) {
      setClients(prev => prev.filter(c => c.id !== id));
      showToast('Cliente removido.', 'info');
    }
  };

  const handleNewClient = () => {
    setSelectedClient(null);
    setIsModalOpen(true);
  };

  // --- CSV Import Logic ---

  const handleImportClick = () => {
    if (fileInputRef.current) {
        fileInputRef.current.click();
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) return;

        try {
            const lines = text.split('\n');
            const newClients: Client[] = [];
            let successCount = 0;

            // Determine if first row is header based on common keywords
            const firstLine = lines[0].toLowerCase();
            const startIndex = (firstLine.includes('nome') || firstLine.includes('name') || firstLine.includes('cliente')) ? 1 : 0;

            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // Simple split by comma
                const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                
                // Expected Format: Name, WhatsApp, Email, Tags
                // Minimum required: Name
                if (cols.length >= 1 && cols[0]) {
                    const nome = cols[0];
                    const whatsapp = cols[1] || '';
                    const email = cols[2] || '';
                    const tagsStr = cols[3] || '';
                    
                    const tags = tagsStr ? tagsStr.split(';').map(t => t.trim()) : [];

                    newClients.push({
                        id: Date.now() + i + Math.random(), // Unique ID generation
                        nome,
                        whatsapp,
                        email,
                        tags,
                        consent: true
                    });
                    successCount++;
                }
            }

            if (successCount > 0) {
                setClients(prev => [...prev, ...newClients]);
                showToast(`${successCount} clientes importados com sucesso!`, 'success');
            } else {
                showToast('Nenhum dado válido encontrado. Verifique o formato (Nome, WhatsApp, Email).', 'error');
            }

        } catch (err) {
            console.error("CSV Import Error", err);
            showToast('Erro ao processar o arquivo. Verifique o formato.', 'error');
        }

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 relative">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Hidden Input for CSV */}
      <input 
          type="file" 
          accept=".csv" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileUpload}
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <User className="text-orange-500" />
            Gestão de Clientes
          </h1>
          <p className="text-slate-500 text-sm mt-1">Gerencie sua base de clientes, histórico e preferências.</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
            <button 
                onClick={handleImportClick}
                className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 w-full md:w-auto"
                title="Importar CSV (Nome, WhatsApp, Email)"
            >
                <FileUp size={20} className="text-slate-500" />
                <span className="hidden sm:inline">Importar CSV</span>
            </button>

            <button 
              onClick={handleNewClient}
              className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-200 flex items-center justify-center gap-2 transition-all active:scale-95 w-full md:w-auto"
            >
              <UserPlus className="w-5 h-5" />
              Novo Cliente
            </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 pb-2">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
           <div>
             <p className="text-xs font-bold text-slate-400 uppercase">Total de Clientes</p>
             <p className="text-2xl font-bold text-slate-800">{clients.length}</p>
           </div>
           <div className="bg-blue-100 p-3 rounded-lg text-blue-600"><User className="w-6 h-6"/></div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
           <div>
             <p className="text-xs font-bold text-slate-400 uppercase">Novos este Mês</p>
             <p className="text-2xl font-bold text-green-600">3</p>
           </div>
           <div className="bg-green-100 p-3 rounded-lg text-green-600"><UserPlus className="w-6 h-6"/></div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
           <div>
             <p className="text-xs font-bold text-slate-400 uppercase">Ticket Médio (Geral)</p>
             <p className="text-2xl font-bold text-purple-600">R$ 145,00</p>
           </div>
           <div className="bg-purple-100 p-3 rounded-lg text-purple-600"><Tag className="w-6 h-6"/></div>
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        {/* Search Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex items-center gap-4 shadow-sm">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome, telefone ou tag..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 transition-all"
            />
          </div>
          <button className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            <Filter className="w-5 h-5" />
          </button>
        </div>

        {/* Table/List */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-4 border-b border-slate-200">Cliente</th>
                  <th className="p-4 border-b border-slate-200 hidden md:table-cell">Contatos</th>
                  <th className="p-4 border-b border-slate-200 hidden lg:table-cell">Tags</th>
                  <th className="p-4 border-b border-slate-200 hidden sm:table-cell">Histórico</th>
                  <th className="p-4 border-b border-slate-200 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map(client => (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                          {client.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{client.nome}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                             <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                               client.stats.status === 'Ativo' ? 'bg-green-100 text-green-700' : 
                               client.stats.status === 'Novo' ? 'bg-blue-100 text-blue-700' :
                               'bg-slate-100 text-slate-500'
                             }`}>
                               {client.stats.status}
                             </span>
                             {client.stats.lastVisitDate && (
                               <span className="text-xs text-slate-400 hidden sm:inline">
                                 Última vez: {format(client.stats.lastVisitDate, 'dd/MM/yy')}
                               </span>
                             )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <div className="space-y-1">
                        {client.whatsapp && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="w-3.5 h-3.5 text-green-500" />
                            {client.whatsapp}
                          </div>
                        )}
                        {client.email && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Mail className="w-3.5 h-3.5 text-blue-500" />
                            <span className="truncate max-w-[150px]">{client.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {client.tags?.map((tag, i) => (
                          <span key={i} className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-100">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 hidden sm:table-cell">
                      <div className="text-sm">
                        <p className="text-slate-800 font-medium">
                          {client.stats.visits} visitas
                        </p>
                        <p className="text-slate-500 text-xs">
                          Total: R$ {client.stats.totalSpent.toFixed(2)}
                        </p>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(client)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(client.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <ClientModal 
          client={selectedClient} 
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSaveClient} 
        />
      )}
    </div>
  );
};

export default ClientesView;
