// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initScrollLock, isScrollLocked } from '@/lib/scrollLock';

/** visualViewport-Attrappe: Höhe/Verschiebung setzen und Ereignis auslösen wie iOS beim Öffnen der Tastatur. */
class FakeViewport extends EventTarget { height = 800; offsetTop = 0; }

const frame = () => new Promise((r) => setTimeout(r, 30));

describe('Scroll-Sperre unter Dialogen', () => {
  const vv = new FakeViewport();
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  initScrollLock();

  afterEach(() => { document.body.innerHTML = ''; });

  it('fixiert den Body an der alten Stelle, folgt der Tastatur und stellt danach die Position wieder her', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true });
    const overlay = document.createElement('div');
    overlay.innerHTML = '<form aria-modal="true">x</form>';
    // happy-dom liefert keine Layout-Rechtecke - Dialog als sichtbar melden
    const form = overlay.firstElementChild as HTMLElement;
    form.getClientRects = () => [{}] as unknown as DOMRectList;
    document.body.append(overlay);
    await frame();

    expect(isScrollLocked()).toBe(true);
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-640px');

    // Tastatur auf: sichtbarer Bereich 460 px, um 120 px verschoben
    vv.height = 460; vv.offsetTop = 120; vv.dispatchEvent(new Event('resize'));
    const html = document.documentElement;
    expect('keyboard' in html.dataset).toBe(true);
    expect(html.style.getPropertyValue('--kb')).toBe('220px'); // 800 - 460 - 120
    expect(html.style.getPropertyValue('--vv-top')).toBe('120px');

    // Tastatur zu
    vv.height = 800; vv.offsetTop = 0; vv.dispatchEvent(new Event('resize'));
    expect('keyboard' in html.dataset).toBe(false);

    overlay.remove();
    await frame();
    expect(isScrollLocked()).toBe(false);
    expect(document.body.style.position).toBe('');
    expect(scrollTo).toHaveBeenLastCalledWith(0, 640);
  });
});
