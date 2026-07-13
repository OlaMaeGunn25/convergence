// CONVERGENCE-Ai Admin Assistant — shared hub chrome
// Injects a top toolbar into every admin hub HTML page providing:
//  - Back to Agentic Systems directory
//  - Cross-links to sibling hubs (Deployment, Operations, Training, Demo)
//  - Logout (clears Supabase session and returns to /admin login)

(function () {
  const HUB_LINKS = [
    { href: "/admin/agentic-systems", label: "Directory", icon: "fa-grip" },
    { href: "https://sitebuilder.convergence-ai.com/site_builds_deployment_hub.html", label: "Deployment Hub", icon: "fa-server" },
    { href: "/admin/operations_hub.html", label: "Operations Hub", icon: "fa-square-poll-vertical" },
    { href: "/admin/training_hub.html", label: "Training Hub", icon: "fa-graduation-cap" },
    { href: "/admin/index.html", label: "Client Demo", icon: "fa-display" },
  ];

  function logout() {
    try {
      // Clear all Supabase auth tokens from local/session storage
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-") || k.includes("supabase"))
        .forEach((k) => localStorage.removeItem(k));
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith("sb-") || k.includes("supabase"))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch (e) {
      console.warn("Logout cleanup failed:", e);
    }
    window.location.href = "/admin";
  }
  window.aiwxLogout = logout;

  function injectToolbar() {
    if (document.getElementById("aiwx-hub-toolbar")) return;
    const here = window.location.pathname;
    const bar = document.createElement("nav");
    bar.id = "aiwx-hub-toolbar";
    bar.innerHTML = `
      <a href="/admin/agentic-systems" class="aiwx-hub-back" title="Back to Agentic Systems directory">
        <i class="fa-solid fa-arrow-left"></i><span>Back</span>
      </a>
      <div class="aiwx-hub-links">
        ${HUB_LINKS.map((l) => {
          const active = here === l.href ? " active" : "";
          return `<a href="${l.href}" class="aiwx-hub-link${active}"><i class="fa-solid ${l.icon}"></i><span>${l.label}</span></a>`;
        }).join("")}
      </div>
      <button type="button" class="aiwx-hub-logout" onclick="aiwxLogout()" title="Sign out">
        <i class="fa-solid fa-right-from-bracket"></i><span>Logout</span>
      </button>
    `;
    document.body.prepend(bar);
    document.body.classList.add("aiwx-has-hub-toolbar");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectToolbar);
  } else {
    injectToolbar();
  }

  // Stubs preserved for Operations Hub pages, safely initialized after DOM content has fully loaded to prevent hijacking inline functions
  document.addEventListener("DOMContentLoaded", () => {
    window.verifyActivation = window.verifyActivation || function () {
      console.warn("verifyActivation() not yet implemented in app.js");
    };
    window.autoLoadTestToken = window.autoLoadTestToken || function () {
      console.warn("autoLoadTestToken() not yet implemented in app.js");
    };
    window.syncBlogFeed = window.syncBlogFeed || function () {
      console.warn("syncBlogFeed() not yet implemented — Social Campaigns module pending");
    };
    window.generateCampaignPosts = window.generateCampaignPosts || function () {
      console.warn("generateCampaignPosts() not yet implemented — Social Campaigns module pending");
    };
  });
})();
