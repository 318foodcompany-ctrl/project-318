function calculateEstimate(form) {
    const guests = Math.max(15, Number(form.elements.guestCount.value || 15));
    const menu = form.querySelector('input[name="menu"]:checked');

    let total = guests * Number(menu?.dataset.price || 0);

    form.querySelectorAll('input[name="addons"]:checked').forEach((addon) => {
        total += guests * Number(addon.dataset.flat || 0);
        total += Number(addon.dataset.once || 0);
    });

    return Math.round(total);
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('quoteBuilder');

    if (!form || !window.supabaseClient) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!form.reportValidity()) return;

        const submitButton = document.getElementById('submitQuote');
        let submitMessage = document.getElementById('quoteSubmitMessage');
        if (!submitMessage) {
            submitMessage = document.createElement('p');
            submitMessage.id = 'quoteSubmitMessage';
            submitMessage.className = 'quote-submit-message';
            submitMessage.setAttribute('role', 'status');
            submitMessage.setAttribute('aria-live', 'polite');
            form.appendChild(submitMessage);
        }
        submitButton.disabled = true;
        submitMessage.classList.remove('error');
        submitMessage.textContent = 'Submitting your request...';

        const data = new FormData(form);
        const addons = data.getAll('addons');

        const lead = {
            name: data.get('name'),
            company: data.get('company'),
            email: data.get('email'),
            phone: data.get('phone'),
            event_date: data.get('eventDate') || null,
            guests: Number(data.get('guestCount')),
            menu: data.get('menu'),
            event_type: data.get('eventType'),
            budget: calculateEstimate(form),
            notes: [
                `Time: ${data.get('eventTime') || ''}`,
                `Address: ${data.get('eventAddress') || ''}`,
                `Add-ons: ${addons.join(', ') || 'None'}`,
                data.get('notes') || ''
            ].filter(Boolean).join('\n'),
            status: 'New'
        };

        try {
            const attribution = window.Project318Attribution?.snapshot?.() || {};
            const { data: quoteId, error } = await window.supabaseClient.rpc('submit_quote_with_attribution', {
                p_name: lead.name,
                p_company: lead.company || '',
                p_email: lead.email,
                p_phone: lead.phone,
                p_event_date: lead.event_date,
                p_guests: lead.guests,
                p_menu: lead.menu,
                p_event_type: lead.event_type,
                p_budget: lead.budget,
                p_notes: lead.notes,
                p_attribution: attribution
            });
            if (error) throw error;

            const persistedQuoteId = Number(Array.isArray(quoteId) ? quoteId[0] : quoteId);
            if (!Number.isSafeInteger(persistedQuoteId) || persistedQuoteId <= 0) {
                throw new Error('The database did not confirm a saved quote record.');
            }

            form.dataset.savedQuoteId = String(persistedQuoteId);
            form.hidden = true;
            const progress = document.querySelector('.progress-wrap');
            if (progress) progress.hidden = true;
            const success = document.getElementById('builderSuccess');
            if (success) {
                success.hidden = false;
                const text = success.querySelector('p');
                if (text) text.textContent = 'Your request has been saved and sent to 318 Food Co. We will follow up with you shortly.';
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            console.error('Quote submission failed:', error);
            submitMessage.classList.add('error');
            submitMessage.textContent = 'Your request was not confirmed as saved. Please try again or call 318 Food Co.';
            submitButton.disabled = false;
        }
    }, true);
});
