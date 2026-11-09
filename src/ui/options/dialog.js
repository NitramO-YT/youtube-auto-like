/**
 * The modal dialogs of the options page: native <dialog> elements opened
 * with showModal, so that the browser keeps the keyboard focus inside and
 * closes them with Escape. A button carrying data-close closes its dialog.
 */
export function setUpDialog(dialog) {
  dialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) dialog.close();
  });
  return {
    open() {
      if (!dialog.open) dialog.showModal();
    },
    close() {
      dialog.close();
    },
    get isOpen() {
      return dialog.open;
    },
  };
}

/** Shows a status line in a dialog, or hides it with null. */
export function setStatus(element, text, { error = false } = {}) {
  element.hidden = text === null;
  element.textContent = text ?? '';
  element.classList.toggle('error-text', error);
}
