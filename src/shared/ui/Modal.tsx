import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface ModalProps {
  ariaLabelledBy: string;
  children: ReactNode;
  initialFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function Modal({ ariaLabelledBy, children, initialFocusRef, onClose, returnFocusRef }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const background = Array.from(document.body.children).filter(element => !element.contains(dialog));
    const inertState = background.map(element => ({ element, inert: element.hasAttribute('inert') }));
    background.forEach(element => element.setAttribute('inert', ''));

    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
    (initialFocusRef.current ?? focusable()[0])?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = focusable();
      if (controls.length === 0) {
        event.preventDefault();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      inertState.forEach(({ element, inert }) => { if (!inert) element.removeAttribute('inert'); });
      (returnFocusRef?.current ?? previousFocus)?.focus();
    };
  }, [initialFocusRef, returnFocusRef]);

  return createPortal(
    <div className="dialog-backdrop" role="presentation">
      <div ref={dialogRef} className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby={ariaLabelledBy}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
