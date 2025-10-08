#!/bin/bash

# Abu Mafhal Setup Script
# This script automates the initial project setup

echo "🚀 Abu Mafhal Marketplace Setup"
echo "================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "📦 Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

echo "✅ Firebase CLI installed"

# Install React dependencies
echo ""
echo "📦 Installing React dependencies..."
npm install firebase react-router-dom recharts lucide-react papaparse xlsx @google/generative-ai

# Install dev dependencies
echo "📦 Installing dev dependencies..."
npm install -D tailwindcss postcss autoprefixer

# Initialize Tailwind
echo "🎨 Initializing Tailwind CSS..."
npx tailwindcss init -p

# Create folder structure
echo "📁 Creating project structure..."

mkdir -p src/components/{common,auth,admin,vendor,buyer,chat,payment}
mkdir -p src/pages
mkdir -p src/services
mkdir -p src/hooks
mkdir -p src/context
mkdir -p src/utils
mkdir -p src/config
mkdir -p functions/payments
mkdir -p functions/notifications

echo "✅ Folder structure created"

# Create .env template
echo "📝 Creating .env template..."
cat > .env.example << 'EOF'
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_VAPID_KEY=your_vapid_key

# Payment Keys
REACT_APP_PAYSTACK_PUBLIC_KEY=pk_test_xxx
REACT_APP_FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-xxx
REACT_APP_NOWPAYMENTS_API_KEY=your_nowpayments_key

# AI
REACT_APP_GEMINI_API_KEY=your_gemini_api_key

# Development
REACT_APP_USE_EMULATORS=false
EOF

echo "✅ .env.example created. Please copy to .env and fill in your credentials."

# Create .gitignore
echo "📝 Creating .gitignore..."
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Production
build/
dist/

# Misc
.DS_Store
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Firebase
.firebase/
.firebaserc
firebase-debug.log
firestore-debug.log
ui-debug.log
functions/node_modules/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
EOF

echo "✅ .gitignore created"

# Create index.css
echo "🎨 Creating index.css..."
cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}
EOF

echo "✅ index.css created"

# Initialize Firebase
echo ""
echo "🔥 Initializing Firebase..."
echo "Please follow the prompts to set up Firebase:"
echo "  - Select Firestore, Functions, Hosting, Storage"
echo "  - Choose JavaScript for Functions"
echo "  - Set public directory to 'dist'"
echo "  - Configure as single-page app: Yes"
echo ""

read -p "Press Enter to continue with Firebase initialization..."
firebase init

# Install Functions dependencies
if [ -d "functions" ]; then
    echo "📦 Installing Firebase Functions dependencies..."
    cd functions
    npm install firebase-admin firebase-functions axios
    cd ..
    echo "✅ Functions dependencies installed"
fi

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "  1. Copy .env.example to .env and fill in your credentials"
echo "  2. Get Firebase config from Firebase Console"
echo "  3. Set up payment provider accounts (Paystack, Flutterwave, NOWPayments)"
echo "  4. Get Gemini API key from Google AI Studio"
echo "  5. Deploy Firestore and Storage rules: firebase deploy --only firestore:rules,storage:rules"
echo "  6. Run development server: npm run dev"
echo "  7. Build and deploy: npm run build && firebase deploy"
echo ""
echo "📖 Read DEPLOYMENT_GUIDE.md for detailed instructions"
echo ""