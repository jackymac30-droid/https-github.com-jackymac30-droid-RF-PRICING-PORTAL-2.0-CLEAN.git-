# Email Reminder Setup Guide

## Quick Test Setup (Send to Your Email)

### Option 1: Test Mode (No API Key Required)
1. Create a `.env` file in the project root (copy from `.env.example`)
2. Add your email address:
   ```
   VITE_TEST_EMAIL=your-email@example.com
   ```
3. Restart your dev server (`npm run dev`)
4. Click the reminder button - emails will be sent to your test email instead of suppliers

### Option 2: Use Resend API (Free Tier)
1. Sign up for free at https://resend.com
2. Get your API key from https://resend.com/api-keys
3. Add to `.env`:
   ```
   VITE_RESEND_API_KEY=re_your_api_key_here
   VITE_EMAIL_FROM=Robinson Fresh <noreply@yourdomain.com>
   VITE_TEST_EMAIL=your-email@example.com  # Optional: for testing
   ```
4. Restart your dev server
5. Click the reminder button - emails will be sent via Resend

## How It Works

### Test Mode
- When `VITE_TEST_EMAIL` is set, all reminders go to that address
- The console will show what email would be sent
- No API key needed for testing

### Production Mode
- Set `VITE_RESEND_API_KEY` with your Resend API key
- Set `VITE_EMAIL_FROM` with your verified domain
- Remove or leave empty `VITE_TEST_EMAIL` to send to actual suppliers
- Emails are sent via Resend API

## Email Template

The reminder email includes:
- Professional HTML design
- Supplier name personalization
- Week number and dates
- Direct link to supplier portal
- Plain text fallback

## Troubleshooting

### Emails not sending?
1. Check browser console for errors
2. Verify `.env` file is in project root
3. Restart dev server after changing `.env`
4. Check Resend dashboard for delivery status

### Test mode not working?
- Make sure `VITE_TEST_EMAIL` is set in `.env`
- Restart dev server after adding it
- Check console logs for email content

### Resend API errors?
- Verify API key is correct
- Check Resend dashboard for account status
- Ensure `VITE_EMAIL_FROM` uses a verified domain

## Alternative Email Services

You can modify `src/utils/emailService.ts` to use:
- **SendGrid**: https://sendgrid.com
- **AWS SES**: https://aws.amazon.com/ses/
- **Mailgun**: https://www.mailgun.com
- **Supabase Edge Functions**: For serverless email sending

