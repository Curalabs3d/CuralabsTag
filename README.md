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
# edite o .env e preencha DATABASE_URL com a connection string da role
# "app_backend" (Supabase → Settings → Database → Connection string,
# trocando o usuário/senha pelos da role app_backend)
npm install
npm run seed     # idempotente — cria Super Admin + tenant de exemplo se ainda não existirem
npm run dev       # http://localhost:4000
```

Credenciais já existentes no projeto Supabase (criadas durante a configuração inicial):
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

## Banco de dados: Supabase (Postgres + RLS)

O backend usa Postgres via [Supabase](https://supabase.com), com Row Level Security habilitado desde o schema inicial (não é uma migração posterior — já nasce assim).

**Projeto:** `chuaxrnuhllxbrgjzapg` (região `sa-east-1`/`us-east-2`, organização Curalabs3d's Org)

### Role dedicada (`app_backend`)

A connection string padrão do Supabase usa a role `postgres`, que é **superusuário e ignora RLS**. Criamos uma role separada, `app_backend`, sem privilégios de superusuário, com apenas `SELECT/INSERT/UPDATE/DELETE` nas 3 tabelas — é essa role que o backend deve usar (`DATABASE_URL` no `.env`, ver `.env.example`). Só assim as políticas de RLS são de fato aplicadas pelo banco, e não apenas pela lógica da aplicação.

### Como o isolamento funciona na prática

Cada requisição autenticada passa por `withTenantContext()` (`backend/src/db/index.js`), que abre uma transação e popula duas variáveis de sessão que as policies leem:

- `app.current_tenant_id` — o tenant do usuário logado (do JWT, nunca de um parâmetro do cliente)
- `app.current_role` — o papel do usuário (`TENANT_ADMIN`, `TENANT_USER`, `SUPER_ADMIN`)

Três contextos especiais existem para pontos onde ainda não sabemos o tenant no momento da consulta (todos só usados internamente pelo backend, nunca expostos a um cliente):
- `AUTH_LOOKUP` — login e resolução de token (não sabemos o tenant antes de consultar o usuário)
- `PUBLIC_LOOKUP` — a rota pública `/nfc/:tagId` (a tag pode ser de qualquer tenant)
- `SUPER_ADMIN` — acesso irrestrito, usado pelo painel master

**Testado e validado diretamente no banco:** com a role `app_backend` e contexto de um tenant específico, uma consulta sem filtro por `tenant_id` retornou apenas as tags daquele tenant (3 de 3), e uma tentativa simulando acesso a dados de outro tenant retornou **zero linhas** — confirmando que o RLS bloqueia mesmo se a aplicação esquecer de filtrar.

> **Nota de transparência:** essa validação foi feita executando SQL diretamente no projeto Supabase (via ferramenta de gerenciamento), simulando a role e o contexto de sessão exatos que o backend usa. O ambiente onde rodo comandos de terminal não tem acesso de rede ao Supabase (por restrição de firewall do próprio ambiente), então não dá pra subir o `server.js` aqui e testar via `curl` ponta a ponta contra o banco real. Recomendo rodar `npm run dev` localmente (ou já em produção) e testar os fluxos de login/tags uma vez, como checagem final.

### Exportar/importar o schema à mão (opcional)
Se quiser reaplicar ou revisar o schema, o SQL completo está documentado nas migrations aplicadas ao projeto (`initial_schema_multitenant`, `create_app_backend_role`, `fix_users_policy_for_login_lookup`, `add_public_lookup_context`) — acessíveis pelo painel do Supabase em Database → Migrations.

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

✅ Já feito — ver a seção "Banco de dados: Supabase (Postgres + RLS)" acima.

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
