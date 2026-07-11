'use server';

import { readUsers, writeUsers, readOrders, readMessages, writeMessages, readNews, writeNews, readCarts, writeCarts } from '@/data/localDb';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';

// Helper to get active session
async function getSessionUser() {
  const session = await getServerSession();
  if (!session?.user?.email) return null;
  const users = readUsers();
  const user = users.find(u => u.email.toLowerCase() === session.user!.email!.toLowerCase());
  return user || null;
}

export async function getClientDashboardData() {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'Non authentifie.' };

    const users = readUsers();
    const orders = readOrders();
    const allMessages = readMessages();
    const news = readNews();

    // Find users referred by this client
    const referredUsers = users
      .filter(u => u.referred_by === user.referral_code)
      .map(u => ({ id: u.id, name: u.full_name, email: u.email, created_at: u.created_at }));

    // Find orders of this client
    const userOrders = orders.filter(o => o.client_phone === user.phone || o.client_name === user.full_name);

    // Find chat messages
    const userMessages = allMessages.filter(
      m => m.senderId === user.id || m.recipientId === user.id
    );

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone || '',
        city: user.city || '',
        address: user.address || '',
        referral_code: user.referral_code,
        cashback_balance: user.cashback_balance || 0,
      },
      referredUsers,
      userOrders,
      userMessages,
      news,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function sendClientMessageAction(text: string) {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'Non authentifie.' };

    const allMessages = readMessages();
    const newMessage = {
      id: `msg-${Date.now()}`,
      senderId: user.id,
      senderName: user.full_name,
      recipientId: 'admin-id',
      text,
      timestamp: new Date().toISOString(),
    };

    allMessages.push(newMessage);
    writeMessages(allMessages);
    revalidatePath('/client');
    return { success: true, message: newMessage };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------
// Admin Actions for Messages & News
// ---------------------------------------------------------
export async function getAdminMessagesList() {
  try {
    const session = await getServerSession();
    if (session?.user?.email !== 'eaumaliksarl@gmail.com') {
      return { success: false, error: 'Non autorise.' };
    }

    const allMessages = readMessages();
    const users = readUsers();

    // Group messages by client id
    const clientsWithMessages = new Map<string, any>();
    allMessages.forEach(m => {
      const clientId = m.senderId === 'admin-id' ? m.recipientId : m.senderId;
      const clientName = m.senderId === 'admin-id' ? 'Client' : m.senderName;
      
      if (!clientsWithMessages.has(clientId)) {
        const clientObj = users.find(u => u.id === clientId);
        clientsWithMessages.set(clientId, {
          clientId,
          clientName: clientObj?.full_name || clientName,
          clientEmail: clientObj?.email || '',
          lastMessage: m.text,
          timestamp: m.timestamp,
          messages: []
        });
      }
      
      clientsWithMessages.get(clientId).messages.push(m);
    });

    return { success: true, clients: Array.from(clientsWithMessages.values()) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function sendAdminReplyAction(clientId: string, text: string) {
  try {
    const session = await getServerSession();
    if (session?.user?.email !== 'eaumaliksarl@gmail.com') {
      return { success: false, error: 'Non autorise.' };
    }

    const allMessages = readMessages();
    const newMessage = {
      id: `msg-${Date.now()}`,
      senderId: 'admin-id',
      senderName: 'Administrateur EAUMALIK',
      recipientId: clientId,
      text,
      timestamp: new Date().toISOString(),
    };

    allMessages.push(newMessage);
    writeMessages(allMessages);
    revalidatePath('/client');
    return { success: true, message: newMessage };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function publishNewsAction(title: string, content: string, imageUrl?: string) {
  try {
    const session = await getServerSession();
    if (session?.user?.email !== 'eaumaliksarl@gmail.com') {
      return { success: false, error: 'Non autorise.' };
    }

    const newsList = readNews();
    const newItem = {
      id: `news-${Date.now()}`,
      title,
      content,
      image_url: imageUrl || null,
      created_at: new Date().toISOString()
    };

    newsList.unshift(newItem);
    writeNews(newsList);
    revalidatePath('/client');
    revalidatePath('/');
    return { success: true, news: newItem };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveUserCartAction(items: any[]) {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'Non authentifie.' };

    const carts = readCarts();
    carts[user.id] = items;
    writeCarts(carts);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getUserCartAction() {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'Non authentifie.' };

    const carts = readCarts();
    return { success: true, items: carts[user.id] || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getUserProfileAction() {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'Non authentifie.' };
    
    // Return full profile except password
    const { password, ...profile } = user;
    return { success: true, profile };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateUserProfileAction(data: {
  full_name: string;
  phone: string;
  city: string;
  address?: string;
  password?: string;
}) {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'Non authentifie.' };

    const users = readUsers();
    const u = users.find(x => x.id === user.id);
    if (!u) return { success: false, error: 'Utilisateur introuvable.' };

    // Validations
    if (data.full_name.length < 3) return { success: false, error: 'Nom complet trop court (min. 3 caracteres).' };
    if (!/^0[6-7][0-9]{8}$/.test(data.phone)) return { success: false, error: 'Numero de telephone marocain invalide (ex: 06XXXXXXXX).' };
    if (!data.city) return { success: false, error: 'Ville obligatoire.' };

    u.full_name = data.full_name;
    u.phone = data.phone;
    u.city = data.city;
    u.address = data.address || null;
    if (data.password && data.password.trim().length >= 6) {
      u.password = data.password;
    }
    u.updated_at = new Date().toISOString();

    writeUsers(users);
    revalidatePath('/client');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
