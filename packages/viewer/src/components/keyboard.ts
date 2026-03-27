/**
 * Keyboard navigation handler.
 *
 * Shortcuts:
 *   j / ArrowDown  — next step
 *   k / ArrowUp    — previous step
 *   Enter          — select / expand current step
 *   Ctrl+K / Cmd+K — open search
 *   Escape         — close search / inspector
 */

export interface KeyboardCallbacks {
  onNextStep: () => void;
  onPrevStep: () => void;
  onSelectStep: () => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
}

export function initKeyboard(callbacks: KeyboardCallbacks): void {
  document.addEventListener("keydown", handleKeyDown);

  function handleKeyDown(e: KeyboardEvent): void {
    // Ctrl+K / Cmd+K -> search
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      callbacks.onOpenSearch();
      return;
    }

    // Escape -> close
    if (e.key === "Escape") {
      callbacks.onCloseSearch();
      return;
    }

    // Don't capture nav keys when typing in an input
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    switch (e.key) {
      case "j":
      case "ArrowDown":
        e.preventDefault();
        callbacks.onNextStep();
        break;
      case "k":
      case "ArrowUp":
        e.preventDefault();
        callbacks.onPrevStep();
        break;
      case "Enter":
        e.preventDefault();
        callbacks.onSelectStep();
        break;
    }
  }
}
