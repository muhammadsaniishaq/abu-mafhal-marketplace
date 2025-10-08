# Abu Mafhal - Multi-Vendor Marketplace

A complete Firebase-powered multi-vendor marketplace built with React, featuring role-based authentication, multiple payment gateways, AI-powered features, and real-time notifications.

## 🚀 Features

### Core Features
- ✅ **Multi-vendor architecture** (Admin, Vendor, Buyer roles)
- ✅ **Firebase Backend** (Auth, Firestore, Storage, Functions, Hosting)
- ✅ **Payment Integration** (Paystack, Flutterwave, NOWPayments crypto)
- ✅ **AI-Powered Features** (Gemini API for recommendations, descriptions, analytics)
- ✅ **Real-time Notifications** (Firebase Cloud Messaging)
- ✅ **Dark/Light Mode** theme support
- ✅ **Responsive Design** (Mobile-first with Tailwind CSS)

### Admin Features
- User management (vendors, buyers)
- Vendor approval system
- Product moderation
- Order management
- Dispute resolution
- Payment tracking
- CMS (banners, blogs, FAQs)
- Analytics & reports
- Audit logs
- AI-powered fraud detection

### Vendor Features
- Product management (CRUD)
- Order processing
- Payout tracking
- Customer reviews
- Storefront customization
- Marketing tools
- AI product description generator
- Sales analytics
- Inventory management

### Buyer Features
- Product browsing & search
- Shopping cart & wishlist
- Multiple payment options
- Order tracking
- Wallet system
- Product reviews
- Dispute filing
- AI-powered recommendations
- Loyalty points

## 📋 Prerequisites

- Node.js 18+ 
- Firebase CLI: `npm install -g firebase-tools`
- Firebase Project (Blaze plan for Cloud Functions)
- Payment provider accounts:
  - Paystack account
  - Flutterwave account
  - NOWPayments account (for crypto)
- Google Gemini API key

## 🛠️ Quick Setup

### 1. Clone or Download
```bash
# If using Git
git clone <your-repo-url>
cd abu-mafhal

# Or download and extract the project
```

### 2. Run Setup Script
```bash
chmod +x setup.sh
./setup.sh
```

### 3. Configure Environment
```bash
# Copy template
cp .env.example .env

# Edit .env and add your credentials
nano .env
```

### 4. Get Firebase Config
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create/select your project
3. Go to Project Settings
4. Copy config and add to `.env`

### 5. Deploy Security Rules
```bash
firebase deploy --only firestore:rules,storage:rules,firestore:indexes
```

### 6. Deploy Functions
```bash
# Set Firebase Functions config
firebase functions:config:set \
  paystack.secret_key="YOUR_KEY" \
  flutterwave.secret_key="YOUR_KEY" \
  nowpayments.api_key="YOUR_KEY"

# Deploy
firebase deploy --only functions
```

### 7. Run Development Server
```bash
npm run dev
```

### 8. Build & Deploy
```bash
npm run build
firebase deploy
```

## 📁 Project Structure

```
abu-mafhal/
├── src/
│   ├── components/
│   │   ├── admin/        # Admin dashboard components
│   │   ├── vendor/       # Vendor dashboard components
│   │   ├── buyer/        # Buyer dashboard components
│   │   ├── common/       # Shared components
│   │   ├── auth/         # Authentication components
│   │   ├── chat/         # Messaging components
│   │   └── payment/      # Payment gateway components
│   ├── pages/            # Page components
│   ├── services/         # Firebase & API services
│   ├── hooks/            # Custom React hooks
│   ├── context/          # React Context providers
│   ├── utils/            # Helper functions
│   ├── config/           # Firebase configuration
│   └── index.css         # Global styles
├── functions/
│   ├── payments/         # Payment cloud functions
│   ├── notifications/    # FCM functions
│   └── index.js          # Functions entry point
├── public/               # Static assets
├── firestore.rules       # Firestore security rules
├── storage.rules         # Storage security rules
├── firebase.json         # Firebase configuration
└── package.json          # Dependencies
```

## 🔐 Security

### Firestore Rules
- Role-based access control (Admin, Vendor, Buyer)
- Vendor approval system
- Document-level permissions
- Secure data validation

### Storage Rules
- File type validation
- Size limits (5MB images, 10MB documents)
- User ownership verification
- Admin override capabilities

## 💳 Payment Integration

### Paystack (NGN)
- Card payments
- Bank transfers
- USSD payments
- Webhook verification

### Flutterwave (NGN + International)
- Multiple payment methods
- Multi-currency support
- Mobile money integration
- Secure webhook handling

### NOWPayments (Cryptocurrency)
- Bitcoin, Ethereum, USDT
- 150+ cryptocurrencies
- Real-time price conversion
- IPN callback system

## 🤖 AI Features

### Gemini API Integration
1. **Product Recommendations**
   - Personalized for each buyer
   - Based on purchase history
   - Category preferences

2. **Vendor AI Assistant**
   - Generate product descriptions
   - Optimize existing content
   - Create marketing copy
   - SEO keyword suggestions

3. **Admin Analytics**
   - Sales predictions
   - Trend analysis
   - Fraud detection
   - Business insights

4. **AI Chatbot**
   - Customer support
   - Order tracking
   - FAQ responses
   - Context-aware conversations

## 📊 Analytics & Reporting

### Admin Dashboard
- Total users, vendors, buyers
- Revenue tracking
- Order statistics
- Top products/vendors
- Category distribution
- Sales trends (charts)
- AI-powered insights

### Vendor Dashboard
- Sales overview
- Revenue charts
- Top-selling products
- Customer reviews
- Order fulfillment rates
- Product performance

### Buyer Dashboard
- Spending statistics
- Order history
- Loyalty points
- Wishlist analytics
- Review contributions

