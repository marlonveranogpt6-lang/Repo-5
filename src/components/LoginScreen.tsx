import React from 'react';
import { Coins, ShieldCheck, Swords, UserRound } from 'lucide-react';
import { soundEngine } from '../game/soundEngine.ts';
import { FullscreenControls } from './FullscreenControls.tsx';
import { MusicToggleButton } from './MusicToggleButton.tsx';
import { TekkenStagePreview } from './TekkenStagePreview.tsx';

interface LoginScreenProps {
  authLoading: boolean;
  authError: string | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  appVersion?: number;
  onGoogleSignIn: () => void;
  onPlayAsGuest: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  authLoading,
  authError,
  connectionStatus,
  appVersion = 10,
  onGoogleSignIn,
  onPlayAsGuest,
}) => {
  return (
    <div
      data-testid="login-screen"
      className="relative h-[100dvh] w-full max-w-[100dvw] bg-[#cdd8e6] text-slate-900 flex flex-col justify-between px-3 sm:px-6 py-2.5 sm:py-4 overflow-hidden safe-area-pad animate-screen-enter"
    >
      {/* Semi-Light Mist-Slate Studio Spotlight Backdrop */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 68% 60% at 50% 44%, rgba(251, 191, 36, 0.28), rgba(219, 228, 240, 0.72) 52%, rgba(169, 184, 206, 0.96) 100%)',
        }}
      />

      {/* Ambient Live 3D Fighter Silhouette Behind Card */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center opacity-70 sm:opacity-85">
        <div className="w-full max-w-2xl h-[64dvh] sm:h-[78dvh]">
          <TekkenStagePreview fighterId="jm" skinId="ascended" variant="semi-light" interactive={false} />
        </div>
      </div>

      {/* Top Status, Music & Fullscreen Bar */}
      <header className="relative z-20 w-full max-w-6xl mx-auto flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] font-display font-bold uppercase tracking-widest text-slate-900">
          <Swords className="w-4 h-4 text-amber-600 shrink-0" />
          <span>KOOPAL CLASH</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="px-2.5 py-1 rounded-lg bg-white/75 backdrop-blur-sm border border-slate-300/90 text-[10px] sm:text-[11px] font-semibold text-slate-700 whitespace-nowrap">
            {connectionStatus === 'connected'
              ? 'Arena Online'
              : connectionStatus === 'connecting'
              ? 'Connecting...'
              : 'Offline Ready'}
          </div>
          <MusicToggleButton compact variant="semi-light" />
          <FullscreenControls compact variant="light" />
        </div>
      </header>

      {/* Center Frosted Semi-Light Entry Card */}
      <div className="relative z-10 w-full max-w-md mx-auto my-auto rounded-2xl bg-white/80 backdrop-blur-md border border-slate-300/90 p-4 sm:p-6 shadow-[0_14px_40px_rgba(15,23,42,0.14)]">
        <div className="text-[10px] font-display font-bold uppercase tracking-widest text-amber-700">
          3D Anime Arena Brawler
        </div>

        <h1 className="font-display text-[clamp(1.5rem,3.6vw,2.4rem)] font-bold tracking-tight text-slate-950 leading-none mt-1">
          KOOPAL CLASH
        </h1>
        <p className="mt-1.5 sm:mt-2 text-xs text-slate-600 leading-snug line-clamp-2">
          2–5 player Domain Expansion battles, Awakening clashes, and tactical arena combat.
        </p>

        <div className="mt-3.5 sm:mt-5 space-y-2.5">
          {/* Primary: Sign in with Google (+1,000 Coins Bonus) */}
          <button
            type="button"
            data-testid="login-google-btn"
            disabled={authLoading}
            onClick={() => {
              soundEngine.unlock();
              soundEngine.play('uiSelect');
              onGoogleSignIn();
            }}
            className="ui-interactive btn-shimmer w-full min-h-[46px] sm:min-h-[52px] px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-55 border border-amber-500/80 text-slate-950 shadow-[0_6px_20px_rgba(245,158,11,0.3)] flex items-center justify-between gap-2 cursor-pointer"
          >
            <span className="flex items-center gap-2 font-display font-bold text-xs sm:text-sm whitespace-nowrap">
              <svg className="w-4 h-4 shrink-0 bg-white rounded-full p-0.5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
                />
              </svg>
              <span>{authLoading ? 'Signing in...' : 'Sign in with Google'}</span>
            </span>

            <span
              data-testid="google-bonus-badge"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 text-amber-300 font-mono-num text-[10px] font-black shrink-0 whitespace-nowrap"
            >
              <Coins className="w-3 h-3 shrink-0" />
              <span>+1,000 COINS</span>
            </span>
          </button>

          {/* Secondary: Play as Guest (0 Starting Coins) */}
          <button
            type="button"
            data-testid="login-guest-btn"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.play('transitionWhoosh');
              onPlayAsGuest();
            }}
            className="ui-interactive w-full min-h-[44px] sm:min-h-[46px] px-3.5 rounded-xl bg-slate-100/90 hover:bg-white border border-slate-300 text-slate-800 font-display font-bold text-xs sm:text-sm flex items-center justify-between gap-2 cursor-pointer"
          >
            <span className="flex items-center gap-2 whitespace-nowrap">
              <UserRound className="w-4 h-4 text-sky-600 shrink-0" />
              <span>Play as Guest</span>
            </span>
            <span className="font-mono-num text-[10px] font-semibold text-slate-500 whitespace-nowrap">
              0 COINS · IN-SESSION
            </span>
          </button>
        </div>

        {authError && (
          <div className="mt-2.5 rounded-xl bg-rose-50 border border-rose-300 px-3 py-1.5 text-[11px] text-rose-700 font-medium line-clamp-2">
            {authError}
          </div>
        )}

        <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-600">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="truncate">Google saves Coins, Skins &amp; Stats. Link anytime in Lobby.</span>
        </div>
      </div>

      {/* Quiet Version Footer */}
      <footer className="relative z-20 w-full max-w-6xl mx-auto flex items-center justify-between text-[10px] font-mono-num text-slate-600 shrink-0">
        <span>KOOPAL CLASH ARENA</span>
        <span data-testid="app-version">v{appVersion}</span>
      </footer>
    </div>
  );
};
