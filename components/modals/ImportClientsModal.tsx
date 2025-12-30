
import React, { useState, useRef } from 'react';
import { X, Upload, Database, Table, Check, AlertTriangle, Loader2, FileText, ArrowRight } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

interface ImportClientsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ImportClientsModal: React.FC<ImportClientsModalProps> = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'parsing' | 'ready' | 'importing' | 'done' | 'error'>('idle');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 });
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. VALIDAÇÃO DE TIPO DE ARQUIVO
  const validateFile = (file: File) => {
    const validExtensions = ['.csv', '.txt'];
    const fileName = file.name.toLowerCase();
    return validExtensions.some(ext => fileName.endsWith(ext));
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateFile(file)) {
      setStatus('error');
      setErrorMsg("Formato inválido. Selecione um arquivo .csv ou .txt");
      return;
    }

    setStatus('parsing');
    
    // Configuração robusta do PapaParse
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      encoding: "ISO-8859-1", // Suporte para acentos do Excel brasileiro
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setStatus('error');
          setErrorMsg("Erro ao ler estrutura do arquivo.");
          return;
        }
        
        // MAPEAMENTO CORRIGIDO (DE-PARA)
        const validRows = results.data.map((row: any) => {
           // Mapeia os campos exatos do seu CSV para os nomes do banco de dados
           const nome = row['Nome'] || row['nome'];
           const apelido = row['Apelido'] || row['apelido'];
           const rawTel = row['Telefone 1'] || row['telefone 1'] || row['Telefone'] || row['whatsapp'];
           const sexo = row['Sexo'] || row['sexo'];
           
           // Limpa o telefone para conter apenas números
           const cleanedTel = rawTel ? rawTel.toString().replace(/\D/g, '') : '';

           return {
             nome: nome?.toString().trim(),
             apelido: apelido?.toString().trim(),
             whatsapp: cleanedTel,
             sexo: sexo?.toString().trim(),
             user_id: user?.id,
             consent: true,
             origem: 'Importação'
           };
        }).filter(item => item.nome && item.whatsapp.length >= 8); // Filtra apenas registros válidos

        console.log(`Debug Importação: Foram identificados ${validRows.length} contatos válidos no arquivo.`);

        if (validRows.length === 0) {
          setStatus('error');
          setErrorMsg("Nenhum dado encontrado. Certifique-se que as colunas se chamam: Nome, Apelido, Telefone 1, Sexo");
          return;
        }

        setParsedData(validRows);
        setProgress({ current: 0, total: validRows.length, percentage: 0 });
        setStatus('ready');
      },
      error: (err) => {
        setStatus('error');
        setErrorMsg("Falha crítica no parser: " + err.message);
      }
    });
  };

  // 2. PROCESSAMENTO EM CHUNKS (LOTES) ANTI-TRAVAMENTO
  const startImport = async () => {
    if (!user || parsedData.length === 0) return;
    setStatus('importing');

    const BATCH_SIZE = 50;
    const total = parsedData.length;
    let processed = 0;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batchToInsert = parsedData.slice(i, i + BATCH_SIZE);

      try {
        const { error } = await supabase
          .from('clients')
          .upsert(batchToInsert, { onConflict: 'whatsapp' });

        if (error) throw error;
      } catch (dbError: any) {
        console.error("Erro ao salvar lote no Supabase:", dbError);
        // Continua para o próximo lote para não travar a importação total
      }

      processed += batchToInsert.length;
      const percentage = Math.round((processed / total) * 100);
      
      setProgress({ current: Math.min(processed, total), total, percentage });

      // DELAY DE SEGURANÇA (Libera o loop de eventos para a UI não congelar)
      await new Promise(resolve => setTimeout(resolve, 15));
    }

    setStatus('done');
    console.log(`Importação Concluída: ${total} contatos processados.`);
    
    // ATUALIZA A LISTA IMEDIATAMENTE
    setTimeout(() => {
      onSuccess(); // Esta função chama o fetchClients() na tela de origem
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300">
        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
              <Database className="text-orange-500" size={24} />
              Importação Segura
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Colunas: Nome, Apelido, Telefone 1, Sexo</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X size={24} />
          </button>
        </header>

        <div className="p-8">
          {status === 'idle' && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-4 border-dashed border-slate-100 rounded-[40px] p-16 flex flex-col items-center justify-center cursor-pointer hover:border-orange-200 hover:bg-orange-50/30 transition-all group"
            >
              <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center text-orange-600 mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-orange-100">
                <Upload size={40} strokeWidth={3} />
              </div>
              <h3 className="text-lg font-black text-slate-700">Selecionar arquivo</h3>
              <p className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-tighter text-center leading-relaxed">
                Suporta .CSV ou .TXT<br/>Cabeçalhos esperados: Nome, Telefone 1...
              </p>
              <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.txt" onChange={handleFileSelection} />
            </div>
          )}

          {(status === 'parsing' || status === 'importing') && (
            <div className="py-12 flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <Loader2 className="animate-spin text-orange-500" size={56} strokeWidth={3} />
                <FileText className="absolute inset-0 m-auto text-orange-200" size={20} />
              </div>
              <div className="text-center w-full max-w-xs">
                <h3 className="text-lg font-black text-slate-800">
                  {status === 'parsing' ? 'Lendo e Mapeando...' : 'Enviando para o Banco...'}
                </h3>
                <div className="mt-4 w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div 
                        className="h-full bg-orange-500 transition-all duration-300" 
                        style={{ width: `${progress.percentage}%` }}
                    />
                </div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-3">
                  {progress.current} de {progress.total} registros
                </p>
              </div>
            </div>
          )}

          {status === 'ready' && (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 flex items-center gap-5">
                <div className="bg-emerald-500 text-white p-3 rounded-2xl shadow-lg">
                  <Table size={24} />
                </div>
                <div>
                  <p className="text-lg font-black text-emerald-900 leading-none">{progress.total} contatos lidos</p>
                  <p className="text-xs text-emerald-700 font-bold uppercase tracking-wider mt-1">Pronto para processar.</p>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setStatus('idle')} className="flex-1 py-4 rounded-2xl font-bold text-slate-400 hover:bg-slate-100">Trocar</button>
                <button 
                  onClick={startImport}
                  className="flex-[2] bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2"
                >
                  Iniciar Importação <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {status === 'done' && (
            <div className="py-12 text-center animate-in fade-in zoom-in-95">
              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-50">
                <Check size={48} strokeWidth={3} />
              </div>
              <h3 className="text-2xl font-black text-slate-800">Finalizado!</h3>
              <p className="text-slate-500 font-medium mt-2">Sua base de dados foi atualizada com sucesso.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-6">
              <div className="bg-rose-50 border border-rose-100 rounded-[32px] p-8 text-center">
                <AlertTriangle size={48} className="text-rose-500 mx-auto mb-4" />
                <h3 className="text-lg font-black text-rose-900">Erro na Importação</h3>
                <p className="text-sm text-rose-700 mt-2">{errorMsg}</p>
              </div>
              <button onClick={() => setStatus('idle')} className="w-full bg-slate-800 text-white py-4 rounded-2xl font-black">Tentar Novamente</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportClientsModal;
