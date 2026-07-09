## Dafiti Command Center

Status page and SRE command center for Dafiti, built on **Next.js 15** with App Router, Prisma ORM, NextAuth and XLSX imports for closed incidents. The project ships both a public status experience and an authenticated admin workspace with dashboards, KPIs and audit trails.

---

### Stack Highlights

- **Frontend:** Next.js 15 (RSC + layouts), Tailwind CSS, shadcn/ui, Framer Motion, TanStack Query
- **Backend:** Next.js route handlers, Prisma ORM (PostgreSQL), Zod validation, Pino structured logging
- **Auth:** NextAuth (Credentials + optional Google OAuth2) with RBAC (ADMIN / USER)
- **Testing:** Vitest unit tests + Playwright E2E scaffold
- **Integrations:** XLSX importer (ExcelJS), Slack/Jira placeholders via Prisma models

---

### Project Structure

```
src/
 ├─ app/                     # App Router layouts & pages (public + admin + auth)
 ├─ components/              # UI primitives and feature widgets (status, incidents, auth)
 ├─ env/                     # Server-side environment validation (Zod)
 ├─ hooks/                   # Client hooks (toast)
 ├─ lib/                     # Logger, helpers, HTTP utilities, Prisma client
 ├─ providers/               # React Query & Session providers
 ├─ server/                  # Domain services (incidents, importer, audit)
 └─ types/                   # NextAuth typings, ts-reset

prisma/
 ├─ schema.prisma            # Data model + enums
 ├─ migrations/000_init      # Initial SQL migration generated from schema
 └─ seed.ts                  # Seed users, apps and sample incident

tests/                       # Vitest unit tests + stubs
e2e/                         # Playwright example spec
```

---

### Getting Started

#### 1. Prerequisites

- Node.js **>= 20**
- npm **>= 10** (or the package manager of your choice)
- PostgreSQL instance (local or remote)

#### 2. Install dependencies

```bash
npm install
```

#### 3. Environment variables

Create a `.env` file based on `.env.example` and adjust values (somente dados locais como porta, banco e NextAuth). Todos os tokens de integrações (Google, Slack, Jira, Instana) são configurados via painel Admin > Integrações e ficam armazenados no banco.

> ⚙️  Caso já tenha um serviço ocupando as portas padrão, os scripts procuram a primeira porta disponível a partir de `APP_PORT` (5000) e `POSTGRES_PORT` (5001). Ajuste esses valores no `.env` se quiser definir explicitamente.

#### 4. Prisma setup

Generate Prisma client & apply the initial migration:

```bash
npx prisma migrate deploy
npm run prisma:generate
```

Seed baseline data (admin/user accounts + apps + example incident):

```bash
npm run db:seed
```

#### 5. Run the app

```bash
npm run dev
```

Visit `http://localhost:5000` (ou a porta informada pelo script) para a página pública. O workspace admin fica em `/admin`.

> 🔐 As credenciais administrativas são fornecidas no onboarding interno. Gere usuários adicionais via CLI/Prisma seed somente em ambientes isolados.

O login via Google permanece opcional e pode ser ativado quando as credenciais reais estiverem disponíveis.
Quando habilitado, o primeiro acesso via Google cria automaticamente o usuário no Command Center com perfil `USER`; promova-o para `ADMIN` pelo painel se necessário.

##### Quick scripts

All-in-one helpers live under `scripts/`:

- `scripts/start-project.sh` – instala dependências, aplica correções automáticas de CVEs no ambiente local, exige `0 vulnerabilities`, sobe o Postgres via Docker Compose, executa Prisma (generate/migrate/seed) e inicia o servidor de desenvolvimento (porta padrão **5000**).
- `scripts/start-production.sh` – primeiro boot em servidores: sobe o Postgres, aguarda saúde, builda a imagem e inicia o app com auditoria de CVEs de produção sem alterar dependências em runtime (migrations inclusas via Docker).
- `scripts/restart-environment.sh` – fixa o commit alvo do deploy, recompila a stack dockerizada, aplica migrations e religa o app validando o container ao final.
- `scripts/caddy-setup.sh` – instala e configura o Caddy como reverse proxy com TLS/HSTS para `commandcenter.dafiti.ai`.

> Make them executable once: `chmod +x scripts/*.sh`

##### Production deploy via GitHub Actions + SSM

- O workflow `.github/workflows/deploy-ssm.yml` dispara em push para `main` e também permite `workflow_dispatch`.
- O job envia o `github.sha` para o host; quando a policy IAM permite leitura no SSM, ele também valida o managed node e acompanha o status final do `AWS-RunShellScript`.
- O script remoto executa `scripts/restart-environment.sh <sha>`, faz checkout em `detached HEAD` do commit exato e imprime o SHA ativo ao final do deploy.

---

### Scripts

| Command                | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| `npm run dev`          | Start Next.js in development mode                          |
| `npm run build`        | Create production build                                    |
| `npm run start`        | Run production server (com auditoria de CVEs de produção, sem mutar dependências no boot) |
| `npm run security:zero-vuln` | Aplica `npm audit fix` e falha se restar qualquer vulnerabilidade |
| `npm run security:check` | Somente valida vulnerabilidades; indicado para CI e produção |
| `npm run lint`         | ESLint (core-web-vitals rules)                             |
| `npm run format`       | Format codebase with Biome                                 |
| `npm run typecheck`    | TypeScript strict type checking                            |
| `npm run test:unit`    | Vitest unit suite (slugify + importer utilities)           |
| `npm run test:e2e`     | Playwright tests (requires dev server running separately)  |
| `npm run db:seed`      | Seed Prisma database                                       |
| `npm run prisma:migrate` | Deploy migrations (CI friendly)                          |
| `npm audit --production` | **Recomendado antes de builds**; verifica CVEs em deps     |
| `docker compose up -d` | Run production stack (app + Postgres) via containers       |

