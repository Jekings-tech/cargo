const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = `"TrackNova Express" <${process.env.FROM_EMAIL}>`;
const REPLY_TO = 'info@tracknovaexpress.com';
const TRACKING_PAGE = 'https://tracknovaexpress.com/track';

function buildEmailHtml({ name, role, shipment }) {
    const trackingId = shipment.trackingId;
    const origin = shipment.route.origin;
    const destination = shipment.route.destination;
    const shipmentType = shipment.shipmentInfo.shipmentType;
    const estimated = new Date(shipment.shipmentInfo.estimatedDelivery).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    const intro = role === 'shipper'
        ? `Your shipment has been successfully created and is now registered in our system.`
        : `A shipment has been created and is on its way to you.`;

    const roleLabel = role === 'shipper' ? 'Sender' : 'Recipient';

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f7f7f7; padding: 24px;">
      <div style="background: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e5e5e5;">
        <h1 style="color: #0a2540; margin: 0 0 8px 0; font-size: 22px;">TrackNova Express</h1>
        <p style="color: #666; margin: 0 0 24px 0; font-size: 14px;">Shipment Notification</p>

        <p style="color: #333; font-size: 15px; line-height: 1.6;">Hi ${name},</p>
        <p style="color: #333; font-size: 15px; line-height: 1.6;">${intro}</p>

        <div style="background: #f0f6ff; border-left: 4px solid #0a2540; padding: 16px; margin: 24px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">Your Tracking Number</p>
          <p style="margin: 0; color: #0a2540; font-size: 22px; font-weight: bold; letter-spacing: 1px;">${trackingId}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px 0; color: #666; font-size: 14px;">Role</td><td style="padding: 8px 0; color: #333; font-size: 14px; text-align: right;">${roleLabel}</td></tr>
          <tr><td style="padding: 8px 0; color: #666; font-size: 14px;">Type</td><td style="padding: 8px 0; color: #333; font-size: 14px; text-align: right;">${shipmentType}</td></tr>
          <tr><td style="padding: 8px 0; color: #666; font-size: 14px;">From</td><td style="padding: 8px 0; color: #333; font-size: 14px; text-align: right;">${origin}</td></tr>
          <tr><td style="padding: 8px 0; color: #666; font-size: 14px;">To</td><td style="padding: 8px 0; color: #333; font-size: 14px; text-align: right;">${destination}</td></tr>
          <tr><td style="padding: 8px 0; color: #666; font-size: 14px;">Estimated Delivery</td><td style="padding: 8px 0; color: #333; font-size: 14px; text-align: right;">${estimated}</td></tr>
        </table>

        <p style="color: #333; font-size: 15px; line-height: 1.6;">
          To track your shipment in real time, visit our tracking page and enter your tracking number:
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${TRACKING_PAGE}" style="background: #0a2540; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block;">Track Your Shipment</a>
        </div>

        <p style="color: #999; font-size: 12px; line-height: 1.5; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
          You are receiving this email because a shipment was registered with this address on TrackNova Express.<br>
          For inquiries, reply to this email or contact <a href="mailto:info@tracknovaexpress.com" style="color: #0a2540;">info@tracknovaexpress.com</a>.
        </p>
      </div>
    </div>
    `;
}

async function sendShipmentCreatedEmails(shipment) {
    const shipper = shipment.shipper;
    const recipient = shipment.recipient;

    const tasks = [];

    if (shipper?.email) {
        tasks.push(
            resend.emails.send({
                from: FROM,
                to: shipper.email,
                reply_to: REPLY_TO,
                subject: `Shipment Created — Tracking ID: ${shipment.trackingId}`,
                html: buildEmailHtml({ name: shipper.name, role: 'shipper', shipment })
            })
        );
    }

    if (recipient?.email) {
        tasks.push(
            resend.emails.send({
                from: FROM,
                to: recipient.email,
                reply_to: REPLY_TO,
                subject: `A Shipment Is On Its Way To You — Tracking ID: ${shipment.trackingId}`,
                html: buildEmailHtml({ name: recipient.name, role: 'recipient', shipment })
            })
        );
    }

    const results = await Promise.allSettled(tasks);

    results.forEach((r, i) => {
        if (r.status === 'rejected') {
            console.error(`Email ${i + 1} failed:`, r.reason?.message || r.reason);
        } else if (r.value?.error) {
            console.error(`Email ${i + 1} error:`, r.value.error.message);
        } else {
            console.log(`Email ${i + 1} sent:`, r.value?.data?.id);
        }
    });
}

module.exports = { sendShipmentCreatedEmails };