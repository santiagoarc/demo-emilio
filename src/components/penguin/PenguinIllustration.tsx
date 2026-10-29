import type { SpeciesId } from "@/domain/types";
import { SPECIES_BY_ID } from "@/domain/species";

/**
 * Representative illustration per species (not a photo of the individual).
 * Species traits: king's ear patches, gentoo's white headband, rockhopper and
 * macaroni crests, chinstrap's chin line and Adélie's eye ring.
 */
export function PenguinIllustration({ speciesId, size = 96, framed = true }: { speciesId: SpeciesId; size?: number; framed?: boolean }) {
  const sp = SPECIES_BY_ID[speciesId];
  const id = `pg-${speciesId}`;
  const back = "#1a2333";
  const belly = "#f4f8fb";
  const whiteFace = speciesId === "chinstrap";

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={`Illustration: ${sp.nameEn}`}>
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor={sp.color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={sp.color} stopOpacity="0.05" />
        </radialGradient>
        <linearGradient id={`${id}-belly`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={speciesId === "king" ? "#ffd27a" : belly} />
          <stop offset="35%" stopColor={belly} />
          <stop offset="100%" stopColor="#d9e6ef" />
        </linearGradient>
      </defs>
      {framed && <rect x="0" y="0" width="120" height="120" rx="28" fill={`url(#${id}-bg)`} />}
      {framed && <rect x="0.5" y="0.5" width="119" height="119" rx="27.5" fill="none" stroke={sp.color} strokeOpacity="0.25" />}

      {/* feet */}
      <ellipse cx="50" cy="106" rx="9" ry="3.5" fill={speciesId === "gentoo" ? "#ff8a3d" : speciesId === "king" ? "#2b2b33" : "#f2a7a0"} />
      <ellipse cx="70" cy="106" rx="9" ry="3.5" fill={speciesId === "gentoo" ? "#ff8a3d" : speciesId === "king" ? "#2b2b33" : "#f2a7a0"} />
      {/* body */}
      <path d="M60 30 C 84 30 92 58 90 80 C 88 98 76 106 60 106 C 44 106 32 98 30 80 C 28 58 36 30 60 30 Z" fill={back} />
      {/* flippers */}
      <path d="M33 58 C 22 68 20 82 24 92 C 30 86 34 76 36 66 Z" fill={back} />
      <path d="M87 58 C 98 68 100 82 96 92 C 90 86 86 76 84 66 Z" fill={back} />
      {/* belly */}
      <path d="M60 46 C 76 46 82 64 81 80 C 80 96 72 102 60 102 C 48 102 40 96 39 80 C 38 64 44 46 60 46 Z" fill={`url(#${id}-belly)`} />
      {/* head */}
      <circle cx="60" cy="34" r="20" fill={back} />
      {whiteFace && <path d="M43 36 C 44 26 52 22 60 22 C 68 22 76 26 77 36 C 76 48 68 54 60 54 C 52 54 44 48 43 36 Z" fill={belly} />}
      {whiteFace && <path d="M45 30 C 50 22 70 22 75 30 C 70 27 50 27 45 30 Z" fill={back} />}
      {whiteFace && <path d="M46 42 C 52 50 68 50 74 42" stroke={back} strokeWidth="1.6" fill="none" />}

      {speciesId === "king" && (
        <>
          <path d="M42 36 C 40 42 42 48 46 50 C 46 44 46 40 42 36 Z" fill="#ffb12b" />
          <path d="M78 36 C 80 42 78 48 74 50 C 74 44 74 40 78 36 Z" fill="#ffb12b" />
        </>
      )}
      {speciesId === "gentoo" && <path d="M47 26 C 52 20 68 20 73 26 C 68 25 64 27 60 27 C 56 27 52 25 47 26 Z" fill={belly} />}
      {(speciesId === "rockhopper" || speciesId === "macaroni") && (
        <>
          <path d="M49 28 C 44 24 38 24 34 26 C 39 27 43 29 47 32 Z" fill={speciesId === "macaroni" ? "#ff9d2e" : "#f4dd3a"} />
          <path d="M71 28 C 76 24 82 24 86 26 C 81 27 77 29 73 32 Z" fill={speciesId === "macaroni" ? "#ff9d2e" : "#f4dd3a"} />
          {speciesId === "macaroni" && <path d="M54 22 C 58 18 62 18 66 22 C 63 24 57 24 54 22 Z" fill="#ff9d2e" />}
          {speciesId === "rockhopper" && (
            <>
              <path d="M36 25 L 31 21 M 38 24 L 35 18 M 84 25 L 89 21 M 82 24 L 85 18" stroke="#f4dd3a" strokeWidth="1.6" strokeLinecap="round" />
            </>
          )}
        </>
      )}

      {/* eyes */}
      {speciesId === "adelie" && (
        <>
          <circle cx="52" cy="33" r="3.6" fill="none" stroke={belly} strokeWidth="1.8" />
          <circle cx="68" cy="33" r="3.6" fill="none" stroke={belly} strokeWidth="1.8" />
        </>
      )}
      <circle cx="52" cy="33" r="1.9" fill={speciesId === "rockhopper" || speciesId === "macaroni" ? "#e2453c" : whiteFace ? back : "#0b0f16"} />
      <circle cx="68" cy="33" r="1.9" fill={speciesId === "rockhopper" || speciesId === "macaroni" ? "#e2453c" : whiteFace ? back : "#0b0f16"} />
      <circle cx="52.6" cy="32.4" r="0.6" fill="#fff" />
      <circle cx="68.6" cy="32.4" r="0.6" fill="#fff" />

      {/* beak */}
      {speciesId === "king" ? (
        <path d="M56 39 C 58 38 62 38 64 39 L 60 50 Z" fill="#1f1f27" stroke="#ff9a2e" strokeWidth="1.1" />
      ) : speciesId === "adelie" || speciesId === "chinstrap" ? (
        <path d="M57 39 C 59 38 61 38 63 39 L 60 44 Z" fill="#1f1f27" />
      ) : (
        <path d="M56 39 C 58 38 62 38 64 39 L 60 46 Z" fill={speciesId === "gentoo" ? "#ff7a2e" : "#d9502f"} />
      )}
    </svg>
  );
}
