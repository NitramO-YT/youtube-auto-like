/**
 * The confirmation shown after a change ("Saved", "Added to …"), with an
 * Undo button when the change can be undone. It hides itself after a delay;
 * a new notice replaces the one shown, and its undo with it.
 */

export const NOTICE_MS = 8000;

/**
 * @param {{ box: Element, text: Element, undoButton: Element }} elements
 *   box is the role="status" element; .error colors it as a failure.
 * @param {{ duration?: number, run?: (action: Function) => unknown }} options
 *   run carries out the undo, so that a page can apply its own error
 *   handling to it.
 */
export function createNotice({ box, text, undoButton }, { duration = NOTICE_MS, run = (action) => action() } = {}) {
  let timer = null;
  let undo = null;

  function hide() {
    clearTimeout(timer);
    undo = null;
    box.hidden = true;
  }

  undoButton.addEventListener('click', () => {
    const action = undo;
    hide();
    if (action) run(action);
  });

  return {
    /** @param {{ error?: boolean, undo?: Function|null }} options */
    show(message, { error = false, undo: action = null } = {}) {
      clearTimeout(timer);
      undo = action;
      text.textContent = message;
      box.classList.toggle('error', error);
      undoButton.hidden = !action;
      box.hidden = false;
      timer = setTimeout(hide, duration);
    },
    hide,
  };
}
