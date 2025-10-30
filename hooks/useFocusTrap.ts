
// FIX: Import React to make React.RefObject available.
import React, { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTORS = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const useFocusTrap = (modalRef: React.RefObject<HTMLElement>, isOpen: boolean) => {
  const firstFocusableElement = useRef<HTMLElement | null>(null);
  const lastFocusableElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      // FIX: Explicitly type 'el' as HTMLElement to resolve error on 'offsetParent'.
      ).filter((el: HTMLElement) => el.offsetParent !== null); // filter only visible elements

      if (focusableElements.length > 0) {
        firstFocusableElement.current = focusableElements[0];
        lastFocusableElement.current = focusableElements[focusableElements.length - 1];
        
        // Use a timeout to ensure the element is focusable after any state updates
        const timer = setTimeout(() => {
          firstFocusableElement.current?.focus();
        }, 100);
        
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, modalRef]);

   useEffect(() => {
    if (isOpen && modalRef.current) {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab' || !firstFocusableElement.current || !lastFocusableElement.current) return;

            if (e.shiftKey) { // Shift+Tab
            if (document.activeElement === firstFocusableElement.current) {
                lastFocusableElement.current.focus();
                e.preventDefault();
            }
            } else { // Tab
            if (document.activeElement === lastFocusableElement.current) {
                firstFocusableElement.current.focus();
                e.preventDefault();
            }
            }
        };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, modalRef]);

};