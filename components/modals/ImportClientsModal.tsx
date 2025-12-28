
import React, { useState, useRef } from 'react';
import { X, Upload, FileText, CheckCircle, AlertTriangle, Loader2, Database, Table, Check } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

interface ImportClientsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ImportClientsModal: React.FC<ImportClientsModalProps> = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'ready' | 'importing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nameHints = ['nome', 'name', 'cliente', 'client', 'nome completo', 'full name'];
  const phoneHints = ['telefone', 'phone', 'celular', 'whatsapp', 'contato', 'mobile', 'tel'];

  const findColumn = (headers: string[], hints: string[]) => {
    return headers.find(h => hints.includes(h.toLowerCase().trim()));
  };

  const sanitizeData = (rawJson: any[]) => {
    if (rawJson.length === 0) return [];
    
    const headers = Object.keys(rawJson[0]);
    const nameCol = findColumn(headers, nameHints);
    const phoneCol = findColumn(headers, phoneHints);

    return rawJson
      .map(row => {
        const nome = (nameCol ? row[nameCol] : '').toString().trim() || 'Sem Nome';
        const whatsappRaw = (phoneCol ? row[phoneCol] : '').toString();
        const whatsapp = whatsappRaw.replace(/\D/g, ''); // Remove tudo que não é número

        return {
          nome,
          whatsapp,
          user_id: user?.id,
          consent: true,
          origem: 'Importação'
        };
      })
      .filter(client => client.whatsapp.length >= 8); // Filtra números muito curtos ou inválidos
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setStatus('parsing');
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const sanitized = sanitizeData(results.data);
          setParsedData(sanitized);
          setStatus(sanitized.length > 0 ? 'ready' : 'error');
          if (sanitized.length === 0) setErrorMsg('Nenhum dado válido encontrado no CSV.');
        },
        error: () => {
          setStatus('error');
          setErrorMsg('Falha ao processar arquivo CSV.');
        }
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          const sanitized = sanitizeData(data);
          setParsedData(sanitized);
          setStatus(sanitized.length > 0 ? 'ready' : 'error');
          if (sanitized.length === 0) setErrorMsg('Nenhum dado válido encontrado no Excel.');
        } catch (e) {
          setStatus('error');
          setErrorMsg('Falha ao ler arquivo Excel.');
        }
      };
      reader.readAsBinaryString(selectedFile);
    } else {
      setStatus('error');
      setErrorMsg('Formato de arquivo não suportado. Use CSV ou Excel.');
    }
  };

  const startImport = async () => {
    setStatus('importing');
    const CHUNK_SIZE = 500;
    const total = parsedData.length;
    let processed = 0;

    try {
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = parsedData.slice(i, i + CHUNK_SIZE);
        
        const { error } = await supabase
          .from('clients')
          .upsert(chunk, { 
            onConflict: 'whatsapp', // Assumindo que whatsapp é único por usuário ou global
            ignoreDuplicates: true 
          });

        if (error) throw error;
        
        processed += chunk.length;
        setProgress(Math.round((processed / total) * 100));
      }
      
      setStatus('done');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message || 'Erro durante a importação.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <Database className="text-orange-500" size={24} />
              Importar Clientes
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Suporte a CSV e Excel</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <X size={24} />
          </button>
        </header>

        <div className="p-8">
          {status === 'idle' && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-4 border-dashed border-slate-100 rounded-[32px] p-12 flex flex-col items-center justify-center cursor-pointer hover:border-orange-200 hover:bg-orange-50/30 transition-all group"
            >
              <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center text-orange-600 mb-6 group-hover:scale-110 transition-transform">
                <Upload size={40} />
              </div>
              <h3 className="text-lg font-black text-slate-700">Clique para selecionar</h3>
              <p className="text-sm text-slate-400 mt-2">ou arraste seu arquivo .csv, .xlsx ou .xls aqui</p>
              <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />
            </div>
          )}

          {(status === 'parsing' || status === 'importing') && (
            <div className="py-12 flex flex-col items-center justify-center space-y-6">
              <Loader2 className="animate-spin text-orange-500" size={48} />
              <div className="text-center">
                <h3 className="text-lg font-black text-slate-800">
                  {status === 'parsing' ? 'Lendo arquivo...' : 'Sincronizando com a nuvem...'}
                </h3>
                {status === 'importing' && (
                  <div className="mt-4 w-64 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                  </div>
                )}
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">{progress}% concluído</p>
              </div>
            </div>
          )}

          {status === 'ready' && (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-4">
                <div className="bg-emerald-500 text-white p-2 rounded-xl">
                  <Table size={20} />
                </div>
                <div>
                  <p className="text-sm font-black text-emerald-900">{parsedData.length} clientes identificados</p>
                  <p className="text-xs text-emerald-700 font-medium">Pronto para iniciar a sincronização.</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Pré-visualização dos dados</h4>
                <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-200/50 overflow-hidden">
                  {parsedData.slice(0, 5).map((client, idx) => (
                    <div key={idx} className="px-5 py-3 flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-700">{client.nome}</span>
                      <span className="text-xs font-mono text-slate-400">{client.whatsapp}</span>
                    </div>
                  ))}
                  {parsedData.length > 5 && (
                    <div className="px-5 py-2 bg-slate-100/50 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      + {parsedData.length - 5} registros adicionais
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setStatus('idle')}
                  className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all"
                >
                  Trocar Arquivo
                </button>
                <button 
                  onClick={startImport}
                  className="flex-[2] bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-orange-100 transition-all active:scale-95"
                >
                  Confirmar Importação
                </button>
              </div>
            </div>
          )}

          {status === 'done' && (
            <div className="py-12 text-center animate-in fade-in zoom-in-95">
              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-100">
                <Check size={48} strokeWidth={3} />
              </div>
              <h3 className="text-2xl font-black text-slate-800">Sucesso!</h3>
              <p className="text-slate-500 font-medium mt-2">Seus clientes foram importados e sincronizados.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-6">
              <div className="bg-rose-50 border border-rose-100 rounded-3xl p-8 text-center">
                <AlertTriangle size={48} className="text-rose-500 mx-auto mb-4" />
                <h3 className="text-lg font-black text-rose-900">Ops! Algo deu errado</h3>
                <p className="text-sm text-rose-700 mt-2 leading-relaxed">{errorMsg}</p>
              </div>
              <button 
                onClick={() => setStatus('idle')}
                className="w-full bg-slate-800 text-white py-4 rounded-2xl font-black hover:bg-slate-900 transition-all"
              >
                Tentar Novamente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportClientsModal;
