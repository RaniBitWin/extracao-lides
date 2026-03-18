# Maps Sheets Collector

Base inicial de um aplicativo web para receber uma busca, preparar a coleta de estabelecimentos e enviar resultados para uma planilha do Google Sheets.

Nesta etapa, o projeto entrega:

- frontend em React + Vite com formulário completo
- backend em Fastify com rotas separadas por módulo
- validação de entrada com Zod
- logs claros no terminal
- tratamento centralizado de erros
- configuração por variáveis de ambiente
- modo local com coleta simulada para facilitar o bootstrap

## Estrutura

```text
backend/
frontend/
.env.example
package.json
README.md
```

## Pré-requisitos

- Node.js 20+
- npm 10+

## Instalação

```bash
npm run install:all
```

## Configuração

Copie `.env.example` para `.env` e ajuste os valores necessários.

Principais variáveis:

- `PORT`: porta do backend
- `FRONTEND_ORIGIN`: origem permitida para CORS
- `DEFAULT_MAX_RESULTS`: valor inicial sugerido no frontend
- `DEFAULT_SHEET_NAME`: nome padrão da aba
- `COLLECTION_MOCK_MODE`: quando `true`, a coleta roda com dados simulados
- `GOOGLE_MAPS_API_KEY`: chave para futura integração com Places API
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: service account do Google Sheets
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: chave privada da service account
- `GOOGLE_PROJECT_ID`: projeto Google Cloud
- `VITE_API_BASE_URL`: URL do backend consumida pelo frontend

## Execução local

Em um terminal:

```bash
npm run dev:backend
```

Em outro terminal:

```bash
npm run dev:frontend
```

Frontend:

- `http://localhost:5173`

Backend:

- `http://localhost:3001`

Healthcheck:

- `GET http://localhost:3001/health`

## Rotas disponíveis

### `POST /api/collection/start`

Inicia a coleta com validação de entrada.

Exemplo de payload:

```json
{
  "searchTerm": "restaurantes em Sao Jose SC",
  "maxResults": 10,
  "spreadsheetId": "planilha-id",
  "sheetName": "Leads"
}
```

### `POST /api/sheets/write`

Recebe os itens coletados e prepara a escrita na planilha.

Exemplo de payload:

```json
{
  "spreadsheetId": "planilha-id",
  "sheetName": "Leads",
  "rows": [
    {
      "placeId": "abc123",
      "name": "Restaurante Exemplo",
      "address": "Rua Central, 100 - Sao Jose/SC",
      "phone": "(48) 3333-4444"
    }
  ]
}
```

## Estado atual

Esta base esta pronta para rodar localmente e para evoluir as integracoes reais. A coleta e a escrita estao estruturadas em servicos independentes.

No momento:

- a coleta pode rodar em modo simulado para facilitar o desenvolvimento local
- a escrita em Sheets esta preparada por modulo e validacao, com ponto unico para ligar a API oficial

## Proximos passos

1. Implementar a integracao real com Places API (Text Search + Place Details).
2. Implementar a escrita real no Google Sheets usando `googleapis`.
3. Adicionar persistencia de execucoes, retries e deduplicacao entre rodadas.
