/* ============================================================
   Build with YOU — OAuth configuration
   ------------------------------------------------------------
   Fill in your provider credentials here to switch the buttons
   from "demo sign-in" to a real OAuth flow.

   1. Google  — console.cloud.google.com > APIs & Services > Credentials
                > OAuth client ID (Web application)
   2. Discord — discord.com/developers/applications > OAuth2 > Redirects
   3. GitHub  — github.com/settings/developers > OAuth Apps

   The redirect URI must match EXACTLY, e.g.
      https://siddheshbajpai.github.io/build-with-you/login.html

   `exchangeUrl` (optional) is a small backend endpoint that swaps the
   ?code= for a session. Without it the callback completes locally in
   demo mode — nothing is sent anywhere, but also nothing is verified.
   ============================================================ */
window.AUTH_CONFIG = {
  google: {
    clientId: '',
    redirectUri: ''
  },
  discord: {
    clientId: '',
    redirectUri: ''
  },
  github: {
    clientId: '',
    redirectUri: ''
  },

  // POST { provider, code, redirect_uri } -> { email, name, role?, plan? }
  exchangeUrl: '',

  // true = always use the local demo sign-in, even with client ids set
  forceDemo: false
};
