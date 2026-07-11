'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef } from 'react';

export default function HeroSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0;
    const bubbles = Array.from({ length: 35 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 2000,
      r: Math.random() * 3 + 0.5,
      speed: Math.random() * 0.8 + 0.2,
      opacity: Math.random() * 0.4 + 0.05,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: Math.random() * 0.015 + 0.005,
    }));

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      w = canvas.width = parent.offsetWidth;
      h = canvas.height = parent.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let raf: number;
    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      bubbles.forEach(b => {
        b.y -= b.speed;
        b.wobble += b.wobbleSpeed;
        b.x += Math.sin(b.wobble) * 0.4;
        if (b.y < -20) { b.y = h + 20; b.x = Math.random() * w; }
        ctx.beginPath();
        ctx.arc(b.x, b.y, Math.max(0.5, b.r), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34, 211, 238, ${b.opacity})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <section className="hero-bg relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-[1]" aria-hidden="true" />
      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center reveal">
        <div className="flex justify-center mb-6 animate-float">
          <div className="h-64 sm:h-[28rem] w-full max-w-3xl sm:max-w-5xl relative">
            <Image src="/logo.png" alt="EAUMALIK Logo" fill className="object-contain" unoptimized />
          </div>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-8 animate-float" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          <span className="pulse-dot" style={{ background: 'var(--primary-light)' }} />
          Leader du traitement de l&apos;eau au Maroc
        </div>
        <h1 className="hero-title mb-6 animate-float-delay">
          L&apos;eau pure,<br /><span className="gradient-text">une vie plus saine</span>
        </h1>
        <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-10" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Solutions professionnelles de traitement et purification de l&apos;eau pour les foyers,
          hotels, restaurants et industries. Installation experte et service de maintenance.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/boutique" className="btn-primary text-base px-8 py-3.5">
            <i className="fa-solid fa-droplet" aria-hidden="true" /> Decouvrir nos produits
          </Link>
          <a href="#features" className="btn-outline text-base px-8 py-3.5">
            <i className="fa-solid fa-shield-halved" aria-hidden="true" /> Pourquoi EAUMALIK
          </a>
        </div>
        <div className="grid grid-cols-3 gap-6 mt-16 max-w-lg mx-auto">
          <div><div className="text-2xl sm:text-3xl font-display font-extrabold gradient-text">500+</div><div className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Installations</div></div>
          <div><div className="text-2xl sm:text-3xl font-display font-extrabold gradient-text">99%</div><div className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Impuretes eliminees</div></div>
          <div><div className="text-2xl sm:text-3xl font-display font-extrabold gradient-text">24h</div><div className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Livraison rapide</div></div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 overflow-hidden" style={{ height: 120 }}>
        <div className="absolute bottom-0 left-0 w-[200%] animate-wave-move" aria-hidden="true">
          <svg viewBox="0 0 2880 120" preserveAspectRatio="none" style={{ height: 120, width: '100%' }}>
            <path fill="var(--bg)" fillOpacity="0.3" d="M0,60 C480,120 960,0 1440,60 C1920,120 2400,0 2880,60 L2880,120 L0,120Z" />
          </svg>
        </div>
        <div className="absolute bottom-0 left-0 w-[200%] animate-wave-move [animation-direction:reverse] [animation-duration:16s] opacity-50" aria-hidden="true">
          <svg viewBox="0 0 2880 120" preserveAspectRatio="none" style={{ height: 120, width: '100%' }}>
            <path fill="var(--bg)" d="M0,80 C360,20 720,100 1440,60 C2160,20 2520,100 2880,80 L2880,120 L0,120Z" />
          </svg>
        </div>
      </div>
    </section>
  );
}
