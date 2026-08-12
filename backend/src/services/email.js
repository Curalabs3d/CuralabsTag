import { Resend } from 'resend';

// Se RESEND_API_KEY não estiver configurada (ex: ambiente de desenvolvimento
// local sem conta criada ainda), os e-mails são apenas logados no console em
// vez de falhar a requisição inteira — evita travar o fluxo de "esqueci
// minha senha" por falta de configuração, mas deixa óbvio que nada foi
// realmente enviado.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_ADDRESS = process.env.EMAIL_FROM || 'CuraLabs3D <no-reply@curalabs3d.com.br>';

export async function sendPasswordResetEmail({ to, resetUrl, userName }) {
  const subject = 'Recuperação de senha — NFC Hub Manager';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1A1A1A;">CuraLabs<span style="color:#FF5C00;">3D</span></h2>
      <p>Olá, ${userName || ''}.</p>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta no NFC Hub Manager.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block; background:#FF5C00; color:#0A0A0A; font-weight:bold; text-decoration:none; padding:12px 20px; border-radius:8px;">
          Redefinir minha senha
        </a>
      </p>
      <p style="color:#666; font-size:13px;">Este link expira em 1 hora. Se você não solicitou essa alteração, pode ignorar este e-mail com segurança — sua senha atual continua válida.</p>
      <p style="color:#999; font-size:11px; margin-top:24px;">Tecnologia NFC por CuraLabs3D — Engenharia e Manufatura Aditiva 3D</p>
    </div>
  `;

  if (!resend) {
    console.warn(`[email] RESEND_API_KEY não configurada — e-mail de reset NÃO enviado. Link (uso interno/dev): ${resetUrl}`);
    return { sent: false };
  }

  try {
    await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
    return { sent: true };
  } catch (err) {
    console.error('[email] Falha ao enviar e-mail de recuperação de senha:', err);
    return { sent: false, error: err };
  }
}
