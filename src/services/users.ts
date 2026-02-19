import { supabase } from '@/lib/supabaseClient';
import type { UserProfile, UserRole } from '@/types';

export const userService = {
    /**
     * Get all users (Admin only)
     */
    async getUsers(roleFilter: string = 'all') {
        let query = supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (roleFilter !== 'all') {
            query = query.eq('role', roleFilter);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as UserProfile[];
    },

    /**
     * Update User Role
     */
    async updateUserRole(userId: string, newRole: UserRole) {
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);

        if (error) throw error;
        return true;
    }
};
