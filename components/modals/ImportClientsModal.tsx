import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Database, 
  Table, 
  Check, 
  AlertTriangle, 
  Loader2, 
  ArrowRight, 
  Sparkles, 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  Info,
  CheckCircle2
} from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useStudio } from '../../contexts/StudioContext';
import { 
  fixCorruptedText, 
  detectBufferEncoding, 
  sanitizeText, 
  validateName,
  EncodingAnalysis
} from '../../utils/encodingCorrection';
import { toast } from 'sonner';

interface ImportClientsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const BATCH_SIZE = 100;

const ImportClientsModal: React.FC<ImportClientsModalProps> = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const { activeStudioId } = useStudio();
  const [status, setStatus] = useState<'idle' | 'parsing' | 'ready' | 'importing' | 'done' | 'error'>('idle');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0, debugText: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [isFixing, setIsFixing] = useState(false);
  const [analysis, setAnalysis] = useState<EncodingAnalysis | null>(null);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFixRetroactive = async () => {
    if (!activeStudioId) {
      toast.error("Nenhum estúdio ativo selecionado.");
      return;
    }
    setIsFixing(true);
    try {
      // 1. Obter todos os clientes da unidade ativa
      const { data, error } = await supabase
        .from('clients')
        .select('id, nome, email, whatsapp')
        .eq('studio_id', activeStudioId);

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.info("Nenhum cliente cadastrado neste estúdio para correção.");
        return;
      }

      // Função matemática para detectar codificação corrompida
      const isCorrupted = (str: string | null | undefined): boolean => {
        if (!str) return false;
        return /[\uFFFD]|[\u00C3][\u0080-\u00BF]|Ã[¢£¡©­³º§ªº»¼½¾¿À-ÿ]/.test(str);
      };

      // 2. Filtrar clientes que possuem caractere corrompido
      const clientsToFix = data.filter(c => isCorrupted(c.nome) || isCorrupted(c.email));

      if (clientsToFix.length === 0) {
        toast.success("Nenhum contato corrompido foi detectado!");
        return;
      }

      let successCount = 0;
      const backupLogs: { id: number; nome_antigo: string; nome_novo: string; whatsapp: string }[] = [];

      // 3. Executar correção e atualizar no Supabase com log
      for (const client of clientsToFix) {
        const newNome = fixCorruptedText(client.nome || '');
        const newEmail = fixCorruptedText(client.email || '');

        if (newNome !== client.nome || newEmail !== client.email) {
          const { error: updateError } = await supabase
            .from('clients')
            .update({ 
              nome: newNome,
              email: newEmail 
            })
            .eq('id', client.id);

          if (!updateError) {
            successCount++;
            backupLogs.push({
              id: client.id,
              nome_antigo: client.nome || '',
              nome_novo: newNome,
              whatsapp: client.whatsapp || ''
            });
          }
        }
      }

      if (successCount > 0) {
        console.log("[CORREÇÃO ENCODING] Relatório de correção retroativa:", backupLogs);
        toast.success(`${successCount} contatos corrigidos com sucesso! Detalhes nos consoles do desenvolvedor.`);
        onSuccess();
      } else {
        toast.info("Os nomes dos contatos já estão corretos.");
      }
    } catch (e: any) {
      console.error("Erro na correção retroativa:", e);
      toast.error(`Erro ao corrigir: ${e.message || 'Falha técnica'}`);
    } finally {
      setIsFixing(false);
    }
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('parsing');

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);

        // Auto-detect encoding
        const detection = detectBufferEncoding(uint8Array);
        setAnalysis(detection);

        const logs = [...detection.logs];

        // Fallback inteligente
        const decoderToUse = detection.detectedEncoding === 'Windows-1252 (Latin1)' ? 'windows-1252' : 'utf-8';
        const textDecoder = new TextDecoder(decoderToUse);
        const text = textDecoder.decode(uint8Array);

        logs.push(`Decodificação executada usando o padrão ${decoderToUse.toUpperCase()}`);

        Papa.parse(text, {
          header: true,
          skipEmptyLines: 'greedy',
          complete: (results) => {
            const getVal = (row: any, ...keys: string[]) => {
                const rowKeys = Object.keys(row);
                for (const k of keys) {
                    const found = rowKeys.find(rk => rk.toLowerCase().trim() === k.toLowerCase());
                    if (found) return row[found];
                }
                return null;
            };

            let correctedCount = 0;
            let invalidCount = 0;

            const mapped = results.data.map((row: any) => {
               const nomeRaw = getVal(row, 'Nome', 'NOME', 'Client', 'Cliente', 'nome')?.toString() || '';
               const rawTel = getVal(row, 'Telefone 1', 'telefone 1', 'Telefone', 'WhatsApp', 'Celular', 'tel', 'phone');
               const emailRaw = getVal(row, 'E-mail', 'Email', 'email')?.toString() || '';
               const genero = getVal(row, 'Sexo', 'Gênero', 'Genero', 'Gender', 'sexo');
               const nascimento = getVal(row, 'Nascimento', 'Data', 'Birth', 'nascimento');

               const cleanedTel = rawTel ? rawTel.toString().replace(/\D/g, '') : '';

               // 1. Corrigir e higienizar Nome
               const correctedNome = fixCorruptedText(nomeRaw);
               const nameValidation = validateName(correctedNome);

               // 2. Corrigir E-mail
               const correctedEmail = emailRaw ? fixCorruptedText(emailRaw) : '';
               const sanitizedEmail = correctedEmail ? sanitizeText(correctedEmail) : null;

               const isCorrected = correctedNome !== nomeRaw || (emailRaw && correctedEmail !== emailRaw);
               if (isCorrected) {
                 correctedCount++;
               }

               const isValid = nameValidation.isValid && cleanedTel.length >= 8;
               if (!isValid) {
                 invalidCount++;
               }

               return {
                 originalNome: nomeRaw || '[Sem Nome]',
                 nome: nameValidation.sanitized,
                 originalEmail: emailRaw,
                 email: sanitizedEmail,
                 whatsapp: cleanedTel,
                 gender: genero?.toString().trim() || null,
                 birth_date: nascimento || null,
                 consent: true,
                 referral_source: 'Importação Excel',
                 isValid,
                 validationReason: nameValidation.isValid 
                   ? (cleanedTel.length >= 8 ? undefined : 'Telefone inválido ou incompleto') 
                   : nameValidation.reason,
                 hasBeenCorrected: isCorrected
               };
            });

            logs.push(`Mapeamento completo: ${mapped.length} contatos analisados.`);
            logs.push(`Contatos corrigidos de problemas de acentuação: ${correctedCount}.`);
            logs.push(`Contatos rejeitados por problemas ou dados inválidos: ${invalidCount}.`);

            if (mapped.length === 0) {
              setErrorMsg("O arquivo está em branco ou não possui registros correspondentes com as colunas Nome/Telefone.");
              setStatus('error');
              return;
            }

            setImportLogs(logs);
            setParsedData(mapped);
            
            const totalValid = mapped.filter((item: any) => item.isValid).length;
            setProgress({ 
              current: 0, 
              total: totalValid, 
              percentage: 0, 
              debugText: `Pronto para processar ${totalValid} contatos.` 
            });
            setStatus('ready');
          },
          error: (err) => {
            setErrorMsg("Falha na leitura do arquivo CSV: " + err.message);
            setStatus('error');
          }
        });
      } catch (err: any) {
        console.error("Erro no processamento do buffer:", err);
        setErrorMsg("Falha na leitura do codificador binário do arquivo: " + (err.message || err));
        setStatus('error');
      }
    };

    reader.onerror = (err) => {
      setErrorMsg("Erro do leitor físico do arquivo.");
      setStatus('error');
    };

    reader.readAsArrayBuffer(file);
  };

  const startImport = async () => {
    if (!user || parsedData.length === 0) {
        setErrorMsg("Não há dados válidos.");
        setStatus('error');
        return;
    }

    setStatus('importing');
    setErrorMsg('');

    const validData = parsedData.filter(item => item.isValid);
    if (validData.length === 0) {
      setErrorMsg("Todos os contatos foram rejeitados por estarem vazios ou com nomes/telefones falsos.");
      setStatus('error');
      return;
    }

    // --- DEDUPLICAÇÃO NO FRONTEND ---
    const deduplicatedData = Array.from(
        validData.reduce((map, item) => {
            map.set(item.whatsapp, item);
            return map;
        }, new Map<string, any>()).values()
    ).map(item => {
      return {
        nome: item.nome,
        whatsapp: item.whatsapp,
        email: item.email || null,
        gender: item.gender || null,
        birth_date: item.birth_date || null,
        consent: item.consent,
        referral_source: item.referral_source,
        studio_id: activeStudioId
      };
    });

    const total = deduplicatedData.length;
    let processed = 0;

    const chunks = [];
    for (let i = 0; i < deduplicatedData.length; i += BATCH_SIZE) {
        chunks.push(deduplicatedData.slice(i, i + BATCH_SIZE));
    }

    try {
        for (const [index, batch] of chunks.entries()) {
            const { error } = await supabase
                .from('clients')
                .upsert(batch, { 
                    onConflict: 'whatsapp',
                    ignoreDuplicates: false 
                });

            if (error) {
                throw new Error(`Falha no banco (Lote ${index + 1}): ${error.message}`);
            }

            processed += batch.length;
            const percentage = Math.round((processed / total) * 100);
            
            setProgress({ 
                current: processed, 
                total, 
                percentage, 
                debugText: `Sincronizando lote ${index + 1} de ${chunks.length}...` 
            });

            await new Promise(resolve => setTimeout(resolve, 50));
        }

        setStatus('done');
        setTimeout(() => {
            onSuccess();
            onClose();
        }, 2000);

    } catch (e: any) {
        setErrorMsg(e.message || "Erro desconhecido durante o salvamento no banco.");
        setStatus('error');
    }
  };

  const validCount = parsedData.filter(item => item.isValid).length;
  const invalidCount = parsedData.filter(item => !item.isValid).length;
  const correctedCount = parsedData.filter(item => item.hasBeenCorrected && item.isValid).length;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div className={`bg-white rounded-[40px] shadow-2xl w-full ${status === 'ready' ? 'max-w-4xl' : 'max-w-xl'} overflow-hidden transition-all duration-300 animate-in zoom-in-95`}>
        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
              <Database className="text-orange-500" size={24} />
              Importar Clientes
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Proteção Definitiva de Encoding UTF-8 (BELARE Secure)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X size={24} /></button>
        </header>

        <div className="p-8 max-h-[80vh] overflow-y-auto">
          {status === 'idle' && (
            <div className="space-y-6">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-4 border-dashed border-slate-100 rounded-[40px] p-16 flex flex-col items-center justify-center cursor-pointer hover:border-orange-200 hover:bg-orange-50/30 transition-all group"
              >
                <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center text-orange-600 mb-6 group-hover:scale-110 transition-transform shadow-lg">
                  <Upload size={40} strokeWidth={3} />
                </div>
                <h3 className="text-lg font-black text-slate-700">Escolher Planilha</h3>
                <p className="text-xs text-slate-400 mt-2 font-bold uppercase text-center text-ellipsis overflow-hidden">Arraste seu arquivo .CSV aqui</p>
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileSelection} />
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-[30px] p-5 flex flex-col sm:flex-row items-center gap-4 justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-500 text-white p-2.5 rounded-xl shadow-md flex-shrink-0">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-amber-900 uppercase tracking-tight">Correção Retroativa</h4>
                    <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Corrigir nomes com acentuação corrompida já cadastrados</p>
                  </div>
                </div>
                <button 
                  onClick={handleFixRetroactive} 
                  disabled={isFixing}
                  className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 flex-shrink-0"
                >
                  {isFixing ? <Loader2 className="animate-spin" size={14} /> : 'Corrigir Agora'}
                </button>
              </div>
            </div>
          )}

          {status === 'parsing' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="animate-spin text-orange-500" size={48} />
              <p className="text-sm font-black text-slate-600 uppercase tracking-widest">Analisando codificação original...</p>
            </div>
          )}

          {status === 'importing' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-6">
              <Loader2 className="animate-spin text-orange-500" size={56} strokeWidth={3} />
              <div className="text-center w-full max-w-xs">
                <h3 className="text-lg font-black text-slate-800">Sincronizando Banco</h3>
                <div className="mt-4 w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div 
                        className="h-full bg-orange-500 transition-all duration-300 shadow-[0_0_10px_rgba(249,115,22,0.5)]" 
                        style={{ width: `${progress.percentage}%` }}
                    />
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-4 uppercase tracking-widest">
                   {progress.current} de {progress.total} importados
                </p>
                <p className="text-[9px] text-orange-500 font-black mt-1 uppercase italic">{progress.debugText}</p>
              </div>
            </div>
          )}

          {status === 'ready' && (
            <div className="space-y-6">
              
              {/* Alerta de codificação */}
              {analysis && (
                <div className={`p-5 rounded-[26px] border flex gap-4 items-start ${
                  analysis.hasMojibake || analysis.detectedEncoding.startsWith('Windows-1252')
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}>
                  <div className={`p-2 rounded-xl text-white ${
                    analysis.hasMojibake || analysis.detectedEncoding.startsWith('Windows-1252') ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}>
                    {analysis.hasMojibake || analysis.detectedEncoding.startsWith('Windows-1252') ? <AlertTriangle size={20} /> : <Check size={20} />}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-wider leading-none">
                      Codificação Original: {analysis.detectedEncoding}
                    </p>
                    <p className="text-[10px] text-slate-600 font-bold leading-relaxed">
                      {analysis.hasMojibake 
                        ? 'Foram identificados acentos corrompidos por dupla codificação (Mojibake). O BELARE higienizou os registros de forma inteligente de modo a restaurar a acentuação saudável.'
                        : analysis.detectedEncoding.startsWith('Windows-1252')
                        ? 'O arquivo está em codificação legada Latin1. O BELARE converteu todos os caracteres automaticamente para UTF-8 puro.'
                        : 'Codificação limpa em UTF-8 puro detectada. Todos os caracteres acentuados estão garantidamente íntegros.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Métricas principais */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Total Carregado</p>
                  <p className="text-xl font-black text-slate-800 mt-1">{parsedData.length}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                  <p className="text-[9px] text-emerald-600 font-black uppercase tracking-wider">Válidos para Salvar</p>
                  <p className="text-xl font-black text-emerald-800 mt-1">{validCount}</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <p className="text-[9px] text-amber-600 font-black uppercase tracking-wider">Acentos Corrigidos</p>
                  <p className="text-xl font-black text-amber-800 mt-1">{correctedCount}</p>
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
                  <p className="text-[9px] text-rose-600 font-black uppercase tracking-wider">Ignorados / Erros</p>
                  <p className="text-xl font-black text-rose-800 mt-1">{invalidCount}</p>
                </div>
              </div>

              {/* Tabela de Preview */}
              <div>
                <h3 className="text-[11px] text-slate-500 font-black uppercase tracking-wider mb-2">Amostra dos Dados Sanitizados</h3>
                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm max-h-56 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase tracking-tight text-[10px] font-bold border-b border-slate-100">
                        <th className="py-2.5 px-4">Original</th>
                        <th className="py-2.5 px-4">Sanitizado / Corrigido (UTF-8)</th>
                        <th className="py-2.5 px-4">WhatsApp</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.slice(0, 5).map((item, index) => (
                        <tr key={index} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-400 truncate max-w-[150px]">{item.originalNome}</td>
                          <td className="py-3 px-4 font-bold text-slate-800 max-w-[200px] truncate">
                            <span className="flex items-center gap-1.5">
                              {item.nome}
                              {item.hasBeenCorrected && item.isValid && (
                                <span className="bg-emerald-100 text-emerald-700 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase flex items-center gap-0.5 shadow-sm">
                                  <Sparkles size={8} /> Corrigido
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500 font-semibold">{item.whatsapp || '[Vazio/Erro]'}</td>
                          <td className="py-3 px-4 text-center">
                            {item.isValid ? (
                              <span className="inline-block bg-emerald-500/10 text-emerald-700 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border border-emerald-500/20">
                                Válido
                              </span>
                            ) : (
                              <span className="inline-block bg-rose-500/10 text-rose-700 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border border-rose-500/20" title={item.validationReason}>
                                Bloqueado
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedData.length > 5 && (
                  <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase text-right leading-none">+ {parsedData.length - 5} registros adicionais na planilha</p>
                )}
              </div>

              {/* Logs do importador */}
              <div className="border border-slate-150 rounded-2xl bg-slate-50 overflow-hidden shadow-sm">
                <button 
                  onClick={() => setShowLogs(!showLogs)}
                  className="w-full flex justify-between items-center px-4 py-3 bg-slate-100/50 hover:bg-slate-100 text-xs font-black text-slate-700 uppercase tracking-widest transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Terminal size={14} className="text-slate-500" /> Logs detalhados do processamento
                  </span>
                  {showLogs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {showLogs && (
                  <div className="p-4 font-mono text-[10px] text-slate-600 bg-slate-900 text-emerald-400 border-t border-slate-200 overflow-y-auto max-h-40 leading-relaxed space-y-1">
                    {importLogs.map((log, index) => (
                      <div key={index} className="flex gap-2">
                        <span className="text-slate-500 select-none">[{index + 1}]</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botões de ação */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button 
                  onClick={() => { setStatus('idle'); setParsedData([]); }}
                  className="w-full sm:w-1/3 border-2 border-slate-200 text-slate-500 py-4 rounded-2xl font-black uppercase text-xs tracking-wider hover:bg-slate-50 transition-all text-center leading-none"
                >
                  Substituir Arquivo
                </button>
                <button 
                  onClick={startImport}
                  className="w-full sm:w-2/3 bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all active:scale-95 leading-none"
                >
                  Concluir e Gravar {validCount} Contatos <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {status === 'done' && (
            <div className="py-12 text-center animate-in fade-in zoom-in-95">
              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-50">
                <CheckCircle2 size={48} strokeWidth={3} />
              </div>
              <h3 className="text-2xl font-black text-slate-800">Pronto! Base Sincronizada</h3>
              <p className="text-slate-500 font-medium text-xs mt-2">Todos os {progress.total} registros únicos higienizados em UTF-8 estão no banco.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-6 animate-in shake duration-300">
              <div className="bg-rose-50 border-2 border-rose-100 rounded-[32px] p-8 text-center">
                <AlertTriangle size={48} className="text-rose-500 mx-auto mb-4" />
                <h3 className="text-lg font-black text-rose-900 uppercase">Falha de Integridade</h3>
                <div className="mt-4 bg-white p-4 rounded-2xl border border-rose-200 text-left">
                    <p className="text-xs font-mono text-rose-600 break-words leading-relaxed">{errorMsg}</p>
                </div>
              </div>
              <button 
                onClick={() => { setStatus('idle'); setErrorMsg(''); }} 
                className="w-full bg-slate-800 text-white py-4 rounded-2xl font-black hover:bg-slate-900 transition-all text-xs uppercase tracking-wider"
              >
                Tentar Outra Planilha
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportClientsModal;
