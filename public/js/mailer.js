import { Resend } from "resend";

const resend = new Resend("test");

// <domain>/unsubscribe?email=test@test.com

const useremail = "user.email"

const biospageLink = "www.google.com";
const projectLink = "www.google.com";
const unsubLink = "www.google.com";

(async function () {
  const { data, error } = await resend.emails.send({
    from: "ASRock Bios Notifier <onboarding@resend.dev>",
    to: [`${useremail}`],
    subject: "New Bios Update Available",
    html: `<strong>A new BIOS is available for your ASRock motherboard.</strong> <p>You can download it from <a href="${biospageLink}">the official ASRock page here</a>.</p><br><p>Note: you are receiving this because you previously signed up to be notified of updates from the unofficial <a href="${projectLink}">ASRock Bios Notifier project page</a>.</p><br><p>You can unsubscribe at any time <a href="${unsubLink}">by clicking here!<a></p>`,
  });

  if (error) {
    return console.error({ error });
  }
  console.log({ data });
})();
