import Footer from './Footer';
import FooterVisibility from './FooterVisibility';

/**
 * Le Footer reste un Server Component, mais sa visibilité dépend d'un petit
 * wrapper client. On évite ainsi `headers()` dans le layout racine, qui
 * forçait toutes les pages publiques à être rendues dynamiquement.
 */
export default function FooterGate() {
  return (
    <FooterVisibility>
      <Footer />
    </FooterVisibility>
  );
}
