import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

const projectLink = "https://www.asrockbioschecker.link/";

export async function mailer(userObject, modelsObject) {
  const user = userObject;
  const models = modelsObject;

  const unsubLink = `${projectLink}unsubscribe?email=${user.email}`;

  const { data, error } = await resend.emails.send({
    from: "ASRock Bios Checker <update@asrockbioschecker.link>",
    to: user.email,
    subject: "New BIOS Update Available",
    html: `<div style="background-color: #202020; color: whitesmoke; padding: 20px; font-family: Arial, sans-serif; line-height: 1.5;">
<h2 style="color: #6b9b1d; text-align: center;">ASRock BIOS Update Alert</h2>
<p>A new BIOS is available for your ASRock <strong>${user.mobo}</strong> motherboard.</p>
<p>You can download it from <a style="color: #6b9b1d; text-decoration: underline;" href="${models.biospage}"><strong>the official ASRock page here</strong></a>.</p>
<p><strong>Version:</strong> ${models.heldversion}</p>
<hr style="border: 1px solid #444;" />
<p style="font-size: 14px;"><em>Note:</em> You are receiving this because you previously signed up to be notified of updates from the unofficial <a style="color: #6b9b1d; text-decoration: underline;" href="${projectLink}"><strong>ASRock BIOS Checker project page</strong></a>.</p>
<p style="font-size: 14px;"><strong>💡Pro-tips for a successful bios update:</strong></p>
<ul>
<li>Ensure your USB drive is stable. Test in Windows by reading/writing to it - make sure it opens, reads, and writes without hanging.</li>
<li>Remember: all BIOS settings get reset to default upon updating. Note down any custom settings beforehand (fan curves, etc).</li>
<li>Never power-off during a BIOS update. If you&nbsp;<em>absolutely have to</em>&nbsp;(i.e. if it hangs for a <strong>really</strong> long time), try removing the USB instead.</li>
</ul>
<hr style="border: 1px solid #444;" />
  <p style="font-size: 12px; text-align: center;">This is an <strong>unofficial</strong> tool and not supported by ASRock. As with any such service, things can break, fail to update, or change at any time. Long-term reliability is not guaranteed.</p>
  <p style="font-size: 12px; text-align: center;">You can <a style="color: #ff5252; text-decoration: underline;" href="${unsubLink}"><strong>unsubscribe here</strong></a> at any time or visit the project page and re-enter your email to manually unsubscribe.</p>
</div>`,
    headers: {
      "List-Unsubscribe": unsubLink,
    },
  });

  if (error) {
    console.error("MAILER.JS Error:", error);
    return { error };
  }
  console.log(
    "MAILER.JS: Email sent to ",
    user.id,
    " at ",
    new Date().toISOString()
  );
  //console.log({ data });
}

export async function confirmationMail(userObject) {
  const user = userObject;

  const unsubLink = `${projectLink}unsubscribe?email=${user.email}`;
  const confirmLink = `${projectLink}confirm/${user.id}`;

  const { data, error } = await resend.emails.send({
    from: "ASRock Bios Checker <confirm@asrockbioschecker.link>",
    to: user.email,
    subject: "Confirm your email",
    html: `<div style="background-color: #202020; color: whitesmoke; padding: 20px; font-family: Arial, sans-serif; line-height: 1.5;">
      <h2 style="color: #6b9b1d; text-align: center;">ASRock BIOS Checker</h2>
        <p>
        You are receiving this because you signed up to be notified of BIOS updates from the unofficial 
        <a href="${projectLink}" style="color: #6b9b1d; text-decoration: underline;"><strong>ASRock BIOS Checker project page</strong></a>.
        </p>
        <p>
        <strong>You must confirm your email in order to proceed.</strong> Unverified emails will be removed within 48 hours.
        </p>
        <p><strong>Please note:</strong> checks are performed daily, but during large updates, your notification may be delayed by 24hr due to tier limits.</p>

      <hr style="border: 1px solid #444;">

      <p><a href="${confirmLink}" style="color: #6b9b1d; text-decoration: underline;">Confirm your email by clicking here✅</a></p>
      
      <hr style="border: 1px solid #444;">      
      <p style="font-size: 12px; text-align: center;">
        This is an unofficial tool and not supported by ASRock. 
        As with any such service, things can break, fail to update, or change at any time. 
        Long-term reliability is not guaranteed.
      </p>
        <p style="font-size: 12px; text-align: center;">
        You can <a href="${unsubLink}" style="color: #ff5252; text-decoration: underline;"><strong>unsubscribe here</strong></a> at any time 
        or simply ignore this email to be removed automatically within 48 hours.
      </p>
    </div>`,
    headers: {
      "List-Unsubscribe": unsubLink,
    },
  });

  if (error) {
    console.error("MAILER.JS Error:", error);
    return { error };
  }
  console.log(
    "MAILER.JS: Confirmation sent to ",
    user.id,
    " at ",
    new Date().toISOString()
  );
  //console.log({ data });
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
