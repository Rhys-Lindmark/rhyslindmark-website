// Human check shared by the /jev demos (moved here from the old Claim Check script).
// The server's HttpOnly cookie is the real proof. This only remembers its expiry so the page can skip the widget.
window.jevHuman = {
  ok() { try { return Number(localStorage.getItem('jevHumanUntil')) > Date.now() + 60000; } catch { return false; } },
  set(until) { try { if (until) localStorage.setItem('jevHumanUntil', String(until)); } catch {} },
  clear() { try { localStorage.removeItem('jevHumanUntil'); } catch {} window.dispatchEvent(new Event('jev-human-needed')); }
};
window.jevTurnstileReady = () => { window.jevRenderRouter?.(); };
const verificationScript = document.createElement('script');
verificationScript.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=jevTurnstileReady&render=explicit';
verificationScript.async = true;
verificationScript.onerror = () => { const e = document.getElementById('route-error'); if (e) { e.textContent = 'Human verification unavailable. Reload to try again.'; e.hidden = false; } };
document.head.append(verificationScript);