## 🔔 Notifications

### Firebase Cloud Messaging
- Push notifications (web/mobile)
- Order updates
- Payment confirmations
- Shipping notifications
- Promotional messages
- Admin alerts

### In-App Notifications
- Real-time updates
- Read/unread status
- Notification center
- Email fallback option

## 💬 Messaging System

### Chat Features
- Buyer ↔ Vendor communication
- Vendor ↔ Admin support
- File attachments
- Order context
- Real-time messaging
- Message history

## 🛒 Order Management

### Order Lifecycle
1. **Pending** - Order placed, payment pending
2. **Confirmed** - Payment received
3. **Processing** - Vendor preparing order
4. **Shipped** - Order in transit
5. **Delivered** - Order completed
6. **Cancelled** - Order cancelled
7. **Refunded** - Payment refunded

### Dispute Resolution
- Buyer can file disputes
- Vendor response system
- Admin mediation
- Evidence upload
- Resolution tracking
- Automatic refunds

## 🎨 UI/UX Features

### Design System
- **Tailwind CSS** for styling
- **Responsive design** (mobile-first)
- **Dark/Light mode** toggle
- **Accessibility** features
- **Loading states** & animations
- **Error handling** & validation

### Components
- Sidebar navigation
- Data tables with pagination
- Charts & graphs (Recharts)
- Modal dialogs
- Toast notifications
- Form validation
- Image galleries

## 🌐 Deployment

### Firebase Hosting
```bash
# Build production version
npm run build

# Preview deployment
firebase hosting:channel:deploy preview

# Deploy to production
firebase deploy
```

### Custom Domain
1. Go to Firebase Console → Hosting
2. Add custom domain
3. Configure DNS records
4. Wait for SSL certificate

### CI/CD (Optional)
Use GitHub Actions for automated deployment:
```yaml
# .github/workflows/deploy.yml
name: Deploy to Firebase
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
```

## 📱 Progressive Web App (PWA)

### Features
- Offline functionality
- Install prompt
- App-like experience
- Background sync
- Push notifications

### Configuration
Update `public/manifest.json`:
```json
{
  "name": "Abu Mafhal",
  "short_name": "Abu Mafhal",
  "description": "Multi-Vendor Marketplace",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#3b82f6",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

## 🧪 Testing

### Local Testing
```bash
# Start development server
npm run dev

# Run Firebase emulators
firebase emulators:start
```

### Test Accounts
Create test accounts for each role:
- **Admin**: admin@test.com
- **Vendor**: vendor@test.com
- **Buyer**: buyer@test.com

### Test Cards
- **Paystack**: 4084084084084081 (success)
- **Flutterwave**: 5531886652142950 (success)

## 🐛 Troubleshooting

### Common Issues

**Issue: Firebase not initialized**
```bash
# Solution: Check .env file has correct config
# Verify Firebase project is selected
firebase use --add
```

**Issue: Functions deployment fails**
```bash
# Solution: Check Node version
node -v  # Should be 18+

# Reinstall dependencies
cd functions
rm -rf node_modules
npm install
```

**Issue: CORS errors**
```bash
# Solution: Configure CORS for Storage
gsutil cors set cors.json gs://YOUR_BUCKET
```

**Issue: Payment webhook not working**
- Verify webhook URL is correct
- Check Firebase Functions logs
- Test with webhook test tools
- Verify signature validation

## 📚 Documentation

### Key Files
- `DEPLOYMENT_GUIDE.md` - Detailed deployment instructions
- `firestore.rules` - Database security rules
- `storage.rules` - Storage security rules
- `functions/index.js` - Cloud Functions entry

### API Documentation
Functions endpoints:
- `initializePaystackPayment` - Start Paystack payment
- `verifyPaystackPayment` - Verify payment
- `initializeFlutterwavePayment` - Start Flutterwave
- `initializeNowPayments` - Start crypto payment
- `processRefund` - Process order refund
- `sendNotification` - Send FCM notification

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 💡 Tips & Best Practices

### Performance
- Enable Firestore offline persistence
- Use pagination for large lists
- Implement lazy loading for images
- Cache frequently accessed data
- Optimize bundle size with code splitting

### Security
- Always validate input on client and server
- Use Firebase security rules
- Implement rate limiting
- Sanitize user-generated content
- Regular security audits

### Scalability
- Use Cloud Functions for heavy operations
- Implement proper indexing in Firestore
- Use Firebase Performance Monitoring
- Set up error tracking (Sentry)
- Monitor costs and optimize queries

## 📞 Support

For issues and questions:
1. Check documentation
2. Review Firebase Console logs
3. Check browser console
4. Test with emulators
5. Create GitHub issue

## 🎯 Roadmap

### Phase 1 (Current)
- ✅ Core marketplace features
- ✅ Payment integration
- ✅ AI features
- ✅ Basic analytics

### Phase 2 (Planned)
- [ ] Mobile apps (React Native)
- [ ] Advanced search with Algolia
- [ ] Email marketing integration
- [ ] SMS notifications
- [ ] Multi-language support (Hausa)
- [ ] Subscription products
- [ ] Affiliate system

### Phase 3 (Future)
- [ ] Vendor mobile app
- [ ] Admin mobile app
- [ ] Advanced reporting
- [ ] Inventory management
- [ ] Shipping integrations
- [ ] Tax calculations
- [ ] Multi-warehouse support

## 🌟 Credits

Built with:
- React 18
- Firebase (Auth, Firestore, Storage, Functions, Hosting)
- Tailwind CSS
- Recharts
- Google Gemini AI
- Paystack, Flutterwave, NOWPayments

---

**Made with ❤️ for Abu Mafhal Marketplace**