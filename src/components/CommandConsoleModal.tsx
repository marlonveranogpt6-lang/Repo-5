import React, { useEffect, useRef, useState } from 'react';
import { Bug, Coins, Terminal, X, Zap } from 'lucide-react';
import { soundEngine } from '../game/soundEngine.ts';

interface CommandConsoleModalProps {
  open: boolean;
  coins: number;
  profileLabel: string;
  inCombat: boolean;
  debugOpen: boolean;
  onGiveCoins: (amount?: number) => void;
  onToggleCombatDebug?: () => void;
  onClose: () => void;
}

export const CommandConsoleModal: React.FC<CommandConsoleModalProps> = ({
  open,
  coins,
  profileLabel,
  inCombat,
  debugOpen,
  onGiveCoins,
  onToggleCombatDebug,
  onClose,
}) => {
  const [commandInput, setCommandInput] = useState('/givecoins 1000');
  const [grantCount, setGrantCount] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setFeedback(null);
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  const triggerGive1000 = () => {
    soundEngine.unlock();
    soundEngine.play('orbPickupChime');
    onGiveCoins(1000);
    setGrantCount((c) => c + 1);
    setFeedback('+1,000 Coins granted!');
  };

  const handleRunCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = commandInput.trim().toLowerCase();
    if (
      !raw ||
      raw === '/givecoins' ||
      raw === 'givecoins' ||
      raw === '/coins' ||
      raw === 'coins' ||
      raw === '/givecoins 1000' ||
      raw === 'givecoins 1000' ||
      raw === '/coins 1000' ||
      raw === '1000' ||
      raw.startsWith('/givecoins') ||
      raw.startsWith('/coins') ||
      raw.startsWith('givecoins')
    ) {
      triggerGive1000();
      return;
    }
    if (raw === '/debug' || raw === 'debug') {
      if (inCombat && onToggleCombatDebug) {
        onToggleCombatDebug();
        setFeedback('Toggled Combat Awakening Debug panel.');
      } else {
        setFeedback('Combat Awakening Debug is only available during an active match.');
      }
      return;
    }
    soundEngine.play('lockedError');
    setFeedback(`Unknown command "${commandInput.trim()}". Use /givecoins 1000.`);
  };

  return (
    <div
      data-testid="f9-command-modal"
      className="fixed inset-0 z-[90] bg-slate-950/60 flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-950 border-2 border-amber-400/70 text-white shadow-2xl overflow-hidden animate-modal-pop">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="font-display font-bold text-sm tracking-wide text-amber-300 flex items-center gap-1.5">
                <span>COMMAND CONSOLE</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-400/15 border border-amber-400/40 font-mono-num text-[10px] text-amber-200">
                  F9
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate max-w-[230px]">
                Active: <span className="text-slate-200 font-semibold">{profileLabel}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            data-testid="f9-close-btn"
            onClick={() => {
              soundEngine.play('uiClick');
              onClose();
            }}
            aria-label="Close Command Console"
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5">
          {/* Live Balance Bar */}
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 px-3.5 py-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Current Balance
            </span>
            <span
              data-testid="f9-coins-balance"
              className="inline-flex items-center gap-1.5 font-mono-num text-base font-black text-amber-300"
            >
              <Coins className="w-4 h-4 text-amber-400" />
              <span>{coins.toLocaleString()}</span>
            </span>
          </div>

          {/* Primary Instant +1,000 Coins Command Button */}
          <button
            type="button"
            data-testid="f9-give-coins-btn"
            onClick={triggerGive1000}
            className="w-full min-h-[50px] px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 border-2 border-amber-300 font-display font-bold text-sm sm:text-base flex items-center justify-between gap-2 shadow-lg cursor-pointer transition"
          >
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-slate-950" />
              <span>RUN: +1,000 COINS</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-950/15 font-mono-num text-xs font-black">
              /givecoins 1000
            </span>
          </button>

          {/* Text Command Input */}
          <form onSubmit={handleRunCommand} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              data-testid="f9-command-input"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="/givecoins 1000"
              className="flex-1 h-9 px-3 rounded-xl bg-slate-900 border border-slate-700 font-mono-num text-xs text-amber-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              data-testid="f9-run-btn"
              className="h-9 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs uppercase cursor-pointer transition shrink-0"
            >
              Execute
            </button>
          </form>

          {feedback && (
            <div
              data-testid="f9-command-feedback"
              className="rounded-xl bg-emerald-500/15 border border-emerald-400/40 px-3 py-2 text-xs font-semibold text-emerald-200 flex items-center justify-between gap-2"
            >
              <span>{feedback}</span>
              {grantCount > 0 && (
                <span className="font-mono-num text-[11px] text-amber-300 shrink-0">
                  ×{grantCount}
                </span>
              )}
            </div>
          )}

          {inCombat && onToggleCombatDebug && (
            <button
              type="button"
              onClick={() => {
                soundEngine.play('uiClick');
                onToggleCombatDebug();
              }}
              className="w-full h-9 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <Bug className="w-3.5 h-3.5 text-amber-400" />
              <span>{debugOpen ? 'Hide' : 'Show'} Combat Awakening Debug Panel (`)</span>
            </button>
          )}

          <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-white/10">
            <span>Press the button or Execute to add +1,000 Coins each time.</span>
            <span className="font-mono-num text-slate-500">F9 / ESC</span>
          </div>
        </div>
      </div>
    </div>
  );
};
