// Shared GA4 snippet for pages that are not built from template.html
// (monthly reports, /insights/ index, holiday previews, hand-written feature pages).
const GA_ID = 'G-ZS0NCFZ2K3';

const GA_SNIPPET = '<!-- Google Analytics 4 -->\n'
  + '<script async src="https://www.googletagmanager.com/gtag/js?id=' + GA_ID + '"></script>\n'
  + '<script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag(\'js\', new Date()); gtag(\'config\', \'' + GA_ID + '\');</script>';

// Idempotent: insert the snippet before </head> unless the page already loads this GA ID.
function ensureGa(html) {
  if (html.includes(GA_ID)) return html;
  const i = html.search(/<\/head>/i);
  if (i === -1) return html;
  return html.slice(0, i) + GA_SNIPPET + '\n' + html.slice(i);
}

module.exports = { GA_ID, GA_SNIPPET, ensureGa };
