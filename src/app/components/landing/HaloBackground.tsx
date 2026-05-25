import React, { useEffect, useRef } from 'react';

export const HaloBackground: React.FC = () => {
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (!imgRef.current) return;
      const dx = (e.clientX / window.innerWidth - 0.5) * 20;
      const dy = (e.clientY / window.innerHeight - 0.5) * 20;
      imgRef.current.style.transform = `scale(1.1) translate(${dx}px, ${dy}px)`;
    };
    window.addEventListener('mousemove', onMouse);
    return () => window.removeEventListener('mousemove', onMouse);
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden" style={{ background: '#030308' }}>

      {/* 3D rendered background image with mouse parallax */}
      <div
        ref={imgRef}
        className="absolute inset-0 will-change-transform"
        style={{ transition: 'transform 0.15s ease-out', transform: 'scale(1.1)' }}
      >
        <img
          src="/hero3d.png"
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: 'brightness(0.5) saturate(1.4) contrast(1.05)' }}
        />
      </div>

      {/* Gradient overlays for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/35 to-black/92 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-transparent to-black/55 pointer-events-none" />

      {/* Pulsing indigo tint over the center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 75% 55% at 50% 38%, rgba(99,102,241,0.14) 0%, transparent 68%)',
          animation: 'bgBreathe 7s ease-in-out infinite',
        }}
      />

      {/* Bottom fade to solid black so sections below blend smoothly */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black to-transparent pointer-events-none" />

      <style>{`
        @keyframes bgBreathe {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
