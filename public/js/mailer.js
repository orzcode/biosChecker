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
    html: `A new BIOS is available for your ASRock <strong>${user.mobo}</strong> motherboard. <p>You can download it from <a href="${models.biospage}">the official ASRock page here</a>.</p><br><p>Note: you are receiving this because you previously signed up to be notified of updates from the unofficial <a href="${projectLink}">ASRock Bios Notifier project page</a>.</p><br><p>You can unsubscribe at any time <a href="${unsubLink}">by clicking here<a> or by visiting the page and re-entering your email.</a></p><br>
    <p>Please note that this is an <strong>unofficial</strong> tool and not supported by ASRock. As with any such service, things can break, fail to update, or change at any time. Long-term reliability is not guaranteed.</p>`,
    headers: {
      "List-Unsubscribe": `${unsubLink}`,
    },
  });

  if (error) {
    return console.error({ error });
  }
  console.log("MAILER.JS: Email sent to ", user.id, " at ", new Date().toISOString());
  console.log({ data });
}

// Test function with hidden objects from .env
export async function testMail() {
  try {
    const mailTestUser = JSON.parse(process.env.MAIL_TEST_USER);
    const mailTestModel = JSON.parse(process.env.MAIL_TEST_MODEL);
    await mailer(mailTestUser, mailTestModel);
  } catch (err) {
    console.error("Error parsing test objects from .env", err);
  }
}