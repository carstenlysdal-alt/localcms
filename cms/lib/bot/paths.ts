/**
 * Stier som kun scannere/exploit-bots beder om (CMS'et er Next.js: ingen PHP, WordPress, .env-filer eller git-mapper
 * serveres). Ren funktion; proxy.ts svarer med et lille 404 og tæller et "strike" mod IP'en.
 */
const MALICIOUS: RegExp[] = [
  /^\/(wp-admin|wp-content|wp-includes|wp-json|wordpress|wp)(\/|$)/i,
  /^\/wp-(login|config|cron|signup)\.php$/i,
  /^\/xmlrpc\.php$/i,
  /^\/\.(env|git|svn|hg|aws|ssh|docker|npmrc|htaccess|htpasswd|ds_store|vscode|idea|bash_history)(\b|\/|\.|$)/i,
  /^\/(phpmyadmin|pma|myadmin|mysql|sqladmin|adminer|dbadmin|phpinfo)(\/|\.php|$)/i,
  /^\/(cgi-bin|cgi|fcgi|scripts)\/.*/i,
  /^\/(vendor\/phpunit|vendor\/composer|node_modules|\.next\/server|_profiler|telescope|horizon|actuator|jolokia|solr|manager\/html|boaform|HNAP1|owa|ecp|autodiscover)(\/|$)/i,
  /^\/(server-status|server-info|config\.(php|json|ya?ml)|configuration\.php|web\.config|composer\.(json|lock)|package\.json|id_rsa|credentials)$/i,
  /\.(php\d?|phtml|asp|aspx|jsp|jspx|cgi|pl|py|sh|bak|old|swp|sql|sqlite|db|dump|tar|tgz|gz|zip|rar|7z|ini|log|pem|key)$/i,
  /(^|\/)\.\.(\/|$)/,
  /%2e%2e|%00|\.\.%2f/i,
];

const SAFE_PREFIXES = ["/.well-known/", "/uploads/", "/media/", "/avatars/", "/icons/", "/_next/"];

export function isMaliciousPath(pathname: string): boolean {
  if (SAFE_PREFIXES.some((p) => pathname.startsWith(p) && !/(\.\.|%2e%2e|%00)/i.test(pathname))) return false;
  return MALICIOUS.some((re) => re.test(pathname));
}
