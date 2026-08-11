import * as XLSX from 'xlsx';

// Colunas esperadas na planilha (case-sensitive, conforme especificação):
// ID_TAG | Codigo_Item | Titulo_Item | Link_Principal | Link_SAC | Link_AreaRestrita | Foto_URL
// Colunas opcionais de capacidade NFC (se ausentes, assume NTAG213 + modo Hub):
// Modelo_NFC (NTAG213 | NTAG215 | NTAG216) | Modo_Gravacao (HUB | DIRETO)
const EXPECTED_COLUMNS = [
  'ID_TAG',
  'Codigo_Item',
  'Titulo_Item',
  'Link_Principal',
  'Link_SAC',
  'Link_AreaRestrita',
  'Foto_URL',
  'Modelo_NFC',
  'Modo_Gravacao',
];

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];

        // defval: '' garante que células vazias não quebrem o parsing
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rows.length === 0) {
          return reject(new Error('A planilha está vazia ou não possui dados na primeira aba.'));
        }

        const foundColumns = Object.keys(rows[0]);
        const missingRequired = !foundColumns.includes('ID_TAG');
        if (missingRequired) {
          return reject(new Error('A coluna obrigatória "ID_TAG" não foi encontrada. Verifique o cabeçalho da planilha.'));
        }

        resolve({ rows, sheetName: firstSheetName, columns: foundColumns });
      } catch (err) {
        reject(new Error('Não foi possível ler o arquivo. Verifique se é um .xlsx ou .csv válido.'));
      }
    };

    reader.onerror = () => reject(new Error('Falha ao carregar o arquivo.'));
    reader.readAsArrayBuffer(file);
  });
}

export function buildTemplateWorkbook() {
  const sample = [
    {
      ID_TAG: 'TAG-001',
      Codigo_Item: 'GIA-8901',
      Titulo_Item: 'Apartamento Edifício Aurora, 302',
      Link_Principal: 'https://giacomelliimoveis.com.br/imovel/8901',
      Link_SAC: 'https://giacomelliimoveis.com.br/sac',
      Link_AreaRestrita: 'https://giacomelliimoveis.com.br/area-restrita',
      Foto_URL: 'https://giacomelliimoveis.com.br/fotos/8901.jpg',
      Modelo_NFC: 'NTAG213',
      Modo_Gravacao: 'HUB',
    },
  ];
  const worksheet = XLSX.utils.json_to_sheet(sample, { header: EXPECTED_COLUMNS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tags NFC');
  return workbook;
}

export function downloadTemplate() {
  const workbook = buildTemplateWorkbook();
  XLSX.writeFile(workbook, 'modelo-importacao-nfc-hub.xlsx');
}

export { EXPECTED_COLUMNS };
