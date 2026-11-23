import React, { useEffect, useState } from 'react';
import { Check, Coins, Lock, ShoppingBag, Sparkles, X } from 'lucide-react';
import {
  ASCENDED_ABILITIES,
  FIGHTER_BY_ID,
  FIGHTERS,
  FighterId,
  SKIN_LABELS,
  SKIN_ORDER,
  SkinId,
  getFighterSkinMeta,
  hasAscendedAbility,
} from '../shared/gameData.ts';
import { getSkinPrice, isSkinUnlocked } from '../game/shopLogic.ts';
import { TekkenStagePreview } from './TekkenStagePreview.tsx';
import { soundEngine } from '../game/soundEngine.ts';

interface SkinShopModalProps {
  open: boolean;
  coins: number;
  unlockedSkins: string[];
  equippedFighterId: FighterId;
  equippedSkinId: SkinId;
  initialFighterId?: FighterId;
  initialSkinId?: SkinId;
  onPurchase: (fighterId: FighterId, skinId: SkinId) => Promise<{ ok: boolean; error?: string }>;
  onEquip: (fighterId: FighterId, skinId: SkinId) => void;
  onClose: () => void;
}

export const SkinShopModal: React.FC<SkinShopModalProps> = ({
  open,
  coins,
  unlockedSkins,
  equippedFighterId,
  equippedSkinId,
  initialFighterId,
  initialSkinId,
  onPurchase,
  onEquip,
  onClose,
}) => {
  const [inspectFighterId, setInspectFighterId] = useState<FighterId>(
    initialFighterId ?? equippedFighterId
  );
  const [inspectSkinId, setInspectSkinId] = useState<SkinId>(
    initialSkinId ?? equippedSkinId
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    setInspectFighterId(initialFighterId ?? equippedFighterId);
    setInspectSkinId(initialSkinId ?? equippedSkinId);
    setStatusMsg(null);
  }, [open, initialFighterId, initialSkinId, equippedFighterId, equippedSkinId]);

  if (!open) return null;

  const fighterSpec = FIGHTER_BY_ID[inspectFighterId];
  const inspectMeta = getFighterSkinMeta(inspectFighterId, inspectSkinId);
  const inspectPrice = getSkinPrice(inspectSkinId);
  const inspectOwned = isSkinUnlocked(unlockedSkins, inspectFighterId, inspectSkinId);

  const handleBuy = async (sid: SkinId) => {
    const key = `${inspectFighterId}:${sid}`;
    setBusyKey(key);
    setStatusMsg(null);
    soundEngine.unlock();
    const res = await onPurchase(inspectFighterId, sid);
    setBusyKey(null);
    if (res.ok) {
      soundEngine.play('loginSuccess');
      const meta = getFighterSkinMeta(inspectFighterId, sid);
      setStatusMsg({
        text: `Unlocked & equipped ${fighterSpec.name} — ${meta.name}!`,
        ok: true,
      });
    } else {
      soundEngine.play('lockedError');
      setStatusMsg({
        text: res.error || 'Purchase failed.',
        ok: false,
      });
    }
  };

  return (
    <div
      data-testid="skin-shop-modal"
      className="fixed inset-0 z-[70] bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl h-[92dvh] sm:h-[88dvh] max-h-[94dvh] rounded-2xl bg-[#e6edf5] border border-slate-300/95 text-slate-900 shadow-2xl overflow-hidden flex flex-col animate-modal-pop">
        {/* Compact Single-Line Semi-Light Header */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-white/85 border-b border-slate-300/80 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <h2 className="font-display text-sm sm:text-lg font-bold tracking-wide text-slate-950 truncate">
                ITEM SHOP
              </h2>
              <span className="hidden md:inline text-[11px] text-slate-500 truncate">
                Classic Free · Ascended 500 · Special 1,000
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              data-testid="shop-coins-balance"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 font-mono-num text-xs font-bold"
            >
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              <span>{coins.toLocaleString()}</span>
            </div>
            <button
              type="button"
              data-testid="close-shop-btn"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.play('uiClick');
                onClose();
              }}
              className="w-8 h-8 rounded-lg bg-slate-200/80 hover:bg-slate-300 text-slate-800 flex items-center justify-center cursor-pointer shrink-0"
              aria-label="Close Item Shop"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Slim Fighter Selector Strip */}
        <div className="px-2.5 py-1.5 sm:px-4 bg-slate-200/70 border-b border-slate-300/80 grid grid-cols-5 gap-1.5 shrink-0">
          {FIGHTERS.map((f) => {
            const active = inspectFighterId === f.id;
            return (
              <button
                key={f.id}
                type="button"
                data-testid={`shop-fighter-${f.id}`}
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.play('uiSelect');
                  setInspectFighterId(f.id);
                  setStatusMsg(null);
                }}
                className={`px-1.5 py-1 rounded-lg border text-center transition cursor-pointer min-w-0 ${
                  active
                    ? 'bg-white border-slate-900 ring-1 ring-slate-900 shadow-xs'
                    : 'bg-white/60 border-slate-300/80 hover:bg-white'
                }`}
              >
                <div className="w-full h-1 rounded-full mb-0.5" style={{ backgroundColor: f.color }} />
                <div className="font-display font-bold text-[10px] sm:text-xs text-slate-900 truncate leading-tight">
                  {f.name}
                </div>
              </button>
            );
          })}
        </div>

        {/* Spacious Zero-Scroll Body: Unclipped 3D Preview + All 3 Skin Tiers Visible */}
        <div className="flex-1 min-h-0 p-2.5 sm:p-4 grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-4 overflow-hidden">
          {/* Left: Full-Height Unclipped 3D Stage */}
          <div
            className="sm:col-span-5 h-[33dvh] min-h-[150px] sm:h-full sm:min-h-0 rounded-xl border bg-gradient-to-b from-white/80 to-slate-200/80 overflow-hidden flex flex-col justify-between relative shadow-xs"
            style={{
              borderColor: `${inspectMeta.accentColor}99`,
              backgroundImage: `radial-gradient(circle at 50% 48%, ${inspectMeta.accentColor}28, rgba(236, 242, 249, 0.94) 76%)`,
            }}
          >
            <div className="px-3 pt-2 pb-0.5 flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
                  {fighterSpec.name} · {SKIN_LABELS[inspectSkinId]}
                </div>
                <div className="font-display text-sm sm:text-base font-bold text-slate-950 truncate leading-tight">
                  {inspectMeta.name}
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-mono-num font-bold shrink-0 ${
                  inspectOwned
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                {inspectPrice === 0 ? 'FREE' : inspectOwned ? 'OWNED' : `${inspectPrice}`}
              </span>
            </div>

            <div className="w-full flex-1 min-h-0 relative">
              <TekkenStagePreview
                fighterId={inspectFighterId}
                skinId={inspectSkinId}
                variant="semi-light"
              />
            </div>

            <div className="px-2.5 py-1 bg-white/75 border-t border-slate-300/70 text-[9px] sm:text-[10px] text-slate-600 flex items-center justify-between shrink-0">
              <span>Drag to spin 3D</span>
              <span className="font-semibold text-slate-800 truncate max-w-[58%]">
                {inspectMeta.tagline}
              </span>
            </div>
          </div>

          {/* Right: All 3 Skin Tier Cards Simultaneously Visible */}
          <div className="sm:col-span-7 flex-1 min-h-0 flex flex-col gap-1.5 sm:gap-2">
            {statusMsg && (
              <div
                data-testid="shop-status-msg"
                className={`rounded-lg px-3 py-1 text-[11px] font-semibold border shrink-0 truncate ${
                  statusMsg.ok
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-rose-50 border-rose-300 text-rose-800'
                }`}
              >
                {statusMsg.text}
              </div>
            )}

            <div className="flex-1 min-h-0 grid grid-rows-3 gap-1.5 sm:gap-2.5">
              {SKIN_ORDER.map((sid) => {
                const meta = getFighterSkinMeta(inspectFighterId, sid);
                const price = getSkinPrice(sid);
                const owned = isSkinUnlocked(unlockedSkins, inspectFighterId, sid);
                const inspected = inspectSkinId === sid;
                const equipped =
                  equippedFighterId === inspectFighterId && equippedSkinId === sid;
                const canAfford = coins >= price;
                const isBusy = busyKey === `${inspectFighterId}:${sid}`;

                return (
                  <div
                    key={sid}
                    data-testid={`shop-skin-card-${sid}`}
                    onClick={() => {
                      soundEngine.unlock();
                      soundEngine.play('uiClick');
                      setInspectSkinId(sid);
                    }}
                    className={`rounded-xl border px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 transition cursor-pointer flex items-center justify-between gap-2.5 min-h-0 ${
                      inspected
                        ? 'bg-white border-slate-900 ring-1 ring-slate-900 shadow-sm'
                        : 'bg-white/72 border-slate-300/85 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-slate-900/20 shrink-0 flex items-center justify-center shadow-xs"
                        style={{ backgroundColor: meta.accentColor }}
                      >
                        {sid === 'special' ? (
                          <Sparkles className="w-4 h-4 text-white drop-shadow" />
                        ) : !owned ? (
                          <Lock className="w-3.5 h-3.5 text-slate-950/75" />
                        ) : (
                          <Check className="w-4 h-4 text-slate-950" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-display font-bold text-xs sm:text-sm text-slate-950 truncate">
                            {meta.name}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-300/80 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-slate-700 shrink-0">
                            {SKIN_LABELS[sid]}
                          </span>
                          {price === 0 && (
                            <span className="hidden md:inline px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase shrink-0">
                              Free
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-600 truncate mt-0.5">
                          {meta.tagline}
                        </div>
                        {hasAscendedAbility(sid) && (
                          <div className="text-[10px] font-semibold text-amber-700 truncate mt-0.5">
                            Secret [5]: {ASCENDED_ABILITIES[inspectFighterId].name} ·{' '}
                            <span className="font-normal text-slate-600">
                              {ASCENDED_ABILITIES[inspectFighterId].actionTag}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      className="shrink-0 flex flex-col items-end gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {owned ? (
                        <button
                          type="button"
                          data-testid={`shop-equip-${sid}`}
                          disabled={equipped}
                          onClick={() => {
                            soundEngine.unlock();
                            soundEngine.play('uiSelect');
                            setInspectSkinId(sid);
                            onEquip(inspectFighterId, sid);
                            setStatusMsg({
                              text: `Equipped ${fighterSpec.name} — ${meta.name}!`,
                              ok: true,
                            });
                          }}
                          className={`min-h-[32px] sm:min-h-[36px] px-3 rounded-lg font-display font-bold text-[11px] sm:text-xs tracking-wide transition whitespace-nowrap ${
                            equipped
                              ? 'bg-emerald-500 text-white cursor-default'
                              : 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                          }`}
                        >
                          {equipped ? 'EQUIPPED ✓' : 'EQUIP'}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            data-testid={`shop-buy-${sid}`}
                            disabled={!canAfford || isBusy}
                            onClick={() => {
                              setInspectSkinId(sid);
                              void handleBuy(sid);
                            }}
                            className={`min-h-[32px] sm:min-h-[36px] px-3 rounded-lg font-display font-bold text-[11px] sm:text-xs tracking-wide inline-flex items-center gap-1 transition whitespace-nowrap ${
                              canAfford
                                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-500 cursor-pointer shadow-xs'
                                : 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed'
                            }`}
                          >
                            <Coins className="w-3.5 h-3.5 shrink-0" />
                            <span>{isBusy ? '...' : `BUY ${price}`}</span>
                          </button>
                          {!canAfford && (
                            <span className="text-[9px] font-medium text-rose-600 whitespace-nowrap">
                              Need {price - coins}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
