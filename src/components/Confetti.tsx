import { useEffect, useRef, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
}

const COLORS = [
  'hsl(217, 91%, 60%)',   // primary
  'hsl(172, 66%, 50%)',   // accent
  'hsl(45, 93%, 52%)',    // gold
  'hsl(0, 72%, 55%)',     // red
  'hsl(280, 70%, 60%)',   // purple
  'hsl(152, 60%, 48%)',   // success
];

interface ConfettiProps {
  active: boolean;
  duration?: number;
  particleCount?: number;
}

export function Confetti({ active, duration = 2500, particleCount = 60 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);

  const spawn = useCallback(() => {
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.random() * Math.PI * 2);
      const velocity = 4 + Math.random() * 6;
      particles.push({
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.4,
        vx: Math.cos(angle) * velocity * (0.5 + Math.random()),
        vy: Math.sin(angle) * velocity - 3,
        size: 4 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        life: 0,
        maxLife: 60 + Math.random() * 40,
      });
    }
    particlesRef.current = particles;
  }, [particleCount]);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    spawn();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      particlesRef.current.forEach(p => {
        p.life++;
        if (p.life > p.maxLife) return;
        alive = true;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // gravity
        p.vx *= 0.99;
        p.rotation += p.rotationSpeed;

        const alpha = 1 - (p.life / p.maxLife);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      if (alive) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);

    const timer = setTimeout(() => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }, duration);

    return () => {
      clearTimeout(timer);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [active, duration, spawn]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9998] pointer-events-none"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
