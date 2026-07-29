import { onRequest } from "firebase-functions/v2/https";
import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import * as fs from "fs";

const app = express();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const BACKUP_FILE = "/tmp/backups.json";

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

function writeBackups(backups: any) {
  try {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backups, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing backups file:", err);
  }
}

app.use(express.json({ limit: "15mb" }));

// Enable CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

const router = express.Router();

// POST /api/gemini/import-schedule
router.post("/gemini/import-schedule", async (req, res) => {
  try {
    const { image, mimeType } = req.body;

    if (!image || !mimeType) {
      return res.status(400).json({ error: "Imagem e mimeType são obrigatórios." });
    }

    const prompt = `Analise a imagem da escala de trabalho de um posto de combustíveis.
    Sua tarefa é extrair três tipos de informações de forma estruturada:
    1. Lista única de funcionários (employees): Todos os nomes de pessoas físicas identificados na escala.
    2. Turnos de trabalho (schedules): Mapeamento de datas para turnos (Manhã, Tarde, Noite, etc.) e o nome do funcionário responsável.
    3. Eventos (events): Reuniões, manutenções, auditorias ou treinamentos com data, título, tipo e horário.

    Regras de Negócio:
    - Mapeamento de Turnos: Se encontrar códigos como T2, T3 ou T4, converta-os obrigatoriamente: T2 = Manhã, T3 = Tarde, T4 = Noite.
    - Formato de Data: YYYY-MM-DD. Use o ano corrente (2026) se não especificado.
    - Formato de Horário: HH:MM.
    - Nomes: Use o nome completo ou como aparece na imagem, padronizando para Capitalize.
    - Tipos de Evento Permitidos: Treinamento, Reunião, Manutenção, Auditoria, Outro.

    Retorne APENAS um JSON seguindo exatamente este esquema:
    {
      "employees": ["Nome Completo 1", "Nome Completo 2"],
      "schedules": [
        { "data": "YYYY-MM-DD", "turno": "Manhã", "frentistaResponsavel": "Nome do Funcionário" }
      ],
      "events": [
        { "data": "YYYY-MM-DD", "titulo": "Reunião Geral", "tipo": "Reunião", "horario": "09:00", "descricao": "Pauta da reunião" }
      ]
    }`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: image, mimeType } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            employees: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            schedules: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  data: { type: Type.STRING },
                  turno: { type: Type.STRING },
                  frentistaResponsavel: { type: Type.STRING }
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
    return res.status(500).json({ error: "Erro ao processar imagem com Gemini.", details: error.message });
  }
});

// GET /api/health
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    storage: "active",
    environment: "firebase-cloud-functions"
  });
});

// GET /api/backup
router.get("/backup", (req, res) => {
  try {
    const cnpj = req.query.cnpj as string;
    if (!cnpj) {
      return res.status(400).json({ error: "CNPJ é obrigatório como parâmetro de busca." });
    }

    const backups = readBackups();
    const cleanCnpj = cnpj.replace(/\D/g, "");
    const entry = backups[cleanCnpj] || backups[cnpj];

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
router.post("/backup", (req, res) => {
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

// Mount router under "/api" prefix
app.use("/api", router);

// Export Express app as a single HTTPS function named "api"
export const api = onRequest({
  cors: true,
  maxInstances: 10,
  memory: "256MiB",
}, app);
