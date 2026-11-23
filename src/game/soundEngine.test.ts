import test from 'node:test';
import assert from 'node:assert/strict';
import { soundEngine } from './soundEngine.ts';

test('soundEngine background music safely tracks mode, mute toggle, and subscriptions in headless env', () => {
  const initialMuted = soundEngine.bgmMuted;
  let notifyCount = 0;
  const unsub = soundEngine.subscribeBgm(() => {
    notifyCount += 1;
  });

  soundEngine.startBgm('lobby');
  assert.equal(soundEngine.getBgmMode(), 'lobby');

  soundEngine.startBgm('combat');
  assert.equal(soundEngine.getBgmMode(), 'combat');

  const toggled = soundEngine.toggleBgmMute();
  assert.equal(toggled, !initialMuted);
  assert.equal(soundEngine.bgmMuted, toggled);
  assert.ok(notifyCount >= 1);

  // Restore original mute state cleanly
  const restored = soundEngine.toggleBgmMute();
  assert.equal(restored, initialMuted);

  soundEngine.stopBgm();
  assert.equal(soundEngine.getBgmMode(), 'none');

  unsub();
});
