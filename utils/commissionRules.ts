/**
 * Regras de comissão e atendimentos com 100% de desconto / parceiros.
 * 
 * DIRETRIZ DO NEGÓCIO:
 * Quando houver desconto de 100% em algum serviço de profissional que receba comissão
 * (ou quando o atendimento for de cliente parceira que paga a comissão diretamente à profissional,
 * como a cliente Juh ou Adrielle Alves, ou cortesia/permuta/desconto total),
 * o valor do atendimento para o estúdio é R$ 0,00 e NÃO deve ser contabilizado
 * pagamento/comissão para o colaborador por parte do estúdio para esse atendimento.
 */

export const isPartnerClientName = (name?: string | null): boolean => {
  if (!name) return false;
  const n = String(name).trim().toLowerCase();
  if (n === '') return false;

  // Juh (ex: "Juh", "Juh Parceira", "Juh Silva")
  if (
    n === 'juh' ||
    n.startsWith('juh ') ||
    n.endsWith(' juh') ||
    n.includes(' juh ')
  ) {
    return true;
  }

  // Adrielle Alves especificamente (exige ambos adrielle E alves, jamais apenas 'alves' isolado!)
  if (n.includes('adrielle') && n.includes('alves')) {
    return true;
  }

  // Nomes com indicativo de parceiro
  if (n.includes('parceir') || n.includes('parceria')) {
    return true;
  }

  return false;
};

export const isPartnerOr100Discount = (itemOrAppt: any): boolean => {
  if (!itemOrAppt) return false;

  // 1. Extração do nome do cliente
  const clientName = String(
    itemOrAppt.client_name ||
    itemOrAppt.client?.nome ||
    itemOrAppt.client?.name ||
    itemOrAppt.client_nome ||
    itemOrAppt.cliente ||
    itemOrAppt.commands?.client_name ||
    itemOrAppt.commands?.client?.nome ||
    ''
  ).trim();

  if (isPartnerClientName(clientName)) {
    return true;
  }

  // 2. Tags do cliente ou do registro
  const clientTags = Array.isArray(itemOrAppt.client?.tags)
    ? itemOrAppt.client.tags
    : (typeof itemOrAppt.client?.tags === 'string' ? [itemOrAppt.client.tags] : []);
  
  if (clientTags.some((t: any) => {
    const st = String(t).toLowerCase();
    return st.includes('parceir') || st.includes('100%');
  })) {
    return true;
  }

  // 3. Observações do cliente
  const clientNotes = String(itemOrAppt.client?.notes || itemOrAppt.client?.observacoes || '').toLowerCase();
  if (clientNotes.includes('parceir') || clientNotes.includes('100%')) {
    return true;
  }

  // 4. Valor nominal zero explícito (atendimento aberto/zerado com 100% de desconto)
  if (
    itemOrAppt.value === 0 || itemOrAppt.price === 0 || itemOrAppt.amount === 0 || itemOrAppt.total === 0 ||
    itemOrAppt.value === '0' || itemOrAppt.price === '0' || itemOrAppt.amount === '0' || itemOrAppt.total === '0' ||
    itemOrAppt.value === 0.00 || itemOrAppt.price === 0.00
  ) {
    return true;
  }

  // 5. Flags de desconto 100% ou métodos de pagamento de cortesia/parceria/direto
  const paymentMethod = String(
    itemOrAppt.payment_method ||
    itemOrAppt.command?.payment_method ||
    itemOrAppt.commands?.payment_method ||
    ''
  ).toLowerCase();

  if (
    itemOrAppt.discount_percent === 100 ||
    itemOrAppt.discount === 100 ||
    itemOrAppt.discount_rule?.value === 100 ||
    itemOrAppt.command?.discount_percent === 100 ||
    itemOrAppt.command?.discount === 100 ||
    itemOrAppt.commands?.discount_percent === 100 ||
    itemOrAppt.commands?.discount === 100 ||
    itemOrAppt.is_partner_100 === true ||
    itemOrAppt.is_partner === true ||
    paymentMethod === 'parceiro_100' ||
    paymentMethod === 'parceiro' ||
    paymentMethod === 'parceria' ||
    paymentMethod === 'direto_profissional' ||
    paymentMethod === 'desconto_total' ||
    paymentMethod === 'cortesia' ||
    paymentMethod === 'permuta' ||
    paymentMethod.includes('parceir') ||
    paymentMethod.includes('cortesia') ||
    paymentMethod.includes('direto')
  ) {
    return true;
  }

  // 6. Observações do agendamento / comanda
  const notes = String(
    itemOrAppt.notes ||
    itemOrAppt.notas ||
    itemOrAppt.observacoes ||
    itemOrAppt.command?.notes ||
    itemOrAppt.commands?.notes ||
    ''
  ).toLowerCase();

  if (
    notes.includes('100%') ||
    notes.includes('cortesia') ||
    notes.includes('parceir') ||
    notes.includes('permuta') ||
    notes.includes('gratis') ||
    notes.includes('grátis') ||
    notes.includes('direto') ||
    notes.includes('desconto total') ||
    notes.includes('zera')
  ) {
    return true;
  }

  return false;
};

/**
 * Retorna o valor efetivo que o estúdio recebeu do atendimento/serviço.
 * Se for parceira ou desconto 100%, retorna 0.
 */
export const getEffectiveAppointmentValue = (a: any, servicesList: any[] = []): number => {
  if (!a) return 0;
  if (isPartnerOr100Discount(a)) return 0;

  if (typeof a.value === 'number' && !isNaN(a.value)) {
    return Math.max(0, a.value);
  }
  if (typeof a.value === 'string' && a.value.trim() !== '') {
    const val = parseFloat(a.value);
    if (!isNaN(val)) return Math.max(0, val);
  }

  if (typeof a.price === 'number' && !isNaN(a.price)) {
    return Math.max(0, a.price);
  }
  if (typeof a.price === 'string' && a.price.trim() !== '') {
    const val = parseFloat(a.price);
    if (!isNaN(val)) return Math.max(0, val);
  }

  if (a.total_amount !== undefined && a.total_amount !== null) {
    const val = Number(a.total_amount);
    if (!isNaN(val)) return Math.max(0, val);
  }

  if (Array.isArray(a.services) && a.services.length > 0) {
    const sum = a.services.reduce((acc: number, s: any) => acc + (Number(s.price || s.preco || 0)), 0);
    if (sum > 0) return sum;
  }

  if (servicesList.length > 0) {
    // Busca por id ou nome
    const sId = a.service_id || a.service?.id;
    if (sId) {
      const match = servicesList.find((s: any) => String(s.id) === String(sId));
      if (match && match.preco) return Number(match.preco);
    }
    const sName = a.service_name || a.service?.name;
    if (sName) {
      const match = servicesList.find((s: any) => String(s.nome).toLowerCase() === String(sName).toLowerCase());
      if (match && match.preco) return Number(match.preco);
    }
  }

  return 0;
};
