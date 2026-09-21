import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { whatsappService } from './whatsappService';
import { queueEmail } from './simpleEmailService';
import { NotificationService } from '../lib/notifications';

/**
 * Service to manage Abu Mafhal Pay Small Small (BNPL):
 * - Auto-detects BNPL installment plans
 * - Calculates total outstanding and overdue debt ("abunda ake binsa")
 * - Automated scheduler checking due dates and sending WhatsApp + Email reminders
 */
export const paySmallSmallService = {
    /**
     * Compute comprehensive financial metrics and debt ledger
     */
    calculateLedgerMetrics(plans = []) {
        const now = new Date();
        const activePlans = plans.filter(p => !p.isCompleted);
        const completedPlans = plans.filter(p => p.isCompleted);

        let totalOutstanding = 0;
        let totalOverdue = 0;
        let overdueInstallmentsCount = 0;
        let earliestDueDate = null;
        let nextDueAmount = 0;
        let nextDueOrderNumber = '';
        let nextDuePlanId = null;

        activePlans.forEach(plan => {
            const planRemaining = Number(plan.remainingAmount || 0);
            totalOutstanding += planRemaining;

            const schedule = Array.isArray(plan.schedule) ? plan.schedule : [];
            schedule.forEach(inst => {
                if (inst.status !== 'paid') {
                    const dueDate = new Date(inst.due_date);
                    const amount = Number(inst.amount || 0);

                    // Check overdue (due date before today)
                    if (dueDate < now) {
                        totalOverdue += amount;
                        overdueInstallmentsCount += 1;
                    }

                    // Check next earliest due
                    if (!earliestDueDate || dueDate < earliestDueDate) {
                        earliestDueDate = dueDate;
                        nextDueAmount = amount;
                        nextDueOrderNumber = plan.orderNumber || plan.id?.slice(0, 8)?.toUpperCase();
                        nextDuePlanId = plan.id;
                    }
                }
            });
        });

        let nextDueInfo = null;
        if (earliestDueDate) {
            const diffMs = earliestDueDate.getTime() - now.getTime();
            const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            nextDueInfo = {
                planId: nextDuePlanId,
                orderNumber: nextDueOrderNumber,
                amount: nextDueAmount,
                date: earliestDueDate,
                dateStr: earliestDueDate.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                }),
                daysRemaining,
                isOverdue: daysRemaining < 0,
                isDueToday: daysRemaining === 0
            };
        }

        return {
            activePlans,
            completedPlans,
            totalOutstanding,
            totalOverdue,
            overdueInstallmentsCount,
            hasOverdue: totalOverdue > 0,
            nextDueInfo
        };
    },

    /**
     * Inspect all active plans, check if an installment is due today or overdue,
     * and automatically send Email and WhatsApp reminders.
     */
    async checkAndSendInstallmentReminders({ userId, userEmail = null, userPhone = null, userName = null, plans = [] }) {
        if (!userId && !userEmail && !userPhone) return { checked: 0, sentReminders: 0 };

        try {
            const now = new Date();
            const todayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
            let remindersSent = 0;

            for (const plan of plans) {
                if (plan.isCompleted) continue;
                const schedule = Array.isArray(plan.schedule) ? plan.schedule : [];

                for (const inst of schedule) {
                    if (inst.status === 'paid') continue;

                    const dueDate = new Date(inst.due_date);
                    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue = diffDays < 0;
                    const isDueToday = diffDays === 0;
                    const isDueSoon = diffDays > 0 && diffDays <= 2;

                    // Trigger reminder if due within 2 days, due today, or overdue
                    if (isOverdue || isDueToday || isDueSoon) {
                        const reminderKey = `@abumafhal_pss_reminded_${plan.id}_inst${inst.installment_number}_${todayKey}`;
                        const alreadySent = await AsyncStorage.getItem(reminderKey);

                        if (!alreadySent) {
                            const instAmount = Number(inst.amount || 0);
                            const orderNum = plan.orderNumber || (plan.id || '').slice(0, 8).toUpperCase();
                            const dueDateFormatted = dueDate.toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                            });
                            const customerName = userName || 'Valued Customer';
                            const remainingTotal = Number(plan.remainingAmount || 0);

                            // 1. Send WhatsApp Notification
                            if (userPhone) {
                                let statusUrgency = isOverdue
                                    ? `⚠️ *OVERDUE by ${Math.abs(diffDays)} days*`
                                    : isDueToday
                                        ? '🔔 *DUE TODAY*'
                                        : `⏰ *Due in ${diffDays} day${diffDays > 1 ? 's' : ''}*`;

                                const waMessage = `🔔 *Abu Mafhal Pay Small Small Payment Reminder*\n\nHello *${customerName}*,\n\nYour installment *#${inst.installment_number}* for Order *#${orderNum}* is ${statusUrgency}.\n\n💵 *Installment Due:* ₦${instAmount.toLocaleString()}\n📅 *Due Date:* ${dueDateFormatted}\n💳 *Total Remaining Balance:* ₦${remainingTotal.toLocaleString()}\n\nTo ensure your 0% interest credit rating remains active and uninterrupted, please settle your installment today.\n\n👉 *Pay Securely Online:* https://abumafhal.com/mobile#paysmallsmall\n\nThank you for choosing Abu Mafhal Marketplace!`;

                                whatsappService.sendDirect(userPhone, waMessage, userId).catch(err => {
                                    console.log('[PaySmallSmallService] WhatsApp dispatch note:', err.message);
                                });
                            }

                            // 2. Send Automated Email Notification
                            if (userEmail && userEmail.includes('@')) {
                                const emailSubject = isOverdue
                                    ? `⚠️ URGENT: Overdue Installment #${inst.installment_number} for Order #${orderNum}`
                                    : `⏰ Payment Reminder: Installment #${inst.installment_number} for Order #${orderNum}`;

                                const emailHtml = `
                                <!DOCTYPE html>
                                <html>
                                <head>
                                  <style>
                                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 20px; color: #0F172A; }
                                    .card { max-width: 560px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                                    .header { background: #0A192F; padding: 28px 24px; text-align: center; }
                                    .header h1 { color: #FFFFFF; font-size: 20px; margin: 0; font-weight: 800; letter-spacing: 0.5px; }
                                    .header p { color: #D9A73A; font-size: 12px; margin: 6px 0 0; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
                                    .content { padding: 28px 24px; }
                                    .alert-box { background: ${isOverdue ? '#FEF2F2' : '#EFF6FF'}; border-left: 4px solid ${isOverdue ? '#DC2626' : '#2563EB'}; padding: 14px 16px; border-radius: 8px; margin-bottom: 20px; }
                                    .alert-box p { margin: 0; font-size: 13px; font-weight: 600; color: ${isOverdue ? '#991B1B' : '#1E40AF'}; }
                                    .stat-grid { background: #F8FAFC; border-radius: 12px; padding: 18px; margin-bottom: 24px; border: 1px solid #F1F5F9; }
                                    .stat-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
                                    .stat-row.total { border-top: 1px solid #E2E8F0; padding-top: 10px; margin-top: 10px; font-weight: 800; font-size: 15px; color: #0F172A; }
                                    .btn-container { text-align: center; margin: 24px 0 10px; }
                                    .pay-btn { display: inline-block; background: #0A192F; color: #FFFFFF !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 800; font-size: 14px; letter-spacing: 0.5px; }
                                    .footer { text-align: center; padding: 20px; font-size: 11px; color: #64748B; border-top: 1px solid #F1F5F9; background: #FAFAFA; }
                                  </style>
                                </head>
                                <body>
                                  <div class="card">
                                    <div class="header">
                                      <h1>ABU MAFHAL MARKETPLACE</h1>
                                      <p>Pay Small Small (BNPL) Installment Ledger</p>
                                    </div>
                                    <div class="content">
                                      <p style="font-size: 15px; margin-top: 0;">Hello <b>${customerName}</b>,</p>
                                      <div class="alert-box">
                                        <p>${isOverdue ? `⚠️ Your installment is overdue by ${Math.abs(diffDays)} days. Please settle immediately.` : isDueToday ? '🔔 Your installment payment is due today.' : `⏰ Friendly reminder: your installment is due in ${diffDays} days.`}</p>
                                      </div>
                                      <div class="stat-grid">
                                        <div class="stat-row"><span>Order Reference:</span><b style="color:#0A192F;">#${orderNum}</b></div>
                                        <div class="stat-row"><span>Installment Number:</span><b>#${inst.installment_number} of ${schedule.length}</b></div>
                                        <div class="stat-row"><span>Due Date:</span><b>${dueDateFormatted}</b></div>
                                        <div class="stat-row total"><span>Amount Due Now:</span><span style="color:#059669;">₦${instAmount.toLocaleString()}</span></div>
                                        <div class="stat-row" style="margin-top:6px; color:#64748B; font-size:12px;"><span>Remaining Plan Debt:</span><span>₦${remainingTotal.toLocaleString()}</span></div>
                                      </div>
                                      <div class="btn-container">
                                        <a href="https://abumafhal.com/mobile#paysmallsmall" class="pay-btn">Settle Installment Now →</a>
                                      </div>
                                    </div>
                                    <div class="footer">
                                      Abu Mafhal Marketplace • 0% Interest Buy Now Pay Later Guarantee<br>
                                      Need help? Contact support via WhatsApp at +234 814 585 3539.
                                    </div>
                                  </div>
                                </body>
                                </html>
                                `;

                                queueEmail({
                                    to: userEmail,
                                    subject: emailSubject,
                                    html: emailHtml,
                                    type: 'bnpl_reminder'
                                }).catch(err => {
                                    console.log('[PaySmallSmallService] Email dispatch note:', err.message);
                                });
                            }

                            // 3. Create In-App Notification record
                            if (userId) {
                                try {
                                    NotificationService.sendOrderNotification({
                                        userId,
                                        orderId: plan.id,
                                        amount: instAmount,
                                        gateway: 'Pay Small Small',
                                        email: userEmail,
                                        phone: userPhone
                                    }).catch(() => {});
                                } catch (_) {}
                            }

                            // Mark as sent for today
                            await AsyncStorage.setItem(reminderKey, 'sent');
                            remindersSent += 1;
                        }
                    }
                }
            }

            return { checked: plans.length, sentReminders: remindersSent };
        } catch (err) {
            console.warn('[PaySmallSmallService] checkAndSendInstallmentReminders error:', err);
            return { checked: 0, sentReminders: 0, error: err.message };
        }
    }
};
