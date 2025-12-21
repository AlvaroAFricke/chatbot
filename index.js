import express from "express";
import fetch from "node-fetch";

// =========================
// CONFIG (SOLO PARA TEST)
// =========================
const VERIFY_TOKEN = "verify_token_test";

// ⚠️ SOLO TEST – luego pasalos a env
const WHATSAPP_TOKEN = "EAASJRnGl1qwBQMAgpQFMKIxnnyjsP27dObg7YMcYatPNw990UI2ZAE4sAK5E1dWQruz5pL03FCAyN87ZBfZAC1sixSiW1VAHvkUQ5aoCAUefwO4PCrc3OeEm1ZB3c6Q7IhKsY7yOK8NMECnc6lVmQUAjPRucaVCP7xZCr9ZAlx7fxKxOgqPZCMxrxZCZBeDqr9mZC8SAZDZD";
const PHONE_NUMBER_ID = "861988820332499";
// =========================

const app = express();
app.use(express.json());

// =========================
// SESIONES EN MEMORIA
// =========================
const sessions = {};

// =========================
// HELPERS
// =========================
function normalizeArgentinaNumber(number) {
  // 549XXXXXXXXX → 54XXXXXXXXX
  if (number.startsWith("549")) {
    return "54" + number.slice(3);
  }
  return number;
}

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});


function getUserInput(message) {
  if (message.type === "text") return message.text.body.trim();
  if (message.type === "interactive") return message.interactive.button_reply.title;
  return "";
}

async function sendText(to, text) {
  const r = await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
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

  console.log("SEND TEXT:", await r.json());
}

async function sendButtons(to, text, buttons) {
  const r = await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
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

  console.log("SEND BUTTONS:", await r.json());
}

// =========================
// FLOW CONTROL
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
    "¡Hola! 👋\nSoy el asistente de BLA Food Group.\n\nContame, ¿para qué unidad de negocio querés presupuestar tu evento? 👇",
    ["Barras BLA", "Invernadero", "Uriburu"]
  );
}

async function endFlow(from) {
  const session = sessions[from];

  try {
    await sendEmail(session);
    console.log("Mail enviado correctamente! ✅");
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
    console.log("Webhook verificado");
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

  // 🚫 IGNORAR MENSAJES ENVIADOS POR EL BOT
  if (message.from === PHONE_NUMBER_ID || message.from_me) {
    return res.sendStatus(200);
  }

  const from = normalizeArgentinaNumber(message.from);
  const input = getUserInput(message);

  console.log(`Mensaje de ${from}: ${input}`);

  // 👉 Si no hay sesión, arrancamos
  if (!sessions[from]) {
    await startFlow(from);
    return res.sendStatus(200);
  }

  const session = sessions[from];

  // ---------------- PASO 1 ----------------
  if (session.step === 1) {
    const serviciosValidos = ["Barras BLA", "Invernadero", "Uriburu"];

    if (!serviciosValidos.includes(input)) {
      await sendButtons(from, "Por favor, elegí una opción válida 👇", serviciosValidos);
      return res.sendStatus(200);
    }

    session.servicio = input;
    session.step = 2;

    let mensaje = "";
    if (input === "Barras BLA") mensaje = "Perfecto. Te ayudo a cotizar una barra para tu evento. Empecemos 👇";
    if (input === "Invernadero") mensaje = "Te ayudo con eventos en Invernadero 🌿. Empecemos 👇";
    if (input === "Uriburu") mensaje = "🔥 Perfecto, querés info sobre Uriburu.";

    await sendText(from, mensaje);
    await sendButtons(from, "¿Qué tipo de evento querés organizar?", [
      "Social",
      "Corporativo",
      "Otro",
    ]);

    return res.sendStatus(200);
  }

  // ---------------- PASO 2 ----------------
  if (session.step === 2) {
    const tiposValidos = ["Social", "Corporativo", "Otro"];

    if (!tiposValidos.includes(input)) {
      await sendButtons(from, "Seleccioná una opción válida 👇", tiposValidos);
      return res.sendStatus(200);
    }

    session.tipo = input;
    session.step = 3;
    session.subStep = 0;

    await sendText(from, `Gracias por seleccionar un evento ${input.toLowerCase()}.`);
    await sendText(from, "¿Para qué fecha te interesa? 📅\n¿En qué horario te gustaría? ⏰😊");
    return res.sendStatus(200);
  }


  // ---------------- PASO 3 ----------------
if (session.step === 3) {

  // Preguntas base
  let questions = [
    { key: "fechaHorario", text: "¿Para qué fecha te interesa? 📅\n¿En qué horario te gustaría? ⏰😊" },
    { key: "personas", text: "¿Cuántas personas aproximadamente serían? 👥" },
  ];

  // 👉 SOLO para Barras BLA preguntamos ubicación
  if (session.servicio === "Barras BLA") {
    questions.push({
      key: "localizacion",
      text: "¿En qué lugar o zona sería? 📍🗺️",
    });
  }

  // Preguntas finales (comunes a todos)
  questions.push(
    { key: "nombre", text: "Para mandarte la propuesta personalizada dejanos tu nombre:" },
    { key: "correo", text: "Para ponernos en contacto dejanos tu correo:" }
  );

  const current = questions[session.subStep];
  session.datos[current.key] = input;
  session.subStep++;

if (session.subStep < questions.length) {
  await sendText(from, questions[session.subStep].text);
} else {
  await sendText(
    from,
    "¡Gracias por escribirnos! ✨\n\n" +
    "En unos minutos, un miembro de nuestro equipo te va a contactar para ayudarte con todos los detalles 😊\n\n" +
    "Mientras tanto, si querés conocer más sobre nuestras unidades de negocio, te invitamos a visitarnos en Instagram 👇\n\n" +
    "👉 BLA Food Group: https://www.instagram.com/blafoodgroup\n" +
    "👉 Barras BLA: https://www.instagram.com/barras.bla\n" +
    "👉 Invernadero: https://www.instagram.com/invernadero.bn\n" +
    "👉 Afrika Club: https://www.instagram.com/afrika.club.arg"
  );

  await endFlow(from);
}


  return res.sendStatus(200);
}
});

