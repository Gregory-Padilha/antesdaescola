/**
 * ANTES DA ESCOLA™ - Analytics & Pixel Tracking System
 * Prepared for Meta Pixel (fbq), Google Analytics / GTM (dataLayer)
 */

window.AppTracker = (function() {
  function logEvent(eventName, payload = {}) {
    console.log(`[Tracker Event] 🎯 ${eventName}`, payload);

    // Meta Pixel (fbq) integration
    if (typeof window.fbq === 'function') {
      window.fbq('trackCustom', eventName, payload);
    }

    // Google Tag Manager / GA4 dataLayer integration
    if (window.dataLayer && Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: eventName,
        ...payload,
        timestamp: new Date().toISOString()
      });
    }

    // Custom DOM Event for extensibility
    try {
      window.dispatchEvent(new CustomEvent('analytics_event', {
        detail: { eventName, payload }
      }));
    } catch(e) {}
  }

  // Setup generic listeners for CTA buttons
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.cta-tracker').forEach(elem => {
      elem.addEventListener('click', function(e) {
        const ctaName = this.getAttribute('data-cta-name') || 'unknown_cta';
        const href = this.getAttribute('href') || '';
        
        if (this.id === 'btn-main-checkout' || href.includes('checkout') || href.includes('pay.kiwify') || href.includes('hotmart')) {
          logEvent('checkout_clicked', { cta: ctaName, destination: href });
        } else {
          logEvent('cta_clicked', { cta: ctaName, destination: href });
        }
      });
    });
  });

  return {
    track: logEvent
  };
})();
