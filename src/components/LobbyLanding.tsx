import React, { useEffect, useState } from 'react';
import {
  Ban,
  Bot,
  ChevronLeft,
  ChevronRight,
  Coins,
  Film,
  Gamepad2,
  Home,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Swords,
} from 'lucide-react';
import { soundEngine } from '../game/soundEngine.ts';
import type { GuestSession, UserAccount } from '../game/accountStore.ts';
import type { CloudUserProfile } from '../game/firebaseUsers.ts';
import { canEnterArena } from '../game/userLogic.ts';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { FullscreenControls } from './FullscreenControls.tsx';
import { MusicToggleButton } from './MusicToggleButton.tsx';
import { TekkenStagePreview } from './TekkenStagePreview.tsx';
import {
  FIGHTER_BY_ID,
  FIGHTERS,
  FighterId,
  GAME_MODES,
  GAME_MODE_BY_ID,
  type GameModeId,
  type SkinId,
  getFighterSkinMeta,
} from '../shared/gameData.ts';

const HUB_TIPS = [
  'Chain M1 combos, guard with F to timed-parry, and break blocks with G Grab.',
  'Press Q to dash with invulnerability frames or Double-Space to fly.',
  'Collect Awakening Orbs in battle for 2x HP/Chi and 20 m/s surge speed.',
  'Swap fighters with the arrows or preview skins in Shop before entering a room.',
];

interface LobbyLandingProps {
  initialRoomCode: string;
  initialName: string;
  account: UserAccount | null;
  cloudUser: CloudUserProfile | null;
  guestSession?: GuestSession | null;
  bonusCoins?: number;
  authLoading: boolean;
  authError: string | null;
  isAdmin: boolean;
  isPlaceholderConfig: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  pingMs: number | null;
  errorMessage: string | null;
  appVersion?: number;
  previewFighterId?: FighterId;
  previewSkinId?: SkinId;
  onChangePreviewFighter?: (fighterId: FighterId) => void;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  onExitGuestToLogin?: () => void;
  onOpenAdminMonitor: () => void;
  onOpenFirebaseGuide: () => void;
  onLoginAccount: (username: string) => void;
  onLogoutAccount: () => void;
  selectedMode: GameModeId;
  onSelectMode: (mode: GameModeId) => void;
  onCreateRoom: (
    name: string,
    opts?: { isSoloPractice?: boolean; isTrainingMode?: boolean; gameMode?: GameModeId }
  ) => void;
  onJoinRoom: (roomCode: string, name: string) => void;
  onOpenCinemaCut: () => void;
  onOpenShop: () => void;
}

