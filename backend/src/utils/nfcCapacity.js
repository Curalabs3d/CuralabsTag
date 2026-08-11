// -----------------------------------------------------------------------
// Cálculo de capacidade NDEF por modelo de tag NFC (NTAG21x).
//
// Um chaveiro NFC não guarda "texto solto": ele guarda uma mensagem NDEF,
// que tem overhead de estrutura (TLV + cabeçalho do registro) além do
// próprio conteúdo. Para registros do tipo URI, o padrão NDEF ainda permite
// "abreviar" prefixos comuns (https://, https://www., etc.) em 1 único byte,
// o que economiza bastante espaço em URLs normais.
//
// Os valores abaixo são os publicados pela NXP para memória de usuário;
// o "usableBytes" já desconta uma margem de segurança para overhead de
// TLV/lock bytes da página final, então é o número que deve ser mostrado
// ao usuário como "capacidade disponível para gravação".
// -----------------------------------------------------------------------

export const NFC_MODELS = {
  NTAG213: { label: 'NTAG213', totalBytes: 144, usableBytes: 137 },
  NTAG215: { label: 'NTAG215', totalBytes: 504, usableBytes: 496 },
  NTAG216: { label: 'NTAG216', totalBytes: 888, usableBytes: 872 },
  CUSTOM: { label: 'Personalizado', totalBytes: null, usableBytes: null },
};

// Overhead fixo de uma mensagem NDEF de 1 registro do tipo URI em tag Type 2:
// TLV (2) + cabeçalho do registro (1) + tamanho do tipo (1) + tamanho do
// payload (1) + tipo 'U' (1) + TLV terminador (1) = 7 bytes.
const NDEF_RECORD_OVERHEAD_BYTES = 7;

// Códigos de abreviação do padrão NDEF URI Record (economia de 1 byte por prefixo)
const URI_ABBREVIATIONS = [
  { prefix: 'https://www.', savedChars: 12 },
  { prefix: 'http://www.', savedChars: 11 },
  { prefix: 'https://', savedChars: 8 },
  { prefix: 'http://', savedChars: 7 },
];

// Retorna quantos bytes uma URL específica ocupa como registro NDEF único.
export function computeUrlNdefBytes(url) {
  if (!url) return 0;
  let remaining = url;
  for (const abbr of URI_ABBREVIATIONS) {
    if (url.startsWith(abbr.prefix)) {
      remaining = url.slice(abbr.prefix.length);
      break;
    }
  }
  // +1 byte para o código de abreviação do prefixo (sempre presente, mesmo sem abreviação -> 0x00)
  const payloadBytes = Buffer.byteLength(remaining, 'utf8') + 1;
  return payloadBytes + NDEF_RECORD_OVERHEAD_BYTES;
}

// Capacidade disponível (em bytes) para um dado modelo, considerando
// override manual de "Personalizado".
export function getModelCapacity(model, customCapacityBytes) {
  if (model === 'CUSTOM') {
    return Number.isFinite(customCapacityBytes) ? customCapacityBytes : 0;
  }
  return NFC_MODELS[model]?.usableBytes ?? NFC_MODELS.NTAG213.usableBytes;
}

// Valida se a gravação cabe no modelo escolhido.
// mode = 'HUB' (grava só a URL curta do hub) | 'DIRECT' (grava links reais escolhidos)
export function validateTagCapacity({
  model = 'NTAG213',
  customCapacityBytes = null,
  writeMode = 'HUB',
  hubUrl = null,
  links = {}, // { mainLink, sacLink, restrictedLink }
  selectedLinks = [], // subset de ['mainLink','sacLink','restrictedLink'] usado somente no modo DIRECT
}) {
  const capacityBytes = getModelCapacity(model, customCapacityBytes);

  if (writeMode === 'HUB') {
    const bytesUsed = computeUrlNdefBytes(hubUrl);
    return {
      writeMode,
      capacityBytes,
      bytesUsed,
      fits: bytesUsed <= capacityBytes,
      breakdown: [{ field: 'hubUrl', bytes: bytesUsed }],
    };
  }

  // Modo DIRECT: soma o custo de cada link efetivamente selecionado.
  // Cada link vira um registro NDEF próprio dentro da mesma mensagem,
  // então cada um paga o overhead de registro individualmente.
  const breakdown = selectedLinks
    .filter((key) => links[key])
    .map((key) => ({ field: key, bytes: computeUrlNdefBytes(links[key]) }));

  const bytesUsed = breakdown.reduce((sum, item) => sum + item.bytes, 0);

  return {
    writeMode,
    capacityBytes,
    bytesUsed,
    fits: bytesUsed <= capacityBytes,
    breakdown,
  };
}