---

### Key Features

- **Public status hub**: Ongoing banner, Slack insights carousel, KPI cards, last-30-day heatline, and recent incidents list.
- **Incident detail**: Timeline with public/private entries, metadata (impact, scope, owner, links) and severity badges.
- **Admin dashboard**: KPIs, Slack insights, 24×7 heatmap, SLA snapshot and latest incidents table.
- **Incident management**: Filters (status/severity/search), Google-auth protected import dialog (XLSX) with detailed summary/errors and audit logging.
- **RBAC + SSO**: Login obrigatório (credenciais locais ou Google OAuth). Usuários criados via Google entram como `GUEST` (somente status page) e podem ser promovidos para `USER` ou `ADMIN` pelo painel.
- **Reports & audit trail**: SLA report per application with adjustable date range and append-only audit table.
- **Importer**: Smart column detection, severity normalization, multi-app expansion, downtime/SLA computation, and detailed JSON summary.
- **Command Center messages**: Webhook protegido por API key para publicar insights em tempo real no dashboard, com histórico paginado e expiração automática (3h) no card principal. Admins possuem uma seção dedicada para revisar, editar ou excluir mensagens.

---

### Testing

- **Vitest**: `npm run test:unit`
  - Uses `vite-tsconfig-paths` to honor `@/*` aliases.
  - Stubs `server-only` import and seeds mandatory env variables.

- **Playwright**: `npm run test:e2e`
  - Starts from `e2e/status-page.spec.ts`.
  - Ensure `npm run dev` runs in parallel before executing Playwright.

---

### Notes & Next Steps

- Integrations (Slack webhooks, Jira mirroring) have data structures ready via Prisma models; wire real adapters as needed.
- RBAC relies on Prisma `Role` enum. Extend `AdminNav` and route matchers if more granular permissions are introduced.
- Consider adding background jobs for scheduled SLA snapshots or Slack ingestion.
- Security headers, rate limiting and CSRF protection can be handled via middleware (e.g. `next-safe-middleware`, `@upstash/ratelimit`).
- As vulnerabilidades conhecidas no antigo parser SheetJS (`xlsx@0.18.5`) foram mitigadas em 23/mar/2026 com a migração para `exceljs`.

#### Security hardening checklist

- O Next.js já envia headers rígidos (`Content-Security-Policy`, `HSTS`, `X-Frame-Options`, etc.). Se estiver atrás de Caddy/Nginx, mantenha o TLS terminado ali e redirecione todo tráfego HTTP → HTTPS.
- Libere no firewall apenas os domínios necessários: `*.dafiti.ai`, `*.dafiti.com.br`, `*.dafiti.com.co`, `*.dafiti.io`, `*.gfg.ai`, `*.google.com`, `*.slack.com`, `*.jira.com` e `apm-dafiti.instana.io`. Para delegar novos serviços, replique esse padrão e reinicie o proxy.
- Banco de dados deve aceitar conexões apenas da própria instância (no compose ele vive em `localhost:5001`). Para ambientes externos, crie usuários dedicados e force TLS.
- Em produção, execute sempre `npm audit --production`, `npm run lint`, `npm run typecheck` e `npm run build` antes do deploy. Qualquer CVE sem correção deve ser descrito em “Notes & Next Steps”.
- Em desenvolvimento local, os mesmos arquivos `.env` funcionam sem proxy; basta rodar `npm run dev`. Headers e CSP continuam ativos, mas como o domínio é `http://localhost`, não há restrições adicionais.

### Command Center Messages API

1. Gere uma chave em **Admin → Integrações → Command Center Messages**. Cada geração exibe o token apenas uma vez; guarde-o com segurança.
2. Faça `POST https://commandcenter.dafiti.ai/api/messages` com o header `x-command-center-key: <sua-chave>` ou `Authorization: Bearer <chave>`.
3. Payload JSON mínimo:

   ```json
   {
     "summary": "Checkout recuperado após rollback",
     "source": "EXTERNAL:status-bot",
     "sentiment": "positivo",
     "tags": ["checkout", "status"],
     "raw": { "ticket": "INC-123" }
   }
   ```

4. As mensagens ficam visíveis no card “Atualizações do Command Center” por 3 horas e entram automaticamente no histórico (botão “Ver histórico”, paginado em blocos de 20 itens).
5. Para revisar, editar ou remover qualquer entrada, use **Admin → Mensagens** (apenas perfil ADMIN).

### Perfis de acesso

- `GUEST`: criado automaticamente no primeiro login via Google. Visualiza apenas a página principal (status) após autenticação.
- `USER`: além do status, pode operar incidentes e acessar o workspace (`/admin`).
- `ADMIN`: acesso completo, inclusive gestão de usuários, integrações e configurações.

Admins podem promover/demover perfis em **Admin → Usuários**.

---

### Troubleshooting

- **Prisma migration errors**: Ensure the `DATABASE_URL` points to an empty schema before running `migrate deploy`.
- **Google OAuth redirect mismatch**: Update `NEXTAUTH_URL` and allow the callback domain in the Google Cloud console.
- **XLSX import validation**: Errors per row are returned in the JSON response; check CLI/logs (`pino-pretty` enabled in development).

---

Happy shipping! 💫
