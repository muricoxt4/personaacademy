"""
Claude Code Token Monitor
Janela flutuante para monitorar uso de tokens do Claude Code.
Lê os logs de ~/.claude/projects/ em tempo real.

Lógica de janela deslizante:
  O Claude Pro usa janelas de ~5h a partir da 1ª mensagem da janela atual.
  Este monitor detecta automaticamente o início da janela pelos timestamps
  dos logs e reseta a contagem quando a janela expira.
"""

import tkinter as tk
from tkinter import font as tkfont
import json
import os
import glob
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path


# ── Configurações ──────────────────────────────────────────────
PRO_WINDOW_LIMIT   = 45          # mensagens por janela (plano Pro)
WINDOW_HOURS       = 5           # duração da janela do Claude Pro em horas
CONTEXT_LIMIT      = 200_000     # tokens de contexto do Claude Sonnet/Opus
REFRESH_INTERVAL   = 4_000       # ms entre cada atualização automática
WINDOW_W, WINDOW_H = 500, 640
CLAUDE_DIR         = Path.home() / ".claude" / "projects"
# ──────────────────────────────────────────────────────────────


# ── Fontes cross-platform ─────────────────────────────────────
def _pick_font(preferred, size, weight="normal"):
    available = tkfont.families()
    for name in preferred:
        if name in available:
            return tkfont.Font(family=name, size=size, weight=weight)
    return tkfont.Font(size=size, weight=weight)

_SANS = ["Segoe UI", "Ubuntu", "SF Pro Text", "Helvetica Neue", "Arial"]
_MONO = ["Consolas", "DejaVu Sans Mono", "Menlo", "Courier New", "Courier"]
# ──────────────────────────────────────────────────────────────


def get_log_files():
    pattern = str(CLAUDE_DIR / "**" / "*.jsonl")
    files = glob.glob(pattern, recursive=True)
    return sorted(files, key=os.path.getmtime, reverse=True)


def _parse_ts(raw):
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        return None


def parse_sessions(max_files=60):
    """
    Lê os arquivos de log e extrai métricas.

    A janela ativa é detectada assim:
      1. Coleta todos os timestamps de mensagens de usuário.
      2. Ordena cronologicamente.
      3. Procura o grupo mais recente de mensagens onde NÃO existe
         um gap >= WINDOW_HOURS entre elas (= mesma janela).
      4. A janela começa no primeiro evento desse grupo e termina
         WINDOW_HOURS depois.

    Retorna:
        sessions    – lista de sessões (mais recente primeiro)
        window_info – dict: start, end, msgs, input_tokens, output_tokens
    """
    files = get_log_files()[:max_files]
    sessions = []
    all_user_events = []   # list of datetime_utc

    for fpath in files:
        try:
            entries = []
            with open(fpath, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue

            if not entries:
                continue

            sess_input       = 0
            sess_output      = 0
            sess_cache_read  = 0
            sess_cache_write = 0
            commands         = []   # list of (ts | None, text)
            sess_time        = None

            for entry in entries:
                ts_raw = entry.get("timestamp") or entry.get("ts")
                ts = _parse_ts(ts_raw)
                if ts and not sess_time:
                    sess_time = ts

                usage = None
                if entry.get("type") == "assistant":
                    usage = entry.get("message", {}).get("usage")
                elif "usage" in entry:
                    usage = entry["usage"]

                if usage:
                    sess_input       += usage.get("input_tokens", 0)
                    sess_output      += usage.get("output_tokens", 0)
                    sess_cache_read  += usage.get("cache_read_input_tokens", 0)
                    sess_cache_write += usage.get("cache_creation_input_tokens", 0)

                if entry.get("type") == "user":
                    content = entry.get("message", {}).get("content", "")
                    event_ts = ts or sess_time
                    if isinstance(content, list):
                        for block in content:
                            if isinstance(block, dict) and block.get("type") == "text":
                                text = block.get("text", "").strip()
                                if text:
                                    commands.append((event_ts, text))
                                    if event_ts:
                                        all_user_events.append(event_ts)
                                    break
                    elif isinstance(content, str) and content.strip():
                        commands.append((event_ts, content.strip()))
                        if event_ts:
                            all_user_events.append(event_ts)

            if sess_input + sess_output == 0:
                continue

            sessions.append({
                "file":        fpath,
                "time":        sess_time,
                "input":       sess_input,
                "output":      sess_output,
                "cache_read":  sess_cache_read,
                "cache_write": sess_cache_write,
                "total":       sess_input + sess_output,
                "commands":    commands,
            })

        except Exception:
            continue

    # ── Detecta janela ativa ──────────────────────────────────
    all_user_events.sort()
    now_utc = datetime.now(timezone.utc)
    win_dur = timedelta(hours=WINDOW_HOURS)

    window_start = None
    window_end   = None

    if all_user_events:
        # Pega a última mensagem e vai voltando enquanto o gap for < WINDOW_HOURS
        group = [all_user_events[-1]]
        for ev in reversed(all_user_events[:-1]):
            if group[-1] - ev < win_dur:
                group.append(ev)
            else:
                break   # gap maior que a janela: começo de janela anterior

        group_start = min(group)
        group_end   = group_start + win_dur

        if now_utc <= group_end:
            # Janela ainda ativa
            window_start = group_start
            window_end   = group_end
        # Se now_utc > group_end: janela expirou, deixa None (contador zerado)

    # ── Contagem dentro da janela ─────────────────────────────
    window_msgs   = 0
    window_input  = 0
    window_output = 0

    if window_start and window_end:
        for sess in sessions:
            sess_in_window = False
            for (ts, _) in sess["commands"]:
                if ts and window_start <= ts <= window_end:
                    window_msgs += 1
                    sess_in_window = True
            if sess_in_window:
                window_input  += sess["input"]
                window_output += sess["output"]

    window_info = {
        "start":  window_start,
        "end":    window_end,
        "msgs":   window_msgs,
        "input":  window_input,
        "output": window_output,
    }

    return sessions, window_info


# ── Helpers ───────────────────────────────────────────────────
def fmt_tokens(n):
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n/1_000:.1f}k"
    return str(n)

