
import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, FileText, CheckCircle, AlertTriangle, Loader2, Database, Table, Check, Info } from 'lucide-react';
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
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dicionário de mapeamento inteligente
  const nameHints = ['nome', 'name', 'cliente', 'client', 'nome completo', 'full name', 'contato', 'usuario'];
  const phoneHints = ['telefone', 'phone', 'celular', 'whatsapp', 'contato', 'mobile', 'tel', 'fone', 'número', 'numero'];

  const findColumn = (headers: string[], hints: string[]) => {
    return headers.find(h => hints.includes(h.toLowerCase().trim()));
  };

  const sanitizeData = useCallback((rawJson: any[]) => {
    if (rawJson.length === 0) return [];
    
    // Identifica as colunas dinamicamente na primeira linha
    const headers = Object.keys(rawJson[0]);
    const nameCol = findColumn(headers, nameHints);
    const phoneCol = findColumn(headers, phoneHints);

    if (!phoneCol) {
        throw new Error("Não conseguimos identificar uma coluna de 'Telefone' ou 'WhatsApp' no seu arquivo.");
    }

    return rawJson
      .map(row => {
        const rawName = nameCol ? row[nameCol] : '';
        const nome = (rawName || '').toString().trim() || 'Sem Nome';
        
        const whatsappRaw = (phoneCol ? row[phoneCol] : '').toString();
        // Regex: Mantém apenas dígitos
        const whatsapp = whatsappRaw.replace(/\D/g, ''); 

        return {
          nome,
          whatsapp,
          user_id: user?.id,
          consent: true,
          origem: 'Importação Excel/CSV'
        };
      })
      // Filtra registros que não possuem um número mínimo de dígitos para ser um telefone (DDI+DDD+NUM ou DDD+NUM)
      .filter(client => client.whatsapp.length >= 8); 
  }, [user]);

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setStatus('parsing');
    setErrorMsg('');
    
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const sanitized = sanitizeData(results.data);
            setParsedData(sanitized);
            setStatus(sanitized.length > 0 ? 'ready' : 'error');
            if (sanitized.length === 0) setErrorMsg('Nenhum dado válido (com telefone) encontrado no CSV.');
          } catch (e: any) {
            setStatus('error');
            setErrorMsg(e.message);
          }
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
          if (sanitized.length === 0) setErrorMsg('Nenhum dado válido (com telefone) encontrado no Excel.');
        } catch (e: any) {
          setStatus('error');
          setErrorMsg(e.message || 'Falha ao ler arquivo Excel.');
        }
      };
      reader.readAsBinaryString(selectedFile);
    } else {
      setStatus('error');
      setErrorMsg('Formato de arquivo não suportado. Use .csv, .xlsx ou .xls.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const startImport = async () => {
    if (!user) return;
    setStatus('importing');
    setProgress(0);

    const CHUNK_SIZE = 500;
    const total = parsedData.length;
    let processed = 0;

    try {
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = parsedData.slice(i, i + CHUNK_SIZE);
        
        const { error } = await supabase
          .from('clients')
          .upsert(chunk, { 
            // Conflito baseado em telefone por usuário (Garante que o mesmo user não duplique, mas permite o mesmo cel em users diferentes se for o caso)
            onConflict: 'whatsapp', 
            ignoreDuplicates: true 
          });

        if (error) throw error;
        
        processed += chunk.length;
        setProgress(Math.round((processed / total) * 100));
      }
      
      setStatus('done');
      onSuccess();
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message || 'Erro durante a persistência dos dados.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[110] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                <Database size={24} />
              </div>
              Importar Base de Clientes
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Suporte: Excel (.xlsx, .xls) e CSV</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X size={24} />
          </button>
        </header>

        <div className="p-8">
          {status === 'idle' && (
            <div 
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-4 border-dashed rounded-[40px] p-16 flex flex-col items-center justify-center cursor-pointer transition-all group relative ${
                dragActive ? 'border-orange-400 bg-orange-50 scale-[0.99]' : 'border-slate-100 hover:border-orange-200 hover:bg-orange-50/30'
              }`}
            >
              <div className="w-24 h-24 bg-orange-100 rounded-[32px] flex items-center justify-center text-orange-600 mb-8 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-lg shadow-orange-100">
                <Upload size={48} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black text-slate-700">Arraste seu arquivo aqui</h3>
              <p className="text-sm text-slate-400 mt-2 font-medium">Ou clique para navegar nas pastas</p>
              
              <div className="mt-8 flex gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-slate-100 shadow-sm text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <FileText size={14} className="text-blue-500" /> .xlsx / .xls
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-slate-100 shadow-sm text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <Table size={14} className="text-emerald-500" /> .csv
                </div>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                onChange={handleFileUpload} 
              />
            </div>
          )}

          {(status === 'parsing' || status === 'importing') && (
            <div className="py-20 flex flex-col items-center justify-center space-y-8">
              <div className="relative">
                <Loader2 className="animate-spin text-orange-500" size={64} strokeWidth={3} />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Database size={20} className="text-orange-300" />
                </div>
              </div>
              <div className="text-center space-y-4">
                <h3 className="text-2xl font-black text-slate-800">
                  {status === 'parsing' ? 'Analisando Estrutura...' : 'Sincronizando Dados...'}
                </h3>
                {status === 'importing' && (
                  <div className="w-80 space-y-2">
                    <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200">
                        <div 
                            className="h-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-500 ease-out shadow-lg" 
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{progress}% Processado</p>
                  </div>
                )}
                <p className="text-sm text-slate-500 font-medium max-w-xs mx-auto">Aguarde um momento enquanto preparamos tudo.</p>
              </div>
            </div>
          )}

          {status === 'ready' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
              <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 flex items-center gap-5 shadow-sm">
                <div className="bg-emerald-500 text-white p-3 rounded-2xl shadow-lg shadow-emerald-100">
                  <CheckCircle size={28} />
                </div>
                <div>
                  <p className="text-lg font-black text-emerald-900 leading-none">{parsedData.length} Contatos Identificados</p>
                  <p className="text-xs text-emerald-700 font-bold uppercase tracking-wider mt-1 opacity-70">Estrutura de dados validada</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Exemplo dos dados (Primeiros 5)</h4>
                    <div className="flex items-center gap-1.5 text-blue-500 bg-blue-50 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                        <Info size={10} /> Mapeamento Automático
                    </div>
                </div>
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
                  {parsedData.slice(0, 5).map((client, idx) => (
                    <div key={idx} className="px-6 py-4 flex justify-between items-center group hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                            {client.nome.charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-slate-700">{client.nome}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-orange-500 bg-orange-50 px-3 py-1 rounded-full">{client.whatsapp}</span>
                    </div>
                  ))}
                  {parsedData.length > 5 && (
                    <div className="px-6 py-3 bg-slate-50/50 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                      + {parsedData.length - 5} registros adicionais ocultos no preview
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setStatus('idle')}
                  className="flex-1 py-5 rounded-2xl font-black text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all uppercase text-xs tracking-widest"
                >
                  Trocar Arquivo
                </button>
                <button 
                  onClick={startImport}
                  className="flex-[2] bg-orange-500 hover:bg-orange-600 text-white py-5 rounded-[24px] font-black shadow-2xl shadow-orange-200 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  Iniciar Importação <ArrowRight size={20} />
                </button>
              </div>
            </div>
          )}

          {status === 'done' && (
            <div className="py-20 text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="w-32 h-32 bg-emerald-100 text-emerald-600 rounded-[40px] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-50 rotate-3">
                <Check size={64} strokeWidth={3} />
              </div>
              <h3 className="text-3xl font-black text-slate-800">Tudo Pronto!</h3>
              <p className="text-slate-500 font-medium mt-3 text-lg">Seus clientes foram sincronizados com sucesso.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-8 animate-in shake duration-500">
              <div className="bg-rose-50 border border-rose-100 rounded-[40px] p-12 text-center shadow-sm">
                <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle size={40} />
                </div>
                <h3 className="text-xl font-black text-rose-900 leading-tight">Não conseguimos processar</h3>
                <p className="text-sm text-rose-700 mt-4 leading-relaxed font-medium">"{errorMsg}"</p>
                <div className="mt-6 p-4 bg-white/50 rounded-2xl text-left border border-rose-100">
                    <p className="text-[10px] font-black text-rose-800 uppercase mb-2">Dica BelaFlow:</p>
                    <p className="text-xs text-rose-600 leading-tight">Certifique-se de que o arquivo contém cabeçalhos como "Nome" e "Telefone" ou "WhatsApp".</p>
                </div>
              </div>
              <button 
                onClick={() => setStatus('idle')}
                className="w-full bg-slate-800 text-white py-5 rounded-3xl font-black hover:bg-slate-900 transition-all shadow-xl active:scale-95 uppercase text-xs tracking-widest"
              >
                Tentar Outro Arquivo
              </button>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .shake { animation: shake 0.4s ease-in-out 0s 2; }
      `}} />
    </div>
  );
};

export default ImportClientsModal;
const ArrowRight = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
);
