import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { api } from '../services/api';

declare global { interface Window { google?: any } }

let providers: Promise<{ google: string | null }> | null = null;
let gsi: Promise<void> | null = null;
const loadProviders = () => (providers ??= api.get<{ google: string | null }>('/auth/providers').catch(() => ({ google: null })));
const loadGsi = () => (gsi ??= new Promise<void>((resolve, reject) => {
  if (window.google?.accounts?.id) return resolve();
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
  s.onload = () => resolve(); s.onerror = () => { gsi = null; reject(new Error('gsi_load_failed')); };
  document.head.appendChild(s);
}));

/** "Continue with Google" via Google Identity Services. Renders nothing when GOOGLE_CLIENT_ID is not configured on the server. */
export function GoogleButton({ mode, onCredential }: { mode: 'signin' | 'signup'; onCredential: (credential: string) => void }) {
  const { t, lang } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential); cb.current = onCredential;
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => { let live = true; loadProviders().then((p) => live && setClientId(p.google)); return () => { live = false; }; }, []);

  useEffect(() => {
    if (!clientId) return;
    let live = true;
    loadGsi().then(() => {
      if (!live || !box.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: (r: { credential: string }) => cb.current(r.credential), ux_mode: 'popup' });
      box.current.innerHTML = '';
      const dark = document.documentElement.dataset.theme === 'dark';
      window.google.accounts.id.renderButton(box.current, {
        type: 'standard', theme: dark ? 'filled_black' : 'outline', size: 'large', shape: 'pill', logo_alignment: 'center',
        text: mode === 'signup' ? 'signup_with' : 'continue_with', locale: lang === 'rw' ? 'rw' : 'en',
        width: Math.min(box.current.clientWidth || 360, 400),
      });
    }).catch(() => { /* Google unreachable: email login still works */ });
    return () => { live = false; };
  }, [clientId, mode, lang]);

  if (!clientId) return null;
  return (<>
    <div ref={box} className="google-btn" />
    <div className="auth-divider"><span>{t('auth.or_email')}</span></div>
  </>);
}
