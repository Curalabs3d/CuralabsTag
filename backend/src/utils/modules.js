// Catálogo de módulos do sistema — cada chave aqui corresponde a uma
// funcionalidade que pode ou não estar incluída no plano de um tenant.
// Vive no código (não no banco) porque cada módulo é amarrado a uma rota
// específica do backend; o banco só guarda QUAIS módulos cada plano inclui.
export const MODULE_CATALOG = {
  tags_manual: { label: 'Cadastro manual de tags' },
  bulk_import: { label: 'Importação em massa (Excel/CSV)' },
  branding: { label: 'Marca da Empresa (cores, logo, mensagem)' },
  multi_user: { label: 'Múltiplos usuários por empresa' },
  batch_export: { label: 'Exportação de lote para gravação NFC' },
};

export const MODULE_KEYS = Object.keys(MODULE_CATALOG);
