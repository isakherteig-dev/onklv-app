import nodemailer from 'nodemailer';

const smtpPass = process.env.SMTP_PASS ?? process.env.LOCAL_SMTP_PASS;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for andre porter
  auth: {
    user: process.env.SMTP_USER,
    pass: smtpPass
  }
});

function escHtml(tekst) {
  return String(tekst ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sender verifiseringskode på e-post til bruker.
 * @param {string} tilEpost - Mottakers e-postadresse
 * @param {string} kode - 6-sifret verifiseringskode
 */
export async function sendVerifiseringsEpost(tilEpost, kode) {
  const fra = process.env.SMTP_FROM || 'OLKV <noreply@olkv.no>';

  await transporter.sendMail({
    from: fra,
    to: tilEpost,
    subject: `Din verifiseringskode: ${kode}`,
    html: `
<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0F1923;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F1923;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#1a2535;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1B3A6B,#2A5298);padding:32px 40px;text-align:center;">
              <span style="font-size:2rem;font-weight:900;letter-spacing:-1px;">
                <span style="color:#fff;">OL</span><span style="color:#E74C3C;">KV</span>
              </span>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:0.8rem;letter-spacing:0.5px;">
                OPPLÆRINGSKONTORET I VESTLAND
              </p>
            </td>
          </tr>

          <!-- Innhold -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:1.5rem;font-weight:700;color:#fff;text-align:center;">
                ✉️ Bekreft e-posten din
              </p>
              <p style="margin:0 0 32px;color:rgba(255,255,255,0.6);font-size:0.9rem;text-align:center;line-height:1.6;">
                Skriv inn denne koden i appen for å aktivere kontoen din.
              </p>

              <!-- Kode-boks -->
              <div style="background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.12);border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:0.8rem;letter-spacing:1px;text-transform:uppercase;">Din kode</p>
                <span style="font-size:3rem;font-weight:900;letter-spacing:12px;color:#fff;font-family:monospace;">${kode}</span>
              </div>

              <p style="margin:0;color:rgba(255,255,255,0.45);font-size:0.82rem;text-align:center;line-height:1.6;">
                Koden utløper om <strong style="color:rgba(255,255,255,0.65);">15 minutter</strong>.<br>
                Hvis du ikke opprettet en konto hos OLKV, kan du se bort fra denne e-posten.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;color:rgba(255,255,255,0.25);font-size:0.75rem;">
                © 2026 OLKV · Opplæringskontoret i Vestland
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
    text: `Din verifiseringskode er: ${kode}\n\nKoden utløper om 15 minutter.\n\nOLKV — Opplæringskontoret i Vestland`
  });
}

export async function sendBekreftelsesEpost(tilEpost, laerlingNavn, laereplassTittel) {
  const fra = process.env.SMTP_FROM || 'OLKV <noreply@olkv.no>';
  if (!tilEpost) return;

  const tryggNavn = escHtml(laerlingNavn || 'der');
  const tryggTittel = escHtml(laereplassTittel || '');

  await transporter.sendMail({
    from: fra,
    to: tilEpost,
    subject: 'Søknaden din er mottatt',
    html: `
<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0F1923;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F1923;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#1a2535;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1B3A6B,#2A5298);padding:32px 40px;text-align:center;">
              <span style="font-size:2rem;font-weight:900;letter-spacing:-1px;">
                <span style="color:#fff;">OL</span><span style="color:#E74C3C;">KV</span>
              </span>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:0.8rem;letter-spacing:0.5px;">
                OPPLÆRINGSKONTORET I VESTLAND
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:1.5rem;font-weight:700;color:#fff;text-align:center;">
                Søknaden din er mottatt
              </p>
              <p style="margin:0 0 28px;color:rgba(255,255,255,0.6);font-size:0.92rem;text-align:center;line-height:1.6;">
                Hei ${tryggNavn}! Vi har mottatt søknaden din.
              </p>
              <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:24px 22px;margin-bottom:24px;">
                <p style="margin:0 0 10px;color:rgba(255,255,255,0.45);font-size:0.78rem;letter-spacing:1px;text-transform:uppercase;">Læreplass</p>
                <p style="margin:0 0 18px;color:#fff;font-size:1.15rem;font-weight:700;">${tryggTittel}</p>
                <p style="margin:0;color:rgba(255,255,255,0.82);font-size:0.96rem;line-height:1.7;">Søknaden din er nå til behandling. Du vil få beskjed når bedriften har sett på søknaden din.</p>
              </div>
              <p style="margin:0;color:rgba(255,255,255,0.48);font-size:0.82rem;text-align:center;line-height:1.6;">
                Du kan logge inn i OLKV for å følge med på søknaden din.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;color:rgba(255,255,255,0.25);font-size:0.75rem;">
                © 2026 OLKV · Opplæringskontoret i Vestland
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
    text: `Hei ${laerlingNavn || 'der'}!\n\nVi har mottatt søknaden din på "${laereplassTittel}". Søknaden er nå til behandling, og du vil få beskjed når bedriften har sett på den.\n\nOLKV — Opplæringskontoret i Vestland`
  });
}

export async function sendStatusEpost(tilEpost, laerlingNavn, laereplassTittel, nyStatus) {
  const fra = process.env.SMTP_FROM || 'OLKV <noreply@olkv.no>';
  const statusTekster = {
    godkjent: {
      emne: 'Søknaden din er godkjent',
      overskrift: 'Søknaden din er oppdatert',
      melding: `Gratulerer! Din søknad på ${laereplassTittel} er godkjent.`
    },
    avslatt: {
      emne: 'Søknaden din ble ikke innvilget',
      overskrift: 'Søknaden din er oppdatert',
      melding: `Din søknad på ${laereplassTittel} ble dessverre ikke innvilget denne gangen.`
    },
    under_behandling: {
      emne: 'Søknaden din er under behandling',
      overskrift: 'Søknaden din er oppdatert',
      melding: `Din søknad på ${laereplassTittel} er nå under behandling.`
    }
  };

  const statusData = statusTekster[nyStatus];
  if (!statusData || !tilEpost) return;

  const mottakerNavn = laerlingNavn || 'der';
  const tryggNavn = escHtml(mottakerNavn);
  const tryggTittel = escHtml(laereplassTittel);
  const tryggMelding = escHtml(statusData.melding);

  await transporter.sendMail({
    from: fra,
    to: tilEpost,
    subject: statusData.emne,
    html: `
<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0F1923;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F1923;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#1a2535;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1B3A6B,#2A5298);padding:32px 40px;text-align:center;">
              <span style="font-size:2rem;font-weight:900;letter-spacing:-1px;">
                <span style="color:#fff;">OL</span><span style="color:#E74C3C;">KV</span>
              </span>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:0.8rem;letter-spacing:0.5px;">
                OPPLÆRINGSKONTORET I VESTLAND
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:1.5rem;font-weight:700;color:#fff;text-align:center;">
                ${statusData.overskrift}
              </p>
              <p style="margin:0 0 28px;color:rgba(255,255,255,0.6);font-size:0.92rem;text-align:center;line-height:1.6;">
                Hei ${tryggNavn}! Her er en oppdatering om læreplassøknaden din.
              </p>
              <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:24px 22px;margin-bottom:24px;">
                <p style="margin:0 0 10px;color:rgba(255,255,255,0.45);font-size:0.78rem;letter-spacing:1px;text-transform:uppercase;">Læreplass</p>
                <p style="margin:0 0 18px;color:#fff;font-size:1.15rem;font-weight:700;">${tryggTittel}</p>
                <p style="margin:0;color:rgba(255,255,255,0.82);font-size:0.96rem;line-height:1.7;">${tryggMelding}</p>
              </div>
              <p style="margin:0;color:rgba(255,255,255,0.48);font-size:0.82rem;text-align:center;line-height:1.6;">
                Du kan logge inn i OLKV for å se søknaden din og eventuelle videre oppdateringer.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;color:rgba(255,255,255,0.25);font-size:0.75rem;">
                © 2026 OLKV · Opplæringskontoret i Vestland
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
    text: `Hei ${mottakerNavn}!\n\n${statusData.melding}\n\nDu kan logge inn i OLKV for å se søknaden din og eventuelle videre oppdateringer.\n\nOLKV — Opplæringskontoret i Vestland`
  });
}
