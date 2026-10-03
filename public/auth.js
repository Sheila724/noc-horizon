// Monta os links de logout (mod_auth_openidc exige URL absoluta do mesmo domínio).
document.querySelectorAll("[data-logout-to]").forEach(link => {
  const target = window.location.origin + link.dataset.logoutTo;
  link.href = "/oidc/callback?logout=" + encodeURIComponent(target);
});
