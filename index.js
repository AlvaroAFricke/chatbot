import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import { sendEmail } from "./mailer.js";

// =========================
// CONFIG
// =========================
const VERIFY_TOKEN = "verify_token_test";
const WHATSAPP_TOKEN = "BLA Food GroupEAAVvoXFK0T8BQdjkvzKFoKsZC31h2tCOVCrwEn5WQbmLZB56YPUMlgZBKZBld55lz2ZAeghbnXA366z5PFT5rKXFRsjGey1FFIsSUE3R9pmmvGi14zgqvCWRVzpvmd8fyCH75NthDZB6bISHbey2M8hizMK7e4X7xiiyF8FmfZCv7ZCK75fwjmniFxZByFwnBpEWgvgZDZD";
const PHONE_NUMBER_ID = "861988820332499";

const app = express();
app.use(express.json());

// =========================
// PATH SETUP
// =========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================
// SERVE INDEX.HTML
// =========================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// =========================
// SESIONES
// =========================
const sessions = {};

// =========================
// HELPERS
// =========================
function normalizeArgentinaNumber(number) {
  if (number.startsWith("549")) return "54" + number.slice(3);
  return number;
}

function getUserInput(message) {
  if (message.type === "text") return message.text.body.trim();
  if (message.type === "interactive")
    return message.interactive.button_reply.title;
  return "";
}

async function sendText(to, text) {
  await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      text: { body: text },
    }),
  });
}

async function sendButtons(to, text, buttons) {
  await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text },
        action: {
          buttons: buttons.map((b) => ({
            type: "reply",
            reply: { id: b, title: b },
          })),
        },
      },
    }),
  });
}

// =========================
// FLOW
// =========================
async function startFlow(from) {
  sessions[from] = {
    step: 1,
    servicio: null,
    tipo: null,
    subStep: 0,
    datos: {},
  };

  await sendButtons(
    from,
    "¡Hola! 👋\nSoy el asistente de BLA Food Group.\n\n¿Para qué unidad de negocio querés presupuestar?",
    ["Barras BLA", "Invernadero", "Uriburu"]
  );
}

async function endFlow(from) {
  const session = sessions[from];

  try {
    await sendEmail(session);
    console.log("📧 Mail enviado correctamente");
  } catch (err) {
    console.error("❌ Error enviando mail:", err);
  }

  delete sessions[from];
}

// =========================
// WEBHOOK VERIFY
// =========================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// =========================
// WEBHOOK MENSAJES
// =========================
app.post("/webhook", async (req, res) => {
  const value = req.body.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  if (message.from === PHONE_NUMBER_ID || message.from_me) {
    return res.sendStatus(200);
  }

  const from = normalizeArgentinaNumber(message.from);
  const input = getUserInput(message);

  if (!sessions[from]) {
    await startFlow(from);
    return res.sendStatus(200);
  }

  const session = sessions[from];

  if (session.step === 1) {
    session.servicio = input;
    session.step = 2;
    await sendButtons(from, "¿Qué tipo de evento?", [
      "Social",
      "Corporativo",
      "Otro",
    ]);
    return res.sendStatus(200);
  }

  if (session.step === 2) {
    session.tipo = input;
    session.step = 3;
    session.subStep = 0;
    await sendText(from, "¿Fecha y horario del evento?");
    return res.sendStatus(200);
  }

  if (session.step === 3) {
    const questions = [
      { key: "fechaHorario", text: "¿Fecha y horario?" },
      { key: "personas", text: "¿Cantidad de personas?" },
      ...(session.servicio === "Barras BLA"
        ? [{ key: "localizacion", text: "¿Ubicación?" }]
        : []),
      { key: "nombre", text: "¿Tu nombre?" },
      { key: "correo", text: "¿Tu correo?" },
    ];

    const q = questions[session.subStep];
    session.datos[q.key] = input;
    session.subStep++;

    if (session.subStep < questions.length) {
      await sendText(from, questions[session.subStep].text);
    } else {
      await sendText(from, "¡Gracias! Un miembro del equipo te va a contactar 🙌");
      await endFlow(from);
    }

    return res.sendStatus(200);
  }
});

// =========================
// SERVER
// =========================
app.listen(3000, () => {
  console.log("Bot escuchando en puerto 3000");
});