import nodemailer from "nodemailer";

function buildEmailHTML(session) {
  const {
    servicio,
    tipo,
    datos: {
      nombre,
      correo,
      fechaHorario,
      personas,
      localizacion,
    },
  } = session;

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="font-family: Arial, Helvetica, sans-serif; background-color:#f5f5f5; padding:20px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-collapse: collapse; border-radius:6px; overflow:hidden;">
        
        <tr>
          <td style="background-color:#111827; color:#ffffff; padding:20px; text-align:center;">
            <h2 style="margin:0;">BLA Food Group</h2>
          </td>
        </tr>

        <tr>
          <td style="padding:20px;">
            <p style="margin-bottom:20px; font-size:14px; color:#333;">
              Se ha recibido una nueva solicitud con la siguiente información:
            </p>

            <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse: collapse; font-size:14px;">
              <tr>
                <td style="border:1px solid #ddd; background:#f0f0f0;">Nombre</td>
                <td style="border:1px solid #ddd;">${nombre}</td>
              </tr>
              <tr>
                <td style="border:1px solid #ddd; background:#f0f0f0;">Correo</td>
                <td style="border:1px solid #ddd;">${correo}</td>
              </tr>
              <tr>
                <td style="border:1px solid #ddd; background:#f0f0f0;">Lugar</td>
                <td style="border:1px solid #ddd;">${servicio}</td>
              </tr>
              <tr>
                <td style="border:1px solid #ddd; background:#f0f0f0;">Tipo</td>
                <td style="border:1px solid #ddd;">${tipo}</td>
              </tr>
              <tr>
                <td style="border:1px solid #ddd; background:#f0f0f0;">Fecha</td>
                <td style="border:1px solid #ddd;">${fechaHorario}</td>
              </tr>
              <tr>
                <td style="border:1px solid #ddd; background:#f0f0f0;">Cantidad</td>
                <td style="border:1px solid #ddd;">${personas}</td>
              </tr>

              ${
                localizacion
                  ? `
              <tr>
                <td style="border:1px solid #ddd; background:#f0f0f0;">Localización</td>
                <td style="border:1px solid #ddd;">${localizacion}</td>
              </tr>`
                  : ""
              }
            </table>
          </td>
        </tr>

        <tr>
          <td style="background-color:#f9f9f9; padding:15px; text-align:center; font-size:12px; color:#666;">
            Este correo fue generado automáticamente por BLA Food Group.
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
`;
}

async function sendEmail(session) {
  const html = buildEmailHTML(session);
  //nzmq uwuk ddby xhtu

  const mailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "alviafricke@gmail.com",
    pass: "nzmq uwuk ddby xhtu", // 👈 APP PASSWORD
  },
    });

  await mailTransporter.sendMail({
    from: "alviafricke@gmail.com",
    to: "alviafricke@gmail.com",
    subject: `Nueva solicitud – ${session.servicio}`,
    html,
  });
}


// =========================
// SERVER
// =========================
app.listen(3000, () => {
  console.log("Bot escuchando en puerto 3000");
});
