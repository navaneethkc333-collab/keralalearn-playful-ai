import type { GameCharacter as Character } from "@/lib/topic-game";

const colors = { leaf: "text-leaf", sky: "text-sky", coral: "text-coral", sun: "text-sun" };

export function GameCharacter({ character, happy = false }: { character: Character; happy?: boolean }) {
  const rx = character.body === "wide" ? 55 : character.body === "tall" ? 36 : 45;
  const ry = character.body === "tall" ? 57 : character.body === "wide" ? 38 : 45;
  return <svg viewBox="0 0 180 190" role="img" aria-label={`${character.name}, your cartoon companion`} className={`game-companion h-36 w-36 shrink-0 ${colors[character.color]} ${happy ? "game-cheer" : ""}`}>
    <ellipse cx="90" cy="173" rx="51" ry="8" className="fill-foreground/10" />
    <g fill="currentColor" stroke="var(--foreground)" strokeWidth="3" strokeLinejoin="round">
      {character.ears === "long" && <><ellipse cx="61" cy="38" rx="12" ry="30" transform="rotate(-18 61 38)" /><ellipse cx="119" cy="38" rx="12" ry="30" transform="rotate(18 119 38)" /></>}
      {character.ears === "round" && <><circle cx="53" cy="60" r="21" /><circle cx="127" cy="60" r="21" /></>}
      {character.ears === "pointed" && <><path d="M47 87L43 30L78 63Z" /><path d="M102 63L137 30L133 87Z" /></>}
      <path d="M48 117Q15 88 24 121M132 117Q165 88 156 121" fill="none" strokeWidth="10" strokeLinecap="round" />
      <ellipse cx="69" cy="158" rx="17" ry="9" /><ellipse cx="111" cy="158" rx="17" ry="9" />
      <ellipse cx="90" cy="106" rx={rx} ry={ry} />
    </g>
    <g className="fill-card"><circle cx="73" cy="94" r={character.eyeSize + 5} /><circle cx="107" cy="94" r={character.eyeSize + 5} /></g>
    <g className="fill-foreground"><circle cx="76" cy="96" r={character.eyeSize / 2} /><circle cx="104" cy="96" r={character.eyeSize / 2} /></g>
    <path d={happy ? "M73 119Q90 145 107 119Z" : "M77 121Q90 134 103 121"} className="fill-coral stroke-foreground" strokeWidth="3" strokeLinecap="round" />
    {character.accessory === "crown" && <path d="M66 59L60 35L80 43L90 25L102 43L122 35L115 59Z" className="fill-sun stroke-foreground" strokeWidth="3" />}
    {character.accessory === "bow" && <path d="M90 62L66 47V76ZM90 62L114 47V76Z" className="fill-coral stroke-foreground" strokeWidth="3" />}
    {character.accessory === "antenna" && <g className="stroke-foreground" strokeWidth="3"><path d="M90 61V29" /><circle cx="90" cy="25" r="9" className="fill-sun" /></g>}
    {character.accessory === "leaf" && <path d="M90 62Q65 27 110 29Q116 50 90 62Z" className="fill-leaf stroke-foreground" strokeWidth="3" />}
  </svg>;
}