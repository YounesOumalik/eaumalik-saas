-- Migration 0007 : Ajout du champ "Prix sur devis" sur les produits
-- Quand price_on_request = true, le prix n'est pas affiché en boutique
-- et le bouton "Ajouter au panier" est remplacé par "Demander un devis".

ALTER TABLE eaumalik.products
  ADD COLUMN IF NOT EXISTS price_on_request BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN eaumalik.products.price_on_request IS
  'Si true, le prix du produit n''est pas affiché en boutique : remplacé par "Sur devis".';