import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { Brain, Shield, Zap, Github, Twitter, Globe, ArrowRight, Sparkles, TrendingUp, Clock, ChevronDown } from "lucide-react";
import { HaloBackground } from "../components/landing/HaloBackground";
import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";

/* ── Google Font ─────────────────────────────────────────────────────────── */
if (!document.getElementById("halo-font")) {
  const l = document.createElement("link"); l.id = "halo-font";
  l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap";
  document.head.appendChild(l);
}

/* ── Custom Cursor ───────────────────────────────────────────────────────── */
const CustomCursor = () => {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 });
  const ringPos = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const move = (e: MouseEvent) => { pos.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", move);
    let raf: number;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const tick = () => {
      ringPos.current.x = lerp(ringPos.current.x, pos.current.x, 0.12);
      ringPos.current.y = lerp(ringPos.current.y, pos.current.y, 0.12);
      if (dot.current) { dot.current.style.left = `${pos.current.x}px`; dot.current.style.top = `${pos.current.y}px`; }
      if (ring.current) { ring.current.style.left = `${ringPos.current.x}px`; ring.current.style.top = `${ringPos.current.y}px`; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener("mousemove", move); cancelAnimationFrame(raf); };
  }, []);
  return (
    <>
      <div ref={dot} className="fixed pointer-events-none z-[999] -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
        style={{ background: "#818cf8", boxShadow: "0 0 8px #818cf8, 0 0 20px rgba(99,102,241,0.5)" }} />
      <div ref={ring} className="fixed pointer-events-none z-[998] -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full border border-indigo-400/50"
        style={{ boxShadow: "0 0 12px rgba(99,102,241,0.2)" }} />
    </>
  );
};

/* ── Magnetic Button ─────────────────────────────────────────────────────── */
const MagneticBtn = ({ children, onClick, className = "", style = {} }: any) => {
  const ref = useRef<HTMLButtonElement>(null);
  const handleMove = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.28;
    const y = (e.clientY - r.top - r.height / 2) * 0.28;
    el.style.transform = `translate(${x}px, ${y}px) scale(1.04)`;
  };
  const handleLeave = () => { if (ref.current) ref.current.style.transform = "translate(0,0) scale(1)"; };
  return (
    <button ref={ref} onClick={onClick} onMouseMove={handleMove} onMouseLeave={handleLeave}
      className={className} style={{ transition: "transform 0.25s ease", ...style }}>
      {children}
    </button>
  );
};

