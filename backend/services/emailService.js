const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendLowStockAlert = async (item) => {
  if (!process.env.EMAIL_ENABLED || process.env.EMAIL_ENABLED === 'false') return;

  const mailOptions = {
    from: `"Charitap Admin" <${process.env.SMTP_USER}>`,
    to: process.env.WELLSPRING_ALERT_EMAILS || process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'hnimonkar@gmail.com',
    subject: `Low Stock Alert: ${item.itemName}`,
    text: `The inventory for "${item.itemName}" in program "${item.destinationProgram}" is low.\n\nCurrent Quantity: ${item.currentQuantity}\nThreshold: ${item.lowStockThreshold}\n\nPlease restock soon.`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #e67e22;">Low Stock Alert</h2>
        <p>The inventory for <strong>${item.itemName}</strong> is running low.</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Program:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.destinationProgram}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Current Quantity:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.currentQuantity} ${item.unit}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Threshold:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.lowStockThreshold}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; font-size: 12px; color: #7f8c8d;">This is an automated alert from Charitap Admin Console.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Low stock alert sent for ${item.itemName}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`[Email] Failed to send low stock alert for ${item.itemName}:`, error.message);
  }
};

module.exports = {
  sendLowStockAlert,
};
