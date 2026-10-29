"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";

/** Welcome photos; they rotate with a crossfade. */
const SLIDES = [
  { src: "/brand/bienvenida-pinguinos.webp", alt: "Gentoo penguins in the ice habitat", position: "50% 50%" },
  { src: "/brand/bienvenida-one-ocean.webp", alt: "One Ocean dome with the sphere and the Animal Care Center", position: "50% 50%" },
  { src: "/brand/bienvenida-one-ocean-render.jpg", alt: "Inside One Ocean, with the kelp forest", position: "50% 60%" },
];
const SLIDE_MS = 6000;

/**
 * Demo sign-in screen. There is no real authentication: any user gets in
 * and only their name is remembered in this browser.
 */
export function LoginScreen({ onEnter }: { onEnter: (user: string) => void }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    // Rescheduled on every change, so clicking a dot restarts the countdown.
    const id = setTimeout(() => setSlide((s) => (s + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(id);
  }, [slide]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onEnter(user.trim() || "Care team");
  };

  return (
    <div className="flex min-h-screen bg-white text-[#0b2440]">
      {/* Welcome panel with photos */}
      <div className="relative hidden flex-1 overflow-hidden bg-[#03101c] lg:block">
        {SLIDES.map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.src}
            src={s.src}
            alt={s.alt}
            aria-hidden={i !== slide}
            style={{ objectPosition: s.position }}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${i === slide ? "opacity-100" : "opacity-0"}`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-[#03101c]/85 via-[#03101c]/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9ff3ea]">Penguin Tracking & Care</p>
          <h2 className="mt-2 max-w-md text-3xl font-semibold leading-tight tracking-tight">Welcome to colony monitoring</h2>
          <p className="mt-2 max-w-md text-sm text-white/75">Location, activity and care for every penguin, in one place.</p>
          <div className="mt-5 flex gap-2">
            {SLIDES.map((s, i) => (
              <button
                key={s.src}
                type="button"
                onClick={() => setSlide(i)}
                aria-label={`Show photo ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === slide ? "w-6 bg-white" : "w-1.5 bg-white/45 hover:bg-white/70"}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Sign-in */}
      <div className="flex w-full flex-col justify-center px-6 py-10 sm:px-12 lg:w-[460px] lg:shrink-0">
        <div className="mx-auto w-full max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/seaworld-abu-dhabi.png" alt="SeaWorld Abu Dhabi" className="mx-auto h-28 w-auto" />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-[#5a7189]">Penguin Tracking & Care</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-[#3d5670]">Username</span>
              <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                autoComplete="username"
                placeholder="first.last"
                className="mt-1 h-11 w-full rounded-xl border border-[#d3dfea] bg-[#f6f9fc] px-3.5 text-sm outline-none transition focus:border-[#1aa6b7] focus:bg-white focus:ring-2 focus:ring-[#1aa6b7]/20"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#3d5670]">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1 h-11 w-full rounded-xl border border-[#d3dfea] bg-[#f6f9fc] px-3.5 text-sm outline-none transition focus:border-[#1aa6b7] focus:bg-white focus:ring-2 focus:ring-[#1aa6b7]/20"
              />
            </label>
            <button
              type="submit"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0b3c60] text-sm font-semibold text-white transition hover:bg-[#0f527f]"
            >
              Sign in <ArrowRight size={16} />
            </button>
          </form>

          <p className="mt-6 rounded-xl bg-[#f1f6fa] px-3.5 py-2.5 text-[11px] leading-snug text-[#5a7189]">
            The password is not checked or sent to any server.
          </p>
        </div>
      </div>
    </div>
  );
}
