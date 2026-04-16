const { Router } = require('express');
const { URL } = require('url');
const usersService = require('./modules/users/users.service');
const identityLinksService = require('./modules/identity_links/identityLinks.service');
const authRequestsService = require('./modules/auth_requests/authRequests.service');
const { createError } = require('./common/errors');
const { signFlowState, verifyFlowState } = require('./common/flowState');
const { env } = require('./config/env');

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function page(title, body) {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:24px;line-height:1.4}
      .card{max-width:720px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:16px}
      label{display:block;margin-top:12px;font-weight:600}
      input,select,button{width:100%;padding:10px;margin-top:6px;border:1px solid #d1d5db;border-radius:10px}
      button{cursor:pointer;font-weight:700}
      .row{display:flex;gap:12px}
      .row>div{flex:1}
      .muted{color:#6b7280;font-size:14px}
      pre{background:#0b1020;color:#e5e7eb;padding:12px;border-radius:12px;overflow:auto}
      .danger{color:#b91c1c;font-weight:700}
    </style>
  </head>
  <body>
    <div class="card">
      ${body}
    </div>
  </body>
</html>`;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v) {
  return typeof v === 'string' && UUID_REGEX.test(v);
}

function isAllowedCallbackUrl(raw) {
  if (!raw) return true;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return false;
  }
  // Si une allowlist est configurée, l'origin doit y figurer (http ou https).
  // La sécurité repose sur la liste elle-même, pas sur le protocole.
  if (env.flowAllowedCallbackOrigins.length > 0) {
    return env.flowAllowedCallbackOrigins.includes(u.origin);
  }
  // Fallback : autoriser uniquement l'origin de PUBLIC_APP_URL
  try {
    const allowed = new URL(env.publicAppUrl);
    return u.origin === allowed.origin;
  } catch {
    return false;
  }
}

function registerWebFlowRoutes(app) {
  const router = Router();

  // Entrée : page de consentement "hora" (login user + confirmation link + approve/reject request)
  router.get('/flow/consent', (req, res) => {
    const link_id = typeof req.query?.link_id === 'string' ? req.query.link_id.trim() : '';
    const request_id =
      typeof req.query?.request_id === 'string' ? req.query.request_id.trim() : '';
    const callback_url =
      typeof req.query?.callback_url === 'string' ? req.query.callback_url.trim() : '';
    // Le paramètre "state" dans l'URL est le state externe de l'app appelante (ex: Ngoni).
    // Il sera retransmis tel quel dans le callback redirect. Ce n'est PAS le state JWT interne Hora.
    const externalState = typeof req.query?.state === 'string' ? req.query.state.trim() : '';

    if (!isUuid(link_id)) {
      throw createError('link_id doit être un UUID valide', 400, 'INVALID_UUID');
    }
    if (request_id && !isUuid(request_id)) {
      throw createError('request_id doit être un UUID valide', 400, 'INVALID_UUID');
    }
    if (callback_url && !isAllowedCallbackUrl(callback_url)) {
      throw createError('callback_url non autorisée', 400, 'INVALID_CALLBACK_URL');
    }

    const resolved = {
      link_id,
      request_id: request_id || null,
      callback_url: callback_url || null,
      external_state: externalState || null,
    };

    const signedState = signFlowState(resolved);

    res.type('text/html').send(
      page(
        'Hora — Consentement',
        `
        <h2>Hora — Consentement</h2>
        <p class="muted">Cette page permet à un utilisateur Hora de se connecter, confirmer un <code>link_id</code> puis approuver/rejeter une <code>request_id</code>.</p>
        <form method="post" action="/flow/consent/login">
          <input type="hidden" name="state" value="${escapeHtml(signedState)}" />
          <div class="row">
            <div>
              <label>link_id (UUID)</label>
              <input name="link_id" value="${escapeHtml(resolved.link_id)}" required readonly />
            </div>
            <div>
              <label>request_id (UUID)</label>
              <input name="request_id" value="${escapeHtml(resolved.request_id || '')}" readonly />
            </div>
          </div>
          <label>callback_url</label>
          <input name="callback_url" value="${escapeHtml(resolved.callback_url || '')}" readonly />
          <label>Téléphone Hora (E.164)</label>
          <input name="phone_number" placeholder="+2250700000000" required />
          <label>PIN Hora (4–6 chiffres)</label>
          <input name="pin" inputmode="numeric" placeholder="1234" required />
          <button type="submit">Se connecter</button>
        </form>
        <p class="muted">Note: aucun token n'est demandé dans l'URL ou le body. Auth utilisateur = login Hora via téléphone + PIN. Un <code>state</code> signé (anti-CSRF) est utilisé pour transporter <code>link_id</code>/<code>request_id</code>/<code>callback_url</code>.</p>
        `,
      ),
    );
  });

  router.post('/flow/consent/login', async (req, res, next) => {
    try {
      const state = typeof req.body?.state === 'string' ? req.body.state.trim() : '';
      if (!state) throw createError('state est obligatoire', 400, 'INVALID_STATE');
      const st = verifyFlowState(state);

      const link_id = typeof req.body?.link_id === 'string' ? req.body.link_id.trim() : st.link_id;
      const request_id =
        typeof req.body?.request_id === 'string' ? req.body.request_id.trim() : st.request_id;
      const callback_url =
        typeof req.body?.callback_url === 'string' ? req.body.callback_url.trim() : st.callback_url;
      const phone_number =
        typeof req.body?.phone_number === 'string' ? req.body.phone_number.trim() : '';
      const pin = req.body?.pin;

      if (!isUuid(link_id)) throw createError('link_id invalide', 400, 'INVALID_UUID');
      if (request_id && !isUuid(request_id)) throw createError('request_id invalide', 400, 'INVALID_UUID');
      if (!phone_number) throw createError('phone_number est obligatoire', 400, 'INVALID_INPUT');
      if (callback_url && !isAllowedCallbackUrl(callback_url)) {
        throw createError('callback_url non autorisée', 400, 'INVALID_CALLBACK_URL');
      }

      const login = await usersService.loginUser({
        phone_number,
        pin,
        device_meta: { device_name: 'Hora Consent UI', user_agent: req.headers['user-agent'] },
      });

      const user_id = login?.user?.user_id;
      if (!user_id) throw createError('Impossible de résoudre user_id', 500, 'INTERNAL_ERROR');

      // 1) Confirmer le link
      const link = await identityLinksService.confirmIdentityLink({
        link_id,
        user_id,
        requester_user_id: user_id,
      });

      // Si pas de request_id, le flow s'arrête ici : link confirmé, redirect vers callback
      if (!request_id) {
        if (callback_url && isAllowedCallbackUrl(callback_url)) {
          const u = new URL(callback_url);
          u.searchParams.set('hora_status', 'link_confirmed');
          u.searchParams.set('hora_link_id', link_id);
          if (st.external_state) {
            u.searchParams.set('state', st.external_state);
          }
          return res.redirect(302, u.toString());
        }
        return res.type('text/html').send(
          page(
            'Hora — Liaison confirmée',
            `
            <h2>Connexion OK</h2>
            <p class="muted">Utilisateur Hora: <code>${escapeHtml(user_id)}</code></p>
            <h3>Liaison confirmée</h3>
            <pre>${escapeHtml(JSON.stringify(link, null, 2))}</pre>
            <p class="muted">Aucune demande d'authentification à traiter (pas de <code>request_id</code>).</p>
            `,
          ),
        );
      }

      const nextState = signFlowState({
        link_id,
        request_id,
        callback_url: callback_url || null,
        external_state: st.external_state || null,
      });
      res.type('text/html').send(
        page(
          'Hora — Approuver / Rejeter',
          `
          <h2>Connexion OK</h2>
          <p class="muted">Utilisateur Hora: <code>${escapeHtml(user_id)}</code></p>
          <h3>Liaison confirmée</h3>
          <pre>${escapeHtml(JSON.stringify(link, null, 2))}</pre>
          <h3>Demande d'authentification</h3>
          <form method="post" action="/flow/consent/resolve">
            <input type="hidden" name="state" value="${escapeHtml(nextState)}" />
            <input type="hidden" name="request_id" value="${escapeHtml(request_id)}" />
            <input type="hidden" name="user_id" value="${escapeHtml(user_id)}" />
            <div class="row">
              <div>
                <label>Action</label>
                <select name="action">
                  <option value="approve">approve</option>
                  <option value="reject">reject</option>
                </select>
              </div>
              <div>
                <label>&nbsp;</label>
                <button type="submit">Valider</button>
              </div>
            </div>
          </form>
          <p class="muted">Cette page ne stocke pas de token. Elle exécute l'action côté serveur via les services internes.</p>
          `,
        ),
      );
    } catch (err) {
      return next(err);
    }
  });

  router.post('/flow/consent/resolve', async (req, res, next) => {
    try {
      const state = typeof req.body?.state === 'string' ? req.body.state.trim() : '';
      if (!state) throw createError('state est obligatoire', 400, 'INVALID_STATE');
      const st = verifyFlowState(state);

      const request_id =
        typeof req.body?.request_id === 'string' ? req.body.request_id.trim() : st.request_id;
      const user_id = typeof req.body?.user_id === 'string' ? req.body.user_id.trim() : '';
      const action = typeof req.body?.action === 'string' ? req.body.action.trim() : '';

      if (!isUuid(request_id)) throw createError('request_id invalide', 400, 'INVALID_UUID');
      if (!user_id) throw createError('user_id est obligatoire', 400, 'INVALID_INPUT');

      let result;
      if (action === 'approve') {
        result = await authRequestsService.approveRequest({
          request_id,
          user_id,
          requester_user_id: user_id,
        });
      } else if (action === 'reject') {
        result = await authRequestsService.rejectRequest({
          request_id,
          user_id,
          requester_user_id: user_id,
        });
      } else {
        throw createError('action invalide (approve/reject)', 400, 'INVALID_INPUT');
      }

      // Redirect back to app if callback_url was provided and allowed.
      const callback_url = st.callback_url;
      if (callback_url && isAllowedCallbackUrl(callback_url)) {
        const u = new URL(callback_url);
        u.searchParams.set('hora_status', result?.status || '');
        u.searchParams.set('hora_request_id', request_id);
        u.searchParams.set('hora_link_id', st.link_id);
        // Retransmettre le state externe de l'app appelante pour qu'elle puisse valider le CSRF
        if (st.external_state) {
          u.searchParams.set('state', st.external_state);
        }
        return res.redirect(302, u.toString());
      }

      return res.type('text/html').send(
        page(
          'Hora — Résultat',
          `
          <h2>Action enregistrée</h2>
          <pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>
          <p><a href="/flow/consent">Revenir</a></p>
          `,
        ),
      );
    } catch (err) {
      return next(err);
    }
  });

  // Endpoint de découverte simple (évite 404 quand on tape /flow)
  router.get('/flow', (_req, res) => {
    res.type('text/html').send(
      page(
        'Hora — Flow',
        `
        <h2>Hora — Flow</h2>
        <ul>
          <li><a href="/flow/consent">/flow/consent</a> — consentement utilisateur (login, link confirm, approve/reject)</li>
        </ul>
        `,
      ),
    );
  });

  app.use(router);
}

module.exports = { registerWebFlowRoutes };

