import { Brand } from "@/components/app-shell";
import { MeetingSprite, PageTransition } from "@/components/motion";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="auth-page"><div className="auth-top"><Brand /><span>Turn conversations into momentum.</span></div><MeetingSprite /><PageTransition className="auth-motion-wrap">{children}</PageTransition><div className="auth-doodle" aria-hidden="true"><span>✦</span><span>◌</span><span>↗</span></div></main>;
}
