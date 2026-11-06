document.querySelectorAll('[data-dialog-open]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById(button.dataset.dialogOpen).showModal();
  });
});

document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
});

document.querySelectorAll('[data-copy-email]').forEach((button) => {
  let resetTimer;
  button.addEventListener('click', async () => {
    const email = button.dataset.copyEmail;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(email);
        copied = true;
      }
    } catch {
      // Use the selection fallback below when clipboard permissions are unavailable.
    }
    if (!copied) {
      const field = document.createElement('textarea');
      field.value = email;
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      try {
        copied = document.execCommand?.('copy') === true;
      } catch {
        copied = false;
      }
      field.remove();
    }

    const status = button.parentElement.querySelector('.copy-status');
    clearTimeout(resetTimer);
    status.textContent = copied ? 'Email copied' : 'Could not copy email';
    button.classList.toggle('is-copied', copied);
    button.setAttribute('aria-label', copied ? 'Email copied' : 'Copy email address');
    button.title = copied ? 'Email copied' : 'Copy email address';
    resetTimer = setTimeout(() => {
      button.classList.remove('is-copied');
      button.setAttribute('aria-label', 'Copy email address');
      button.title = 'Copy email address';
      status.textContent = '';
    }, 2000);
  });
});

const courtToggle = document.getElementById('court-toggle');
if (courtToggle) {
  const courtPlay = document.getElementById('court-play');
  const courtGame = document.getElementById('court-game');
  window.addEventListener('message', (event) => {
    if (event.source !== courtGame.contentWindow || event.data?.type !== 'pickleball-height' || courtPlay.hidden) return;
    const height = Number(event.data.height);
    if (Number.isFinite(height) && height > 0) courtGame.style.height = `${height + 2}px`;
  });
  courtToggle.addEventListener('click', () => {
    const opening = courtPlay.hidden;
    courtPlay.hidden = !opening;
    courtToggle.setAttribute('aria-expanded', String(opening));
    courtToggle.innerHTML = opening ? 'Close court <span aria-hidden="true">×</span>' : 'Let\'s play pickleball! <span aria-hidden="true">↗</span>';
    if (opening) courtGame.style.height = '';
    courtGame.src = opening ? 'pickleball.html?embed=1' : 'about:blank';
  });
}
