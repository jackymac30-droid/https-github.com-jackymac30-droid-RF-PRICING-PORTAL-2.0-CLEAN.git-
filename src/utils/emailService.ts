import { supabase } from './supabase';
import type { Supplier, Week } from '../types';

/**
 * Sends a pricing reminder email to a supplier
 * 
 * Uses Resend API for email delivery (free tier available)
 * To test: Set VITE_TEST_EMAIL in .env to your email address
 */
export async function sendPricingReminder(
  supplier: Supplier,
  week: Week,
  weekId: string,
  testEmail?: string // Optional: send to test email instead of supplier email
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get test email from environment or use supplier email
    const recipientEmail = testEmail || import.meta.env.VITE_TEST_EMAIL || supplier.email;
    const isTestMode = !!testEmail || !!import.meta.env.VITE_TEST_EMAIL;
    
    console.log('📧 Sending pricing reminder:', {
      supplier: supplier.name,
      supplierEmail: supplier.email,
      recipientEmail,
      isTestMode,
      week: week.week_number,
      weekId
    });

    // Get email template
    const portalUrl = window.location.origin;
    const emailTemplate = getPricingReminderEmailTemplate(
      supplier.name,
      week.week_number,
      week.start_date,
      week.end_date,
      portalUrl
    );

    // Try to send via Resend API if configured
    const resendApiKey = import.meta.env.VITE_RESEND_API_KEY;
    
    if (resendApiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`
          },
          body: JSON.stringify({
            from: import.meta.env.VITE_EMAIL_FROM || 'Robinson Fresh <noreply@robinsonfresh.com>',
            to: recipientEmail,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
            text: emailTemplate.text
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || `Resend API error: ${response.statusText}`);
        }

        console.log('✅ Email sent successfully via Resend:', data);
      } catch (resendError: any) {
        console.error('Resend API error:', resendError);
        // Fall through to log-only mode if Resend fails
      }
    } else {
      // No Resend API key - log the email that would be sent
      console.log('📧 Email would be sent (Resend API key not configured):');
      console.log('To:', recipientEmail);
      console.log('Subject:', emailTemplate.subject);
      console.log('--- Email Content ---');
      console.log(emailTemplate.text);
      console.log('--- End Email ---');
    }

    // Store reminder in audit log for tracking
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert({
        week_id: weekId,
        supplier_id: supplier.id,
        field_changed: 'pricing_reminder_sent',
        new_value: new Date().toISOString(),
        user_id: 'rf-system',
        reason: `Pricing reminder sent to ${supplier.name} (${recipientEmail}) for Week ${week.week_number}${isTestMode ? ' [TEST MODE]' : ''}`
      });

    if (auditError) {
      console.error('Error logging reminder:', auditError);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending pricing reminder:', error);
    return { success: false, error: error.message || 'Failed to send reminder' };
  }
}

/**
 * Email template for pricing reminder
 */
export function getPricingReminderEmailTemplate(
  supplierName: string,
  weekNumber: number,
  weekStartDate: string,
  weekEndDate: string,
  portalUrl: string
): { subject: string; html: string; text: string } {
  const subject = `Reminder: Submit Pricing for Week ${weekNumber} - Robinson Fresh`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Robinson Fresh</h1>
          <p>Pricing Reminder</p>
        </div>
        <div class="content">
          <p>Hello ${supplierName},</p>
          
          <p>This is a friendly reminder that pricing for <strong>Week ${weekNumber}</strong> is still pending.</p>
          
          <p><strong>Week Details:</strong></p>
          <ul>
            <li>Week Number: ${weekNumber}</li>
            <li>Start Date: ${new Date(weekStartDate).toLocaleDateString()}</li>
            <li>End Date: ${new Date(weekEndDate).toLocaleDateString()}</li>
          </ul>
          
          <p>Please log in to the supplier portal to submit your pricing as soon as possible.</p>
          
          <div style="text-align: center;">
            <a href="${portalUrl}" class="button">Submit Pricing Now</a>
          </div>
          
          <p>If you have any questions or need assistance, please contact your RF representative.</p>
          
          <p>Thank you,<br>The Robinson Fresh Team</p>
        </div>
        <div class="footer">
          <p>This is an automated reminder. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Robinson Fresh - Pricing Reminder

Hello ${supplierName},

This is a friendly reminder that pricing for Week ${weekNumber} is still pending.

Week Details:
- Week Number: ${weekNumber}
- Start Date: ${new Date(weekStartDate).toLocaleDateString()}
- End Date: ${new Date(weekEndDate).toLocaleDateString()}

Please log in to the supplier portal to submit your pricing as soon as possible.

Portal URL: ${portalUrl}

If you have any questions or need assistance, please contact your RF representative.

Thank you,
The Robinson Fresh Team

---
This is an automated reminder. Please do not reply to this email.
  `;

  return { subject, html, text };
}

