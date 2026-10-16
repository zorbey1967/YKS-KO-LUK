import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';

type Tool = 'pen' | 'eraser' | 'line' | 'arrow' | 'rect' | 'text';
type Stroke = {
  tool: Tool;
  color: string;
  width: number;
  points: { x: number; y: number }[];
  text?: string;
};

const COLORS = ['#e8eef8', '#ff5a5a', '#f5c542', '#3dd68c', '#6ea5ff'];

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = s.tool === 'eraser' ? '#0b1220' : s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const pts = s.points.map((p) => ({ x: p.x * w, y: p.y * h }));
  if (!pts.length) { ctx.restore(); return; }
  if (s.tool === 'text' && s.text) {
    ctx.font = `${Math.max(14, s.width * 6)}px Inter, sans-serif`;
    ctx.fillText(s.text, pts[0].x, pts[0].y);
    ctx.restore();
    return;
  }
  ctx.beginPath();
  if (s.tool === 'rect' && pts.length > 1) {
    const a = pts[0]; const b = pts[pts.length - 1];
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  } else if ((s.tool === 'line' || s.tool === 'arrow') && pts.length > 1) {
    const a = pts[0]; const b = pts[pts.length - 1];
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    if (s.tool === 'arrow') {
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.lineTo(b.x - 12 * Math.cos(ang - 0.4), b.y - 12 * Math.sin(ang - 0.4));
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - 12 * Math.cos(ang + 0.4), b.y - 12 * Math.sin(ang + 0.4));
    }
  } else {
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
  }
  ctx.stroke();
  ctx.restore();
}

export function MeetingWhiteboard({ room }: { room: Room | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(3);
  const strokesRef = useRef<Stroke[]>([]);
  const redoRef = useRef<Stroke[]>([]);
  const liveRef = useRef<Stroke | null>(null);

  function paint() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, c.width, c.height);
    for (const s of strokesRef.current) drawStroke(ctx, s, c.width, c.height);
    if (liveRef.current) drawStroke(ctx, liveRef.current, c.width, c.height);
  }

  function send(kind: 'stroke' | 'clear' | 'undo', stroke?: Stroke) {
    if (!room) return;
    const payload = JSON.stringify({ board: true, kind, stroke });
    void room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
  }

  function push(stroke: Stroke, broadcast = true) {
    strokesRef.current = [...strokesRef.current, stroke];
    redoRef.current = [];
    if (broadcast) send('stroke', stroke);
    paint();
  }

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const resize = () => {
      const r = c.getBoundingClientRect();
      c.width = Math.max(320, Math.floor(r.width * (window.devicePixelRatio || 1)));
      c.height = Math.max(180, Math.floor(r.height * (window.devicePixelRatio || 1)));
      paint();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload)) as { board?: boolean; kind?: string; stroke?: Stroke };
        if (!msg.board) return;
        if (msg.kind === 'clear') {
          strokesRef.current = [];
          redoRef.current = [];
          paint();
          return;
        }
        if (msg.kind === 'undo') {
          const last = strokesRef.current[strokesRef.current.length - 1];
          if (last) {
            strokesRef.current = strokesRef.current.slice(0, -1);
            redoRef.current = [...redoRef.current, last];
            paint();
          }
          return;
        }
        if (msg.stroke) {
          strokesRef.current = [...strokesRef.current, msg.stroke];
          paint();
        }
      } catch { /* ignore */ }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room]);

  function pos(e: React.PointerEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  return (
    <div className="meeting-board">
      <div className="meeting-board-tools">
        {(['pen', 'eraser', 'line', 'arrow', 'rect', 'text'] as Tool[]).map((t) => (
          <button key={t} className={`chip-btn${tool === t ? ' on' : ''}`} type="button" onClick={() => setTool(t)}>{t === 'pen' ? 'Kalem' : t === 'eraser' ? 'Silgi' : t === 'line' ? 'Çizgi' : t === 'arrow' ? 'Ok' : t === 'rect' ? 'Şekil' : 'Metin'}</button>
        ))}
        {COLORS.map((c) => (
          <button key={c} type="button" className="meeting-board-color" style={{ background: c, outline: color === c ? '2px solid #fff' : 'none' }} aria-label={c} onClick={() => setColor(c)} />
        ))}
        <label className="muted">Kalınlık <input type="range" min={1} max={12} value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label>
        <button className="chip-btn" type="button" onClick={() => {
          const last = strokesRef.current[strokesRef.current.length - 1];
          if (!last) return;
          strokesRef.current = strokesRef.current.slice(0, -1);
          redoRef.current = [...redoRef.current, last];
          send('undo');
          paint();
        }}>Geri</button>
        <button className="chip-btn" type="button" onClick={() => {
          const next = redoRef.current[redoRef.current.length - 1];
          if (!next) return;
          redoRef.current = redoRef.current.slice(0, -1);
          push(next);
        }}>İleri</button>
        <button className="chip-btn" type="button" onClick={() => {
          strokesRef.current = [];
          redoRef.current = [];
          send('clear');
          paint();
        }}>Temizle</button>
      </div>
      <canvas
        ref={canvasRef}
        className="meeting-board-canvas"
        onPointerDown={(e) => {
          if (tool === 'text') {
            const text = window.prompt('Metin');
            if (!text) return;
            push({ tool, color, width, points: [pos(e)], text });
            return;
          }
          liveRef.current = { tool, color, width, points: [pos(e)] };
        }}
        onPointerMove={(e) => {
          if (!liveRef.current) return;
          liveRef.current = { ...liveRef.current, points: [...liveRef.current.points, pos(e)] };
          paint();
        }}
        onPointerUp={() => {
          if (!liveRef.current) return;
          push(liveRef.current);
          liveRef.current = null;
        }}
      />
    </div>
  );
}
