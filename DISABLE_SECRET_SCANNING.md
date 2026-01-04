# Disable Netlify Secret Scanning 🔓

## The Problem
Netlify is detecting example token patterns in documentation files. These are just examples, not real secrets!

## Solution: Disable Secret Scanning

### Option 1: In Netlify Dashboard (If Available)

1. Go to: **https://app.netlify.com**
2. Click your site → **"Site settings"**
3. Look for:
   - **"Security"** section
   - **"Secret scanning"** option
   - **"Build settings"** → **"Secret detection"**
4. If you see it, **disable** or **turn off** secret scanning

### Option 2: Add to netlify.toml

Add this to your `netlify.toml` file:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  ignore = "*.md"  # Ignore markdown files in scanning

[build.environment]
  NETLIFY_SECRET_SCANNING = "false"
```

### Option 3: Contact Netlify Support

If you can't disable it in settings:
1. Go to: https://www.netlify.com/support/
2. Ask them to disable secret scanning for your site
3. Explain that you have example tokens in documentation files

---

## Quick Fix: Remove Example Tokens from Docs

Alternatively, we can remove all example token references from documentation files so Netlify doesn't detect them.

---

## Best Solution

**Disable secret scanning** - it's too aggressive and flags examples in documentation.

Try Option 1 first (in Netlify dashboard), then Option 2 (netlify.toml), then Option 3 (support).

