-- Migration 0006 : Ajout du rôle "Administrateur" (administrator)
-- Un Administrateur a tous les droits SAUF la possibilité de supprimer le Superadministrateur.

-- 1) Supprime l'ancien CHECK constraint sur la colonne users.role
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

-- 2) Ajoute le nouveau CHECK constraint incluant tous les rôles
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('client','admin','administrator','sales','technician','stock_manager','admin_assistant'));
