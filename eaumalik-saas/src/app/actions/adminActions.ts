'use server';

import { readUsers, writeUsers } from '@/data/localDb';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';

// Helper to check if current user is superadmin (admin)
async function requireSuperAdmin() {
  const session = await getServerSession();
  if (!session?.user?.email) throw new Error('Non authentifié.');
  const users = readUsers();
  const user = users.find(u => u.email.toLowerCase() === session.user!.email!.toLowerCase());
  if (!user || user.role !== 'admin') {
    throw new Error('Accès refusé. Droits superadministrateur requis.');
  }
  return user;
}

export async function listStaffUsersAction() {
  try {
    await requireSuperAdmin();
    const users = readUsers();
    // Staff are users whose role is NOT 'client'
    const staff = users.filter(u => u.role !== 'client');
    return { success: true, staff };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createStaffUserAction(data: {
  email: string;
  passwordHash: string;
  full_name: string;
  phone: string;
  role: string;
  permissions: {
    can_view_products: boolean;
    can_edit_products: boolean;
    can_validate_orders: boolean;
    can_follow_prospects: boolean;
    can_view_comptabilite: boolean;
    can_view_stocks: boolean;
  };
}) {
  try {
    await requireSuperAdmin();
    const users = readUsers();
    if (users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      return { success: false, error: 'Cet email est déjà utilisé.' };
    }

    const newStaff = {
      id: `staff-${Date.now()}`,
      email: data.email,
      password: data.passwordHash,
      full_name: data.full_name,
      phone: data.phone,
      role: data.role,
      permissions: data.permissions,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    users.push(newStaff);
    writeUsers(users);
    revalidatePath('/admin/personnels');
    return { success: true, staff: newStaff };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateStaffUserAction(
  id: string,
  data: {
    email: string;
    full_name: string;
    phone: string;
    role: string;
    password?: string;
    permissions: {
      can_view_products: boolean;
      can_edit_products: boolean;
      can_validate_orders: boolean;
      can_follow_prospects: boolean;
      can_view_comptabilite: boolean;
      can_view_stocks: boolean;
    };
  }
) {
  try {
    await requireSuperAdmin();
    const users = readUsers();
    const staff = users.find(u => u.id === id);
    if (!staff) return { success: false, error: 'Membre du personnel introuvable.' };

    // Check email uniqueness if changed
    if (data.email.toLowerCase() !== staff.email.toLowerCase() && users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      return { success: false, error: 'Cet email est déjà utilisé.' };
    }

    staff.email = data.email;
    staff.full_name = data.full_name;
    staff.phone = data.phone;
    staff.role = data.role;
    staff.permissions = data.permissions;
    if (data.password && data.password.trim()) {
      staff.password = data.password;
    }
    staff.updated_at = new Date().toISOString();

    writeUsers(users);
    revalidatePath('/admin/personnels');
    return { success: true, staff };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteStaffUserAction(id: string) {
  try {
    const admin = await requireSuperAdmin();
    if (id === admin.id) {
      return { success: false, error: 'Vous ne pouvez pas supprimer votre propre compte administrateur.' };
    }

    const users = readUsers();
    const filtered = users.filter(u => u.id !== id);
    writeUsers(filtered);
    revalidatePath('/admin/personnels');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
