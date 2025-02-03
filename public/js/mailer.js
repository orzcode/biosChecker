import { Resend } from "resend";

const andj3 = j3;
const resend = new Resend("re_EoW1HEpe_HNC4zqjdGRXMWKYzQDshDZ");

export async function mailer(userObject, modelsObject) {
  const user = userObject;
  const models = modelsObject;

  const projectLink = "/";
  //change this to the actual project link

  // <domain>/unsubscribe?email=test@test.com
  const unsubLink = `${projectLink}/unsubscribe?email=${user.email}`;

  const { data, error } = await resend.emails.send({
    from: "ASRock Bios Notifier <onboarding@resend.dev>",
    to: user.email,
    subject: "New Bios Update Available",
    html: `<strong>A new BIOS is available for your ASRock ${user.mobo} motherboard.</strong> <p>You can download it from <a href="${models.biospage}">the official ASRock page here</a>.</p><br><p>Note: you are receiving this because you previously signed up to be notified of updates from the unofficial <a href="${projectLink}">ASRock Bios Notifier project page</a>.</p><br><p>You can unsubscribe at any time <a href="${unsubLink}">by clicking here!<a></p>`,
  });

  if (error) {
    return console.error({ error });
  }
  console.log({ data });
}