/* ── 3D Tilt Card ────────────────────────────────────────────────────────── */
const TiltCard = ({ children, className = "", intensity = 14 }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1000px) rotateY(${x * intensity}deg) rotateX(${-y * intensity}deg) scale(1.03)`;
    const shine = el.querySelector<HTMLElement>(".shine");
    if (shine) { shine.style.background = `radial-gradient(circle at ${(x+0.5)*100}% ${(y+0.5)*100}%, rgba(255,255,255,0.12) 0%, transparent 60%)`; shine.style.opacity = "1"; }
  }, [intensity]);
  const onLeave = useCallback(() => {
    const el = ref.current; if (!el) return;
    el.style.transform = "perspective(1000px) rotateY(0) rotateX(0) scale(1)";
    const shine = el.querySelector<HTMLElement>(".shine");
    if (shine) shine.style.opacity = "0";
  }, []);
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={className}
      style={{ transition: "transform 0.2s ease", transformStyle: "preserve-3d", willChange: "transform", position: "relative" }}>
      <div className="shine absolute inset-0 rounded-[inherit] pointer-events-none z-10 transition-opacity duration-300" style={{ opacity: 0 }} />
      {children}
    </div>
  );
};

/* ── Typewriter ──────────────────────────────────────────────────────────── */
const WORDS = ["Redefined.", "Reimagined.", "Autonomous.", "Accelerated.", "Mastered."];
function useTypewriter() {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [del, setDel] = useState(false);
  useEffect(() => {
    const w = WORDS[idx], speed = del ? 42 : 88;
    const t = setTimeout(() => {
      if (!del) {
        setText(w.slice(0, text.length + 1));
        if (text.length + 1 === w.length) setTimeout(() => setDel(true), 1800);
      } else {
        setText(text.slice(0, -1));
        if (text.length === 0) { setDel(false); setIdx(i => (i + 1) % WORDS.length); }
      }
    }, speed);
    return () => clearTimeout(t);
  }, [text, del, idx]);
  return text;
}

/* ── FadeIn ──────────────────────────────────────────────────────────────── */
const FadeIn = ({ children, delay = 0, className = "" }: any) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
};

/* ── CountUp ─────────────────────────────────────────────────────────────── */
const CountUp = ({ target, suffix = "" }: any) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let n = 0; const step = Math.ceil(target / 40);
    const t = setInterval(() => { n = Math.min(n + step, target); setV(n); if (n >= target) clearInterval(t); }, 34);
    return () => clearInterval(t);
  }, [inView, target]);
  return <span ref={ref}>{v}{suffix}</span>;
};

/* ── Pill Badge ──────────────────────────────────────────────────────────── */
const Badge = ({ children }: any) => (
  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase"
    style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />{children}
  </div>
);

/* ── Gradient Heading ────────────────────────────────────────────────────── */
const GradHead = ({ children, className = "" }: any) => (
  <h2 className={`font-black tracking-tighter bg-clip-text text-transparent ${className}`}
    style={{ backgroundImage: "linear-gradient(135deg,#e0e7ff 0%,#818cf8 40%,#22d3ee 70%,#34d399 100%)" }}>
    {children}
  </h2>
);

/* ── Divider ─────────────────────────────────────────────────────────────── */
const Divider = () => (
  <div className="mx-auto w-20 h-px my-4 rounded-full"
    style={{ background: "linear-gradient(90deg,transparent,#6366f1,transparent)" }} />
);

/* ── Infinite Ticker ─────────────────────────────────────────────────────── */
const TICKER_ITEMS = [
  "🗺️ Roadmap Generation", "📅 Smart Scheduling", "🔮 Mastery Tracking",
  "🛡️ Auto Healing", "⚡ Spaced Repetition", "💡 RAG Resources",
  "🤖 Fully Autonomous", "🔬 AI Progress Reports", "🎯 Goal Analysis", "🔗 Resource Curation",
];
const Ticker = () => {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="relative overflow-hidden py-4" style={{ maskImage: "linear-gradient(90deg,transparent,black 10%,black 90%,transparent)" }}>
      <div className="flex gap-6 animate-[ticker_22s_linear_infinite]" style={{ width: "max-content" }}>
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-slate-300 whitespace-nowrap"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

/* ── 3D Perspective Grid Section ─────────────────────────────────────────── */
const PerspGrid = ({ children, className = "" }: any) => (
  <div className={`relative ${className}`}>
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ perspective: "600px" }}>
      <div className="absolute inset-0 opacity-[0.04]"
        style={{
          transform: "rotateX(70deg) translateY(-40%)",
          backgroundImage: "linear-gradient(rgba(99,102,241,1) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,1) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
    </div>
    {children}
  </div>
);

/* ── How It Works step ───────────────────────────────────────────────────── */
const HOW_STEPS = [
  { num: "01", icon: "🎯", title: "Set Your Goal", desc: "Tell HALO what you want to master — subject, depth, and your available time.", color: "#6366f1" },
  { num: "02", icon: "🗺️", title: "Agents Build Plan", desc: "Roadmap Architect + Schedule Strategist generate your full personalised roadmap and calendar in seconds.", color: "#06b6d4" },
  { num: "03", icon: "📚", title: "Study with AI Resources", desc: "Every session comes pre-loaded with the best free YouTube lectures, PDFs, and practice problems.", color: "#10b981" },
  { num: "04", icon: "🛡️", title: "HALO Heals & Adapts", desc: "Miss a day? Guardian Agent detects it and silently restores your week. Progress Oracle tracks your mastery.", color: "#f59e0b" },
];

const HowStep = ({ step, i }: { step: typeof HOW_STEPS[0], i: number }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 40, rotateX: -15 }}
      animate={inView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
      transition={{ duration: 0.7, delay: i * 0.18, ease: "easeOut" }}
      style={{ transformStyle: "preserve-3d", perspective: "800px" }}>
      <TiltCard intensity={10}>
        <div className="relative p-7 rounded-3xl h-full"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: `0 0 40px ${step.color}15`, transformStyle: "preserve-3d" }}>
          {/* Step number — "lifts" in 3D */}
          <div className="absolute -top-4 -right-4 w-12 h-12 rounded-2xl flex items-center justify-center text-xs font-black text-white"
            style={{ background: `linear-gradient(135deg,${step.color},${step.color}88)`, boxShadow: `0 8px 24px ${step.color}55`, transform: "translateZ(20px)" }}>
            {step.num}
          </div>
          <div className="text-4xl mb-4" style={{ transform: "translateZ(10px)" }}>{step.icon}</div>
          <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
          <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
          {/* Connector line (not on last) */}
          {i < HOW_STEPS.length - 1 && (
            <motion.div initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : {}}
              transition={{ duration: 0.8, delay: i * 0.18 + 0.5 }}
              className="hidden lg:block absolute -right-8 top-1/2 -translate-y-1/2 w-8 h-px origin-left"
              style={{ background: `linear-gradient(90deg,${step.color},${HOW_STEPS[i+1]?.color ?? step.color})` }} />
          )}
        </div>
      </TiltCard>
    </motion.div>
  );
};

/* ── Floating 3D decoration orbs ────────────────────────────────────────── */
const FloatOrb = ({ color, size, top, left, delay = 0 }: any) => (
  <div className="absolute rounded-full pointer-events-none blur-3xl opacity-20"
    style={{
      width: size, height: size, top, left,
      background: color,
      animation: `orbFloat ${6 + delay}s ease-in-out ${delay}s infinite alternate`,
    }} />
);

/* ── Agent card ──────────────────────────────────────────────────────────── */
const AgentCard = ({ num, name, role, icon, desc, gradFrom, gradTo, img, tags, reverse, delay }: any) => (
  <FadeIn delay={delay}>
    <div className={`flex flex-col ${reverse ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-12 lg:gap-20`}>
      <div className="flex-1 space-y-5">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-white text-xs font-bold tracking-widest uppercase"
          style={{ background: `linear-gradient(135deg,${gradFrom},${gradTo})`, boxShadow: `0 0 24px ${gradFrom}44` }}>
          AGENT {num}
        </div>
        <div className="flex items-center gap-3.5">
          <span className="text-5xl">{icon}</span>
          <h3 className="text-3xl lg:text-4xl font-black tracking-tight text-white">{name}</h3>
        </div>
        <p className="text-lg font-light italic" style={{ color: gradFrom }}>&ldquo;{role}&rdquo;</p>
        <p className="text-slate-400 text-base leading-relaxed">{desc}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {tags.map((t: string, i: number) => (
            <span key={i} className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: `${gradFrom}18`, color: gradFrom, border: `1px solid ${gradFrom}35` }}>{t}</span>
          ))}
        </div>
      </div>

      <div className="flex-1 w-full max-w-lg">
        <TiltCard className="relative rounded-3xl overflow-hidden border border-white/10 group"
          style={{ boxShadow: `0 30px 80px ${gradFrom}22` } as any}>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-10"
            style={{ boxShadow: `inset 0 0 60px ${gradFrom}30` }} />
          <img src={img} alt={name} className="w-full aspect-[4/3] object-cover transition-transform duration-700 group-hover:scale-105"
            style={{ filter: "brightness(0.82) saturate(1.25)" }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-xl backdrop-blur-md text-xs font-semibold"
            style={{ background: "rgba(0,0,0,0.65)", border: `1px solid ${gradFrom}44`, color: gradFrom }}>
            {icon} {name}
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-4 py-2 rounded-full backdrop-blur-md border border-white/10"
            style={{ background: "rgba(0,0,0,0.75)" }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: gradFrom }} />
            <span className="text-xs text-white/70 font-medium">Active · Autonomous</span>
          </div>
        </TiltCard>
      </div>
    </div>
  </FadeIn>
);

/* ══════════════════════════════════════════════════════════════════════════ */
export const LandingPage = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.14], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.14], [1, 0.87]);
  const word = useTypewriter();

  useEffect(() => {
    const h = () => { setScrolled(window.scrollY > 50); setShowSticky(window.scrollY > window.innerHeight * 0.7); };
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  const agents = [
    { num:"01", name:"Roadmap Architect", role:"The Strategist", icon:"🗺️",
      desc:"Analyzes your subject, skill level, and goals to produce a structured multi-phase roadmap — with difficulty-scored topics and curated resources.",
      gradFrom:"#6366f1", gradTo:"#7c3aed", img:"/agent_roadmap.png",
      tags:["📚 Roadmap Generation","🎯 Goal Analysis","⚡ Difficulty Scoring","🔗 Resource Curation"] },
    { num:"02", name:"Schedule Strategist", role:"The Orchestrator", icon:"📅",
      desc:"Converts your roadmap into an intelligent spaced-repetition calendar — scheduling study, review, and practice around your real-world availability.",
      gradFrom:"#06b6d4", gradTo:"#0284c7", img:"/agent_strategist.png",
      tags:["📅 Calendar Planning","🔁 Spaced Repetition","⏰ Smart Blocking","🗓️ Conflict Detection"], reverse:true },
    { num:"03", name:"Progress Oracle", role:"The Analyst", icon:"🔮",
      desc:"Monitors mastery scores in real-time, generates AI-powered weekly performance reports, unlocks achievements, and surfaces your optimal next step.",
      gradFrom:"#10b981", gradTo:"#0d9488", img:"/agent_oracle.png",
      tags:["📊 Mastery Scoring","🏆 Achievements","📈 Weekly Reports","🔮 Predictive Insights"] },
    { num:"04", name:"Guardian Agent", role:"The Sentinel", icon:"🛡️",
      desc:"The self-healing backbone. Detects missed sessions, auto-reschedules your week, and keeps you precisely on track — zero intervention needed.",
      gradFrom:"#f59e0b", gradTo:"#d97706", img:"/agent_guardian.png",
      tags:["🛡️ Schedule Healing","🔔 Drift Detection","🔄 Auto-Reschedule","🤖 Fully Autonomous"], reverse:true },
  ];

  return (
    <div className="relative bg-[#030308] text-white selection:bg-indigo-500/30 overflow-x-hidden" style={{ fontFamily:"'Inter',sans-serif" }}>
      <CustomCursor />
      <HaloBackground />
      <div className="fixed inset-0 z-[1] pointer-events-none bg-gradient-to-b from-black/15 via-black/25 to-black/70" />

      {/* Progress bar */}
      <motion.div className="fixed top-0 left-0 right-0 h-[2px] z-[60] origin-left"
        style={{ scaleX: scrollYProgress, background: "linear-gradient(90deg,#6366f1,#06b6d4,#10b981)" }} />

      {/* Sticky CTA */}
      <AnimatePresence>
        {showSticky && (
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:20 }}
            transition={{ duration:0.4 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <MagneticBtn onClick={() => navigate("/signup")}
              className="flex items-center gap-2.5 px-7 py-3 rounded-full font-bold text-sm text-white"
              style={{ background:"linear-gradient(135deg,#6366f1,#06b6d4)", boxShadow:"0 8px 40px rgba(99,102,241,0.55), 0 0 0 1px rgba(255,255,255,0.1)" }}>
              <span className="w-2 h-2 rounded-full bg-white/80 animate-pulse" />
              Start your HALO journey
              <ArrowRight size={15} />
            </MagneticBtn>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navbar */}
      <nav className={`fixed top-2 inset-x-3 lg:inset-x-10 z-50 transition-all duration-500 rounded-2xl ${scrolled ? "bg-black/70 backdrop-blur-2xl border border-white/8 px-6 py-3" : "bg-transparent px-6 py-5"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => window.scrollTo({ top:0, behavior:"smooth" })}>
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-indigo-500/40 group-hover:border-indigo-400 transition-colors" />
              <div className="w-3.5 h-3.5 rounded-sm rotate-45 group-hover:rotate-90 transition-transform duration-500"
                style={{ background:"linear-gradient(135deg,#818cf8,#22d3ee)", boxShadow:"0 0 10px rgba(99,102,241,0.7)" }} />
            </div>
            <span className="text-lg font-black tracking-tight">HALO</span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
            {["Features","Agents","How It Works","Stats"].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g,"-")}`} className="hover:text-white transition-colors relative group">
                {l}<span className="absolute -bottom-0.5 left-0 w-0 h-px bg-indigo-400 transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/login")} className="hidden sm:block text-sm text-slate-400 hover:text-white transition-colors">Sign in</button>
            <MagneticBtn onClick={() => navigate("/signup")}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background:"linear-gradient(135deg,#6366f1,#06b6d4)", boxShadow:"0 4px 20px rgba(99,102,241,0.35)" }}>
              Get Started
            </MagneticBtn>
          </div>
        </div>
      </nav>

      {/* ══ HERO ═════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden z-10">
        {/* Depth orbs behind hero text */}
        <FloatOrb color="rgba(99,102,241,0.6)" size="500px" top="-100px" left="-150px" delay={0} />
        <FloatOrb color="rgba(6,182,212,0.5)" size="400px" top="30%" left="70%" delay={2} />
        <FloatOrb color="rgba(168,85,247,0.4)" size="300px" top="60%" left="10%" delay={1} />

        <motion.div style={{ opacity:heroOpacity, scale:heroScale }} className="max-w-5xl mx-auto text-center relative">
          <motion.div initial={{ opacity:0, y:-14 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7 }} className="mb-10">
            <Badge>Autonomous Agent Core · v2.0 · 4 Agents Active</Badge>
          </motion.div>

          <motion.h1 initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.9, delay:0.1 }}
            className="text-6xl sm:text-7xl md:text-[7.5rem] font-black tracking-tighter leading-none mb-0"
            style={{ textShadow:"0 0 80px rgba(99,102,241,0.3)" }}>
            Study,
          </motion.h1>
          <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} transition={{ duration:0.9, delay:0.2 }}
            className="text-6xl sm:text-7xl md:text-[7.5rem] font-black tracking-tighter leading-none mb-8 flex items-center justify-center min-h-[1.2em]">
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage:"linear-gradient(135deg,#818cf8,#22d3ee,#34d399,#818cf8)", backgroundSize:"200% auto", animation:"gradAnim 5s linear infinite" }}>
              {word}
            </span>
            <span className="inline-block w-[3px] h-[0.75em] ml-1.5 rounded-full animate-pulse align-middle"
              style={{ background:"#818cf8", verticalAlign:"middle" }} />
          </motion.div>

          <motion.p initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.9, delay:0.3 }}
            className="max-w-xl mx-auto text-lg text-slate-400 leading-relaxed mb-10">
            HALO is the world's first <strong className="text-white font-semibold">self-healing learning platform</strong>.
            Four AI agents design, schedule, curate, and restore your study plan — fully autonomously.
          </motion.p>

          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.9, delay:0.42 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-4">
            <MagneticBtn onClick={() => navigate("/signup")}
              className="group flex items-center gap-2.5 px-9 py-4 rounded-2xl font-bold text-base text-white"
              style={{ background:"linear-gradient(135deg,#6366f1,#06b6d4)", boxShadow:"0 8px 40px rgba(99,102,241,0.45)", border:"1px solid rgba(255,255,255,0.1)" }}>
              Initialize Core
              <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
            </MagneticBtn>
            <MagneticBtn onClick={() => document.getElementById("agents")?.scrollIntoView({ behavior:"smooth" })}
              className="px-9 py-4 rounded-2xl font-bold text-base text-slate-300 hover:text-white transition-all"
              style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)" }}>
              Meet the Agents ↓
            </MagneticBtn>
          </motion.div>

          {/* 3D Hero card */}
          <motion.div initial={{ opacity:0, y:70, rotateX:15 }} animate={{ opacity:1, y:0, rotateX:0 }}
            transition={{ duration:1.2, delay:0.65, ease:"easeOut" }}
            className="mt-16 relative mx-auto max-w-3xl" style={{ perspective:"1400px" }}>
            <TiltCard intensity={8} className="relative rounded-3xl overflow-hidden border border-white/10"
              style={{ boxShadow:"0 40px 100px rgba(99,102,241,0.22), 0 0 0 1px rgba(255,255,255,0.05)" }}>
              <img src="/hero3d.png" alt="HALO AI Platform" className="w-full object-cover aspect-video"
                style={{ filter:"brightness(0.78) saturate(1.35)" }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
              <div className="absolute top-4 left-4 px-3 py-2 rounded-xl backdrop-blur-md text-xs"
                style={{ background:"rgba(0,0,0,0.7)", border:"1px solid rgba(99,102,241,0.35)" }}>
                <div className="text-indigo-300 font-bold">🗺️ Roadmap Architect</div>
                <div className="text-white/45 text-[10px]">Building your path…</div>
              </div>
              <div className="absolute top-4 right-4 px-3 py-2 rounded-xl backdrop-blur-md text-xs"
                style={{ background:"rgba(0,0,0,0.7)", border:"1px solid rgba(16,185,129,0.35)" }}>
                <div className="text-emerald-300 font-bold">🔮 Progress Oracle</div>
                <div className="text-white/45 text-[10px]">Mastery: 87% ↑</div>
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 text-xs whitespace-nowrap"
                style={{ background:"rgba(0,0,0,0.8)" }}>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white/65">4 Agents Online</span>
                <div className="w-px h-3 bg-white/20" />
                <span className="font-semibold" style={{ color:"#818cf8" }}>HALO · Autonomous Mode</span>
              </div>
            </TiltCard>
            <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-20 h-40 blur-3xl rounded-full pointer-events-none" style={{ background:"rgba(99,102,241,0.18)" }} />
            <div className="absolute -right-8 top-1/2 -translate-y-1/2 w-20 h-40 blur-3xl rounded-full pointer-events-none" style={{ background:"rgba(6,182,212,0.18)" }} />
          </motion.div>

          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:2 }}
            className="mt-10 flex flex-col items-center gap-1.5 text-slate-600 text-xs">
            <ChevronDown size={15} className="animate-bounce" />
            Scroll to explore
          </motion.div>
        </motion.div>
      </section>

      {/* ══ TICKER ═══════════════════════════════════════════════════════════ */}
      <div className="py-6 relative z-10 border-y border-white/5" style={{ background:"rgba(0,0,0,0.3)" }}>
        <Ticker />
      </div>

      {/* ══ STATS ════════════════════════════════════════════════════════════ */}
      <section id="stats" className="py-16 px-6 relative z-10">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label:"Autonomous Agents", color:"#818cf8", isNum:true, val:4 },
            { label:"Local & Private", color:"#22d3ee", isNum:true, val:100, suf:"%" },
            { label:"Self-Healing Schedule", color:"#34d399", isNum:false, val:"AI" },
            { label:"Always & Forever", color:"#fbbf24", isNum:false, val:"Free" },
          ].map((s, i) => (
            <FadeIn key={i} delay={i * 0.08}>
              <TiltCard>
                <div className="text-center p-6 rounded-2xl transition-all duration-300"
                  style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-4xl font-black mb-1.5" style={{ color:s.color }}>
                    {s.isNum ? <CountUp target={s.val as number} suffix={s.suf ?? ""} /> : s.val}
                  </p>
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{s.label}</p>
                </div>
              </TiltCard>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ══ FEATURES ═════════════════════════════════════════════════════════ */}
      <PerspGrid>
        <section id="features" className="py-24 px-6 relative z-10">
          <div className="max-w-6xl mx-auto">
            <FadeIn className="text-center mb-14">
              <Badge>Core Capabilities</Badge>
              <GradHead className="text-4xl md:text-5xl mt-5 mb-3">Built Different</GradHead>
              <Divider />
              <p className="text-slate-400 max-w-md mx-auto">Every module is purpose-built for autonomous, agentic learning at scale.</p>
            </FadeIn>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon:<Brain size={20} className="text-indigo-400"/>, title:"Agentic Architecture", desc:"Four specialized agents sharing a unified memory — orchestrated as one autonomous system.", color:"#6366f1" },
                { icon:<Shield size={20} className="text-cyan-400"/>, title:"Self-Healing Core", desc:"The Guardian detects missed sessions and restores your entire week silently in the background.", color:"#06b6d4" },
                { icon:<Sparkles size={20} className="text-emerald-400"/>, title:"RAG Knowledge Vault", desc:"ARIA retrieves the best YouTube lectures, PDFs, and notes for each topic — ranked by quality.", color:"#10b981" },
                { icon:<TrendingUp size={20} className="text-amber-400"/>, title:"Mastery Analytics", desc:"Progress Oracle computes topic-level mastery from your completions and adapts targets live.", color:"#f59e0b" },
                { icon:<Zap size={20} className="text-purple-400"/>, title:"Spaced Repetition", desc:"Review sessions at optimal forgetting-curve intervals for maximum long-term retention.", color:"#a855f7" },
                { icon:<Clock size={20} className="text-rose-400"/>, title:"Fully Private", desc:"Every agent runs locally on your machine. Your data never leaves your device.", color:"#f43f5e" },
              ].map((f,i) => (
                <FadeIn key={i} delay={i*0.07}>
                  <TiltCard className="h-full">
                    <div className="group p-7 rounded-3xl h-full transition-all duration-300 hover:bg-white/[0.055]"
                      style={{ background:"rgba(255,255,255,0.026)", border:"1px solid rgba(255,255,255,0.07)" }}>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6"
                        style={{ background:`${f.color}18`, border:`1px solid ${f.color}38` }}>{f.icon}</div>
                      <h3 className="text-base font-bold mb-2.5 text-white">{f.title}</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                    </div>
                  </TiltCard>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      </PerspGrid>

      {/* ══ HOW IT WORKS ═════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <Badge>The Process</Badge>
            <GradHead className="text-4xl md:text-5xl mt-5 mb-3">How It Works</GradHead>
            <Divider />
            <p className="text-slate-400 max-w-md mx-auto">From zero to fully autonomous study plan in under 60 seconds.</p>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {HOW_STEPS.map((s,i) => <HowStep key={i} step={s} i={i} />)}
          </div>
        </div>
      </section>

      {/* ══ AGENTS ═══════════════════════════════════════════════════════════ */}
      <PerspGrid>
        <section id="agents" className="py-24 px-6 relative z-10">
          <div className="max-w-6xl mx-auto">
            <FadeIn className="text-center mb-24">
              <Badge>The Core System</Badge>
              <GradHead className="text-4xl md:text-6xl mt-5 mb-3">Quartet of Intelligence</GradHead>
              <Divider />
              <p className="text-slate-400 max-w-lg mx-auto">Four tireless AI agents. One unified mission: get you to mastery, autonomously.</p>
            </FadeIn>
            <div className="flex flex-col gap-28">
              {agents.map((a,i) => <AgentCard key={i} {...a} delay={0.08} />)}
            </div>
          </div>
        </section>
      </PerspGrid>

      {/* ══ CTA ══════════════════════════════════════════════════════════════ */}
      <section className="py-32 px-6 relative z-10 overflow-hidden">
        <FloatOrb color="rgba(99,102,241,0.5)" size="600px" top="-100px" left="50%" delay={0} />
        <FadeIn>
          <div className="max-w-2xl mx-auto text-center relative p-12 rounded-3xl overflow-hidden"
            style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.08)", boxShadow:"0 0 100px rgba(99,102,241,0.12)" }}>
            <Badge>Ready to Activate?</Badge>
            <GradHead className="text-4xl md:text-5xl mt-5 mb-4">Initialize Your<br/>Autonomous Core</GradHead>
            <p className="text-slate-400 mb-9 text-base">Your personalised study plan, ready in under 60 seconds.</p>
            <MagneticBtn onClick={() => navigate("/signup")}
              className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl font-bold text-base text-white group"
              style={{ background:"linear-gradient(135deg,#6366f1,#06b6d4)", boxShadow:"0 8px 50px rgba(99,102,241,0.45)", border:"1px solid rgba(255,255,255,0.12)" }}>
              Get Started Free
              <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
            </MagneticBtn>
          </div>
        </FadeIn>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════════════════════ */}
      <footer className="py-12 px-6 relative z-10" style={{ borderTop:"1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background:"linear-gradient(135deg,#6366f1,#06b6d4)", boxShadow:"0 0 12px rgba(99,102,241,0.5)" }}>
              <div className="w-3 h-3 bg-white rounded-sm rotate-45" />
            </div>
            <span className="font-black tracking-tight">HALO</span>
          </div>
          <p className="text-xs text-slate-600">© 2026 HALO AI · Built for the agents of tomorrow.</p>
          <div className="flex items-center gap-5">
            <Github size={16} className="text-slate-600 hover:text-white transition-colors cursor-pointer" />
            <Twitter size={16} className="text-slate-600 hover:text-white transition-colors cursor-pointer" />
            <Globe size={16} className="text-slate-600 hover:text-white transition-colors cursor-pointer" />
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes gradAnim { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes orbFloat { 0%{transform:translateY(0px) scale(1)} 100%{transform:translateY(-30px) scale(1.05)} }
        * { cursor: none !important; }
      `}</style>
    </div>
  );
};
