"use client";

import { motion, useReducedMotion } from "motion/react";

export function PageTransition({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .52, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>;
}

export function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 22, filter: "blur(4px)" }} whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }} viewport={{ once: true, amount: .15 }} transition={{ duration: .6, delay, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>;
}

export function AnimatedTrail() {
  const reduce = useReducedMotion();

  return null;
}

export function MeetingSprite() {
  const reduce = useReducedMotion();
  return <motion.div className="meeting-sprite" aria-hidden="true" initial={reduce ? false : { opacity: 0, x: 35, y: 18, rotate: 8 }} animate={{ opacity: 1, x: 0, y: [0, -7, 0], rotate: [0, -2, 0] }} transition={{ opacity: { duration: .5, delay: .25 }, x: { duration: .55, delay: .25, ease: [0.22, 1, 0.36, 1] }, y: { duration: 3.8, delay: .8, repeat: Infinity, ease: "easeInOut" }, rotate: { duration: 3.8, delay: .8, repeat: Infinity, ease: "easeInOut" } }}><svg viewBox="0 0 220 235" fill="none"><path d="M39 213c-12-47 7-86 38-105 38-23 91-20 121 15 17 20 20 57 8 90H39Z" fill="#ff795b" stroke="#181817" strokeWidth="5"/><path d="M64 40c23-27 74-41 111-13 31 24 29 77 10 105-22 34-82 46-116 12C44 116 40 68 64 40Z" fill="#fffef5" stroke="#181817" strokeWidth="5"/><path d="M63 65c15-36 85-57 118-13 4 6 7 14 8 23-29-22-88-10-126 20-6-9-5-20 0-30Z" fill="#d6adf3" stroke="#181817" strokeWidth="5"/><path d="M76 111c3-17 19-26 34-23 13 2 23 14 20 29-2 14-15 24-30 22-16-2-27-14-24-28ZM133 108c2-16 15-25 30-23 15 1 26 14 23 29-2 15-16 24-30 22-15-2-25-14-23-28Z" fill="#fff" stroke="#181817" strokeWidth="5"/><path d="m129 107 6-2M98 112l7 2M116 130c7 8 18 8 25 0" stroke="#181817" strokeWidth="5" strokeLinecap="round"/><path d="M61 85c-14 4-22 18-19 31 2 8 8 14 15 17M188 84c14 4 22 17 20 30-2 8-8 15-15 18" stroke="#181817" strokeWidth="5"/><path d="m164 41 15-15M182 53l23-5M55 51 38 38" stroke="#ffac4c" strokeWidth="8" strokeLinecap="round"/></svg></motion.div>;
}
