const fetchCommandPayments = async (id: string) => {
  try {
    // 1) Fonte preferencial: financial_transactions (é o que seu CommandDetailView já usa)
    const { data: txs, error: txErr } = await supabase
      .from('financial_transactions')
      .select('amount, net_value, tax_rate, installments, brand, payment_method, created_at, date, status, type')
      .eq('command_id', id)
      .eq('type', 'income')
      .neq('status', 'cancelado')
      .order('created_at', { ascending: true });

    if (txErr) throw txErr;

    if (txs && txs.length > 0) {
      return txs.map((t: any) => {
        const amount = Number(t.amount || 0);
        const net = Number(t.net_value ?? t.net_amount ?? t.net_amount ?? amount);
        const fee = Number((amount - net).toFixed(2));

        return {
          amount,
          net_amount: net,
          fee_amount: fee,
          method: (t.payment_method || 'misto'),
          brand: t.brand || null,
          installments: Number(t.installments || 1),
          created_at: t.created_at || t.date || null
        };
      });
    }

    // 2) Fallback: command_payments (se existir em algum caso)
    const { data: cps, error: cpErr } = await supabase
      .from('command_payments')
      .select('amount, method, fee_amount, net_amount, brand, installments, created_at')
      .eq('command_id', id)
      .order('created_at', { ascending: true });

    if (cpErr) throw cpErr;

    return cps || [];
  } catch (err) {
    console.error("Erro ao buscar pagamentos (FT/CP):", err);
    return [];
  }
};

useEffect(() => {
  const fetchFullCommand = async () => {
    if (!commandId) return;
    setLoading(true);
    try {
      const { data: fullData, error } = await supabase.rpc('get_command_full', {
        p_command_id: commandId
      });
      if (error) throw error;

      const result = Array.isArray(fullData) ? fullData[0] : fullData;
      setData(result);

      const payList = await fetchCommandPayments(commandId);
      setPayments(payList);
    } catch (err) {
      console.error("Erro ao carregar detalhe da comanda paga:", err);
      setData(null);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  fetchFullCommand();
}, [commandId]);
