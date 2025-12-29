import nodemailer from "nodemailer";

// =========================
// BUILD EMAIL HTML
// =========================
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
                <td style="border:1px solid #ddd; background:#f0f0f0;">Unidad</td>
                <td style="border:1px solid #ddd;">${servicio}</td>
              </tr>
              <tr>
                <td style="border:1px solid #ddd; background:#f0f0f0;">Tipo de evento</td>
                <td style="border:1px solid #ddd;">${tipo}</td>
              </tr>
              <tr>
                <td style="border:1px solid #ddd; background:#f0f0f0;">Fecha / Horario</td>
                <td style="border:1px solid #ddd;">${fechaHorario}</td>
              </tr>
              <tr>
                <td style="border:1px solid #ddd; background:#f0f0f0;">Cantidad de personas</td>
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
            Correo generado automáticamente por BLA Food Group.
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
`;
}

// =========================
// SEND EMAIL
// =========================
export async function sendEmail(session) {
  const html = buildEmailHTML(session);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER || "alviafricke@gmail.com",
      pass: process.env.MAIL_PASS || "APP_PASSWORD_GMAIL",
    },
  });

  await transporter.sendMail({
    from: `"BLA Food Group" <${process.env.MAIL_USER || "alviafricke@gmail.com"}>`,
    to: "alviafricke@gmail.com",
    subject: `Nueva solicitud – ${session.servicio}`,
    html,
  });
}
