'use server';

import { readUsers, writeUsers } from '@/data/localDb';
import { getServerSession } from 'next-auth';

export async function registerUserAction(input: {
  email: string;
  passwordHash: string;
  full_name: string;
  phone: string;
  city: string;
  address?: string;
  referredBy?: string;
}) {
  try {
    const users = readUsers();
    
    if (users.some(u => u.email.toLowerCase() === input.email.toLowerCase())) {
      return { success: false, error: 'Cet email est deja utilise.' };
    }

    const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newUser = {
      id: `u-${Date.now()}`,
      email: input.email,
      password: input.passwordHash, // for demo, store direct/hashed
      full_name: input.full_name,
      phone: input.phone,
      city: input.city,
      address: input.address || null,
      role: 'client',
      referral_code: referralCode,
      referred_by: input.referredBy || null,
      cashback_balance: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (input.referredBy) {
      const referrer = users.find(u => u.referral_code === input.referredBy);
      if (referrer) {
        referrer.cashback_balance = (referrer.cashback_balance || 0) + 150; // Give 150 MAD to referrer
        newUser.cashback_balance = 50; // Give 50 MAD to new user
      }
    }

    users.push(newUser);
    writeUsers(users);

    return { success: true, user: { id: newUser.id, email: newUser.email, full_name: newUser.full_name } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getCurrentUserPermissionsAction() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) return { success: false, error: 'Non authentifie.' };
    const users = readUsers();
    const user = users.find(u => u.email.toLowerCase() === session.user!.email!.toLowerCase());
    if (!user) return { success: false, error: 'Utilisateur introuvable.' };

    return {
      success: true,
      role: user.role,
      permissions: user.permissions || {
        can_view_products: user.role === 'admin',
        can_edit_products: user.role === 'admin',
        can_validate_orders: user.role === 'admin',
        can_follow_prospects: user.role === 'admin',
        can_view_comptabilite: user.role === 'admin',
        can_view_stocks: user.role === 'admin',
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
