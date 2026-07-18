import React, { useState, useEffect, useRef } from 'react';

const AnimatedCounter = ({ target, suffix = '', duration = 1500, stepSize = 1 }) => {
  const [count, setCount] = useState(0);
  const elementRef = useRef(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          let startTime = null;

          const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);
            
            // Easing out quadratic
            const easeProgress = percentage * (2 - percentage);
            
            const currentValue = parseFloat((easeProgress * target).toFixed(target % 1 === 0 ? 0 : 1));
            setCount(currentValue);

            if (percentage < 1) {
              requestAnimationFrame(animate);
            } else {
              setCount(target);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.1 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current);
      }
    };
  }, [target, duration]);

  return (
    <span ref={elementRef}>
      {count % 1 === 0 ? count.toLocaleString() : count.toFixed(1)}
      {suffix}
    </span>
  );
};

const STATS = [
  { target: 100, suffix: 'K+', label: 'Happy Customers' },
  { target: 15, suffix: 'K+', label: 'Active Sellers' },
  { target: 250, suffix: 'K+', label: 'Products Listed' },
  { target: 4.8, suffix: '/5', label: 'Customer Rating' }
];

export const StatsSection = () => {
  return (
    <section className="py-20 bg-[#0E1A2E] text-[#F5F3EB] relative overflow-hidden font-['Inter']">
      {/* Decorative borders or watermarks */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#D9A73A]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map((stat, i) => (
            <div
              key={i}
              className="p-8 bg-white/5 border border-white/10 rounded-3xl flex flex-col items-center text-center shadow-lg transition-transform duration-300 hover:scale-105 hover:border-[#D9A73A]/40"
            >
              <div className="text-4xl md:text-5xl font-extrabold text-[#D9A73A] font-['Poppins'] tracking-tight">
                <AnimatedCounter target={stat.target} suffix={stat.suffix} />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-3">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
export default StatsSection;
