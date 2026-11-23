import React, { useEffect, useState } from 'react';
import { Music, VolumeX } from 'lucide-react';
import { soundEngine } from '../game/soundEngine.ts';

interface MusicToggleButtonProps {
  compact?: boolean;
  variant?: 'semi-light' | 'light' | 'dark';
  showLabel?: boolean;
}

export const MusicToggleButton: React.FC<MusicToggleButtonProps> = ({
  compact = false,
  variant = 'semi-light',
  showLabel = false,
}) => {
  const [bgmMuted, setBgmMuted] = useState(() => soundEngine.bgmMuted || soundEngine.muted);

  useEffect(() => {
    const sync = () => setBgmMuted(soundEngine.bgmMuted || soundEngine.muted);
    sync();
    return soundEngine.subscribeBgm(sync);
  }, []);

  const themeClass =
    variant === 'dark'
      ? 'bg-white/10 hover:bg-white/18 border border-white/15 text-slate-200'
      : variant === 'light'
      ? 'bg-white/95 hover:bg-slate-100 border border-slate-300 text-slate-800'
      : 'bg-white/75 hover:bg-white border border-slate-300/90 text-slate-800';

  return (
    <button
      type="button"
      data-testid="bgm-toggle-btn"
      onClick={() => {
        soundEngine.unlock();
        const nextMuted = soundEngine.toggleBgmMute();
        setBgmMuted(nextMuted || soundEngine.muted);
        if (!nextMuted) soundEngine.play('uiClick');
      }}
      title={bgmMuted ? 'Turn Background Music On' : 'Mute Background Music'}
      aria-label={bgmMuted ? 'Turn Background Music On' : 'Mute Background Music'}
      className={`ui-interactive rounded-lg font-display font-semibold flex items-center justify-center gap-1 shadow-xs cursor-pointer whitespace-nowrap ${themeClass} ${
        compact
          ? 'min-h-[32px] min-w-[32px] sm:min-h-[36px] sm:min-w-[36px] px-2 text-[11px]'
          : 'min-h-[36px] px-2.5 text-xs'
      }`}
    >
      {bgmMuted ? (
        <VolumeX className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      ) : (
        <Music className="w-3.5 h-3.5 text-amber-600 shrink-0" />
      )}
      {showLabel && <span>{bgmMuted ? 'BGM Off' : 'Music'}</span>}
    </button>
  );
};
