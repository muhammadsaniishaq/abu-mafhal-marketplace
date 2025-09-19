export type Role = 'superadmin'|'admin'|'vendor'|'moderator'|'customer'|'guest';


export const PERMISSIONS = {
users: { read: ['admin','superadmin','moderator'], write: ['admin','superadmin'], del: ['superadmin'] },
vendors: { read: ['admin','superadmin','moderator'], write: ['admin','superadmin'], del: ['admin','superadmin'] },
products: { read: ['vendor','admin','superadmin','moderator'], write: ['vendor','admin','superadmin'], del: ['vendor','admin','superadmin'] },
orders: { read: ['vendor','admin','superadmin','moderator'], write: ['admin','superadmin'], del: ['superadmin'] },
refunds: { read: ['admin','superadmin','moderator'], write: ['admin','superadmin'], del: ['superadmin'] },
cms: { read: ['admin','superadmin','moderator'], write: ['admin','superadmin'], del: ['superadmin'] },
settings: { read: ['admin','superadmin'], write: ['superadmin'], del: ['superadmin'] },
} as const;


export function can(module: keyof typeof PERMISSIONS, action: 'read'|'write'|'del', role: Role) {
return PERMISSIONS[module][action].includes(role);
}