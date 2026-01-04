# Authenticate Git to Push to GitHub 🔐

## Quick Fix: One-Time Authentication

Since we removed the token from the URL for security, you need to authenticate once.

### Step 1: Get a New GitHub Token

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Name it: "My Computer"
4. Check **"repo"** permission
5. Click **"Generate token"**
6. **COPY THE TOKEN** (starts with `ghp_`)

### Step 2: Push with Token

Run this command (replace `YOUR_TOKEN` with the token you copied):

```bash
git push https://YOUR_TOKEN@github.com/jackymac30-droid/RF-PRICING-PORTAL-2.0.git main
```

**Example:**
Replace `YOUR_TOKEN` with your actual token from GitHub.

### Step 3: Save Credentials (Optional)

After the first push, macOS will ask if you want to save the password. Click **"Always"** or **"Save"**.

Then future pushes will work with just:
```bash
git push
```

---

## Alternative: Use GitHub CLI

If you have GitHub CLI installed:

```bash
# Install (if needed)
brew install gh

# Login
gh auth login

# Then push normally
git push
```

---

## After Authentication

Once authenticated, you can use:
- `git push` (normal push)
- `./publish.sh` (publish script)

Both will work automatically!

