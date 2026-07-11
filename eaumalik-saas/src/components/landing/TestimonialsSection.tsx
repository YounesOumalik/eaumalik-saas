const TESTIMONIALS = [
  { name: 'Mohammed Alami',         role: 'Restaurant, Casablanca', text: "Depuis l'installation du systeme EAUMALIK, la qualite de notre eau a considerablement ameliore. Nos clients remarquent la difference.", rating: 5 },
  { name: 'Fatima Zahra Bennani',   role: 'Foyer, Rabat',          text: "Service impeccable du debut a la fin. L'installateur etait ponctuel et professionnel. L'eau a un gout incroyable maintenant.", rating: 5 },
  { name: 'Karim Tazi',             role: 'Hotel, Marrakech',      text: "Nous avons equipe tout notre hotel avec les systemes EAUMALIK. Le rapport qualite-prix est excellent et le suivi maintenance est top.", rating: 4 },
];

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-1 mb-4">
      {Array.from({ length: 5 }, (_, i) => (
        <i
          key={i}
          className={`fa-${i < n ? 'solid' : 'regular'} fa-star text-xs`}
          style={{ color: i < n ? '#fbbf24' : 'var(--text-muted)' }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export default function TestimonialsSection() {
  return (
    <section className="py-24 px-4" style={{ background: 'var(--bg)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 reveal">
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold mb-4">
            Ce que disent <span className="gradient-text">nos clients</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <div key={t.name} className="glass-card p-6 reveal" style={{ transitionDelay: `${i * 100}ms` }}>
              <Stars n={t.rating} />
              <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-sm"
                  style={{ background: 'var(--bg-card-hover)', color: 'var(--primary-light)' }}
                  aria-hidden="true"
                >
                  {t.name.split(' ').map(w => w[0]).join('')}
                </div>
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
