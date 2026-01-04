# How to Push to GitHub (Simple Steps)

## The Problem
GitHub needs to know it's really YOU trying to upload your code. It's like a password.

## Solution: Use a Personal Access Token

### Step 1: Create a Token on GitHub

**Follow these exact steps:**

1. **Go to GitHub.com and sign in** (make sure you're logged in!)

2. **Click your profile picture** (top right corner) → Click **"Settings"**

3. **Scroll down on the left sidebar** → Click **"Developer settings"** (it's near the bottom)

4. **Click "Personal access tokens"** → Click **"Tokens (classic)"**

5. **Click the green button** that says **"Generate new token"** → Click **"Generate new token (classic)"**

6. **Fill out the form:**
   - **Note:** Type something like "My Computer" or "RF Pricing Project"
   - **Expiration:** Choose how long (90 days is good, or "No expiration" if you want)
   - **Check the box** next to **"repo"** (this gives permission to push code)
     - When you check "repo", it automatically checks all the sub-boxes (repo:status, repo_deployment, etc.) - that's fine!

7. **Scroll to the bottom** and click the green **"Generate token"** button

8. **COPY THE TOKEN IMMEDIATELY!** 
   - It will be a long string starting with `ghp_`
   - You'll only see it ONCE - if you leave the page, you can't see it again!
   - Save it somewhere safe (like a text file) before closing the page

### Step 2: Push Your Code
Run this command (replace YOUR_TOKEN with the token you copied):

```bash
git push https://YOUR_TOKEN@github.com/jackymac30-droid/RF-PRICING-PORTAL-2.0.git main
```

**OR** use this easier way:

```bash
# First, update the remote URL to include your token
git remote set-url origin https://YOUR_TOKEN@github.com/jackymac30-droid/RF-PRICING-PORTAL-2.0.git

# Then push normally
git push -u origin main
```

### Alternative: Use GitHub Desktop App
1. Download GitHub Desktop: https://desktop.github.com/
2. Sign in with your GitHub account
3. Add your repository
4. Click "Push origin" button

---

## What Just Happened?
✅ Step 1: We put all your files in a "commit" (like saving a snapshot)
✅ Step 2: We connected your computer to GitHub (like adding a friend)
❌ Step 3: We need YOUR password (token) to actually upload

Once you push, your code will be on GitHub and you can see it at:
https://github.com/jackymac30-droid/RF-PRICING-PORTAL-2.0

