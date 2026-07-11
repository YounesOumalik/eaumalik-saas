import fs from 'fs';
import path from 'path';
import type { Product, Order, User, MaintenanceAlert } from '@/types';
import { MOCK_PRODUCTS } from './mock';

const DB_DIR = path.join(process.cwd(), 'data-store');

// Ensure DB directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const PRODUCTS_FILE = path.join(DB_DIR, 'products.json');
const ORDERS_FILE = path.join(DB_DIR, 'orders.json');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const CARTS_FILE = path.join(DB_DIR, 'carts.json');
const MESSAGES_FILE = path.join(DB_DIR, 'messages.json');
const NEWS_FILE = path.join(DB_DIR, 'news.json');

// Initialize with mock data if files don't exist
if (!fs.existsSync(PRODUCTS_FILE)) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(MOCK_PRODUCTS, null, 2));
}
if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(USERS_FILE)) {
  // Default admin user
  const defaultUsers: any[] = [
    {
      id: 'admin-id',
      email: 'eaumaliksarl@gmail.com',
      password: 'adminpassword123', // plain password for local dev ease
      full_name: 'Administrateur EAUMALIK',
      role: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
  fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
}
if (!fs.existsSync(CARTS_FILE)) {
  fs.writeFileSync(CARTS_FILE, JSON.stringify({}, null, 2));
}
if (!fs.existsSync(MESSAGES_FILE)) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(NEWS_FILE)) {
  const defaultNews = [
    {
      id: 'news-1',
      title: 'Nouveau Purificateur ECO LIFE 2026',
      content: 'Découvrez notre dernière technologie d\'osmose inverse avec réduction d\'eau rejetée de 50%. Disponible dès maintenant.',
      created_at: new Date().toISOString()
    },
    {
      id: 'news-2',
      title: 'Campagne de Maintenance Annuelle',
      content: 'Rappel à tous nos clients : pensez à vérifier vos filtres à charbon actif pour garantir la pureté de votre eau.',
      created_at: new Date().toISOString()
    }
  ];
  fs.writeFileSync(NEWS_FILE, JSON.stringify(defaultNews, null, 2));
}

// ---------------------------------------------------------
// Products
// ---------------------------------------------------------
export function readProducts(): Product[] {
  try {
    const data = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return MOCK_PRODUCTS;
  }
}

export function writeProducts(products: Product[]) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}

// ---------------------------------------------------------
// Orders
// ---------------------------------------------------------
export function readOrders(): Order[] {
  try {
    const data = fs.readFileSync(ORDERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function writeOrders(orders: Order[]) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

// ---------------------------------------------------------
// Users
// ---------------------------------------------------------
export function readUsers(): any[] {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function writeUsers(users: any[]) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ---------------------------------------------------------
// Carts
// ---------------------------------------------------------
export function readCarts(): Record<string, any[]> {
  try {
    const data = fs.readFileSync(CARTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

export function writeCarts(carts: Record<string, any[]>) {
  fs.writeFileSync(CARTS_FILE, JSON.stringify(carts, null, 2));
}

// ---------------------------------------------------------
// Messages
// ---------------------------------------------------------
export function readMessages(): any[] {
  try {
    const data = fs.readFileSync(MESSAGES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function writeMessages(messages: any[]) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

// ---------------------------------------------------------
// News / Actualités
// ---------------------------------------------------------
export function readNews(): any[] {
  try {
    const data = fs.readFileSync(NEWS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function writeNews(news: any[]) {
  fs.writeFileSync(NEWS_FILE, JSON.stringify(news, null, 2));
}
