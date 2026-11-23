function setTermOpen(button, open) {
  const detail = button.nextElementSibling;
  button.setAttribute('aria-expanded', String(open));
  button.querySelector('span:last-child').textContent = open ? '−' : '+';
  detail.classList.toggle('hidden', !open);
}

document.querySelectorAll('.term-button').forEach(button => {
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    setTermOpen(button, !open);
  });
});

const linkedTerm = document.querySelector(location.hash);
if (linkedTerm?.classList.contains('term-row')) {
  setTermOpen(linkedTerm.querySelector('.term-button'), true);
  requestAnimationFrame(() => linkedTerm.scrollIntoView({ block: 'start', behavior: 'instant' }));
}
