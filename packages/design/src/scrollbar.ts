const SCROLLING_CLASS = 'agentry-scrolling';
const HIDE_DELAY_MS = 3000;

const timers = new WeakMap<Element, number>();

function resolveScroller(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Document) return target.scrollingElement;
  return null;
}

function handleScroll(event: Event): void {
  const el = resolveScroller(event.target);
  if (!el) return;

  el.classList.add(SCROLLING_CLASS);

  const pending = timers.get(el);
  if (pending !== undefined) window.clearTimeout(pending);

  timers.set(
    el,
    window.setTimeout(() => {
      el.classList.remove(SCROLLING_CLASS);
      timers.delete(el);
    }, HIDE_DELAY_MS),
  );
}

let installed = false;

export function initScrollbars(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
}
