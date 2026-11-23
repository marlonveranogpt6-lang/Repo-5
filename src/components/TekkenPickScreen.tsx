import React, { useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Copy,
  Eye,
  Flame,
  Lock,
  LogOut,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Swords,
  X,
} from 'lucide-react';
import {
  FIGHTER_BY_ID,
  FIGHTERS,
  FighterId,
  GAME_MODES,
  GAME_MODE_BY_ID,
  GameModeId,
  MAPS,
  MapId,
  RoomChatMessage,
  RoomState,
  SKIN_LABELS,
  SKIN_ORDER,
  SkinId,
  getFighterSkinMeta,
} from '../shared/gameData.ts';
import { AWAKENING_CONFIG } from '../shared/awakeningConfig.ts';
import { DOMAIN_CONFIGS } from '../game/domainLogic.ts';
import { TekkenStagePreview } from './TekkenStagePreview.tsx';
import { SkillDemoPreview, SkillDemoTab } from './SkillDemoPreview.tsx';
import { FullscreenControls } from './FullscreenControls.tsx';
import { MusicToggleButton } from './MusicToggleButton.tsx';
import { RoomChatBox } from './RoomChatBox.tsx';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { soundEngine } from '../game/soundEngine.ts';
import type { GuestSession, UserAccount } from '../game/accountStore.ts';
import type { CloudUserProfile } from '../game/firebaseUsers.ts';
import { getSkinPrice, isSkinUnlocked } from '../game/shopLogic.ts';

interface TekkenPickScreenProps {
  room: RoomState;
  playerId: string;
  account: UserAccount | null;
  cloudUser: CloudUserProfile | null;
  guestSession?: GuestSession | null;
  bonusCoins?: number;
  isAdmin: boolean;
  pingMs: number | null;
  errorMessage: string | null;
  selectedSkin: SkinId;
  unlockedSkins: string[];
  chatMessages: RoomChatMessage[];
  unreadChatCount: number;
  chatOpen: boolean;
  onToggleChat: () => void;
  onSendChat: (text: string) => void;
  onSelectFighter: (fighterId: FighterId) => void;
  onSelectSkin: (skinId: SkinId) => void;
  onSelectMap: (mapId: MapId) => void;
  onSelectMode?: (gameMode: GameModeId) => void;
  onToggleReady: (ready: boolean) => void;
  onStartNow: () => void;
  onOpenShop: (initialFighterId?: FighterId, initialSkinId?: SkinId) => void;
  onOpenAdminMonitor: () => void;
  onGoogleSignIn?: () => void;
  onLeave: () => void;
}

