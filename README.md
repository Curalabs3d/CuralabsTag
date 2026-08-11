# NFC Hub Manager — CuraLabs3D

Sistema Multi-Tenant para gerenciamento de Perfis/Hubs de Links vinculados a
Chaveiros NFC corporativos. Desenvolvido para a CuraLabs3D (Engenharia e
Manufatura Aditiva 3D), com o caso de uso inicial do projeto **Giacomelli
Imóveis** (800 chaveiros NFC) e arquitetura pronta para expansão a novos
clientes (tenants).

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS + React Router + Lucide Icons + SheetJS (`xlsx`)
- **Backend:** Node.js + Express + SQLite (`better-sqlite3`) + JWT
- **Design:** Dark mode cibernético/industrial — fundo `#0A0A0A` / `#121212`, destaque laranja `#FF5C00`, tipografia Space Grotesk + Inter

## Estrutura do projeto

```
curalabs3d-nfc-hub/
├── backend/
│   ├── server.js               # entrypoint da API Express
│   ├── src/
│   │   ├── db/index.js         # schema SQLite (multi-tenant)
│   │   ├── db/seed.js          # popula Super Admin + tenant de exemplo
│   │   ├── middleware/auth.js  # JWT + controle de papéis (roles)
│   │   ├── middleware/tenant.js# isolamento por tenant_id
│   │   └── routes/             # auth, tenants, tags, public
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── pages/               # Login, Register, AdminPanel, Dashboard, NfcLanding
    │   ├── components/          # ExcelUploader, TagsTable, AppShell, StatusBadge, Logo
    │   ├── context/AuthContext.jsx
    │   ├── api/client.js
    │   └── utils/excelParser.js # parsing SheetJS
    ├── .htaccess                 # SPA rewrite para Hostinger
    └── .env.example
```

## Rodando localmente

### 1. Backend
```bash
cd backend
cp .env.example .env
npm install
npm run seed     # cria Super Admin + tenant "Giacomelli Imóveis" de exemplo
npm run dev       # http://localhost:4000
```

Credenciais criadas pelo seed:
- **Super Admin:** `admin@curalabs3d.com.br` / `CuraLabs3D#2025`
- **Tenant (Giacomelli):** `gestor@giacomelliimoveis.com.br` / `Giacomelli#2025`

### 2. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev        # http://localhost:5173
```

O Vite já está configurado com proxy de `/api` para `http://localhost:4000`
em desenvolvimento (`vite.config.js`).

## Fluxo de rotas

| Rota          | Descrição                                                        |
|---------------|--------------------------------------------------------------------|
| `/`           | Login                                                              |
| `/register`   | Solicitação de conta corporativa (status `PENDING_APPROVAL`)      |
| `/admin`      | Painel Super Admin — aprovação de tenants, visão geral            |
| `/dashboard`  | Painel do Tenant — upload de Excel, tabela de tags, exportação     |
| `/nfc/:tagId` | Landing pública acionada pela aproximação do chaveiro NFC          |

## Importação em massa (Excel/CSV)

Colunas esperadas na planilha (cabeçalho exato):

```
ID_TAG | Codigo_Item | Titulo_Item | Link_Principal | Link_SAC | Link_AreaRestrita | Foto_URL
```

O parsing acontece 100% no navegador via SheetJS
(`src/utils/excelParser.js`); o resultado (JSON) é enviado ao endpoint
`POST /api/tags/bulk-import`, que faz **upsert** (cria ou atualiza) por
`tag_id` dentro do tenant autenticado. Um botão "Baixar modelo" gera um
`.xlsx` de exemplo com as colunas corretas.

## Parametrização de capacidade por modelo de tag NFC

Cada tag NFC pode ser configurada individualmente com:

- **Modelo do chip:** `NTAG213` (137 bytes úteis), `NTAG215` (496 bytes), `NTAG216` (872 bytes) ou `CUSTOM` (capacidade manual em bytes).
- **Modo de gravação:**
  - **Hub** (padrão): o chip grava apenas a URL curta do hub (`/nfc/:tagId`). Praticamente nunca estoura, e os links de destino continuam editáveis pelo painel sem precisar regravar o chaveiro físico.
  - **Direto:** o chip grava o(s) link(s) de destino reais, escolhidos individualmente por checkbox (Principal / SAC / Área Restrita) — sem reservar espaço para os que não forem marcados.

O cálculo de bytes considera o overhead real de uma mensagem NDEF (TLV + cabeçalho de registro) e as abreviações de prefixo padrão do NDEF URI Record (`https://`, `https://www.` etc.). A mesma lógica existe em `backend/src/utils/nfcCapacity.js` (validação definitiva, que bloqueia o salvamento com erro 422 se não couber) e em `frontend/src/utils/nfcCapacity.js` (feedback instantâneo na UI via barra de capacidade).

Na importação em massa, linhas que excedem a capacidade do modelo escolhido **não travam o lote**: elas são importadas mesmo assim e aparecem como avisos no resultado, para ajuste posterior.

## Exportação de lote (gravação NFC Tools)

`GET /api/tags/export-batch` retorna um CSV `tag_id,url` com todas as tags
do tenant (ex: `TAG-001,https://nfc.curalabs3d.com.br/nfc/TAG-001`), pronto
para importar no app **NFC Tools** e gravar os 800 chaveiros em lote.

## Multi-tenancy e segurança

- Toda tabela de negócio (`nfc_tags`) carrega `tenant_id`.
- O middleware `resolveTenantScope` sempre usa o `tenant_id` do **token JWT**,
  nunca um valor vindo do cliente — impede que um usuário troque o
  `tenantId` na requisição para acessar dados de outra empresa.
- A rota pública `/api/public/nfc/:tagId` não exige autenticação, mas só
  retorna tags de tenants com status `ACTIVE`.

### Migrando para Supabase/Postgres com Row Level Security

O schema atual (SQLite) foi desenhado para ser 1:1 portável para Postgres:
1. Recrie as tabelas `tenants`, `users` e `nfc_tags` em Postgres (mesmos campos).
2. Habilite RLS em `nfc_tags` e `users`.
3. Crie uma política do tipo:
   ```sql
   CREATE POLICY tenant_isolation ON nfc_tags
   USING (tenant_id = current_setting('app.current_tenant_id')::text);
   ```
4. No backend, troque `better-sqlite3` pelo client do Supabase/`pg`, definindo
   `app.current_tenant_id` a cada requisição autenticada (a partir do JWT).

## Deploy na Hostinger

1. `cd frontend && npm run build` → gera `dist/`.
2. Envie o conteúdo de `dist/` (incluindo o `.htaccess` já presente na raiz
   do frontend) para o subdomínio `nfc.curalabs3d.com.br`.
3. O backend (Node/Express) deve rodar em um serviço Node da Hostinger (ou
   VPS separado); aponte `VITE_API_URL` do frontend para essa URL antes do
   build de produção.

## Próximos passos sugeridos

- Upload real de imagens (`Foto_URL`) via S3/Supabase Storage em vez de URL manual.
- Página de analytics por tag (histórico de scans, geolocalização aproximada).
- E-mail transacional na aprovação/rejeição de tenants.
- Testes automatizados (Vitest no frontend, Supertest no backend).
