// Espelha a lógica de backend/src/utils/nfcCapacity.js — usado para dar
// feedback instantâneo na UI (barra de capacidade) sem round-trip ao servidor.
// A validação definitiva (que impede salvar) sempre acontece no backend.

export const NFC_MODELS = {
  NTAG213: { label: 'NTAG213', totalBytes: 144, usableBytes: 137 },
  NTAG215: { label: 'NTAG215', totalBytes: 504, usableBytes: 496 },
  NTAG216: { label: 'NTAG216', totalBytes: 888, usableBytes: 872 },
  CUSTOM: { label: 'Personalizado', totalBytes: null, usableBytes: null },
};

const NDEF_RECORD_OVERHEAD_BYTES = 7;

const URI_ABBREVIATIONS = [
  { prefix: 'https://www.', savedChars: 12 },
  { prefix: 'http://www.', savedChars: 11 },
  { prefix: 'https://', savedChars: 8 },
  { prefix: 'http://', savedChars: 7 },
];

function utf8ByteLength(str) {
  return new TextEncoder().encode(str).length;
}

export function computeUrlNdefBytes(url) {
  if (!url) return 0;
  let remaining = url;
  for (const abbr of URI_ABBREVIATIONS) {
    if (url.startsWith(abbr.prefix)) {
      remaining = url.slice(abbr.prefix.length);
      break;
    }
  }
  const payloadBytes = utf8ByteLength(remaining) + 1;
  return payloadBytes + NDEF_RECORD_OVERHEAD_BYTES;
}

export function getModelCapacity(model, customCapacityBytes) {
  if (model === 'CUSTOM') {
    return Number.isFinite(customCapacityBytes) ? customCapacityBytes : 0;
  }
  return NFC_MODELS[model]?.usableBytes ?? NFC_MODELS.NTAG213.usableBytes;
}

export function validateTagCapacity({
  model = 'NTAG213',
  customCapacityBytes = null,
  writeMode = 'HUB',
  hubUrl = null,
  links = {},
  selectedLinks = [],
}) {
  const capacityBytes = getModelCapacity(model, customCapacityBytes);

  if (writeMode === 'HUB') {
    const bytesUsed = computeUrlNdefBytes(hubUrl);
    return {
      writeMode, capacityBytes, bytesUsed, fits: bytesUsed <= capacityBytes,
      breakdown: [{ field: 'hubUrl', bytes: bytesUsed }],
    };
  }

  const breakdown = selectedLinks
    .filter((key) => links[key])
    .map((key) => ({ field: key, bytes: computeUrlNdefBytes(links[key]) }));

  const bytesUsed = breakdown.reduce((sum, item) => sum + item.bytes, 0);

  return { writeMode, capacityBytes, bytesUsed, fits: bytesUsed <= capacityBytes, breakdown };
}
