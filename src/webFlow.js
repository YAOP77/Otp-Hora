const { Router } = require('express');
const { URL } = require('url');
const usersService = require('./modules/users/users.service');
const identityLinksService = require('./modules/identity_links/identityLinks.service');
const identityLinksRepository = require('./modules/identity_links/identityLinks.repository');
const enterpriseRepository = require('./modules/enterprise_accounts/enterprise.repository');
const { createError } = require('./common/errors');
const {
  signFlowState,
  verifyFlowState,
  signFlowUserToken,
  verifyFlowUserToken,
} = require('./common/flowState');
const { env } = require('./config/env');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v) {
  return typeof v === 'string' && UUID_REGEX.test(v);
}

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
      *{box-sizing:border-box}
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;padding:24px;line-height:1.5;background:#f9fafb;color:#111827}
      .card{max-width:480px;margin:40px auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.05)}
      h1,h2{margin-top:0}
      h1{font-size:22px}
      label{display:block;margin-top:14px;font-weight:600;font-size:14px}
      input,select,button{width:100%;padding:11px 12px;margin-top:6px;border:1px solid #d1d5db;border-radius:10px;font-size:15px;font-family:inherit}
      input:focus,select:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.15)}
      button{cursor:pointer;font-weight:600;border:none;margin-top:18px}
      .btn-primary{background:#2563eb;color:#fff}
      .btn-primary:hover{background:#1d4ed8}
      .btn-success{background:#16a34a;color:#fff}
      .btn-success:hover{background:#15803d}
      .btn-danger{background:#dc2626;color:#fff}
      .btn-danger:hover{background:#b91c1c}
      .row{display:flex;gap:10px;margin-top:16px}
      .row button{margin-top:0;flex:1}
      .muted{color:#6b7280;font-size:14px}
      .enterprise{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;margin:16px 0}
      .enterprise-name{font-weight:700;color:#1e40af}
      .success{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;color:#166534}
      .error{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;color:#991b1b}
    </style>
  </head>
  <body>
    <div class="card">
      ${body}
    </div>
  </body>
</html>`;
}

function renderLoginForm(signedState, enterpriseName) {
  return page(
    'Hora — Connexion',
    `
    <h1>Connexion Hora</h1>
    ${
      enterpriseName
        ? `<div class="enterprise">
             <div class="muted">Demande de liaison depuis</div>
             <div class="enterprise-name">${escapeHtml(enterpriseName)}</div>
           </div>`
        : ''
    }
    <p class="muted">Connectez-vous avec votre compte Hora pour continuer.</p>
    <form method="post" action="/flow/consent/login">
      <input type="hidden" name="state" value="${escapeHtml(signedState)}" />
      <label>Téléphone Hora</label>
      <input name="phone_number" placeholder="+225 07 00 00 00 00" inputmode="tel" autocomplete="tel" required />
      <label>PIN Hora</label>
      <input name="pin" type="password" inputmode="numeric" placeholder="••••" autocomplete="current-password" required />
      <button type="submit" class="btn-primary">Se connecter</button>
    </form>
    `,
  );
}

function renderApprovalForm(signedState, enterpriseName, userPrenom) {
  return page(
    'Hora — Autoriser la liaison',
    `
    <h1>Autoriser la liaison ?</h1>
    ${
      userPrenom
        ? `<p class="muted">Bonjour <strong>${escapeHtml(userPrenom)}</strong>.</p>`
        : ''
    }
    <div class="enterprise">
      <div class="muted">L'application suivante demande à vous authentifier</div>
      <div class="enterprise-name">${escapeHtml(enterpriseName || 'Application partenaire')}</div>
    </div>
    <p class="muted">Vous pouvez autoriser cette demande pour continuer, ou la refuser si vous ne la reconnaissez pas.</p>
    <form method="post" action="/flow/consent/resolve">
      <input type="hidden" name="state" value="${escapeHtml(signedState)}" />
      <div class="row">
        <button type="submit" name="action" value="reject" class="btn-danger">Refuser</button>
        <button type="submit" name="action" value="approve" class="btn-success">Autoriser</button>
      </div>
    </form>
    `,
  );
}

function renderResult(title, message, isSuccess) {
  return page(
    `Hora — ${title}`,
    `
    <h1>${escapeHtml(title)}</h1>
    <div class="${isSuccess ? 'success' : 'error'}">${escapeHtml(message)}</div>
    <p class="muted" style="margin-top:20px">Vous pouvez fermer cette fenêtre et revenir sur l'application.</p>
    `,
  );
}

async function loadLinkContext(linkId) {
  const link = await identityLinksRepository.findLinkById(linkId);
  if (!link) {
    throw createError('Liaison introuvable', 404, 'LINK_NOT_FOUND');
  }
  const company = await enterpriseRepository.findEnterpriseByIdForAuth(link.company_id);
  return { link, company };
}

function registerWebFlowRoutes(app) {
  const router = Router();

  // ─── GET /flow/consent?link_id=X ─────────────────────────────────────
  // Si l'utilisateur a un hora_token valide (venant d'un login récent) → affiche approve/reject directement
  // Sinon → affiche le formulaire login
  router.get('/flow/consent', async (req, res, next) => {
    try {
      const link_id = typeof req.query?.link_id === 'string' ? req.query.link_id.trim() : '';
      const horaToken = typeof req.query?.hora_token === 'string' ? req.query.hora_token.trim() : '';

      if (!isUuid(link_id)) {
        throw createError('link_id doit être un UUID valide', 400, 'INVALID_UUID');
      }

      const { link, company } = await loadLinkContext(link_id);
      const enterpriseName = company?.nom_entreprise || null;

      // Liaison déjà résolue → afficher la page de résultat
      if (link.status === 'approved') {
        return res.type('text/html').send(
          renderResult(
            'Liaison autorisée',
            `Vous avez déjà autorisé ${enterpriseName || 'cette application'}.`,
            true,
          ),
        );
      }
      if (link.status === 'rejected') {
        return res.type('text/html').send(
          renderResult(
            'Liaison refusée',
            `Vous avez refusé la demande de ${enterpriseName || 'cette application'}.`,
            false,
          ),
        );
      }

      // hora_token valide → skip login, affiche directement approve/reject
      if (horaToken) {
        const userToken = verifyFlowUserToken(horaToken);
        if (userToken && userToken.user_id === link.user_id) {
          const signedState = signFlowState({
            link_id,
            user_id: userToken.user_id,
          });
          return res.type('text/html').send(
            renderApprovalForm(signedState, enterpriseName, null),
          );
        }
      }

      // Sinon : formulaire login (le link_id est porté par le state JWT pour anti-CSRF)
      const signedState = signFlowState({ link_id });
      return res.type('text/html').send(
        renderLoginForm(signedState, enterpriseName),
      );
    } catch (err) {
      return next(err);
    }
  });

  // ─── POST /flow/consent/login ────────────────────────────────────────
  router.post('/flow/consent/login', async (req, res, next) => {
    try {
      const state = typeof req.body?.state === 'string' ? req.body.state.trim() : '';
      if (!state) throw createError('state est obligatoire', 400, 'INVALID_STATE');
      const st = verifyFlowState(state);
      const link_id = st.link_id;
      if (!isUuid(link_id)) throw createError('link_id invalide', 400, 'INVALID_UUID');

      const phone_number =
        typeof req.body?.phone_number === 'string' ? req.body.phone_number.trim() : '';
      const pin = req.body?.pin;
      if (!phone_number) throw createError('phone_number est obligatoire', 400, 'INVALID_INPUT');

      const { link, company } = await loadLinkContext(link_id);
      const enterpriseName = company?.nom_entreprise || null;

      const login = await usersService.loginUser({
        phone_number,
        pin,
        device_meta: { device_name: 'Hora Consent UI', user_agent: req.headers['user-agent'] },
      });
      const user_id = login?.user?.user_id;
      if (!user_id) throw createError('Impossible de résoudre user_id', 500, 'INTERNAL_ERROR');

      // La liaison doit appartenir à l'utilisateur authentifié
      if (link.user_id !== user_id) {
        throw createError(
          "Cette liaison n'appartient pas à l'utilisateur connecté",
          403,
          'LINK_USER_MISMATCH',
        );
      }

      // Si déjà résolue, afficher le résultat
      if (link.status === 'approved') {
        return res.type('text/html').send(
          renderResult(
            'Liaison autorisée',
            `Vous avez déjà autorisé ${enterpriseName || 'cette application'}.`,
            true,
          ),
        );
      }
      if (link.status === 'rejected') {
        return res.type('text/html').send(
          renderResult(
            'Liaison refusée',
            `Vous avez refusé la demande de ${enterpriseName || 'cette application'}.`,
            false,
          ),
        );
      }

      // Afficher approve/reject
      const nextState = signFlowState({ link_id, user_id });
      return res.type('text/html').send(
        renderApprovalForm(nextState, enterpriseName, login.user.prenom),
      );
    } catch (err) {
      return next(err);
    }
  });

  // ─── POST /flow/consent/resolve ──────────────────────────────────────
  router.post('/flow/consent/resolve', async (req, res, next) => {
    try {
      const state = typeof req.body?.state === 'string' ? req.body.state.trim() : '';
      if (!state) throw createError('state est obligatoire', 400, 'INVALID_STATE');
      const st = verifyFlowState(state);
      const link_id = st.link_id;
      const user_id = st.user_id;
      if (!isUuid(link_id) || !isUuid(user_id)) {
        throw createError('State invalide', 400, 'INVALID_STATE');
      }

      const action = typeof req.body?.action === 'string' ? req.body.action.trim() : '';
      if (action !== 'approve' && action !== 'reject') {
        throw createError('action invalide (approve/reject)', 400, 'INVALID_INPUT');
      }

      const { company } = await loadLinkContext(link_id);
      const enterpriseName = company?.nom_entreprise || null;

      if (action === 'approve') {
        await identityLinksService.approveLink({
          requester_user_id: user_id,
          link_id,
        });
        return res.type('text/html').send(
          renderResult(
            'Liaison autorisée',
            `Vous avez autorisé ${enterpriseName || "l'application"} à vous authentifier.`,
            true,
          ),
        );
      }

      await identityLinksService.rejectLink({
        requester_user_id: user_id,
        link_id,
      });
      return res.type('text/html').send(
        renderResult(
          'Liaison refusée',
          `Vous avez refusé la demande de ${enterpriseName || "l'application"}.`,
          false,
        ),
      );
    } catch (err) {
      return next(err);
    }
  });

  router.get('/flow', (_req, res) => {
    res.type('text/html').send(
      page(
        'Hora — Flow',
        `
        <h1>Hora — Flow</h1>
        <p class="muted">Ce point d'entrée ne peut être utilisé que via un lien de consentement envoyé par une application partenaire.</p>
        `,
      ),
    );
  });

  app.use(router);
}

module.exports = { registerWebFlowRoutes };