export const TekkenPickScreen: React.FC<TekkenPickScreenProps> = ({
  room,
  playerId,
  account,
  cloudUser,
  guestSession = null,
  bonusCoins = 0,
  isAdmin,
  pingMs,
  errorMessage,
  selectedSkin,
  unlockedSkins,
  chatMessages,
  unreadChatCount,
  chatOpen,
  onToggleChat,
  onSendChat,
  onSelectFighter,
  onSelectSkin,
  onSelectMap,
  onSelectMode,
  onToggleReady,
  onStartNow,
  onOpenShop,
  onOpenAdminMonitor,
  onGoogleSignIn,
  onLeave,
}) => {
  const [copied, setCopied] = useState(false);
  const [skillsDrawerOpen, setSkillsDrawerOpen] = useState(false);
  const [modeModalOpen, setModeModalOpen] = useState(false);
  const [demoTab, setDemoTab] = useState<SkillDemoTab>('m1');
  const { enterFullscreen } = usePWAInstall();

  const me = room.players.find((p) => p.playerId === playerId);
  const myFighterId: FighterId = me?.fighterId ?? 'jm';
  const candidateSkin: SkinId = selectedSkin ?? me?.skinId ?? 'classic';
  const mySkinId: SkinId = isSkinUnlocked(unlockedSkins, myFighterId, candidateSkin)
    ? candidateSkin
    : 'classic';
  const mySpec = FIGHTER_BY_ID[myFighterId];
  const isHost = room.hostId === playerId;
  const canStart = room.isSoloPractice || room.isTrainingMode || room.players.length >= 2;
  const baseCoins = cloudUser?.coins ?? account?.coins ?? guestSession?.coins ?? null;
  const displayCoins = baseCoins !== null ? baseCoins + bonusCoins : bonusCoins > 0 ? bonusCoins : null;

  const cycleSkin = (dir: -1 | 1) => {
    soundEngine.unlock();
    const unlockedForFighter = SKIN_ORDER.filter((sid) =>
      isSkinUnlocked(unlockedSkins, myFighterId, sid)
    );
    if (unlockedForFighter.length <= 1) {
      soundEngine.play('uiClick');
      onOpenShop(myFighterId, 'ascended');
      return;
    }
    soundEngine.play('uiSelect');
    const idx = Math.max(0, unlockedForFighter.indexOf(mySkinId));
    const nextIdx = (idx + dir + unlockedForFighter.length) % unlockedForFighter.length;
    onSelectSkin(unlockedForFighter[nextIdx]);
  };

  const copyInvite = async () => {
    soundEngine.unlock();
    soundEngine.play('uiClick');
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', room.roomCode);
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const triggerMobileFs = () => {
    if (window.matchMedia('(pointer: coarse)').matches) {
      void enterFullscreen(true);
    }
  };

  const activeModeLabel = room.isTrainingMode
    ? 'Training'
    : GAME_MODE_BY_ID[room.gameMode]?.shortLabel ?? 'Classic FFA';

  return (
    <div className="h-[100dvh] w-full max-w-[100dvw] bg-[#cdd8e6] text-slate-900 flex flex-col justify-between px-2 py-1.5 sm:px-4 sm:py-2.5 overflow-hidden safe-area-pad animate-screen-enter">
      {/* Semi-Light Mist-Slate Studio Spotlight Backdrop */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 68% 58% at 28% 48%, rgba(251, 191, 36, 0.25), rgba(219, 228, 240, 0.72) 55%, rgba(169, 184, 206, 0.96) 100%)',
        }}
      />

      {/* TIER 1: Slim Top Room Bar + Single-Row P1–P5 Strip */}
      <div className="relative z-20 w-full max-w-7xl mx-auto flex flex-col gap-1 shrink-0">
        <div className="flex items-center justify-between gap-1.5 bg-white/80 backdrop-blur-md border border-slate-300/90 rounded-xl px-2.5 py-1.5 shadow-sm">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] font-display font-bold uppercase tracking-wider text-slate-500 hidden sm:inline">
                {room.isTrainingMode ? 'Training' : room.isSoloPractice ? 'Bot' : 'Room'}
              </span>
              <span className="font-mono-num text-sm sm:text-base font-bold tracking-widest text-amber-700 leading-none">
                {room.roomCode}
              </span>
            </div>

            {!room.isSoloPractice && !room.isTrainingMode && (
              <button
                type="button"
                onClick={copyInvite}
                className="ui-interactive min-h-[30px] px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-white border border-slate-300 text-[10px] sm:text-[11px] font-semibold text-slate-800 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-sky-600" />}
                <span className="hidden xs:inline sm:inline">{copied ? 'Copied' : 'Invite'}</span>
              </button>
            )}

            {!room.isTrainingMode && (
              <button
                type="button"
                onClick={() => {
                  if (onSelectMode && isHost) {
                    soundEngine.play('uiClick');
                    setModeModalOpen(true);
                  }
                }}
                className={`min-h-[30px] px-2 py-0.5 rounded-lg border text-[10px] font-display font-bold uppercase flex items-center gap-1 whitespace-nowrap truncate ${
                  isHost && onSelectMode
                    ? 'bg-amber-100 hover:bg-amber-200 border-amber-400 text-amber-900 cursor-pointer'
                    : 'bg-slate-100 border-slate-300 text-slate-700 cursor-default'
                }`}
                title={isHost ? 'Change Game Mode' : activeModeLabel}
              >
                <Swords className="w-3 h-3 shrink-0" />
                <span className="truncate">{activeModeLabel}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {displayCoins !== null && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.play('uiSelect');
                  onOpenShop(myFighterId, mySkinId);
                }}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 font-mono-num text-[11px] font-bold cursor-pointer whitespace-nowrap"
              >
                <Coins className="w-3 h-3 text-amber-600" />
                <span>{displayCoins.toLocaleString()}</span>
              </button>
            )}

            {!cloudUser && guestSession && onGoogleSignIn && (
              <button
                type="button"
                data-testid="pick-link-google-btn"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.play('uiSelect');
                  onGoogleSignIn();
                }}
                className="ui-interactive min-h-[30px] px-2 py-0.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-display font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>Link +1k</span>
              </button>
            )}

            <button
              type="button"
              data-testid="open-shop-btn"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.play('uiSelect');
                onOpenShop(myFighterId, mySkinId);
              }}
              className="ui-interactive min-h-[30px] px-2 py-0.5 rounded-lg bg-amber-400 hover:bg-amber-300 border border-amber-500/80 text-slate-950 text-[10px] sm:text-[11px] font-display font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <ShoppingBag className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">Shop</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                data-testid="admin-monitor-btn"
                onClick={onOpenAdminMonitor}
                className="ui-interactive min-h-[30px] px-2 py-0.5 rounded-lg bg-white hover:bg-amber-50 border border-amber-400 text-amber-800 text-[10px] sm:text-[11px] font-display font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <ShieldCheck className="w-3 h-3 shrink-0" />
                <span className="hidden md:inline">Admin</span>
              </button>
            )}

            {pingMs !== null && (
              <span className="hidden lg:inline text-[10px] font-mono-num text-emerald-700 font-semibold px-1">
                {pingMs}ms
              </span>
            )}

            <RoomChatBox
              messages={chatMessages}
              playerId={playerId}
              unreadCount={unreadChatCount}
              isOpen={chatOpen}
              onToggleOpen={onToggleChat}
              onSendMessage={onSendChat}
            />

            <MusicToggleButton compact variant="semi-light" />

            <FullscreenControls compact lockLandscape variant="light" />

            <button
              type="button"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.play('transitionWhoosh');
                onLeave();
              }}
              aria-label="Leave Room"
              className="ui-interactive min-h-[30px] px-2 py-0.5 rounded-lg bg-white/80 hover:bg-rose-50 border border-slate-300 text-[10px] sm:text-[11px] font-semibold text-slate-800 hover:text-rose-700 flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>

        {/* Single-Row P1–P5 Player Slots Strip */}
        <div className="grid grid-cols-5 gap-1">
          {[0, 1, 2, 3, 4].map((slotIdx) => {
            const p = room.players.find((pl) => pl.slotIndex === slotIdx);
            const fSpec = p ? FIGHTER_BY_ID[p.fighterId] : null;
            const isSelf = p?.playerId === playerId;
            return (
              <div
                key={slotIdx}
                className={`rounded-lg px-1.5 sm:px-2 py-1 border transition flex items-center justify-between gap-1 min-w-0 ${
                  p
                    ? isSelf
                      ? 'bg-white border-amber-500 shadow-xs'
                      : 'bg-white/75 border-slate-300/90'
                    : 'bg-slate-200/55 border-slate-300/60 opacity-70'
                }`}
              >
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    className="w-1.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: fSpec?.color ?? '#64748b' }}
                  />
                  <span className="text-[9px] font-mono-num font-bold text-slate-500 shrink-0">
                    P{slotIdx + 1}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-900 truncate">
                    {p ? p.name : 'Open'}
                  </span>
                </div>
                {p && (
                  <span
                    className={`text-[8px] sm:text-[9px] font-display font-bold shrink-0 ${
                      p.ready ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {p.ready ? '✓' : '·'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {errorMessage && (
          <div className="rounded-lg bg-rose-50 border border-rose-300 px-2.5 py-1 text-[10px] text-rose-700 font-medium truncate">
            {errorMessage}
          </div>
        )}
      </div>

      {/* TIER 2: Center Stage + Kit/Arena Split */}
      <div className="relative z-10 w-full max-w-7xl mx-auto my-1 sm:my-1.5 grid grid-cols-1 sm:grid-cols-12 gap-1.5 sm:gap-2.5 items-stretch flex-1 min-h-0">
        {/* 3D Spotlight Pedestal + Compact Skin Switcher */}
        <div
          className="sm:col-span-6 lg:col-span-5 relative rounded-2xl bg-white/80 backdrop-blur-md border overflow-hidden flex flex-col justify-between shadow-md flex-1 sm:flex-initial min-h-[115px] sm:min-h-0"
          style={{
            borderColor: `${mySpec.color}88`,
            backgroundImage: `radial-gradient(circle at 50% 48%, ${mySpec.color}22, rgba(235, 242, 249, 0.92) 74%)`,
          }}
        >
          <div className="relative z-10 px-2.5 pt-2 flex items-start justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-700 truncate">
                {mySpec.title} · {mySpec.m1Combo.rangeIdentity}
              </div>
              <h2 className="font-display font-bold text-lg sm:text-2xl text-slate-950 tracking-tight leading-none mt-0.5 truncate">
                {mySpec.name}
              </h2>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                data-testid="skills-preview-btn"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.play('uiSelect');
                  setSkillsDrawerOpen(true);
                }}
                className="ui-interactive btn-shimmer min-h-[30px] px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 border border-amber-500/80 text-slate-950 text-[10px] sm:text-[11px] font-display font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-xs"
              >
                <Eye className="w-3.5 h-3.5 shrink-0" />
                <span>SKILLS &amp; 3D</span>
              </button>
              <div className="hidden sm:block text-right text-[9px] font-mono-num font-bold text-slate-700 bg-white/85 px-2 py-0.5 rounded-lg border border-slate-300 leading-tight">
                <div>HP {mySpec.maxHp}</div>
                <div className="text-amber-700">STM {mySpec.maxStamina}</div>
              </div>
            </div>
          </div>

          <div className="w-full flex-1 min-h-0 relative">
            <TekkenStagePreview
              fighterId={myFighterId}
              skinId={mySkinId}
              variant="semi-light"
              interactive
            />
          </div>

          <div
            data-testid="skin-switcher"
            className="relative z-10 px-2 py-1.5 bg-white/85 border-t border-slate-300/80 flex items-center justify-between gap-1.5 shrink-0"
          >
            <button
              type="button"
              aria-label="Previous Skin"
              onClick={() => cycleSkin(-1)}
              className="w-7 h-7 rounded-lg bg-slate-200/80 hover:bg-slate-300 text-slate-800 flex items-center justify-center cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div className="grid grid-cols-3 gap-1 flex-1 min-w-0">
              {SKIN_ORDER.map((sid) => {
                const unlocked = isSkinUnlocked(unlockedSkins, myFighterId, sid);
                const active = mySkinId === sid && unlocked;
                const price = getSkinPrice(sid);
                const meta = getFighterSkinMeta(myFighterId, sid);
                return (
                  <button
                    key={sid}
                    type="button"
                    data-skin-id={sid}
                    data-skin-locked={unlocked ? 'false' : 'true'}
                    onClick={() => {
                      soundEngine.unlock();
                      if (!unlocked) {
                        soundEngine.play('lockedError');
                        onOpenShop(myFighterId, sid);
                        return;
                      }
                      soundEngine.play('uiSelect');
                      onSelectSkin(sid);
                    }}
                    className={`min-h-[28px] px-1.5 py-0.5 rounded-lg text-[9px] sm:text-[10px] font-display font-bold uppercase border transition cursor-pointer flex items-center justify-center gap-1 truncate ${
                      active
                        ? 'text-slate-950 shadow-xs'
                        : unlocked
                        ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-white'
                        : 'bg-slate-100/60 border-slate-300/70 text-slate-500 hover:border-amber-500 hover:text-amber-800'
                    }`}
                    style={
                      active
                        ? {
                            backgroundColor: meta.accentColor,
                            borderColor: '#0f172a',
                          }
                        : undefined
                    }
                    title={meta.name}
                  >
                    {!unlocked && <Lock className="w-2.5 h-2.5 shrink-0 text-amber-600" />}
                    <span className="truncate">{SKIN_LABELS[sid]}</span>
                    {!unlocked && (
                      <span className="hidden md:inline font-mono-num text-[8px] text-amber-700 shrink-0">
                        {price}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              aria-label="Next Skin"
              onClick={() => cycleSkin(1)}
              className="w-7 h-7 rounded-lg bg-slate-200/80 hover:bg-slate-300 text-slate-800 flex items-center justify-center cursor-pointer shrink-0"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Panel: Compact Combat Kit Summary + Arena Picker */}
        <div className="sm:col-span-6 lg:col-span-7 flex flex-col justify-between gap-1.5 lg:gap-2 shrink-0 sm:shrink sm:min-h-0">
          <div className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-300/90 p-2 lg:p-3 flex flex-col justify-between gap-1.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-700 truncate">
                  <Flame className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {mySpec.passive.name} · Domain: {DOMAIN_CONFIGS[myFighterId].domainName}
                  </span>
                </div>
                <p className="hidden md:block text-[11px] text-slate-600 mt-0.5 line-clamp-1">
                  {mySpec.passive.shortDesc}
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-[9px] font-mono-num text-slate-600 shrink-0">
                <span>PWR {mySpec.stats.power}</span>
                <span>SPD {mySpec.stats.speed}</span>
                <span>DEF {mySpec.stats.defense}</span>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-1">
              {(
                [
                  { tab: 'm1', key: 'M1', name: mySpec.m1Combo.stepNames[0] },
                  { tab: 'skill1', key: '1', name: mySpec.abilities[2].name },
                  { tab: 'skill2', key: '2', name: mySpec.abilities[3].name },
                  { tab: 'ultimate', key: '3', name: mySpec.abilities[4].name },
                  { tab: 'awakening', key: 'ORB', name: AWAKENING_CONFIG.AWAKENED_KITS[myFighterId].awakenedTitle },
                  { tab: 'domain', key: 'V', name: DOMAIN_CONFIGS[myFighterId].domainName },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.tab}
                  type="button"
                  onClick={() => {
                    soundEngine.unlock();
                    soundEngine.play('uiClick');
                    setDemoTab(chip.tab);
                    setSkillsDrawerOpen(true);
                  }}
                  className="ui-interactive rounded-lg bg-slate-100/90 hover:bg-amber-50 border border-slate-300/80 hover:border-amber-500 px-1.5 py-1 text-left cursor-pointer transition min-w-0"
                  title={`${chip.key}: ${chip.name}`}
                >
                  <div className="text-[8px] font-mono-num font-bold text-amber-700 leading-none">
                    {chip.key}
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-display font-bold text-slate-900 truncate mt-0.5">
                    {chip.name}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Stage Selector */}
          <div className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-300/90 p-2 lg:p-3 sm:flex-1 sm:min-h-0 flex flex-col justify-between gap-1.5 shadow-sm">
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <h3 className="font-display text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-900 truncate">
                  Arena Stage
                </h3>
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-500 shrink-0">
                {isHost ? 'Host selects map' : 'Synced to Host'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:flex-1 sm:min-h-0">
              {MAPS.map((m) => {
                const selected = room.mapId === m.id;
                const biomeTag =
                  m.id === 'shibuya'
                    ? 'Train · Shops'
                    : m.id === 'obsidian'
                    ? 'Lava · Forges'
                    : m.id === 'temple'
                    ? 'Koi · Dojo'
                    : 'Oasis · Ruins';
                return (
                  <button
                    key={m.id}
                    type="button"
                    data-map-id={m.id}
                    disabled={!isHost}
                    onClick={() => {
                      soundEngine.unlock();
                      soundEngine.play('uiSelect');
                      onSelectMap(m.id);
                    }}
                    className={`text-left rounded-xl px-2 py-1 lg:p-2.5 border transition flex flex-col justify-between min-w-0 ${
                      selected
                        ? 'bg-amber-100/90 border-amber-500 shadow-xs'
                        : 'bg-slate-100/75 border-slate-300/80 hover:bg-white'
                    } ${isHost ? 'cursor-pointer' : 'cursor-default opacity-85'}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-display font-bold text-[11px] sm:text-xs text-slate-950 truncate">
                        {m.name}
                      </span>
                      {selected && (
                        <span className="text-[8px] font-bold text-amber-700 uppercase shrink-0">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-slate-600 truncate mt-0.5 [@media(max-height:430px)]:hidden">
                      {biomeTag}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Mode Picker Modal */}
      {modeModalOpen && onSelectMode && isHost && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in"
          onClick={() => setModeModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#e6edf5] border border-slate-300 p-4 shadow-2xl space-y-2.5 animate-modal-pop text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-display font-bold text-sm text-slate-950 uppercase">
                <Swords className="w-4 h-4 text-amber-600" />
                <span>Select Game Mode</span>
              </div>
              <button
                type="button"
                onClick={() => setModeModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              {GAME_MODES.map((gm) => {
                const active = room.gameMode === gm.id;
                return (
                  <button
                    key={gm.id}
                    type="button"
                    data-testid={`pick-mode-${gm.id}`}
                    onClick={() => {
                      soundEngine.unlock();
                      soundEngine.play('uiSelect');
                      onSelectMode(gm.id);
                      setModeModalOpen(false);
                    }}
                    className={`w-full text-left rounded-xl p-2.5 border transition cursor-pointer ${
                      active
                        ? 'bg-amber-100 border-amber-500 text-slate-950'
                        : 'bg-white/80 border-slate-300 text-slate-800 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-xs uppercase">{gm.shortLabel}</span>
                      <span className="text-[10px] font-mono-num text-amber-700 font-bold">{gm.playersHint}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{gm.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Toggleable SKILLS & PREVIEW Modal */}
      {skillsDrawerOpen && (() => {
        const awKit = AWAKENING_CONFIG.AWAKENED_KITS[myFighterId];
        const domCfg = DOMAIN_CONFIGS[myFighterId];
        const tabs: Array<{ id: SkillDemoTab; label: string; badge: string }> = [
          { id: 'passive', label: 'Passive', badge: 'PASSIVE' },
          { id: 'm1', label: 'M1 Combo', badge: 'M1 / J' },
          { id: 'skill1', label: 'Skill 1', badge: 'KEY 1' },
          { id: 'skill2', label: 'Skill 2', badge: 'KEY 2' },
          { id: 'ultimate', label: 'Ultimate', badge: 'KEY 3' },
          { id: 'awakening', label: 'Awakening', badge: 'ORB / 4' },
          { id: 'domain', label: 'Domain', badge: 'KEY V' },
        ];

        const activeDetail =
          demoTab === 'passive'
            ? {
                title: mySpec.passive.name,
                subtitle: `${mySpec.name} Combat Identity`,
                desc: mySpec.passive.shortDesc,
                bonus: mySpec.passive.frenzyBonus,
                stats: ['Parry: F (0.26s)', 'Dash: Q (I-frames)', 'Grab: G (Breaks Guard)'],
              }
            : demoTab === 'm1'
            ? {
                title: mySpec.m1Combo.stepNames.join(' → '),
                subtitle: `Signature Basic Attack · ${mySpec.m1Combo.rangeIdentity}`,
                desc: mySpec.abilities[0].shortDesc,
                bonus: `Finisher: ${mySpec.m1Combo.heavyFinisherName} · Combo Link: ${mySpec.comboLink.triggerName} (+${mySpec.comboLink.bonusDamage} DMG)`,
                stats: [
                  `CD ${mySpec.abilities[0].cooldown}s`,
                  `DMG ${mySpec.abilities[0].damage}`,
                  `RNG ${mySpec.abilities[0].range}m`,
                ],
              }
            : demoTab === 'skill1'
            ? {
                title: mySpec.abilities[2].name,
                subtitle: `Skill 1 · Key [${mySpec.abilities[2].keyHint}]`,
                desc: mySpec.abilities[2].shortDesc,
                bonus: `Awakened Form: ${awKit.skill1.name} — ${awKit.skill1.shortDesc}`,
                stats: [
                  `CD ${mySpec.abilities[2].cooldown}s`,
                  `${mySpec.abilities[2].manaCost} Chi`,
                  `DMG ${mySpec.abilities[2].damage}`,
                ],
              }
            : demoTab === 'skill2'
            ? {
                title: mySpec.abilities[3].name,
                subtitle: `Skill 2 · Key [${mySpec.abilities[3].keyHint}]`,
                desc: mySpec.abilities[3].shortDesc,
                bonus: `Awakened Form: ${awKit.skill2.name} — ${awKit.skill2.shortDesc}`,
                stats: [
                  `CD ${mySpec.abilities[3].cooldown}s`,
                  `${mySpec.abilities[3].manaCost} Chi`,
                  `DMG ${mySpec.abilities[3].damage}`,
                ],
              }
            : demoTab === 'ultimate'
            ? {
                title: mySpec.abilities[4].name,
                subtitle: `Signature Ultimate · Key [${mySpec.abilities[4].keyHint}]`,
                desc: mySpec.abilities[4].shortDesc,
                bonus: `Awakened Ultimate: ${awKit.skill3.name} — ${awKit.skill3.shortDesc}`,
                stats: [
                  `CD ${mySpec.abilities[4].cooldown}s`,
                  `${mySpec.abilities[4].manaCost} Chi`,
                  `DMG ${mySpec.abilities[4].damage}`,
                ],
              }
            : demoTab === 'awakening'
            ? {
                title: awKit.awakenedTitle,
                subtitle: `Awakened Surge & Secret Finisher [${awKit.skill4.keyHint}]`,
                desc: awKit.skill4.shortDesc,
                bonus: `Clash Finisher: ${awKit.clashLabel} · Collect Awakening Orbs for 2× HP/Chi & 20m/s speed.`,
                stats: [
                  `CD ${awKit.skill4.cooldown}s`,
                  `${awKit.skill4.chiCost} Chi`,
                  `DMG ${awKit.skill4.damage}`,
                ],
              }
            : {
                title: domCfg.domainName,
                subtitle: `Domain Expansion · Key [V] at 100% Gauge`,
                desc:
                  myFighterId === 'jm'
                    ? 'Locks all inside with a top-down Overhead Center Camera while JM auto-dashes edge-to-edge in flash-step speedster form, leaving permanent glowing laser lines across the floor that explode on enemy contact.'
                    : myFighterId === 'prime'
                    ? 'Transforms the arena into a blazing magma crucible: rapid 0.45s volcanic geysers, continuous falling Giant Meteor Fists, and +30% M1 speed / -40% Dash CD overdrive gauntlets.'
                    : domCfg.subtitle,
                bonus: `Barrier Radius ${domCfg.radius}m · Duration ${domCfg.durationSec}s · Zero-escape barrier lock once sealed.`,
                stats: [`Radius ${domCfg.radius}m`, `${domCfg.durationSec}s`, 'Barrier Locked'],
              };

        return (
          <div
            data-testid="skills-preview-drawer"
            className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 animate-fade-in"
            onClick={() => setSkillsDrawerOpen(false)}
          >
            <div
              className="w-full max-w-4xl max-h-[92dvh] rounded-2xl bg-[#e6edf5] border border-slate-300 shadow-2xl overflow-hidden flex flex-col animate-modal-pop text-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-2.5 bg-white/85 border-b border-slate-300/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: mySpec.color }} />
                  <span className="font-display font-bold text-sm sm:text-base truncate text-slate-950">
                    {mySpec.name} · SKILLS &amp; 3D PREVIEW
                  </span>
                </div>
                <button
                  type="button"
                  data-testid="close-skills-preview-btn"
                  onClick={() => setSkillsDrawerOpen(false)}
                  className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-3 py-2 bg-slate-200/70 border-b border-slate-300/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                {tabs.map((t) => {
                  const active = demoTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      data-demo-tab={t.id}
                      onClick={() => {
                        soundEngine.unlock();
                        soundEngine.play('uiClick');
                        setDemoTab(t.id);
                      }}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-display font-bold uppercase whitespace-nowrap cursor-pointer transition flex items-center gap-1.5 ${
                        active
                          ? 'bg-amber-400 border-amber-500 text-slate-950'
                          : 'bg-white/75 border-slate-300 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <span>{t.label}</span>
                      <span className="text-[9px] font-mono-num px-1 rounded bg-slate-900 text-amber-300">
                        {t.badge}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 flex-1 min-h-0 overflow-y-auto">
                <div className="sm:col-span-7 h-[190px] sm:h-[260px] relative rounded-xl overflow-hidden border border-slate-300 bg-slate-900">
                  <SkillDemoPreview fighterId={myFighterId} skinId={mySkinId} demoTab={demoTab} />
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-slate-950/75 text-[10px] font-mono-num text-amber-300 pointer-events-none">
                    LIVE 3D SIMULATION · DRAG TO ORBIT
                  </div>
                </div>
                <div className="sm:col-span-5 flex flex-col justify-between gap-2.5">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      {activeDetail.subtitle}
                    </div>
                    <h4 className="font-display font-bold text-lg sm:text-xl text-slate-950 mt-0.5">
                      {activeDetail.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-700 mt-1.5 leading-relaxed">
                      {activeDetail.desc}
                    </p>
                    <div className="mt-2.5 rounded-xl bg-amber-100/80 border border-amber-300 p-2 text-[11px] text-amber-950 font-medium leading-snug">
                      {activeDetail.bonus}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-300/80">
                    {activeDetail.stats.map((st) => (
                      <span
                        key={st}
                        className="px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono-num text-[10px] font-bold"
                      >
                        {st}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TIER 3: Compact Bottom Roster Dock + Lock In / Start Fight */}
      <div className="relative z-20 w-full max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2 bg-white/82 backdrop-blur-md border border-slate-300/90 rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 shadow-md shrink-0">
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5 flex-1 min-w-0">
          {FIGHTERS.map((f) => {
            const isSelected = myFighterId === f.id;
            const pickedBy = room.players.filter((p) => p.fighterId === f.id);
            return (
              <button
                key={f.id}
                type="button"
                data-fighter-id={f.id}
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.play('uiSelect');
                  onSelectFighter(f.id);
                }}
                className={`min-h-[40px] sm:min-h-[46px] rounded-xl px-1.5 sm:px-2 py-1 border text-left transition cursor-pointer min-w-0 flex flex-col justify-between ${
                  isSelected
                    ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500 shadow-xs'
                    : 'bg-slate-100/80 border-slate-300/80 hover:bg-white'
                }`}
              >
                <div className="w-full h-1 rounded-full" style={{ backgroundColor: f.color }} />
                <div className="flex items-center justify-between gap-1 mt-0.5 min-w-0">
                  <span className="font-display font-bold text-[10px] sm:text-xs text-slate-950 truncate">
                    {f.name}
                  </span>
                  {pickedBy.length > 0 && (
                    <span
                      className="text-[8px] font-mono-num font-bold text-slate-950 px-1 rounded shrink-0"
                      style={{ backgroundColor: f.color }}
                    >
                      P{pickedBy[0].slotIndex + 1}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.play('uiSelect');
              triggerMobileFs();
              onToggleReady(!me?.ready);
            }}
            className={`btn-shimmer flex-1 sm:flex-none min-h-[40px] sm:min-h-[46px] px-3.5 sm:px-5 rounded-xl font-display font-bold text-xs sm:text-sm tracking-wide transition active:scale-95 cursor-pointer whitespace-nowrap ${
              me?.ready
                ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm'
                : 'bg-amber-400 hover:bg-amber-300 border border-amber-500/80 text-slate-950 shadow-sm'
            }`}
          >
            {me?.ready ? 'LOCKED ✓' : 'LOCK IN'}
          </button>

          {isHost && (
            <button
              type="button"
              data-testid="start-fight-btn"
              disabled={!canStart}
              onClick={() => {
                soundEngine.unlock();
                soundEngine.play('transitionWhoosh');
                triggerMobileFs();
                onStartNow();
              }}
              className="btn-shimmer flex-1 sm:flex-none min-h-[40px] sm:min-h-[46px] px-3.5 sm:px-5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-display font-bold text-xs sm:text-sm tracking-wide transition active:scale-95 shadow-sm cursor-pointer whitespace-nowrap"
            >
              {room.isTrainingMode ? 'START TRAINING' : 'START FIGHT'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
