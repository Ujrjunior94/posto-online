import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";

import { GoogleGenAI, Type } from "@google/genai";

// Helper to instantiate Google OAuth2 client dynamically
function getOAuth2Client(req?: express.Request) {
  const protocol = req ? (req.headers["x-forwarded-proto"] || req.protocol || "http") : "http";
  const host = req ? (req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000") : "localhost:3000";
  const redirectUri = `${protocol}://${host}/api/auth/google/callback`;

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

// AI configuration
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const BACKUP_FILE = (process.env.FUNCTIONS_EMULATOR || process.env.FUNCTION_SIGNATURE_TYPE || process.env.FIREBASE_CONFIG || process.env.FUNCTION_TARGET)
  ? "/tmp/backups.json"
  : path.join(process.cwd(), "backups.json");

// Helper to read backup file safely
function readBackups() {
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const data = fs.readFileSync(BACKUP_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading backups file:", err);
  }
  return {};
}

// Helper to write backup file safely
function writeBackups(backups: any) {
  try {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backups, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing backups file:", err);
  }
}

export async function createExpressApp() {
  const app = express();

  // Middleware for parsing JSON with a 15mb limit to allow complete system backups
  app.use(express.json({ limit: "15mb" }));

  // Enable CORS manually or generic header configuration
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // --- API ROUTES ---

  // POST /api/gemini/import-schedule
  app.post("/api/gemini/import-schedule", async (req, res) => {
    try {
      const { image, mimeType, textContent } = req.body;

      if (!image && !textContent) {
        return res.status(400).json({ error: "Imagem, documento (PDF/Excel/CSV) ou conteúdo de texto é obrigatório." });
      }

      const prompt = `Analise o documento, imagem ou planilha da escala de trabalho / escala de plantão de um posto de combustíveis (frentistas, gerentes, caixa, lavadores).

      REGRA MANDATÓRIA CRÍTICA DE LEITURA DE MATRIZ COMPLETA (SEM LIMITES OU CORTE DE DIAS):
      - A imagem/documento da escala é uma matriz onde cada LINHA representa UM DIA DO MÊS (do Dia 01 até o último dia do mês, ex: Dia 31) e cada COLUNA representa UM FUNCIONÁRIO (ou vice-versa).
      - VOCÊ DEVE OBRIGATORIAMENTE PERCORRER TODAS AS LINHAS E COLUNAS DA TABELA ATÉ O FINAL DO MÊS (Dia 01, Dia 02, ..., Dia 31).
      - NUNCA INTERROMPA A LEITURA APÓS AS PRIMEIRAS LINHAS OU PRIMEIROS DIAS.
      - ALGORITMO: Para CADA dia do mês (ex: 31 dias) x Para CADA funcionário (ex: 11 funcionários) -> crie o registro correspondente em "schedules".
      - CÁLCULO DE REGISTROS ESPERADOS: Quantidade de Dias (ex: 31) x Quantidade de Funcionários (ex: 11) = Total de Registros (ex: 341 registros).
      - O JSON final DEVE conter um registro para CADA combinação de Funcionário + Data.

      Sua tarefa é extrair e retornar as informações estruturadas em JSON:
      1. Mês e Ano identificados na escala (mes: número 1-12, ex: 7, ano: número ex: 2026).
      2. Lista de funcionários (employees) com TODOS os nomes das colunas/linhas e detalhes estruturados (employeeDetails): nome completo, cargo (Frentista, Gerente, Supervisor, Lavador, Caixa).
      3. Lançamentos diários (schedules): MATRIZ COMPLETA DE TODOS OS DIAS DO MÊS E FUNCIONÁRIOS
         - data: YYYY-MM-DD (ex: 2026-07-01, 2026-07-02, ..., 2026-07-31)
         - turno: "Manhã (06h - 14h)", "Tarde (14h - 22h)", "Noite (22h - 06h)", "Horista (10h - 18h)", ou "Folga Geral"
         - frentistaResponsavel: Nome do Funcionário
         - status: "Trabalhando", "Folga", "Horista", "Férias", "Afastado", "Licença"
      4. Eventos e Treinamentos (events): Reuniões, inspeções, treinamentos ou auditorias com data, título, tipo e horário.
      5. Padrões Aprendidos (learnedPatterns): Identifique a lógica operacional por funcionário (tipoEscala: 6x1, 12x36, Fixo, etc.).
      6. Relatório de Validação (validationReport): warnings e errors.

      Regras de Padronização de Turnos:
      - T1, T2, Manhã, M, 1º Turno, 06-14h -> "Manhã (06h - 14h)"
      - T3, Tarde, T, 2º Turno, 14-22h -> "Tarde (14h - 22h)"
      - T4, Noite, N, 3º Turno, 22-06h -> "Noite (22h - 06h)"
      - Folga, F, Repouso, DSR, Folga Geral -> "Folga Geral"
      - Horista, Intermediário, H -> "Horista (10h - 18h)"

      Formato de Data: YYYY-MM-DD. Assuma ano e mês informados na folha ou corrente (2026-07).
      Nomes: Mantenha padronizados e limpos (Capitalized).

      Retorne APENAS o JSON conforme a estrutura do responseSchema.`;

      let contentsParts: any[] = [{ text: prompt }];

      if (image && mimeType) {
        contentsParts.push({ inlineData: { data: image, mimeType } });
      } else if (textContent) {
        contentsParts.push({ text: `Conteúdo de Texto / Planilha / CSV Enviado:\n\n${textContent}` });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: {
          parts: contentsParts
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mes: { type: Type.INTEGER },
              ano: { type: Type.INTEGER },
              employees: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              employeeDetails: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    cargo: { type: Type.STRING },
                    telefone: { type: Type.STRING }
                  },
                  required: ["name"]
                }
              },
              schedules: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    data: { type: Type.STRING },
                    turno: { type: Type.STRING },
                    frentistaResponsavel: { type: Type.STRING },
                    status: { type: Type.STRING }
                  },
                  required: ["data", "turno", "frentistaResponsavel"]
                }
              },
              events: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    data: { type: Type.STRING },
                    titulo: { type: Type.STRING },
                    tipo: { type: Type.STRING },
                    descricao: { type: Type.STRING },
                    horario: { type: Type.STRING }
                  },
                  required: ["data", "titulo", "tipo", "horario"]
                }
              },
              learnedPatterns: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    funcionario: { type: Type.STRING },
                    tipoEscala: { type: Type.STRING },
                    sequenciaTurnos: { type: Type.ARRAY, items: { type: Type.STRING } },
                    diasTurno: { type: Type.INTEGER },
                    diasFolga: { type: Type.INTEGER },
                    confiancaIA: { type: Type.INTEGER },
                    observacao: { type: Type.STRING }
                  },
                  required: ["funcionario", "tipoEscala", "confiancaIA"]
                }
              },
              validationReport: {
                type: Type.OBJECT,
                properties: {
                  warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
                  errors: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            },
            required: ["employees", "schedules", "events"]
          }
        }
      });

      const extractedData = JSON.parse(response.text || "{}");
      return res.json(extractedData);
    } catch (error: any) {
      console.error("Gemini Error:", error);
      return res.status(500).json({ error: "Erro ao processar imagem ou documento de escala com Gemini.", details: error.message });
    }
  });

  // GET /api/health - monitoring route
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      storage: fs.existsSync(BACKUP_FILE) ? "active" : "initialized",
    });
  });

  // GET /api/firebase-config - dynamic firebase configuration for popups
  app.get("/api/firebase-config", (req, res) => {
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, "utf-8");
        return res.json(JSON.parse(data));
      }
      return res.status(404).json({ error: "Configuração do Firebase não encontrada no servidor." });
    } catch (err: any) {
      return res.status(500).json({ error: "Erro ao carregar configuração do Firebase.", details: err.message });
    }
  });

  // GET /api/backup?cnpj=...
  app.get("/api/backup", (req, res) => {
    try {
      const cnpj = req.query.cnpj as string;
      if (!cnpj) {
        return res.status(400).json({ error: "CNPJ é obrigatório como parâmetro de busca." });
      }

      const backups = readBackups();
      const cleanCnpj = cnpj.replace(/\D/g, ""); // remove non-digits to normalize
      const entry = backups[cleanCnpj] || backups[cnpj]; // try clean first, fallback to raw

      if (!entry) {
        return res.status(404).json({ error: `Nenhum backup encontrado para o CNPJ ${cnpj}` });
      }

      return res.json(entry);
    } catch (error: any) {
      console.error("Error retrieving backup:", error);
      return res.status(500).json({ error: "Erro interno ao recuperar backup.", details: error.message });
    }
  });

  // POST /api/backup
  app.post("/api/backup", (req, res) => {
    try {
      const { cnpj, data, updated_at } = req.body;

      if (!cnpj) {
        return res.status(400).json({ error: "CNPJ é obrigatório no corpo da requisição." });
      }
      if (!data) {
        return res.status(400).json({ error: "Os dados ('data') de backup são obrigatórios." });
      }

      const backups = readBackups();
      const cleanCnpj = cnpj.replace(/\D/g, "");

      const backupEntry = {
        cnpj: cleanCnpj,
        data,
        updated_at: updated_at || new Date().toISOString(),
      };

      backups[cleanCnpj] = backupEntry;
      writeBackups(backups);

      console.log(`[Backup] Backup salvo com sucesso para o CNPJ: ${cleanCnpj} em ${backupEntry.updated_at}`);

      return res.json({
        success: true,
        message: "Backup salvo com sucesso no servidor.",
        cnpj: cleanCnpj,
        updated_at: backupEntry.updated_at,
      });
    } catch (error: any) {
      console.error("Error saving backup:", error);
      return res.status(500).json({ error: "Erro interno ao salvar backup.", details: error.message });
    }
  });

  // --- GOOGLE DRIVE OAUTH & BACKUP ROUTES ---

  // GET /api/auth/google - Inicia fluxo OAuth2 do Google
  app.get("/api/auth/google", (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(500).send("Credenciais OAuth do Google não configuradas no ambiente do servidor.");
    }
    const oauth2Client = getOAuth2Client(req);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/drive.file"],
      prompt: "consent",
    });
    res.redirect(authUrl);
  });

  // GET /api/auth/google/callback - Callback do fluxo OAuth2
  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        return res.status(400).send("Código de autorização não fornecido pelo Google.");
      }
      const oauth2Client = getOAuth2Client(req);
      const { tokens } = await oauth2Client.getToken(code);

      const htmlResponse = `
        <!DOCTYPE html>
        <html lang="pt-BR">
          <head>
            <meta charset="UTF-8">
            <title>Google Drive Conectado</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #0f172a; text-align: center; }
              .card { background: white; padding: 2.5rem; border-radius: 1.25rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); max-width: 420px; border: 1px solid #e2e8f0; }
              h2 { color: #16a34a; margin-top: 0; font-size: 20px; }
              p { font-size: 14px; color: #64748b; margin-bottom: 0; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>✓ Conectado ao Google Drive!</h2>
              <p>Autenticação realizada com sucesso. Esta janela fechará em breve...</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: "GOOGLE_DRIVE_AUTH_SUCCESS",
                  tokens: ${JSON.stringify(tokens)}
                }, "*");
                setTimeout(() => { window.close(); }, 1000);
              } else {
                window.location.href = "/?google_drive_connected=true";
              }
            </script>
          </body>
        </html>
      `;
      res.setHeader("Content-Type", "text/html");
      return res.status(200).send(htmlResponse);
    } catch (error: any) {
      console.error("Erro na callback do Google OAuth:", error);
      return res.status(500).send(`Erro na autenticação com Google Drive: ${error.message}`);
    }
  });

  // POST /api/drive/list-folders - Lista pastas disponíveis no Google Drive do usuário
  app.post("/api/drive/list-folders", async (req, res) => {
    try {
      const { tokens } = req.body;
      if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
        return res.status(401).json({ error: "Tokens do Google Drive ausentes." });
      }

      const oauth2Client = getOAuth2Client(req);
      oauth2Client.setCredentials(tokens);

      const drive = google.drive({ version: "v3", auth: oauth2Client });
      const response = await drive.files.list({
        q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: "files(id, name, webViewLink)",
        spaces: "drive",
        pageSize: 100,
        orderBy: "name",
      });

      return res.json({
        success: true,
        folders: response.data.files || [],
      });
    } catch (error: any) {
      console.error("Erro ao listar pastas do Google Drive:", error);
      return res.status(500).json({
        error: "Falha ao recuperar pastas do Google Drive.",
        details: error.message,
      });
    }
  });

  // POST /api/drive/create-folder - Cria uma nova pasta específica no Google Drive
  app.post("/api/drive/create-folder", async (req, res) => {
    try {
      const { tokens, folderName } = req.body;
      if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
        return res.status(401).json({ error: "Tokens do Google Drive ausentes." });
      }
      if (!folderName || !folderName.trim()) {
        return res.status(400).json({ error: "O nome da pasta é obrigatório." });
      }

      const oauth2Client = getOAuth2Client(req);
      oauth2Client.setCredentials(tokens);

      const drive = google.drive({ version: "v3", auth: oauth2Client });
      const folderMetadata = {
        name: folderName.trim(),
        mimeType: "application/vnd.google-apps.folder",
      };
      const createdFolder = await drive.files.create({
        requestBody: folderMetadata,
        fields: "id, name, webViewLink",
      });

      return res.json({
        success: true,
        folderId: createdFolder.data.id,
        folderName: createdFolder.data.name,
        webViewLink: createdFolder.data.webViewLink,
      });
    } catch (error: any) {
      console.error("Erro ao criar pasta no Google Drive:", error);
      return res.status(500).json({
        error: "Falha ao criar pasta no Google Drive.",
        details: error.message,
      });
    }
  });

  // POST /api/drive/upload-backup - Upload de arquivo JSON para pasta no Google Drive
  app.post("/api/drive/upload-backup", async (req, res) => {
    try {
      const { tokens, folderName = "Backups_MeuPosto", folderId: reqFolderId, cnpj = "posto_geral", backupData, filename } = req.body;

      if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
        return res.status(401).json({ error: "Tokens do Google Drive ausentes. Conecte sua conta do Google Drive nas configurações de backup." });
      }

      if (!backupData) {
        return res.status(400).json({ error: "Conteúdo do backup é obrigatório para envio." });
      }

      const oauth2Client = getOAuth2Client(req);
      oauth2Client.setCredentials(tokens);

      const drive = google.drive({ version: "v3", auth: oauth2Client });

      // 1. Localizar ou usar a pasta de backup especificada
      let folderId = reqFolderId;
      let targetFolderName = folderName;

      if (!folderId) {
        const cleanFolderName = (folderName || "Backups_MeuPosto").trim();
        const folderSearchRes = await drive.files.list({
          q: `name = '${cleanFolderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: "files(id, name, webViewLink)",
          spaces: "drive",
        });

        if (folderSearchRes.data.files && folderSearchRes.data.files.length > 0) {
          folderId = folderSearchRes.data.files[0].id!;
          targetFolderName = folderSearchRes.data.files[0].name!;
        } else {
          const folderMetadata = {
            name: cleanFolderName,
            mimeType: "application/vnd.google-apps.folder",
          };
          const createdFolder = await drive.files.create({
            requestBody: folderMetadata,
            fields: "id, name",
          });
          folderId = createdFolder.data.id!;
          targetFolderName = createdFolder.data.name!;
        }
      }

      // 2. Criar e fazer upload do arquivo JSON
      const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "_");
      const cleanCnpj = cnpj.replace(/\D/g, "") || "geral";
      const finalFilename = filename || `backup_posto_${cleanCnpj}_${dateStr}.json`;

      const fileMetadata = {
        name: finalFilename,
        parents: [folderId],
        description: `Backup do aplicativo Meu Posto (CNPJ: ${cnpj}) enviado em ${new Date().toLocaleString("pt-BR")}`,
      };

      const media = {
        mimeType: "application/json",
        body: typeof backupData === "string" ? backupData : JSON.stringify(backupData, null, 2),
      };

      const uploadedFile = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, name, webViewLink, createdTime, size",
      });

      console.log(`[Google Drive] Backup enviado com sucesso! File ID: ${uploadedFile.data.id}, Pasta: ${targetFolderName}`);

      return res.json({
        success: true,
        message: `Backup enviado para o Google Drive na pasta "${targetFolderName}" com sucesso!`,
        fileId: uploadedFile.data.id,
        fileName: uploadedFile.data.name,
        webViewLink: uploadedFile.data.webViewLink,
        folderId: folderId,
        folderName: targetFolderName,
        uploadedAt: uploadedFile.data.createdTime || new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Erro ao enviar backup para o Google Drive:", error);
      return res.status(500).json({
        error: "Falha ao enviar arquivo de backup para o Google Drive.",
        details: error.message,
      });
    }
  });

  return app;
}

export async function startServer() {
  const app = await createExpressApp();
  const PORT = 3000;

  // --- VITE DEVELOPMENT MIDDLEWARE OR PRODUCTION SERVING ---

  if (process.env.NODE_ENV !== "production") {
    console.log("Loading Vite in development mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static production build from /dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Meu Posto] Server running on http://0.0.0.0:${PORT}`);
  });
}

// Avoid starting the standalone server when imported inside a Firebase Function environment
const isFirebaseFunction = !!(
  process.env.FUNCTIONS_EMULATOR || 
  process.env.FUNCTION_SIGNATURE_TYPE || 
  process.env.FIREBASE_CONFIG ||
  process.env.FUNCTION_TARGET
);

if (!isFirebaseFunction) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
  });
}
