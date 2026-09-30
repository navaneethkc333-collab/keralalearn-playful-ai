import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Pencil, Eraser, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export type DrawingHandle = { toBase64: () => string | null; isEmpty: () => boolean };

const COLORS = ["#1f2937", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#92400e"];

export const DrawingCanvas = forwardRef<DrawingHandle>(function DrawingCanvas(_, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<"pencil" | "eraser">("pencil");
  const [size, setSize] = useState(6);
  const [color, setColor] = useState(COLORS[0]!);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  useImperativeHandle(ref, () => ({
    toBase64: () => canvas.current?.toDataURL("image/png").split(",")[1] ?? null,
    isEmpty: () => !dirty.current,
  }));

  const pos = (e: React.PointerEvent) => {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant={tool === "pencil" ? "default" : "outline"} onClick={() => setTool("pencil")}><Pencil className="mr-1 h-4 w-4" />Pencil</Button>
        <Button type="button" size="sm" variant={tool === "eraser" ? "default" : "outline"} onClick={() => setTool("eraser")}><Eraser className="mr-1 h-4 w-4" />Eraser</Button>
        {COLORS.map((c) => (
          <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => { setColor(c); setTool("pencil"); }} className={`h-7 w-7 rounded-full border-2 ${color === c && tool === "pencil" ? "border-primary ring-2 ring-primary" : "border-border"}`} style={{ background: c }} />
        ))}
        <div className="flex w-40 items-center gap-2 text-sm">Size <Slider min={2} max={30} step={1} value={[size]} onValueChange={(v) => setSize(v[0] ?? 6)} /></div>
        <Button
          type="button" size="sm" variant="outline"
          onClick={() => { const c = canvas.current!; const ctx = c.getContext("2d")!; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height); dirty.current = false; }}
        ><Trash2 className="mr-1 h-4 w-4" />Clear</Button>
      </div>
      <canvas
        ref={canvas}
        width={800}
        height={500}
        className="w-full touch-none rounded-2xl border-2 bg-card"
        onPointerDown={(e) => {
          drawing.current = true;
          const ctx = canvas.current!.getContext("2d")!;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = canvas.current!.getContext("2d")!;
          const p = pos(e);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = tool === "eraser" ? size * 2 : size;
          ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          if (tool === "pencil") dirty.current = true;
        }}
        onPointerUp={() => { drawing.current = false; }}
        onPointerLeave={() => { drawing.current = false; }}
      />
    </div>
  );
});
