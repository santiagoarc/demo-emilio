"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";

/**
 * Pantalla de entrada de la demo. No hay autenticación real: cualquier
 * usuario entra y solo se recuerda su nombre en este navegador.
 */
export function LoginScreen({ onEnter }: { onEnter: (user: string) => void }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onEnter(user.trim() || "Equipo de cuidado");
  };

  return (
    <div className="flex min-h-screen bg-white text-[#0b2440]">
      {/* Bienvenida con la foto */}
      <div className="relative hidden flex-1 overflow-hidden lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/bienvenida-pinguino.jpg" alt="Pingüino papúa sobre la nieve del hábitat" className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#03101c]/85 via-[#03101c]/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9ff3ea]">Penguin Tracking & Care</p>
          <h2 className="mt-2 max-w-md text-3xl font-semibold leading-tight tracking-tight">Bienvenido al monitoreo de la colonia</h2>
          <p className="mt-2 max-w-md text-sm text-white/75">Ubicación, actividad y cuidado de cada ejemplar en un solo lugar.</p>
        </div>
      </div>

      {/* Acceso */}
      <div className="flex w-full flex-col justify-center px-6 py-10 sm:px-12 lg:w-[460px] lg:shrink-0">
        <div className="mx-auto w-full max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/seaworld-abu-dhabi.png" alt="SeaWorld Abu Dhabi" className="mx-auto h-28 w-auto" />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">Inicia sesión</h1>
          <p className="mt-1 text-sm text-[#5a7189]">Penguin Tracking & Care</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-[#3d5670]">Usuario</span>
              <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                autoComplete="username"
                placeholder="nombre.apellido"
                className="mt-1 h-11 w-full rounded-xl border border-[#d3dfea] bg-[#f6f9fc] px-3.5 text-sm outline-none transition focus:border-[#1aa6b7] focus:bg-white focus:ring-2 focus:ring-[#1aa6b7]/20"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#3d5670]">Contraseña</span>
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
              Entrar <ArrowRight size={16} />
            </button>
          </form>

          <p className="mt-6 rounded-xl bg-[#f1f6fa] px-3.5 py-2.5 text-[11px] leading-snug text-[#5a7189]">
            Acceso de demostración: no se valida la contraseña ni se envía a ningún servidor. Los datos son simulados.
          </p>
        </div>
      </div>
    </div>
  );
}
