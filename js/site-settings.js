(function () {
  const fallbackSettings = {
    business_name: "318 Food Co.",
    phone: "(318) 572-0137",
    email: "318FoodCompany@gmail.com",
    address: "Northwest Louisiana",
    hours: "By appointment",
    facebook_url: "",
    instagram_url: ""
  };

  function isMissingSettingsTable(error) {
    const message = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
    return message.includes("pgrst205") || message.includes("website_settings") && message.includes("not find");
  }

  async function fetchSettingsRows() {
    const primary = await supabaseClient
      .from("website_settings")
      .select("setting_key, setting_value");

    if (!primary.error || !isMissingSettingsTable(primary.error)) return primary;

    const fallback = await supabaseClient
      .from("website_content")
      .select("content_key, content_value")
      .eq("page", "settings");

    return {
      data: (fallback.data || []).map((item) => ({
        setting_key: item.content_key,
        setting_value: item.content_value
      })),
      error: fallback.error
    };
  }

  function phoneHref(phone) {
    const trimmed = String(phone || "").trim();
    const hasPlus = trimmed.startsWith("+");
    const digits = trimmed.replace(/\D/g, "");
    return digits ? `tel:${hasPlus ? "+" : ""}${digits}` : "tel:3185720137";
  }

  function emailHref(email) {
    return `mailto:${String(email || fallbackSettings.email).trim()}`;
  }

  function replaceExistingContactText(element, oldValuePattern, newValue) {
    const text = element.textContent || "";
    element.textContent = oldValuePattern.test(text)
      ? text.replace(oldValuePattern, newValue)
      : newValue;
  }

  function replaceBusinessName(settings) {
    if (!settings.business_name || settings.business_name === fallbackSettings.business_name) return;

    const businessNamePattern = /318 Food Co\.?/g;
    document.title = document.title.replace(businessNamePattern, settings.business_name);
    document.querySelectorAll('meta[name="description"]').forEach((meta) => {
      meta.content = meta.content.replace(businessNamePattern, settings.business_name);
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (parent && !["SCRIPT", "STYLE"].includes(parent.tagName)) textNodes.push(walker.currentNode);
    }
    textNodes.forEach((node) => {
      node.nodeValue = node.nodeValue.replace(businessNamePattern, settings.business_name);
    });
    document.querySelectorAll('img[alt*="318 Food Co"]').forEach((image) => {
      image.alt = image.alt.replace(businessNamePattern, settings.business_name);
    });
  }

  function applySettings(settings) {
    window.websiteSettings = { ...settings };
    replaceBusinessName(settings);

    const phonePattern = /(?:\+?1[\s.-]?)?\(?318\)?[\s.-]?572[\s.-]?0137/;
    document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
      link.href = phoneHref(settings.phone);
      replaceExistingContactText(link, phonePattern, settings.phone);
    });

    const emailPattern = /318FoodCompany@gmail\.com/i;
    document.querySelectorAll('a[href^="mailto:"]').forEach((link) => {
      link.href = emailHref(settings.email);
      replaceExistingContactText(link, emailPattern, settings.email);
    });

    document.querySelectorAll('[data-setting="address"]').forEach((element) => {
      element.textContent = settings.address;
    });
    document.querySelectorAll('[data-setting="hours"]').forEach((element) => {
      element.textContent = settings.hours;
    });

    ["facebook", "instagram"].forEach((network) => {
      const url = settings[`${network}_url`];
      document.querySelectorAll(`[data-setting-social="${network}"]`).forEach((link) => {
        if (!url || !/^https?:\/\//i.test(url)) {
          link.hidden = true;
          return;
        }
        link.hidden = false;
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      });
    });

    document.dispatchEvent(new CustomEvent("website-settings-ready", {
      detail: window.websiteSettings
    }));
  }

  async function loadWebsiteSettings() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) {
      applySettings(fallbackSettings);
      return;
    }

    const { data, error } = await fetchSettingsRows();

    if (error) {
      console.error("Website settings load failed:", error);
      applySettings(fallbackSettings);
      return;
    }

    const settings = { ...fallbackSettings };
    (data || []).forEach((item) => {
      if (Object.hasOwn(settings, item.setting_key) && item.setting_value !== "") {
        settings[item.setting_key] = item.setting_value;
      }
    });
    applySettings(settings);
  }

  loadWebsiteSettings();
})();