export const LobbyLanding: React.FC<LobbyLandingProps> = ({
  initialRoomCode,
  initialName,
  account,
  cloudUser,
  guestSession = null,
  bonusCoins = 0,
  authLoading,
  authError,
  isAdmin,
  isPlaceholderConfig,
  connectionStatus,
  pingMs,
  errorMessage,
  appVersion = 10,
  previewFighterId: controlledFighterId,
  previewSkinId = 'classic',
  onChangePreviewFighter,
  onGoogleSignIn,
  onGoogleSignOut,
  onExitGuestToLogin,
  onOpenAdminMonitor,
  onOpenFirebaseGuide,
  onLoginAccount,
  onLogoutAccount,
  selectedMode,
  onSelectMode,
  onCreateRoom,
  onJoinRoom,
  onOpenCinemaCut,
  onOpenShop,
}) => {
  const effectiveName =
    cloudUser?.displayName || account?.username || guestSession?.displayName || initialName || 'Fighter';
  const [name, setName] = useState(effectiveName);
  const [fallbackInput, setFallbackInput] = useState('');
  const [showFallbackForm, setShowFallbackForm] = useState(false);
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [loginAttention, setLoginAttention] = useState(false);
  const [localFighterId, setLocalFighterId] = useState<FighterId>(
    controlledFighterId ?? cloudUser?.favoriteFighter ?? 'jm'
  );
  const [tipIndex, setTipIndex] = useState(0);
  const { enterFullscreen } = usePWAInstall();

  const activeFighterId = controlledFighterId ?? localFighterId;
  const setFighterId = (fid: FighterId) => {
    setLocalFighterId(fid);
    onChangePreviewFighter?.(fid);
  };

  useEffect(() => {
    if (cloudUser?.displayName) {
      setName(cloudUser.displayName);
    } else if (account?.username) {
      setName(account.username);
    } else if (guestSession?.displayName) {
      setName(guestSession.displayName);
    }
  }, [cloudUser?.displayName, account?.username, guestSession?.displayName]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % HUB_TIPS.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, []);

  const handleAction = (
    fn: () => void,
    tryFs = false,
    sfx: 'uiClick' | 'uiSelect' | 'transitionWhoosh' | 'loginSuccess' = 'uiClick'
  ) => {
    soundEngine.unlock();
    soundEngine.play(sfx);
    if (tryFs && window.matchMedia('(pointer: coarse)').matches) {
      void enterFullscreen(false);
    }
    fn();
  };

  const handleFallbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = fallbackInput.trim();
    if (!clean) return;
    soundEngine.unlock();
    soundEngine.play('loginSuccess');
    onLoginAccount(clean);
    setShowFallbackForm(false);
  };

  const cyclePreviewFighter = (dir: -1 | 1) => {
    soundEngine.unlock();
    soundEngine.play('uiSelect');
    const idx = Math.max(0, FIGHTERS.findIndex((f) => f.id === activeFighterId));
    const next = FIGHTERS[(idx + dir + FIGHTERS.length) % FIGHTERS.length];
    setFighterId(next.id);
  };

  const syncedCoins = (cloudUser?.coins ?? account?.coins ?? guestSession?.coins ?? 0) + bonusCoins;
  const isBanned = Boolean(cloudUser?.banned);
  const isGuest = Boolean(!cloudUser && !account && guestSession);
  const isSignedIn = isGuest || (isPlaceholderConfig ? Boolean(cloudUser || account) : Boolean(cloudUser));
  const entryGate = canEnterArena({
    isPlaceholderConfig,
    hasCloudUser: Boolean(cloudUser),
    hasLocalAccount: Boolean(account),
    isGuest,
    isBanned,
    connectionStatus,
  });

  const nudgeSignIn = () => {
    soundEngine.unlock();
    soundEngine.play('lockedError');
    setLoginAttention(true);
    setTimeout(() => setLoginAttention(false), 900);
  };

  const previewSpec = FIGHTER_BY_ID[activeFighterId];
  const equippedPreviewSkin: SkinId =
    cloudUser?.equippedSkins?.[activeFighterId] ?? previewSkinId ?? 'classic';
  const previewSkinMeta = getFighterSkinMeta(activeFighterId, equippedPreviewSkin);

  return (
    <div className="relative h-[100dvh] w-full max-w-[100dvw] bg-[#cdd8e6] text-slate-900 flex flex-col justify-between overflow-hidden safe-area-pad animate-screen-enter">
      {/* Semi-Light Studio Spotlight & Soft Mist-Slate Arena Backdrop */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 62% 58% at 50% 42%, rgba(251, 191, 36, 0.30), rgba(219, 228, 240, 0.72) 52%, rgba(169, 184, 206, 0.96) 100%)',
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-35"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 78%)',
        }}
      />

      {/* Full-Viewport Center 3D Fighter Showcase Stage (Raised cleanly above bottom strip) */}
      <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none">
        <div className="w-full h-[50dvh] sm:h-[74dvh] max-w-2xl -translate-y-10 sm:-translate-y-4 pointer-events-auto">
          <TekkenStagePreview
            fighterId={activeFighterId}
            skinId={equippedPreviewSkin}
            variant="semi-light"
            interactive
          />
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
          style={{
            background: 'linear-gradient(to top, rgba(182,196,216,0.75), rgba(182,196,216,0.18), transparent)',
          }}
        />
      </div>

      {/* TOP HUD BAR: Profile/Coins (Left) · Icon Tabs (Center) · Music/Setup/FS/SignOut (Right) */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-2.5 sm:px-5 pt-2 sm:pt-3 flex items-center justify-between gap-2 shrink-0">
        {/* Left: Profile & Currency Cluster */}
        <div className="flex items-center gap-2 min-w-0">
          {cloudUser?.photoURL ? (
            <img
              src={cloudUser.photoURL}
              alt={cloudUser.displayName}
              referrerPolicy="no-referrer"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-amber-500/60 object-cover shrink-0 shadow-sm"
            />
          ) : (
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-400 text-slate-950 font-display font-bold text-xs sm:text-sm flex items-center justify-center shrink-0 shadow-sm">
              {effectiveName.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-display font-bold text-xs sm:text-sm text-slate-950 truncate max-w-[96px] sm:max-w-[155px]">
                {effectiveName}
              </span>
              {isAdmin && (
                <span className="text-[9px] font-display font-bold uppercase tracking-wider text-amber-700 shrink-0">
                  Admin
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-0.5 text-[10px] sm:text-[11px] font-mono-num">
              <button
                type="button"
                data-testid={isGuest ? 'guest-coins-badge' : 'account-coins'}
                onClick={() => handleAction(onOpenShop, false, 'uiSelect')}
                className="inline-flex items-center gap-1 text-amber-800 hover:text-amber-700 font-bold cursor-pointer whitespace-nowrap"
                title="Open Item Shop"
              >
                <Coins className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 shrink-0" />
                <span>{syncedCoins.toLocaleString()}</span>
                <Plus className="w-3 h-3 text-amber-700" />
              </button>

              {cloudUser ? (
                <span className="hidden lg:inline text-slate-600 whitespace-nowrap">
                  {cloudUser.wins}W·{cloudUser.losses}L·{cloudUser.totalKOs} KO
                </span>
              ) : isGuest ? (
                <button
                  type="button"
                  data-testid="link-google-btn"
                  disabled={authLoading}
                  onClick={() => handleAction(onGoogleSignIn, false, 'uiSelect')}
                  className="text-[10px] font-display font-bold text-sky-700 hover:text-sky-600 underline cursor-pointer whitespace-nowrap"
                >
                  Link +1k
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Center: Clean Icon-Above-Label Nav Tabs */}
        <nav className="flex items-center gap-0.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.play('uiClick');
            }}
            className="relative min-h-[40px] px-2 sm:px-3 py-1 flex flex-col items-center justify-center gap-0.5 text-slate-950 cursor-pointer whitespace-nowrap"
          >
            <Home className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-amber-600" />
            <span className="text-[9px] sm:text-[10px] font-display font-bold">Home</span>
            <span className="absolute bottom-0 inset-x-1.5 h-0.5 rounded-full bg-amber-500" />
          </button>

          <button
            type="button"
            data-testid="open-shop-btn"
            onClick={() => handleAction(onOpenShop, false, 'uiSelect')}
            className="ui-interactive min-h-[40px] px-2 sm:px-3 py-1 flex flex-col items-center justify-center gap-0.5 text-slate-600 hover:text-slate-950 cursor-pointer whitespace-nowrap"
          >
            <ShoppingBag className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
            <span className="text-[9px] sm:text-[10px] font-display font-semibold">Shop</span>
          </button>

          <button
            type="button"
            onClick={() => handleAction(onOpenCinemaCut, false, 'transitionWhoosh')}
            className="ui-interactive min-h-[40px] px-2 sm:px-3 py-1 flex flex-col items-center justify-center gap-0.5 text-slate-600 hover:text-slate-950 cursor-pointer whitespace-nowrap"
          >
            <Film className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
            <span className="text-[9px] sm:text-[10px] font-display font-semibold">Cinema</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              data-testid="admin-monitor-btn"
              onClick={() => handleAction(onOpenAdminMonitor)}
              className="ui-interactive min-h-[40px] px-2 sm:px-3 py-1 flex flex-col items-center justify-center gap-0.5 text-amber-700 hover:text-amber-600 cursor-pointer whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              <span className="text-[9px] sm:text-[10px] font-display font-semibold">Admin</span>
            </button>
          )}
        </nav>

        {/* Right: Music, Cloud Setup, Fullscreen & Sign Out */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <MusicToggleButton compact variant="semi-light" />

          <button
            type="button"
            data-testid="firebase-guide-btn"
            onClick={() => handleAction(onOpenFirebaseGuide)}
            title="Account & Cloud Setup"
            className="ui-interactive min-h-[32px] sm:min-h-[36px] px-2 rounded-lg bg-white/75 hover:bg-white border border-slate-300/90 text-slate-800 flex items-center gap-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap shadow-xs"
          >
            <KeyRound className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span className="hidden xl:inline">Cloud</span>
          </button>

          <FullscreenControls compact variant="light" />

          {cloudUser ? (
            <button
              type="button"
              onClick={() => handleAction(onGoogleSignOut)}
              title="Sign Out"
              className="ui-interactive min-h-[32px] sm:min-h-[36px] px-2 rounded-lg bg-white/75 hover:bg-rose-50 border border-slate-300/90 text-slate-800 hover:text-rose-700 flex items-center gap-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline">Sign Out</span>
            </button>
          ) : account ? (
            <button
              type="button"
              onClick={() => handleAction(onLogoutAccount)}
              title="Log Out"
              className="ui-interactive min-h-[32px] sm:min-h-[36px] px-2 rounded-lg bg-white/75 hover:bg-rose-50 border border-slate-300/90 text-slate-800 hover:text-rose-700 flex items-center gap-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline">Log Out</span>
            </button>
          ) : isGuest && onExitGuestToLogin ? (
            <button
              type="button"
              onClick={() => handleAction(onExitGuestToLogin)}
              title="Switch Account"
              className="ui-interactive min-h-[32px] sm:min-h-[36px] px-2 rounded-lg bg-white/75 hover:bg-white border border-slate-300/90 text-slate-800 flex items-center gap-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline">Switch</span>
            </button>
          ) : null}
        </div>
      </header>

      {/* MIDDLE INTERACTIVE HUD LAYER: Zero-Clipping & Open Center Stage */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-2.5 sm:px-5 flex-1 min-h-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 py-1 pointer-events-none">
        {/* Left Panel: Mode Selector (compact side width on landscape mobile, never clips) */}
        <div className="order-2 sm:order-1 w-full sm:w-[172px] md:w-[205px] lg:w-[244px] min-w-0 shrink-0 pointer-events-auto rounded-2xl bg-white/78 backdrop-blur-md border border-slate-300/90 p-2 sm:p-2.5 lg:p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.10)] space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-amber-700 truncate">
              Game Mode
            </span>
            <span className="text-[10px] font-mono-num font-semibold text-slate-500 shrink-0">
              {GAME_MODE_BY_ID[selectedMode]?.playersHint}
            </span>
          </div>

          <div data-testid="lobby-mode-selector" className="grid grid-cols-3 sm:grid-cols-2 gap-1">
            {GAME_MODES.map((gm) => {
              const active = selectedMode === gm.id;
              return (
                <button
                  key={gm.id}
                  type="button"
                  data-testid={`lobby-mode-${gm.id}`}
                  onClick={() => handleAction(() => onSelectMode(gm.id), false, 'uiSelect')}
                  title={gm.description}
                  className={`min-h-[30px] sm:min-h-[32px] px-1.5 py-1 rounded-lg border text-[9px] sm:text-[10px] font-display font-bold uppercase tracking-tight cursor-pointer transition truncate ${
                    active
                      ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-xs'
                      : 'bg-slate-100/80 hover:bg-white text-slate-700 border-slate-300/80'
                  }`}
                >
                  {gm.shortLabel}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-slate-600 leading-snug line-clamp-1 md:line-clamp-2 [@media(max-height:450px)]:hidden">
            {GAME_MODE_BY_ID[selectedMode]?.description}
          </p>

          {/* Mobile portrait (< sm) compact Tag + Room Code row */}
          {isSignedIn ? (
            <div className="sm:hidden pt-1.5 border-t border-slate-200 flex items-center gap-1.5 min-w-0">
              <input
                type="text"
                data-testid="mobile-player-name"
                maxLength={14}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Fighter Tag"
                aria-label="Arena Fighter Tag"
                className="flex-1 min-w-0 h-8 px-2.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                maxLength={4}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="CODE"
                aria-label="Room Code"
                className="w-16 shrink-0 h-8 px-1.5 rounded-lg bg-white border border-slate-300 text-center font-mono-num text-xs font-bold tracking-widest text-amber-700 placeholder-slate-400 focus:outline-none focus:border-sky-500 uppercase"
              />
              <button
                type="button"
                data-testid="mobile-join-room-btn"
                disabled={!entryGate.allowed || roomCode.length < 4}
                onClick={() => handleAction(() => onJoinRoom(roomCode, name), true, 'transitionWhoosh')}
                className="ui-interactive shrink-0 h-8 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-display font-bold text-xs cursor-pointer whitespace-nowrap"
              >
                JOIN
              </button>
            </div>
          ) : (
            <div className="sm:hidden pt-1.5 border-t border-slate-200 flex items-center gap-1.5">
              <button
                type="button"
                disabled={authLoading}
                onClick={() => handleAction(onGoogleSignIn, false, 'uiSelect')}
                className="ui-interactive flex-1 h-8 px-2.5 rounded-lg bg-amber-400 text-slate-950 font-display font-bold text-xs cursor-pointer truncate"
              >
                {authLoading ? 'Signing in...' : 'Sign in with Google'}
              </button>
              {isPlaceholderConfig && (
                <button
                  type="button"
                  onClick={() => handleAction(() => onLoginAccount('Fighter'), false, 'loginSuccess')}
                  className="ui-interactive h-8 px-2.5 rounded-lg bg-slate-800 text-white font-display font-bold text-xs cursor-pointer whitespace-nowrap"
                >
                  Quick Start
                </button>
              )}
            </div>
          )}
        </div>

        {/* Center Stage Bottom Strip: Fighter Cycling Pill tucked neatly below feet (never blocks character) */}
        <div className="order-1 sm:order-2 flex-1 min-w-0 min-h-0 flex flex-col items-center justify-end pb-0.5 sm:pb-1 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/84 backdrop-blur-md border border-slate-300/90 shadow-md max-w-full">
            <button
              type="button"
              aria-label="Previous Fighter"
              onClick={() => cyclePreviewFighter(-1)}
              className="w-7 h-7 rounded-full bg-slate-200/80 hover:bg-slate-300/80 text-slate-800 flex items-center justify-center cursor-pointer transition active:scale-90 shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center min-w-[104px] sm:min-w-[128px] px-1 truncate">
              <div className="font-display font-bold text-[11px] sm:text-xs text-slate-950 leading-tight truncate">
                {previewSpec.name}
              </div>
              <div className="text-[9px] sm:text-[10px] text-amber-700 font-semibold truncate">
                {previewSkinMeta.name}
              </div>
            </div>
            <button
              type="button"
              aria-label="Next Fighter"
              onClick={() => cyclePreviewFighter(1)}
              className="w-7 h-7 rounded-full bg-slate-200/80 hover:bg-slate-300/80 text-slate-800 flex items-center justify-center cursor-pointer transition active:scale-90 shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Panel (Landscape / Desktop): Fighter Tag, Join Room Code, Auth Alerts (Zero Right-Edge Clipping) */}
        <div className="hidden sm:flex order-3 w-[172px] md:w-[205px] lg:w-[244px] min-w-0 shrink-0 flex-col gap-1.5 pointer-events-auto">
          <div
            data-testid="account-panel"
            className={`rounded-2xl bg-white/78 backdrop-blur-md border p-2 md:p-2.5 lg:p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.10)] space-y-1.5 lg:space-y-2 transition min-w-0 ${
              loginAttention ? 'border-amber-500 ring-2 ring-amber-400/50' : 'border-slate-300/90'
            }`}
          >
            <div className="min-w-0">
              <label
                htmlFor="player-name"
                className="block text-[9px] md:text-[10px] font-display font-bold uppercase tracking-wider text-slate-600 mb-0.5 truncate"
              >
                Arena Fighter Tag
              </label>
              <input
                id="player-name"
                type="text"
                maxLength={14}
                disabled={!isSignedIn}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isSignedIn ? 'Enter nickname' : 'Sign in first...'}
                className="w-full min-w-0 h-8 px-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 disabled:opacity-50"
              />
            </div>

            <div className="pt-1 border-t border-slate-200 min-w-0">
              <div className="text-[9px] md:text-[10px] font-display font-bold uppercase tracking-wider text-slate-600 mb-0.5 truncate">
                Join Friend Room
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <input
                  type="text"
                  maxLength={4}
                  disabled={!isSignedIn}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="CODE"
                  className="w-[54px] md:w-[62px] lg:w-[72px] shrink-0 h-8 px-1 rounded-lg bg-white border border-slate-300 text-center font-mono-num text-xs font-bold tracking-widest text-amber-700 placeholder-slate-400 focus:outline-none focus:border-sky-500 uppercase disabled:opacity-50"
                />
                <button
                  type="button"
                  data-testid="join-room-btn"
                  disabled={!entryGate.allowed || roomCode.length < 4}
                  onClick={() => handleAction(() => onJoinRoom(roomCode, name), true, 'transitionWhoosh')}
                  className="ui-interactive btn-shimmer flex-1 min-w-0 h-8 px-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-display font-bold text-[10px] md:text-[11px] flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap truncate"
                >
                  {!isSignedIn && <Lock className="w-3 h-3 shrink-0" />}
                  <span className="lg:hidden">JOIN</span>
                  <span className="hidden lg:inline">JOIN ROOM</span>
                </button>
              </div>
            </div>

            {isGuest && (
              <button
                type="button"
                data-testid="panel-link-google-btn"
                disabled={authLoading}
                onClick={() => handleAction(onGoogleSignIn, false, 'uiSelect')}
                className="ui-interactive w-full h-8 px-2 rounded-lg bg-amber-400/25 hover:bg-amber-400/40 border border-amber-500/50 text-amber-900 font-display font-bold text-[10px] lg:text-[11px] flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap truncate"
              >
                <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">{authLoading ? 'Linking...' : 'Link Google (+1k)'}</span>
              </button>
            )}

            {!isSignedIn && (
              <div className="space-y-1.5 pt-1 border-t border-slate-200">
                <button
                  type="button"
                  data-testid="google-signin-btn"
                  disabled={authLoading}
                  onClick={() => handleAction(onGoogleSignIn, false, 'uiSelect')}
                  className="ui-interactive w-full h-8 px-2 rounded-lg bg-amber-400 text-slate-950 font-display font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer truncate"
                >
                  <span>{authLoading ? 'Signing in...' : 'Sign in Google'}</span>
                </button>
                {isPlaceholderConfig && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowFallbackForm((v) => !v)}
                      className="w-full text-[10px] text-amber-700 underline cursor-pointer"
                    >
                      Use local fallback account
                    </button>
                    {showFallbackForm && (
                      <form onSubmit={handleFallbackSubmit} className="flex gap-1">
                        <input
                          type="text"
                          maxLength={14}
                          value={fallbackInput}
                          onChange={(e) => setFallbackInput(e.target.value)}
                          placeholder="Username"
                          className="flex-1 min-w-0 h-7 px-2 rounded bg-white border border-slate-300 text-xs text-slate-900"
                        />
                        <button
                          type="submit"
                          className="h-7 px-2 rounded bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <LogIn className="w-3 h-3" />
                        </button>
                      </form>
                    )}
                  </>
                )}
                <div
                  data-testid="mandatory-login-banner"
                  onClick={nudgeSignIn}
                  className="rounded-lg bg-amber-100 border border-amber-300 px-2 py-1 text-[10px] text-amber-900 cursor-pointer"
                >
                  Sign in required to play.
                </div>
              </div>
            )}
          </div>

          {(authError || errorMessage || isBanned) && (
            <div className="rounded-xl bg-rose-50/95 border border-rose-300 px-2.5 py-1.5 text-[10px] text-rose-700 font-medium shadow-md flex items-center gap-1.5">
              {isBanned && <Ban className="w-3.5 h-3.5 shrink-0" />}
              <span className="line-clamp-2">
                {isBanned
                  ? 'This account is suspended by Admin Monitor.'
                  : authError || errorMessage}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Portrait Error Alert */}
      {(authError || errorMessage || isBanned) && (
        <div className="sm:hidden relative z-20 mx-2.5 mb-1 rounded-lg bg-rose-50/95 border border-rose-300 px-2.5 py-1 text-[10px] text-rose-700 font-medium truncate shrink-0">
          {isBanned ? 'Account suspended by Admin Monitor.' : authError || errorMessage}
        </div>
      )}

      {/* BOTTOM ACTION DOCK: Quiet Tip/Ping (Left) · Vs. Bot / Training / MATCH CTA (Right) */}
      <footer className="relative z-20 w-full max-w-7xl mx-auto px-2.5 sm:px-5 pb-2 sm:pb-3 pt-1 flex items-center justify-between gap-2 shrink-0">
        <div className="hidden md:flex flex-col min-w-0 max-w-md">
          <p className="text-[11px] text-slate-700 truncate font-medium">
            {HUB_TIPS[tipIndex]}
          </p>
          <div className="flex items-center gap-2 text-[10px] font-mono-num text-slate-600 mt-0.5">
            <span>
              {connectionStatus === 'connected'
                ? `Sync${pingMs !== null ? ` · ${pingMs} ms` : ''}`
                : connectionStatus === 'connecting'
                ? 'Connecting...'
                : 'Reconnecting...'}
            </span>
            <span>·</span>
            <span data-testid="app-version">v{appVersion}</span>
          </div>
        </div>

        <div className="w-full md:w-auto flex items-center justify-end gap-1.5 sm:gap-2.5">
          <button
            type="button"
            data-testid="vs-bot-btn"
            data-start="true"
            disabled={!entryGate.allowed}
            onClick={() =>
              handleAction(
                () => onCreateRoom(name, { isSoloPractice: true, gameMode: selectedMode }),
                true,
                'transitionWhoosh'
              )
            }
            className="ui-interactive min-h-[42px] sm:min-h-[46px] px-3 sm:px-4 rounded-xl bg-white/85 hover:bg-white disabled:opacity-45 border border-slate-300/90 text-slate-900 font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shadow-sm"
          >
            <Bot className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Vs. Bot</span>
          </button>

          <button
            type="button"
            data-testid="training-area-btn"
            disabled={!entryGate.allowed}
            onClick={() => handleAction(() => onCreateRoom(name, { isTrainingMode: true }), true, 'transitionWhoosh')}
            className="ui-interactive min-h-[42px] sm:min-h-[46px] px-3 sm:px-4 rounded-xl bg-white/85 hover:bg-white disabled:opacity-45 border border-emerald-400/70 text-emerald-700 font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shadow-sm"
          >
            <Gamepad2 className="w-4 h-4 shrink-0" />
            <span>Training</span>
          </button>

          <button
            type="button"
            data-testid="create-room-btn"
            disabled={!entryGate.allowed}
            onClick={() =>
              handleAction(() => onCreateRoom(name, { gameMode: selectedMode }), true, 'transitionWhoosh')
            }
            className="ui-interactive btn-shimmer flex-1 sm:flex-none min-h-[42px] sm:min-h-[46px] px-4 sm:px-7 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-45 border border-amber-500/80 text-slate-950 font-display font-bold text-sm sm:text-base tracking-wide flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(245,158,11,0.32)] cursor-pointer whitespace-nowrap"
          >
            {!isSignedIn ? <Lock className="w-4 h-4 shrink-0" /> : <Swords className="w-4 h-4 shrink-0" />}
            <span>MATCH</span>
            <span className="hidden lg:inline text-[11px] font-semibold opacity-80">· Room</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
