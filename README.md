# Scanlee

Scanlee is a local-first document extraction tool for turning photographed documents into structured data using Ollama vision models. You define document types such as invoices or cheques, choose the fields you want to extract, upload one image or process documents in batches, and export the results to CSV or Excel.

The full workflow runs on your machine. Scanlee does not require internet access for document processing, document images stay local, extraction is handled by your local Ollama instance, and the app stores metadata and results in a local SQLite database. That keeps sensitive document data private and under your control.

## What It Does

- Create custom document types with the fields you want to capture
- Configure extraction for documents such as cheques, invoices, and similar business paperwork
- Upload a single image or process multiple documents in a batch
- Send document images to a locally running Ollama vision model
- Process documents without sending them to external cloud services
- Review extracted values before exporting
- Export processed data to CSV or XLSX

## How It Works

1. Create a document type and define the fields you want to extract.
2. Upload document images and assign them to that document type.
3. Run extraction through your configured Ollama model.
4. Review the parsed output.
5. Export the final structured data to CSV or Excel.

## Tech Stack

- Next.js App Router
- React
- SQLite via better-sqlite3
- Local filesystem storage for uploaded images
- Ollama for local AI extraction
- CSV and XLSX export support

## Ollama Configuration

Set the following values in your `.env` file:

```dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3.5:0.8b
```

- `OLLAMA_BASE_URL` points to your Ollama server
- `OLLAMA_MODEL` specifies the model Scanlee should use for extraction

Make sure Ollama is running and that the selected model is already available locally.

## Tested Models

This project has been tested with the following Ollama models:

- Gemma 4 E2B
- Gemma 4 E4B
- Gemma 4 26B MoE
- Qwen 3.5 0.8B
- Qwen 3.5 models up to the 35B MoE variant

Current observation: Gemma 4 E2B has produced the weakest extraction results so far.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Local Data

- `data/scanlee.sqlite` stores local app data and extracted results
- `data/uploads/` stores uploaded source images

The project is designed for local, self-hosted document processing with Ollama as the extraction backend.