def truncate(text, max_len=55):
    return text[:max_len] + "…" if len(text) > max_len else text


# ── Paleta ────────────────────────────────────────────────────
BG       = "#0f1117"
PANEL    = "#1a1d27"
ACCENT   = "#d4a853"
ACCENT2  = "#5b8dee"
GREEN    = "#4caf87"
YELLOW   = "#e0a030"
RED      = "#e05c5c"
TEXT     = "#e8e8f0"
TEXT_DIM = "#6b7080"
BORDER   = "#2a2d3a"
# ──────────────────────────────────────────────────────────────


class TokenMonitor(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Claude Monitor")
        self.geometry(f"{WINDOW_W}x{WINDOW_H}")
        self.configure(bg=BG)
        self.resizable(True, True)
        self.minsize(420, 500)
        self.attributes("-topmost", False)
        self._build_fonts()
        self._build_ui()
        self._schedule_refresh()

    def _build_fonts(self):
        self.f_title  = _pick_font(_SANS, 11, "bold")
        self.f_num    = _pick_font(_MONO, 22, "bold")
        self.f_body   = _pick_font(_SANS, 9)
        self.f_cmd    = _pick_font(_MONO, 8)
        self.f_small  = _pick_font(_SANS, 7)
        self.f_header = _pick_font(_SANS, 9, "bold")

    def _build_ui(self):
        bar = tk.Frame(self, bg=PANEL, height=40)
        bar.pack(fill="x")
        bar.pack_propagate(False)

        tk.Label(bar, text="◆  CLAUDE MONITOR",
                 font=self.f_title, bg=PANEL, fg=ACCENT).pack(side="left", padx=14, pady=8)

        tk.Button(bar, text="📌", font=self.f_small, bg=PANEL, fg=TEXT_DIM,
                  bd=0, cursor="hand2", activebackground=PANEL,
                  command=self._toggle_topmost).pack(side="right", padx=4)

        self.lbl_status = tk.Label(bar, text="● live", font=self.f_small, bg=PANEL, fg=GREEN)
        self.lbl_status.pack(side="right", padx=4)

        self.lbl_updated = tk.Label(bar, text="", font=self.f_small, bg=PANEL, fg=TEXT_DIM)
        self.lbl_updated.pack(side="right", padx=4)

        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")

        outer = tk.Frame(self, bg=BG)
        outer.pack(fill="both", expand=True)

        canvas = tk.Canvas(outer, bg=BG, bd=0, highlightthickness=0)
        sb = tk.Scrollbar(outer, orient="vertical", command=canvas.yview)
        self.scroll_frame = tk.Frame(canvas, bg=BG)

        self.scroll_frame.bind("<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=self.scroll_frame, anchor="nw")
        canvas.configure(yscrollcommand=sb.set)
        canvas.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")

        canvas.bind_all("<MouseWheel>",
            lambda e: canvas.yview_scroll(int(-1*(e.delta/120)), "units"))
        canvas.bind_all("<Button-4>", lambda e: canvas.yview_scroll(-1, "units"))
        canvas.bind_all("<Button-5>", lambda e: canvas.yview_scroll( 1, "units"))

        self._build_content()

        footer = tk.Frame(self, bg=PANEL, height=28)
        footer.pack(fill="x", side="bottom")
        footer.pack_propagate(False)
        tk.Label(footer,
                 text=f"janela deslizante de {WINDOW_HOURS}h  •  atualiza a cada 4s  •  ~/.claude/projects/",
                 font=self.f_small, bg=PANEL, fg=TEXT_DIM).pack(side="left", padx=10, pady=6)
        tk.Button(footer, text="↻ agora", font=self.f_small, bg=PANEL, fg=ACCENT,
                  bd=0, cursor="hand2", activebackground=PANEL,
                  command=self._refresh).pack(side="right", padx=10)

    def _build_content(self):
        f  = self.scroll_frame
        px = dict(padx=14)

        # ── Janela atual ──
        tk.Label(f, text="JANELA ATUAL  (últimas 5h)", font=self.f_small,
                 bg=BG, fg=TEXT_DIM).pack(anchor="w", padx=14, pady=(14, 4))

        cards = tk.Frame(f, bg=BG)
        cards.pack(fill="x", pady=(0, 4), **px)
        self.card_msgs   = self._metric_card(cards, "mensagens", "—", ACCENT)
        self.card_tokens = self._metric_card(cards, "tokens", "—", ACCENT2)
        for c in (self.card_msgs, self.card_tokens):
            c.pack(side="left", fill="both", expand=True, padx=(0, 6))

        # Barra mensagens
        bf = tk.Frame(f, bg=PANEL, padx=12, pady=10)
        bf.pack(fill="x", pady=(0, 6), **px)

        r1 = tk.Frame(bf, bg=PANEL)
        r1.pack(fill="x")
        tk.Label(r1, text=f"Mensagens  (limite ~{PRO_WINDOW_LIMIT})",
                 font=self.f_body, bg=PANEL, fg=TEXT).pack(side="left")
        self.lbl_msgs_pct = tk.Label(r1, text="0%", font=self.f_body, bg=PANEL, fg=ACCENT)
        self.lbl_msgs_pct.pack(side="right")
        self.bar_msgs = self._progress_bar(bf)

        ri = tk.Frame(bf, bg=PANEL)
        ri.pack(fill="x", pady=(6, 0))
        self.lbl_win_start = tk.Label(ri, text="início: —",
                                      font=self.f_small, bg=PANEL, fg=TEXT_DIM)
        self.lbl_win_start.pack(side="left")
        self.lbl_reset = tk.Label(ri, text="reset em: —",
                                  font=self.f_small, bg=PANEL, fg=ACCENT)
        self.lbl_reset.pack(side="right")

        # Barra de tempo
        tf = tk.Frame(f, bg=PANEL, padx=12, pady=10)
        tf.pack(fill="x", pady=(0, 6), **px)

        r2 = tk.Frame(tf, bg=PANEL)
        r2.pack(fill="x")
        tk.Label(r2, text=f"Tempo da janela  ({WINDOW_HOURS}h)",
                 font=self.f_body, bg=PANEL, fg=TEXT).pack(side="left")
        self.lbl_time_pct = tk.Label(r2, text="—", font=self.f_body, bg=PANEL, fg=ACCENT2)
        self.lbl_time_pct.pack(side="right")
        self.bar_time = self._progress_bar(tf, color=ACCENT2)
        self.lbl_time_detail = tk.Label(tf, text="—",
                                        font=self.f_small, bg=PANEL, fg=TEXT_DIM)
        self.lbl_time_detail.pack(anchor="w", pady=(4, 0))

        # ── Sessão mais recente ──
        tk.Label(f, text="SESSÃO MAIS RECENTE", font=self.f_small,
                 bg=BG, fg=TEXT_DIM).pack(anchor="w", padx=14, pady=(10, 4))

        cf = tk.Frame(f, bg=PANEL, padx=12, pady=10)
        cf.pack(fill="x", pady=(0, 6), **px)
        r3 = tk.Frame(cf, bg=PANEL)
        r3.pack(fill="x")
        tk.Label(r3, text=f"Contexto  ({fmt_tokens(CONTEXT_LIMIT)} máx)",
                 font=self.f_body, bg=PANEL, fg=TEXT).pack(side="left")
        self.lbl_ctx_pct = tk.Label(r3, text="0%", font=self.f_body, bg=PANEL, fg=ACCENT2)
        self.lbl_ctx_pct.pack(side="right")
        self.bar_ctx = self._progress_bar(cf, color=ACCENT2)
        self.lbl_ctx_detail = tk.Label(cf, text="entrada: — | saída: — | cache: —",
                                       font=self.f_small, bg=PANEL, fg=TEXT_DIM)
        self.lbl_ctx_detail.pack(anchor="w", pady=(4, 0))

        # ── Interações ──
        tk.Label(f, text="ÚLTIMAS INTERAÇÕES", font=self.f_small,
                 bg=BG, fg=TEXT_DIM).pack(anchor="w", padx=14, pady=(10, 4))
        self.cmd_frame = tk.Frame(f, bg=BG)
        self.cmd_frame.pack(fill="x", pady=(0, 14), **px)

    # ── Helpers ───────────────────────────────────────────────
    def _metric_card(self, parent, label, value, color):
        card = tk.Frame(parent, bg=PANEL, padx=12, pady=10)
        num  = tk.Label(card, text=value, font=self.f_num, bg=PANEL, fg=color)
        num.pack(anchor="w")
        tk.Label(card, text=label, font=self.f_small, bg=PANEL, fg=TEXT_DIM).pack(anchor="w")
        card._num = num
        return card

    def _progress_bar(self, parent, color=ACCENT):
        outer = tk.Frame(parent, bg=BORDER, height=6)
        outer.pack(fill="x", pady=(6, 0))
        outer.pack_propagate(False)
        inner = tk.Frame(outer, bg=color, height=6)
        inner.place(relx=0, rely=0, relwidth=0.0, relheight=1)
        return inner

    def _set_bar(self, bar, pct, color_ok=None):
        pct = max(0.0, min(1.0, pct))
        bar.place(relwidth=pct)
        if color_ok:
            bar.configure(bg=GREEN if pct < 0.6 else YELLOW if pct < 0.85 else RED)

    # ── Refresh ───────────────────────────────────────────────
    def _refresh(self):
        sessions, wi = parse_sessions()
        now_utc   = datetime.now(timezone.utc)
        now_local = datetime.now()

        # Cards
        self.card_msgs._num.configure(text=str(wi["msgs"]))
        self.card_tokens._num.configure(text=fmt_tokens(wi["input"] + wi["output"]))

        # Barra mensagens
        msg_pct = wi["msgs"] / PRO_WINDOW_LIMIT if PRO_WINDOW_LIMIT else 0
        self._set_bar(self.bar_msgs, msg_pct, color_ok=True)
        self.lbl_msgs_pct.configure(text=f"{int(msg_pct*100)}%")

        # Info da janela
        if wi["start"] and wi["end"]:
            start_l = wi["start"].astimezone()
            end_l   = wi["end"].astimezone()
            delta   = wi["end"] - now_utc

            if delta.total_seconds() > 0:
                h, rem = divmod(int(delta.total_seconds()), 3600)
                m, s   = divmod(rem, 60)
                reset_color = ACCENT if msg_pct < 0.85 else RED
                self.lbl_reset.configure(
                    text=f"reset em {h}h {m:02d}m {s:02d}s  ({end_l.strftime('%H:%M')})",
                    fg=reset_color)
            else:
                self.lbl_reset.configure(text="✓ janela expirada", fg=GREEN)

            self.lbl_win_start.configure(text=f"início: {start_l.strftime('%d/%m %H:%M')}")

            elapsed   = (now_utc - wi["start"]).total_seconds()
            total_sec = WINDOW_HOURS * 3600
            self._set_bar(self.bar_time, elapsed / total_sec, color_ok=True)
            eh, em = divmod(int(elapsed // 60), 60)
            self.lbl_time_pct.configure(text=f"{int(elapsed/total_sec*100)}%")
            self.lbl_time_detail.configure(
                text=f"{eh}h {em:02d}m de {WINDOW_HOURS}h  •  "
                     f"{start_l.strftime('%H:%M')} → {end_l.strftime('%H:%M')}")
        else:
            self.lbl_reset.configure(text="sem janela ativa", fg=TEXT_DIM)
            self.lbl_win_start.configure(text="início: —")
            self._set_bar(self.bar_time, 0)
            self.lbl_time_pct.configure(text="—")
            self.lbl_time_detail.configure(text="sem atividade nas últimas 5h")

        # Contexto
        if sessions:
            lat = sessions[0]
            ctx_pct = lat["total"] / CONTEXT_LIMIT
            self._set_bar(self.bar_ctx, ctx_pct, color_ok=True)
            self.lbl_ctx_pct.configure(text=f"{int(ctx_pct*100)}%")
            self.lbl_ctx_detail.configure(
                text=(f"entrada: {fmt_tokens(lat['input'])}  |  "
                      f"saída: {fmt_tokens(lat['output'])}  |  "
                      f"cache: {fmt_tokens(lat['cache_read'])} lido / "
                      f"{fmt_tokens(lat['cache_write'])} escrito"))
        else:
            self.lbl_ctx_pct.configure(text="0%")
            self.lbl_ctx_detail.configure(text="nenhuma sessão encontrada")

        # Interações
        for w in self.cmd_frame.winfo_children():
            w.destroy()

        if not sessions:
            tk.Label(self.cmd_frame, text="Nenhum log encontrado em ~/.claude/projects/",
                     font=self.f_body, bg=BG, fg=TEXT_DIM).pack(anchor="w")
        else:
            shown = 0
            for sess in sessions[:6]:
                if not sess["commands"]:
                    continue
                t  = sess["time"]
                ts = t.astimezone().strftime("%d/%m %H:%M") if t else "—"

                hdr = tk.Frame(self.cmd_frame, bg=PANEL, padx=10, pady=6)
                hdr.pack(fill="x", pady=(0, 3))
                tk.Label(hdr, text=f"📁 {ts}", font=self.f_header,
                         bg=PANEL, fg=TEXT).pack(side="left")
                tk.Label(hdr, text=fmt_tokens(sess["total"]) + " tokens",
                         font=self.f_small, bg=PANEL, fg=ACCENT).pack(side="right")

                for (_, cmd) in sess["commands"][-4:]:
                    row = tk.Frame(self.cmd_frame, bg=BG)
                    row.pack(fill="x", pady=1)
                    tk.Label(row, text="›", font=self.f_cmd,
                             bg=BG, fg=ACCENT2, width=2).pack(side="left")
                    tk.Label(row, text=truncate(cmd),
                             font=self.f_cmd, bg=BG, fg=TEXT, anchor="w").pack(side="left")
                shown += 1
                if shown >= 4:
                    break

        self.lbl_updated.configure(text=now_local.strftime("%H:%M:%S"))

    def _schedule_refresh(self):
        self._refresh()
        self.after(REFRESH_INTERVAL, self._schedule_refresh)

    def _toggle_topmost(self):
        self.attributes("-topmost", not self.attributes("-topmost"))


if __name__ == "__main__":
    app = TokenMonitor()
    app.mainloop()
