# Scanlee

Scanlee is a Supabase-backed document extraction app for turning photographed business documents into structured data. It gives each account a private workspace for document types, uploads, review, and exports, while supporting both local Ollama models and remote API models such as Google AI Studio.

## What It Does

- Create reusable document types for invoices, cheques, and other structured paperwork
- Store accounts, document metadata, and uploaded files in Supabase
- Keep user-created templates private or share them as public read-only templates others can duplicate
- Run extraction against either a local Ollama model or a remote model configured through Google AI Studio
- Review extracted values before exporting
- Export processed data to CSV or XLSX

## How It Works

1. Create or duplicate a document type and define the fields you want to capture.
2. Upload document images into your account-scoped workspace.
3. Run extraction using your configured AI provider.
4. Review the parsed output and fix anything the model missed.
5. Export the final structured data to CSV or Excel.

## Tech Stack

- Next.js App Router
- React
- Supabase Auth, Postgres, and Storage
- Ollama for local model inference
- Google AI Studio for remote Gemini or Gemma-style model inference
- CSV and XLSX export support

## Supabase Setup

Create a local `.env` file with the core Supabase settings:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_STORAGE_BUCKET=scanlee-documents
```

- `NEXT_PUBLIC_SUPABASE_URL` is your Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the browser-safe key used for auth and RLS-protected requests.
- `NEXT_PUBLIC_SITE_URL` is the base URL used for auth redirects.
- `SUPABASE_SECRET_KEY` is the server-only key for privileged server operations.
- `SUPABASE_STORAGE_BUCKET` is the private bucket used for document uploads.

The app still accepts the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` names as fallbacks, but new setup should use the publishable and secret key names.

Apply the SQL in [supabase/migrations/202604140001_initial_multi_tenant.sql](supabase/migrations/202604140001_initial_multi_tenant.sql) to your Supabase project before using the authenticated workspace flow.

## AI Provider Setup

Scanlee is designed to work with both local and remote model backends. Configure the provider or providers you want to use in `.env`.

### Ollama

```dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gemma4:26b
```

- `OLLAMA_BASE_URL` is the base URL for your local or network-accessible Ollama instance.
- `OLLAMA_MODEL` is the model tag Scanlee should call for extraction.

### Google AI Studio

```dotenv
GEMINI_API_KEY=your-ai-studio-api-key
GEMINI_MODEL=gemini-2.5-flash
```

- `GEMINI_API_KEY` is the server-only API key created in Google AI Studio.
- `GEMINI_MODEL` is the remote model id Scanlee should use for extraction.

Keep model ids configurable through `.env` so you can switch between local Ollama models and remote Gemini or Gemma variants without code changes.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Notes

- Protected routes require valid Supabase environment variables and the applied SQL migration.
- Extraction quality varies by model, so validate at least one real document and one table-heavy document type when changing providers or model ids.
- The seeded starter templates include cheque and invoice, and additional templates can be shared by duplication without exposing a user's private workspace.
