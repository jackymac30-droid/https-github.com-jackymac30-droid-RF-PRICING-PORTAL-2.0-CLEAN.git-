# Security Setup Guide

## 🔒 Password Protection

The application requires passwords for all user accounts in **production**. In **development mode** (localhost), passwords are optional for easier testing.

### Development vs Production

- **Development Mode** (localhost/127.0.0.1): Password is optional - just select user and click login
- **Production Mode** (hosted): Password is required - must enter correct password

Follow these steps to secure your application:

### 1. Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Application Passwords (REQUIRED for shared links)
VITE_RF_PASSWORD=your_strong_rf_password_here
VITE_SUPPLIER_PASSWORD=your_strong_supplier_password_here

# Access Code (REQUIRED for production - protects before login)
# Default: "RF2024" if not set
VITE_ACCESS_CODE=RF2024
```

### 🔐 Access Code Protection (REQUIRED for Shared Links)

**This is the first layer of protection** - appears before the login screen:

1. **Set the access code** in `.env`:
   ```env
   VITE_ACCESS_CODE=RF2024
   ```
   (Default is "RF2024" if not set, but change it!)

2. **How it works:**
   - When someone opens your shared link, they see a "Protected Access" screen first
   - They must enter the correct code to see the login page
   - Code is validated once per browser session
   - **This prevents anyone from even seeing the login page without the code**

**Important:**
- ✅ Change the default code in production!
- ✅ Share the code separately from the link
- ✅ Works in production only (skipped in dev mode)
- ✅ Session-based (validated once per browser session)

### 2. Password Requirements

**For Production:**
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, and symbols
- Avoid common words or patterns
- Use a password manager to generate secure passwords

**Example Strong Passwords:**
- RF: `Rf$ecure2024!VolPricing`
- Supplier: `Supp$ecure2024!Access`

### 3. Development Mode (Testing)

When running on `localhost` or `127.0.0.1`, the app automatically enters **Development Mode**:
- ✅ Password field is optional
- ✅ Can login by just selecting a user
- ✅ Shows "Development Mode" indicator
- ✅ Makes testing faster and easier

**To force production mode in development:**
- Set `VITE_DEV_MODE=false` in `.env`
- Or deploy to a production URL (not localhost)

### 4. Default Passwords (Production Only)

If environment variables are not set, the app uses these defaults:
- **RF Manager**: `rf2024!secure`
- **Suppliers**: `supplier2024!secure`

⚠️ **WARNING**: Change these immediately in production!

### 5. Supabase Authentication (Recommended)

For enhanced security, set up Supabase Authentication:

1. **Enable Email Auth in Supabase Dashboard:**
   - Go to Authentication > Providers
   - Enable Email provider
   - Configure email templates

2. **Create User Accounts:**
   - Add supplier emails to the `suppliers` table
   - Create user accounts in Supabase Auth with matching emails
   - Set passwords for each user

3. **The app will automatically:**
   - Try Supabase Auth first
   - Fall back to environment variable password if Auth fails

### 6. Additional Security Recommendations

#### A. Session Management
- Sessions are stored in localStorage (consider moving to httpOnly cookies in production)
- Add session timeout (recommended: 8 hours of inactivity)
- Implement automatic logout on browser close

#### B. Database Security
- Ensure Row Level Security (RLS) is enabled on all tables
- Review RLS policies to ensure proper access control
- Use service role keys only on the backend (never expose in frontend)

#### C. Network Security
- Use HTTPS in production (required for Supabase)
- Enable CORS restrictions in Supabase
- Consider IP whitelisting for sensitive operations

#### D. Password Policies
- Implement password complexity requirements
- Add password expiration (e.g., 90 days)
- Consider two-factor authentication (2FA) for RF users

### 7. Production Checklist

- [ ] Change all default passwords
- [ ] Set strong environment variable passwords
- [ ] Enable Supabase Authentication
- [ ] Review and test RLS policies
- [ ] Enable HTTPS
- [ ] Set up session timeout
- [ ] Configure CORS properly
- [ ] Remove console.log statements (already done)
- [ ] Set up error logging/monitoring
- [ ] Regular security audits

### 8. Quick Start

1. Copy `.env.example` to `.env`
2. Fill in your Supabase credentials
3. Set strong passwords for `VITE_RF_PASSWORD` and `VITE_SUPPLIER_PASSWORD`
4. Restart your development server
5. Test login with the new password

### 9. Password Reset (Future Enhancement)

Consider implementing:
- Password reset via email
- Admin password reset functionality
- Password strength indicator
- Account lockout after failed attempts

## 🔐 Current Security Features

✅ Password protection on all logins
✅ Session validation
✅ Encrypted connections (HTTPS)
✅ Supabase RLS policies
✅ Environment variable configuration
✅ Password visibility toggle
✅ Error handling for failed logins

## 🚨 Security Notes

- Never commit `.env` files to version control
- Rotate passwords regularly
- Use different passwords for different environments
- Monitor failed login attempts
- Keep dependencies updated

