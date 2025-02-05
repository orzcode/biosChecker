import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function mailer(userObject, modelsObject) {
  const user = userObject;
  const models = modelsObject;

  const projectLink = "https://asrockbioschecker.koyeb.app/";

  // <domain>/unsubscribe?email=test@test.com
  const unsubLink = `${projectLink}unsubscribe?email=${user.email}`;

  const { data, error } = await resend.emails.send({
    from: "ASRock Bios Notifier <onboarding@resend.dev>",
    to: user.email,
    subject: "New Bios Update Available",
    html: `<strong>A new BIOS is available for your ASRock ${user.mobo} motherboard.</strong> <p>You can download it from <a href="${models.biospage}">the official ASRock page here</a>.</p><br><p>Note: you are receiving this because you previously signed up to be notified of updates from the unofficial <a href="${projectLink}">ASRock Bios Notifier project page</a>.</p><br><p>You can unsubscribe at any time <a href="${unsubLink}">by clicking here!<a></p>`,
    headers: {
      "List-Unsubscribe": `${unsubLink}`,
    },
  });

  if (error) {
    return console.error({ error });
  }
  console.log("MAILER.JS:   Email sent to ", user.email);
  console.log({ data });
}
