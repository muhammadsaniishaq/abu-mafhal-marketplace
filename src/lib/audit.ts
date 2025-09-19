import { adminDb } from './admin';
export async function logAudit(actorId: string, action: string, target: any, meta: any, ip?: string, ua?: string){
await adminDb.collection('auditLogs').add({ actorId, action, target, meta, ip, userAgent: ua, createdAt: new Date() });
}