# Node.js Version Requirement

⚠️ **IMPORTANT: This backend requires Node.js v18 LTS**

The `better-sqlite3` package does not compile on Node.js v23.

## Quick Fix

You are currently on **Node.js v23.11.0**. You need to switch to v18.

### Method 1: Using NVM (Recommended)

```bash
# Load NVM if not already loaded
source ~/.nvm/nvm.sh

# Install and use Node.js 18
nvm install 18
nvm use 18

# Verify
node --version  # Should show v18.x.x

# Install dependencies
cd backend
rm -rf node_modules package-lock.json swipe.db*
npm install

# Start server
npm start
```

### Method 2: Use the Setup Script

```bash
cd backend
./setup.sh
```

The script will guide you through the process.

### Method 3: Manual Installation

If you don't have nvm:
1. Download Node.js v18 LTS from https://nodejs.org/
2. Install it
3. Run `npm install` in the backend directory

## After Switching to Node v18

Once on Node v18, the installation should complete successfully:

```bash
npm install    # Should work without errors
npm start      # Server starts on port 3000
```

## Verification

```bash
# Should see v18.x.x
node --version

# Should start without errors
npm start
```

## Why Node v18?

- `better-sqlite3` v9.2.2 requires Node.js v18 or lower
- Node.js v23 introduced breaking changes in native module compilation
- Node.js v18 is the current LTS (Long Term Support) version
- All service files use synchronous API that requires better-sqlite3

## Alternative (Not Recommended)

If you must stay on Node v23, you would need to:
1. Complete the async/await migration in all service files (see IMPLEMENTATION_NOTES.md)
2. Use `sqlite3` package instead of `better-sqlite3`

However, this is significantly more work. **Switching to Node v18 is the fastest path to a working backend.**
