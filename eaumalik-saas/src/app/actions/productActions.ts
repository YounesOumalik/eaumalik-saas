'use server';

import { revalidatePath } from 'next/cache';
import { createProduct, updateProduct, deleteProduct } from '@/data/repositories';
import type { Product } from '@/types';

export async function createProductAction(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) {
  try {
    const res = await createProduct(product);
    revalidatePath('/boutique');
    revalidatePath('/admin/catalogue');
    return { success: true, product: res };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateProductAction(id: string, product: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>) {
  try {
    const res = await updateProduct(id, product);
    revalidatePath('/boutique');
    revalidatePath('/admin/catalogue');
    return { success: true, product: res };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteProductAction(id: string) {
  try {
    await deleteProduct(id);
    revalidatePath('/boutique');
    revalidatePath('/admin/catalogue');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
