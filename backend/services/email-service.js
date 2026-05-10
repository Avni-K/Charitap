const nodemailer = require('nodemailer');

/**
 * Email Service for Charitap
 * Handles all email notifications (charity invitations, admin alerts, etc.)
 */
class EmailService {
  constructor() {
    this.enabled = process.env.EMAIL_ENABLED === 'true';
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@charitap.com';
    this.adminEmail = process.env.ADMIN_EMAIL || 'admin@charitap.com';
    
    // Create transporter based on environment
    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      
      console.log('[Email] Service initialized - ENABLED');
    } else {
      console.log('[Email] Service initialized - DISABLED (emails will be logged only)');
    }
  }

  /**
   * Send charity nomination notification to the charity
   */
  async sendCharityNomination(charityEmail, charityName, nominatedBy) {
    const subject = `You've been nominated to join Charitap`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .stats { background: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You've Been Nominated</h1>
          </div>
          <div class="content">
            <p>Hi ${charityName || 'there'},</p>
            
            <p>Great news! A Charitap user believes your organization would be perfect for our micro-donation platform.</p>
            
            <div class="stats">
              <p><strong>What is Charitap?</strong></p>
              <p>Charitap enables people to donate spare change from everyday purchases. Users round up their transactions, and the accumulated amounts are donated to verified charities like yours.</p>
            </div>
            
            <p><strong>Why join Charitap?</strong></p>
            <ul>
              <li>Recurring micro-donations from engaged users</li>
              <li>Secure, PCI-compliant payment processing via Stripe</li>
              <li>Fast, automated fund transfers</li>
              <li>Transparent blockchain-verified donations</li>
              <li>Reach donation-minded individuals</li>
            </ul>
            
            <p><strong>Next Steps:</strong></p>
            <p>We'd love to learn more about your organization. Please reply to this email with:</p>
            <ol>
              <li>Your organization's full legal name</li>
              <li>EIN / Tax ID number (for 501(c)(3) verification)</li>
              <li>Contact person name and phone number</li>
              <li>Brief description of your mission (1-2 sentences)</li>
              <li>Official website URL</li>
            </ol>
            
            <p>Once we verify your nonprofit status, we'll guide you through connecting your bank account via Stripe (it only takes 5 minutes!).</p>
            
            <p><strong>Questions?</strong> Simply reply to this email, and our team will be happy to help.</p>
            
            <p>We're excited to potentially partner with you in making charitable giving effortless!</p>
            
            <p>Best regards,<br><strong>The Charitap Team</strong></p>
          </div>
          <div class="footer">
            <p>This invitation was initiated by a Charitap user (${nominatedBy})</p>
            <p>© ${new Date().getFullYear()} Charitap. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
Hi ${charityName || 'there'},

Great news! A Charitap user believes your organization would be perfect for our micro-donation platform.

What is Charitap?
Charitap enables people to donate spare change from everyday purchases. Users round up their transactions, and accumulated amounts are donated to verified charities like yours.

Why join Charitap?
- Recurring micro-donations from engaged users
- Secure, PCI-compliant payment processing via Stripe
- Fast, automated fund transfers
- Transparent blockchain-verified donations
- Reach donation-minded individuals

Next Steps:
Please reply to this email with:
1. Your organization's full legal name
2. EIN / Tax ID number (for 501(c)(3) verification)
3. Contact person name and phone number
4. Brief description of your mission (1-2 sentences)
5. Official website URL

Once we verify your nonprofit status, we'll guide you through connecting your bank account via Stripe.

Questions? Simply reply to this email.

Best regards,
The Charitap Team

---
This invitation was initiated by a Charitap user (${nominatedBy})
    `;
    
    return this.sendEmail(charityEmail, subject, html, text);
  }

  /**
   * Send notification to admin about new charity nomination
   */
  async sendAdminNotification(applicationData) {
    const subject = `New Charity Nomination: ${applicationData.charityName}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; }
          .content { background: #f9f9f9; padding: 20px; }
          .info-box { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #667eea; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Charity Nomination</h2>
          </div>
          <div class="content">
            <div class="info-box">
              <p><strong>Charity Name:</strong> ${applicationData.charityName}</p>
              <p><strong>Email:</strong> ${applicationData.charityEmail}</p>
              <p><strong>Category:</strong> ${applicationData.category}</p>
              <p><strong>Nominated By:</strong> ${applicationData.nominatedBy}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <p><strong>Action Required:</strong></p>
            <ol>
              <li>Wait for charity to reply with their information</li>
              <li>Verify 501(c)(3) status on <a href="https://www.irs.gov/charities-non-profits/tax-exempt-organization-search">IRS.gov</a></li>
              <li>Create Stripe Express account for them</li>
              <li>Send Stripe onboarding link to charity</li>
              <li>Approve in admin dashboard once complete</li>
            </ol>
            
            <p><em>The charity has been sent an email notification.</em></p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
New Charity Nomination

Charity Name: ${applicationData.charityName}
Email: ${applicationData.charityEmail}
Category: ${applicationData.category}
Nominated By: ${applicationData.nominatedBy}
Date: ${new Date().toLocaleString()}

Action Required:
1. Wait for charity to reply with their information
2. Verify 501(c)(3) status on IRS.gov
3. Create Stripe Express account
4. Send Stripe onboarding link
5. Approve in admin dashboard

The charity has been sent an email notification.
    `;
    
    return this.sendEmail(this.adminEmail, subject, html, text);
  }

  /**
   * Generic email sender
   */
  async sendEmail(to, subject, html, text) {
    const mailOptions = {
      from: `Charitap <${this.fromEmail}>`,
      to,
      subject,
      html,
      text
    };
    
    if (!this.enabled) {
      console.log('[Email] DISABLED - Email would be sent:');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('---');
      return { success: true, message: 'Email service disabled - logged only' };
    }
    
    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[Email] Sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('[Email] Failed to send:', error.message);
      throw error;
    }
  }

  /**
   * Test email configuration
   */
  async testConnection() {
    if (!this.enabled) {
      return { success: false, message: 'Email service is disabled' };
    }
    
    try {
      await this.transporter.verify();
      console.log('[Email] Connection test successful');
      return { success: true, message: 'Email service is working' };
    } catch (error) {
      console.error('[Email] Connection test failed:', error.message);
      return { success: false, message: error.message };
    }
  }
}

// Export singleton instance
module.exports = new EmailService();
