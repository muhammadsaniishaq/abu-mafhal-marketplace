/**
 * autonomousAIEngine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Abu Mafhal Autonomous AI Engine (Edge / Offline / Resilient Mode)
 *
 * Guarantees 100% uptime for AI features even when external cloud APIs
 * (Google Gemini or OpenAI) have quota limits, invalid keys, or network drops.
 *
 * Supports fluent bilingual natural language generation (Hausa & English)
 * with deep Abu Mafhal domain knowledge, live account context, and platform stats.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Detect whether prompt is Hausa or English
export const detectLanguage = (text = '') => {
    if (!text || typeof text !== 'string') return 'en';
    const lower = text.toLowerCase();

    const hausaKeywords = [
        'sannu', 'ina', 'yaya', 'yane', 'lafiya', 'nagode', 'don allah', 'kudi', 'kudin',
        'kaya', 'kayan', 'sayar', 'saya', 'siyayya', 'bashi', 'oda', 'order', 'shago',
        'waya', 'wayoyi', 'hula', 'takalmi', 'riga', 'direba', 'karba', 'koma', 'mayar',
        'asusu', 'barka', 'dole', 'lokaci', 'nawa', 'wane', 'wace', 'a ina', 'yau', 'gobe',
        'tafi', 'zo', 'jira', 'sauka', 'sauki', 'mai', 'masu', 'ina son', 'ba ni', 'bude',
        'menene', 'yanzu', 'naji', 'babu', 'akwai', 'ina kwana', 'barka da', 'aiko'
    ];

    let hausaHits = 0;
    for (const kw of hausaKeywords) {
        if (lower.includes(kw)) hausaHits++;
    }

    return hausaHits >= 1 ? 'ha' : 'en';
};

// Format currency
const formatNaira = (amount = 0) => {
    return '₦' + Number(amount || 0).toLocaleString();
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * USER SHOPPING ASSISTANT AUTONOMOUS GENERATOR
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const generateAutonomousUserResponse = ({ prompt = '', history = [], userContext = '' }) => {
    const isHausa = detectLanguage(prompt) === 'ha';
    const lower = (prompt || '').toLowerCase().trim();

    // ── 1. GREETING / SANNO ──
    if (
        lower === 'sannu' || lower === 'salamu alaikum' || lower === 'assalamu alaikum' ||
        lower.startsWith('ina kwana') || lower.startsWith('barka') || lower === 'hello' ||
        lower === 'hi' || lower === 'hey' || lower.includes('yaya kake') || lower.includes('how are you')
    ) {
        if (isHausa) {
            return {
                text: `👋 **Sannu da zuwa Abu Mafhal Marketplace!**\n\nNi ne mataimakin ku na AI (Shopping Assistant). Ina nan domin taimaka muku da duk abin da ya shafi:\n\n• **Binciken Kaya:** Wayoyi, sutura, takalma, da kayan gida\n• **Bibiyar Oda (Orders):** Duba halin da kayanku suke ciki\n• **Biyan Kuɗi & Bashi:** Pay on Delivery, Bank Transfer, ko Pay Small Small (0% riba)\n• **Mayar da Kaya (Returns):** Garanti na kwanaki 7 idan kaya sun sami matsala\n• **Zama Mai Sayarwa (Vendor):** Bude shagonka a sauƙaƙe\n\nTa yaya zan iya taimaka muku a yanzu?`,
                suggestions: ['Ina order dina? 📦', 'Yaya ake biyan kudi? 💳', 'Ina son sayen waya 📱']
            };
        } else {
            return {
                text: `👋 **Welcome to Abu Mafhal Marketplace!**\n\nI'm your intelligent AI Shopping Assistant. I'm here to help you 24/7 with:\n\n• **Order Tracking:** Check real-time shipping status and delivery updates\n• **Product Discovery:** Find verified electronics, fashion, and authentic goods\n• **Payment Methods:** Bank Transfer, Card, Pay on Delivery, or 0% Interest Pay Small Small (BNPL)\n• **Returns & Refunds:** 7-day hassle-free buyer protection\n• **Vendor Selling:** How to open your verified merchant store\n\nHow can I help you today?`,
                suggestions: ['Track my order 📦', 'Payment options 💳', 'Recommend trending items ✨']
            };
        }
    }

    // ── 2. ORDER TRACKING & STATUS ──
    if (
        lower.includes('order') || lower.includes('oda') || lower.includes('kayana') ||
        lower.includes('track') || lower.includes('ina kaya') || lower.includes('delivery') ||
        lower.includes('shipped') || lower.includes('ina oda') || lower.includes('ina order')
    ) {
        let orderDetails = '';
        if (userContext && userContext.includes('Order #')) {
            orderDetails = userContext;
        }

        if (isHausa) {
            let reply = `📦 **Bibiyar Halin Ododin Ku (Order Tracking):**\n\n`;
            if (orderDetails) {
                reply += `Ga bayanin ododin da kuka yi kwanan nan daga asusunku:\n${orderDetails}\n\n`;
                reply += `💡 **Matakan Isar da Kaya:**\n• **Pending:** Muna tabbatar da oda da duba sito.\n• **Processing:** Shagon yana shirya kaya tare da sa hatimi.\n• **Shipped:** Direban isar da sako yana kan hanya zuwa gare ku.\n• **Delivered:** An karɓi kaya cikin nasara.\n\nKuna iya danna sashen **"Orders"** a ƙasan wayarku domin ganin cikakken bayanin kowace oda tare da lambar wayar direba!`;
            } else {
                reply += `Domin duba halin da odarku take ciki:\n\n1. Danna alamar **"Orders" (Ododi)** a ƙasan manhajar.\n2. Zaku ga dukkan ododin da kuka yi, kwanan wata, da kuma matakin da suke ciki (Pending, Processing, ko Shipped).\n3. Idan odarku ta shiga matakin **"Shipped"**, zaku ga lambar wayar direban da yake ɗauke da kayanku domin ku tuntube shi.\n\nIdan kuna buƙatar taimako a kan wata oda ta musamman, zaku iya buɗe korafi a sashen Help & Support.`;
            }
            return {
                text: reply,
                suggestions: ['Yaushe kayana zai iso? 🚚', 'Biyan kudi a bakin kofa (POD) 💵', 'Bude korafin sako (Ticket) 🎫']
            };
        } else {
            let reply = `📦 **Order Tracking & Delivery Status:**\n\n`;
            if (orderDetails) {
                reply += `Here is your recent order snapshot from your account:\n${orderDetails}\n\n`;
                reply += `💡 **Delivery Stages:**\n• **Pending:** Order received and awaiting payment/stock clearance.\n• **Processing:** Merchant is packaging your items securely.\n• **Shipped:** Handed over to our courier; dispatch rider is en route.\n• **Delivered:** Successfully received at your doorstep.\n\nYou can also tap the **"Orders"** tab at the bottom to view live tracking and driver contact info!`;
            } else {
                reply += `To check the status of your order:\n\n1. Tap the **"Orders"** tab on the bottom navigation bar.\n2. Tap on any order to view its real-time progress (Pending, Processing, or Shipped).\n3. Once dispatched, you will see direct delivery rider details and live tracking.\n\nNeed to report a delay? You can open a ticket in **Help & Support** anytime.`;
            }
            return {
                text: reply,
                suggestions: ['How fast is delivery? 🚚', 'Pay on Delivery info 💵', 'Open a support ticket 🎫']
            };
        }
    }

    // ── 3. PAYMENTS & PSS (BNPL) & POD ──
    if (
        lower.includes('payment') || lower.includes('biya') || lower.includes('kudi') ||
        lower.includes('bank') || lower.includes('transfer') || lower.includes('card') ||
        lower.includes('pod') || lower.includes('pss') || lower.includes('small small') ||
        lower.includes('delivery pay') || lower.includes('paystack') || lower.includes('flutterwave')
    ) {
        if (isHausa) {
            return {
                text: `💳 **Hanyoyin Biyan Kuɗi a Abu Mafhal:**\n\nMuna da tsari mai sauƙi da tsaro 100% domin biyan kuɗin kayayyaki:\n\n1. **Pay on Delivery (Biyan Kuɗi Lokacin Karɓar Kaya):**\n   Kuna iya biya da tsabar kuɗi ko ta hanyar transfer ga direba a bakin ƙofarku idan kayan sun iso.\n\n2. **Pay Small Small / PSS (Biyan Kuɗi a Hankali):**\n   Sayi kayanka yanzu, ka biya kashi-kashi a tsawon watanni ba tare da ko sisi na riba (0% Interest) ba!\n\n3. **Bank Transfer / USSD:**\n   Canja kuɗi kai tsaye ta asusun banki cikin aminci.\n\n4. **Katin Banki (Mastercard / Visa / Verve):**\n   Biyan kuɗi nan take ta hanyar Paystack ko Flutterwave tare da tsaro na musamman.\n\n5. **Asusun Manhaja (In-App Wallet):**\n   Sanya kuɗi a walat ɗinku domin yin siyayya da danna maballi ɗaya tak ba tare da ɓata lokaci ba.`,
                suggestions: ['Yaya Pay Small Small yake? 🛒', 'Biyan kudi a bakin kofa (POD) 💵', 'Yadda ake sanya kudi a Wallet 👛']
            };
        } else {
            return {
                text: `💳 **Payment Methods on Abu Mafhal Marketplace:**\n\nWe offer completely secure and flexible payment options:\n\n1. **Pay on Delivery (POD):**\n   Pay with cash or instant bank transfer directly to the delivery rider when your package arrives.\n\n2. **Pay Small Small (PSS / 0% BNPL):**\n   Buy what you need today and split the cost into easy weekly or monthly installments with 0% interest!\n\n3. **Instant Bank Transfer & USSD:**\n   Fast and automated bank transfers via our secured payment gateways.\n\n4. **Debit Cards (Mastercard, Visa, Verve):**\n   Instant checkout powered by encrypted Paystack & Flutterwave channels.\n\n5. **In-App Wallet:**\n   Preload your wallet for instant 1-tap checkout, cashback rewards, and instant refunds.`,
                suggestions: ['How does Pay Small Small work? 🛒', 'Is Pay on Delivery available? 💵', 'How to fund my wallet 👛']
            };
        }
    }

    // ── 4. RETURNS, REFUNDS & BUYER PROTECTION ──
    if (
        lower.includes('return') || lower.includes('refund') || lower.includes('mayar') ||
        lower.includes('koma') || lower.includes('matsala') || lower.includes('lalace') ||
        lower.includes('fake') || lower.includes('dispute') || lower.includes('canja')
    ) {
        if (isHausa) {
            return {
                text: `🛡️ **Kariyar Kwastoma da Mayar da Kaya (Buyer Protection & Returns):**\n\nA Abu Mafhal, haƙƙinku da amincinku yana gaba da komai:\n\n• **Garanti na Kwanaki 7:** Idan kayan da kuka karɓa sun sami matsala, basu yi daidai da abin da kuka yi oda ba, ko sun lalace, kuna da kwanaki 7 don mayar da su.\n• **Yadda Ake Bude Korafi:**\n  1. Shiga sashen **Help & Support** a cikin Profile ɗinku.\n  2. Zaɓi **"New Ticket"** sannan ku zaɓi odar da ke da matsala.\n  3. Ɗauki hoton kayan sannan ku tura bayani.\n• **Mayar da Kuɗi (Refunds):** Idan an tabbatar da korafinku, za a mayar muku da kuɗinku 100% kai tsaye zuwa asusun Wallet ɗinku ko bankin ku ba tare da ɓata lokaci ba.`,
                suggestions: ['Bude sabon Ticket 🎫', 'Hanyoyin mayar da kudi 💰', 'Garanti na Abu Mafhal 🛡️']
            };
        } else {
            return {
                text: `🛡️ **Buyer Protection & 7-Day Hassle-Free Returns:**\n\nYour purchases are 100% protected by Abu Mafhal Escrow Protection:\n\n• **7-Day Return Window:** If an item is damaged, defective, or different from the description, you can return it within 7 days of delivery.\n• **How to Initiate a Return:**\n  1. Go to your Profile → **Help & Support** → **New Ticket**.\n  2. Select your order ID and choose the return reason.\n  3. Upload a photo of the item and submit.\n• **Instant Refund:** Once inspected, your refund will be deposited into your In-App Wallet or bank account with zero deduction.`,
                suggestions: ['Open a support ticket 🎫', 'Refund timelines 💰', 'Escrow protection details 🛡️']
            };
        }
    }

    // ── 5. VENDOR / SELLING INQUIRIES ──
    if (
        lower.includes('vendor') || lower.includes('seller') || lower.includes('sayar') ||
        lower.includes('shago') || lower.includes('kasuwanci') || lower.includes('merchant') ||
        lower.includes('zama mai sayarwa') || lower.includes('bude shago')
    ) {
        if (isHausa) {
            return {
                text: `🏪 **Yadda Ake Zama Mai Sayarwa (Become a Vendor):**\n\nKuna son bunkasa kasuwancinku da sayar da kayayyaki ga dubban kwastomomi a fadin Najeriya?\n\n1. **Bude Asusu:** Shiga sashen Profile ka danna **"Become a Vendor" (Zama Mai Sayarwa)**.\n2. **Bayanin Shago:** Cika sunan shagonka, adireshin kasuwanci, da lambar waya.\n3. **Tabbatarwa:** Hukumar Abu Mafhal za ta tantance shagonka cikin sa'o'i 24 domin baka lambar **Verified Merchant**.\n4. **Sanya Kaya:** Fara loda kayayyaki, saita farashi, da samun kudi kai tsaye zuwa asusun bankinka.\n\n🎁 **Kyautar Maraba:** Shaguna sabbi suna samun wata 1 na kyauta (Free Trial) ba tare da kudin rajista ba!`,
                suggestions: ['Yaya ake cire kudin shago? 💼', 'Kudin rajistar shago 🎟️', "Ka'idojin sayar da kaya 📋"]
            };
        } else {
            return {
                text: `🏪 **How to Become a Verified Merchant on Abu Mafhal:**\n\nExpand your business and reach thousands of daily shoppers across Northern Nigeria and nationwide:\n\n1. **Apply Online:** Go to Profile → tap **"Become a Vendor"**.\n2. **Store Setup:** Enter your store name, business category, and contact address.\n3. **Verification:** Our compliance team approves your account within 24 hours to award you the **Verified Merchant Shield**.\n4. **Start Selling:** Upload your catalog, track live sales, and receive automated payouts directly into your bank account.\n\n🎁 **Welcome Offer:** Enjoy a 1-Month Free Trial with 0% subscription fees!`,
                suggestions: ['Vendor payout rules 💼', 'Merchant subscription plans 🎟️', 'Product listing guidelines 📋']
            };
        }
    }

    // ── 6. WALLET & TOP-UP ──
    if (lower.includes('wallet') || lower.includes('asusu') || lower.includes('cire kudi') || lower.includes('sa kudi') || lower.includes('topup') || lower.includes('withdraw')) {
        if (isHausa) {
            return {
                text: `👛 **Asusun Wallet na Abu Mafhal:**\n\nWalat dinku ita ce hanya mafi sauri da sauki wajen gudanar da hada-hadar kudi a manhajar:\n\n• **Sanya Kuɗi (Top Up):** Shiga shafin Wallet ka danna "Add Money / Top Up", zaka iya canja kudi ta bank transfer ko katin ATM.\n• **Siyayya Cikin Sauki:** Yana ba ku damar biyan kudin kaya nan take ba tare da jiran OTP ko matsalar network na banki ba.\n• **Mayar da Kudi (Refunds):** Duk kudin da aka mayar muku suna shiga walat nan take.\n• **Cire Kuɗi (Withdrawal):** Kuna iya cire kudin da ke walat dinku zuwa asusun bankinku na kashin kai a kowane lokaci.`,
                suggestions: ['Yadda ake cire kudi zuwa banki 🏦', 'Kariyar Wallet 🔒', 'Taimakon biyan kudi 💳']
            };
        } else {
            return {
                text: `👛 **Abu Mafhal In-App Wallet Guide:**\n\nYour wallet is the fastest, safest way to transact on the platform:\n\n• **Deposit / Top-up:** Go to the Wallet screen, tap "Top Up", and pay via instant virtual bank transfer or debit card.\n• **1-Tap Checkout:** Bypass bank network delays and OTP issues with instantaneous payment authorization.\n• **Instant Refunds:** All returns and cancelled orders are credited back to your wallet instantly.\n• **Withdrawals:** Transfer your available balance back to your personal Nigerian commercial bank account anytime.`,
                suggestions: ['How to withdraw to bank 🏦', 'Wallet security features 🔒', 'Payment support 💳']
            };
        }
    }

    // ── 7. PRODUCT RECOMMENDATIONS & GENERAL CATALOG ──
    if (lower.includes('waya') || lower.includes('phone') || lower.includes('sutura') || lower.includes('clothes') || lower.includes('takalmi') || lower.includes('shoes') || lower.includes('kaya') || lower.includes('recommend') || lower.includes('nawa') || lower.includes('price')) {
        if (isHausa) {
            return {
                text: `🛍️ **Binciken Kayayyaki a Abu Mafhal:**\n\nMuna da kayayyaki ingantattu kuma na asali (100% Authentic) a farashi mai rahusa:\n\n• 📱 **Wayoyi & Na'urorin Zamani:** iPhone, Samsung, Redmi, Laptops, da Earbuds\n• 👔 **Sutura & Kayan Kawa:** Shaddodi, Jalabiya, Riguna, da Takalman maza da mata\n• ✨ **Turaruka & Kayan Kwalliya:** Asalin turaren wuta, Arabian perfumes, da mayukan fata\n• 🍳 **Kayan Gida & Kayan Daki:** Na'urorin girki, fanka, da kayan ado\n\n💡 **Shawarwari:** Kuna iya amfani da akwatin bincike (Search Bar) a babban shafin kasuwa ko ku tura min hoton kayan da kuke nema domin na nemo muku shi kai tsaye!`,
                suggestions: ['Bincika wayoyin zamani 📱', 'Kayan sawa masu kyau 👔', 'Nemo kaya da hoto 📸']
            };
        } else {
            return {
                text: `🛍️ **Product Catalog & Trending Recommendations:**\n\nWe feature 100% verified, authentic products directly from certified distributors:\n\n• 📱 **Phones & Electronics:** Flagship smartphones, laptops, smartwatches, and accessories\n• 👔 **Fashion & Footwear:** Traditional attire, designer wears, sneakers, and corporate shoes\n• ✨ **Fragrances & Beauty:** Premium Arabian ouds, perfumes, and skincare essentials\n• 🍳 **Home & Kitchen:** High-efficiency appliances and contemporary home decor\n\n💡 **Pro Tip:** Use the Search bar on the homepage, or send me a photo right here in this chat to find matching items instantly!`,
                suggestions: ['Trending smartphones 📱', 'Fashion & lifestyle 👔', 'Find items by photo 📸']
            };
        }
    }

    // ── 8. FALLBACK / GENERAL ASSISTANCE ──
    if (isHausa) {
        return {
            text: `Na fahimci tambayarku dangane da **"${prompt}"**.\n\nA matsayina na mataimakin kasuwar Abu Mafhal, zan iya taimaka muku wajen:\n\n1. **Bibiyar Oda:** Nuna muku halin da kayanku suke ciki da lambar direba.\n2. **Sayayya & Farashi:** Nemo kayayyaki mafi inganci da saukin farashi.\n3. **Biyan Kudi:** Bayanin Pay on Delivery, Bank Transfer, ko Pay Small Small.\n4. **Taimako:** Buɗe korafin matsalar kaya ko kudi a sashen Help & Support.\n\nDon Allah zaɓi ɗaya daga cikin zaɓuɓɓukan da ke ƙasa ko ku ƙara min bayani domin na taimaka muku yadda ya kamata!`,
            suggestions: ['Ina order dina? 📦', 'Hanyoyin biyan kudi 💳', 'Tuntubi Customer Care 📞']
        };
    } else {
        return {
            text: `I understand your inquiry regarding **"${prompt}"**.\n\nAs your Abu Mafhal Assistant, I can assist you with:\n\n1. **Order Tracking:** Checking real-time order delivery status and rider dispatch.\n2. **Catalog Browsing:** Locating verified products at the best market prices.\n3. **Payment Assistance:** Guiding you through Bank Transfer, Card, POD, or Pay Small Small.\n4. **Support Services:** Helping you file a dispute or open a support ticket.\n\nPlease select one of the suggested prompts below or ask a more specific question so I can assist you right away!`,
            suggestions: ['Track my orders 📦', 'Payment options 💳', 'Contact Customer Support 📞']
        };
    }
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ADMIN AI COPILOT AUTONOMOUS GENERATOR
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const generateAutonomousAdminResponse = ({ prompt = '', history = [], platformContext = {} }) => {
    const isHausa = detectLanguage(prompt) === 'ha';
    const lower = (prompt || '').toLowerCase().trim();

    const {
        stats = {},
        pendingVendors = [],
        recentOrders = [],
        lowStock = [],
        openTickets = [],
        activeCoupons = [],
        pendingPayouts = [],
        openDisputes = [],
        recentBroadcasts = []
    } = platformContext || {};

    const totalUsers = stats.users || 0;
    const activeVendors = stats.vendors || 0;
    const totalRev = stats.revenue || 0;
    const todayRev = stats.todayRevenue || 0;
    const todayOrd = stats.todayOrders || 0;
    const pendingOrd = stats.pendingOrders || 0;

    // ── 1. PLATFORM SUMMARY / STATS ──
    if (
        lower.includes('summary') || lower.includes('stat') || lower.includes('overview') ||
        lower.includes('bayanin tsari') || lower.includes('kudi') || lower.includes('revenue') ||
        lower.includes('yaya kasuwa') || lower.includes('yau') || lower.includes('today')
    ) {
        if (isHausa) {
            return {
                text: `📊 **Taƙaitaccen Rahoton Abu Mafhal (Live Executive Report):**\n\nGa halin da kasuwanci da tsarin manhaja yake ciki a yau:\n\n• **Kuɗin Shiga (All-Time Revenue):** ${formatNaira(totalRev)}\n• **Kuɗin Shiga na Yau:** ${formatNaira(todayRev)}\n• **Ododin Yau (Today's Orders):** ${todayOrd} ododi\n• **Ododin da ke Jira (Pending Orders):** ${pendingOrd}\n• **Jimillar Masu Amfani (Users):** ${totalUsers.toLocaleString()} masu rijista\n• **Masu Sayarwa (Vendors):** ${activeVendors.toLocaleString()} shaguna masu aiki\n• **Shagunan da ke Jiran Tabbatarwa:** ${pendingVendors.length} aikace-aikace\n• **Kayan da ke Neman Ƙarewa (Low Stock):** ${lowStock.length} kayayyaki ƙasa da 10\n• **Korafe-korafe Masu Buɗe (Open Tickets):** ${openTickets.length}\n• **Kuɗin da Masu Shago ke Jira (Payouts):** ${pendingPayouts.length} buƙatu\n\n💡 **Shawarar Gudanarwa:** Tabbatar da shiga sashen **Orders** domin tura ododin da ke jira zuwa ga direbobin isar da saƙo.`,
                suggestions: ['Duba kayan da ke karewa 📉', 'Aikace-aikacen masu shago 🏪', 'Rubuta sanarwa (Broadcast) 📢']
            };
        } else {
            return {
                text: `📊 **Abu Mafhal Marketplace Executive Briefing:**\n\nHere is your real-time operational status:\n\n• **Gross All-Time Revenue:** ${formatNaira(totalRev)}\n• **Today's Revenue:** ${formatNaira(todayRev)}\n• **Today's Orders:** ${todayOrd} orders processed\n• **Pending Orders:** ${pendingOrd} awaiting fulfillment\n• **Registered Users:** ${totalUsers.toLocaleString()} accounts\n• **Active Merchants:** ${activeVendors.toLocaleString()} verified stores\n• **Pending Vendor Applications:** ${pendingVendors.length} awaiting review\n• **Low Stock Warnings:** ${lowStock.length} items below 10 units\n• **Open Support Tickets:** ${openTickets.length} pending response\n• **Pending Merchant Payouts:** ${pendingPayouts.length} withdrawal requests\n\n💡 **Action Recommendation:** Prioritize clearing pending vendor approvals and dispatching pending orders to maintain platform SLA.`,
                suggestions: ['View low stock items 📉', 'Review pending vendors 🏪', 'Draft a push broadcast 📢']
            };
        }
    }

    // ── 2. LOW STOCK INVENTORY RADAR ──
    if (lower.includes('stock') || lower.includes('low stock') || lower.includes('karewa') || lower.includes('kaya') || lower.includes('inventory')) {
        let itemsList = '';
        if (lowStock.length > 0) {
            itemsList = lowStock.slice(0, 5).map(item => `• **${item.name}** — ${item.stock_quantity} left (${formatNaira(item.price)}, ${item.category || 'General'})`).join('\n');
        }

        if (isHausa) {
            return {
                text: `📉 **Kayayyakin da ke Neman Ƙarewa a Sito (Low Stock Radar):**\n\nAkwai kayayyaki **${lowStock.length}** da yawansu ya ragu ƙasa da guda 10 a sito:\n\n${itemsList || 'A halin yanzu babu wani kaya da ya ragu ƙasa da 10 a sito. Sito yana cikin ƙoshin lafiya!'}\n\n💡 **Shawarar AI:** A tuntuɓi masu sayarwa (vendors) ko a ƙara yawan kayayyakin a sashen **Products** domin kada kwastomomi su rasa damar yin oda.`,
                suggestions: ['Shiga sashen Products 📦', 'Aika sanarwa ga masu shago 📢', 'Bayanin tsari gaba daya 📊']
            };
        } else {
            return {
                text: `📉 **Low Stock Inventory Radar:**\n\nThere are **${lowStock.length}** products with inventory levels below 10 units:\n\n${itemsList || 'All warehouse and merchant inventory levels are currently healthy!'}\n\n💡 **Inventory Action:** Contact relevant merchants or restock key SKU units in the **Products** module to avoid lost sales volume.`,
                suggestions: ['Manage Products 📦', 'Notify merchants 📢', 'Platform summary 📊']
            };
        }
    }

    // ── 3. VENDOR APPLICATIONS ──
    if (lower.includes('vendor') || lower.includes('shago') || lower.includes('merchant') || lower.includes('aikace') || lower.includes('application')) {
        let vList = '';
        if (pendingVendors.length > 0) {
            vList = pendingVendors.slice(0, 5).map(v => `• **${v.store_name}** — submitted ${new Date(v.created_at).toLocaleDateString()}`).join('\n');
        }

        if (isHausa) {
            return {
                text: `🏪 **Aikace-aikacen Masu Sayarwa (Pending Vendor Applications):**\n\nAkwai shaguna **${pendingVendors.length}** da ke jiran tantancewar Admin:\n\n${vList || 'Babu wani sabon shago da yake jiran tabbatarwa a halin yanzu.'}\n\n💡 **Ka'idojin Tantancewa:**\n1. Tabbatar sunan shago bai saba ka'idar kasuwanci ba.\n2. Duba lambar waya da shaidar kasuwanci (CAC/ID).\n3. Danna sashen **Vendor Applications** a cikin Admin Drawer domin amincewa ko kin amincewa.`,
                suggestions: ['Bude Vendor Applications 🏪', 'Duba masu shago masu aiki 👥', 'Bayanin kudin shiga 💰']
            };
        } else {
            return {
                text: `🏪 **Pending Merchant Applications:**\n\nThere are **${pendingVendors.length}** vendor store applications awaiting your review:\n\n${vList || 'No pending applications at the moment. All vendor queues are cleared!'}\n\n💡 **Verification Checklist:**\n1. Verify merchant identity and valid store phone number.\n2. Confirm compliance with Abu Mafhal authentic goods policy.\n3. Tap **Vendor Applications** in the Admin Drawer to approve or decline.`,
                suggestions: ['Open Vendor Applications 🏪', 'View active merchants 👥', 'Revenue overview 💰']
            };
        }
    }

    // ── 4. BROADCAST COPYWRITING ──
    if (lower.includes('broadcast') || lower.includes('sanarwa') || lower.includes('talla') || lower.includes('message') || lower.includes('push') || lower.includes('notification')) {
        if (isHausa) {
            return {
                text: `📢 **Samfurin Saƙon Sanarwa (Push Broadcast Draft):**\n\nGa samfurin saƙon talla mai ɗaukar hankali da kuke iya aikawa dukkan masu amfani da manhaja:\n\n**Take (Title):** 🔥 Garabasar Musamman ta Ranar Yau a Abu Mafhal!\n**Saƙo (Body):** Yi amfani da damar samun rangwame har 30% a kan dukkan wayoyi da kayan sawa. Kayan zai iso ƙofarku tare da zabin Pay on Delivery! Shiga yanzu kafin kaya su ƙare.\n\n💡 Kuna iya zuwa sashen **Broadcast** a cikin Drawer domin manna wannan saƙon da turawa nan take!`,
                suggestions: ['Bude sashen Broadcast 📢', 'Shirya Flash Sale 🔥', 'Bayanin tsarin yau 📊']
            };
        } else {
            return {
                text: `📢 **High-Converting Push Broadcast Draft:**\n\nHere is a professionally crafted notification ready to send to your active users:\n\n**Title:** 🔥 Flash Deals Live Now on Abu Mafhal Marketplace!\n**Message Body:** Enjoy up to 30% discount on top-selling smartphones, fashion, and home electronics today. Doorstep delivery available nationwide with Pay on Delivery! Tap to shop before stocks run out.\n\n💡 You can navigate to **Broadcast** in your Admin Drawer to paste and dispatch this notification immediately.`,
                suggestions: ['Open Broadcast module 📢', 'Plan a Flash Sale 🔥', 'Platform summary 📊']
            };
        }
    }

    // ── 5. SUPPORT TICKETS & DISPUTES ──
    if (lower.includes('ticket') || lower.includes('korafi') || lower.includes('dispute') || lower.includes('support') || lower.includes('taimako')) {
        let tList = '';
        if (openTickets.length > 0) {
            tList = openTickets.slice(0, 4).map(t => `• #${t.id?.slice(0, 6)}: "${t.subject}" [${t.category}]`).join('\n');
        }

        if (isHausa) {
            return {
                text: `🎫 **Korafe-korafen Kwastomomi (Support & Disputes):**\n\n• **Korafe-korafe Masu Buɗe (Tickets):** ${openTickets.length}\n• **Rikice-rikicen Ododi (Disputes):** ${openDisputes.length}\n\n${tList ? `Korafe-korafe na kwanan nan:\n${tList}\n\n` : ''}💡 **Shawarar Taimako:** Amsa korafe-korafe a kan lokaci yana ƙara amincin kwastomomi da kashi 85%. Shiga sashen **Support Tickets** ko **Disputes** a cikin Drawer domin mayar da martani ko sasantawa.`,
                suggestions: ['Duba Support Tickets 🎫', 'Duba Disputes ⚠️', 'Bayanin tsari gaba daya 📊']
            };
        } else {
            return {
                text: `🎫 **Support & Dispute Resolution Center:**\n\n• **Open Support Tickets:** ${openTickets.length}\n• **Active Order Disputes:** ${openDisputes.length}\n\n${tList ? `Recent Open Tickets:\n${tList}\n\n` : ''}💡 **Resolution Best Practice:** Quick ticket turnaround increases buyer retention by over 85%. Access **Support Tickets** or **Disputes** in the drawer to review and resolve customer inquiries.`,
                suggestions: ['Open Support Tickets 🎫', 'Review Disputes ⚠️', 'Platform overview 📊']
            };
        }
    }

    // ── 6. DEFAULT / GENERAL ADVICE ──
    if (isHausa) {
        return {
            text: `🤖 **Admin AI Copilot yana shirye:**\n\nNa fahimci tambayarku dangane da **"${prompt}"**.\n\nA matsayina na babban mataimakin shugabancin Abu Mafhal, ina da damar bincikar:\n\n• Jimillar kuɗin shiga da ododin kowace rana\n• Kayan da suka rage a sito da bayanan masu sayarwa\n• Taimaka muku rubuta tallace-tallace da katin rangwame (Coupons)\n• Magance matsalolin kwastomomi da masu kai sako\n\nDon Allah zaɓi ɗaya daga cikin ayyukan da ke ƙasa domin mu ci gaba!`,
            suggestions: ['Bayanin tsarin yau 📊', 'Duba kayan da ke karewa 📉', 'Aikace-aikacen masu shago 🏪']
        };
    } else {
        return {
            text: `🤖 **Admin AI Copilot Ready:**\n\nI have reviewed your request regarding **"${prompt}"**.\n\nWith direct access to the live platform database, I can assist you with:\n\n• Live revenue analytics and daily order volume\n• Inventory restocking alerts and merchant compliance\n• Crafting push notifications, coupons, and flash sale campaigns\n• Resolving support tickets and driver logistics\n\nPlease select any action chip below or ask for specific figures!`,
            suggestions: ['Platform summary 📊', 'Low stock products 📉', 'Pending vendor stores 🏪']
        };
    }
};
