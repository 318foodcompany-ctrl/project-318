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

    if (!form || !supabaseClient) return;

    form.addEventListener('submit', async () => {
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

        const { error } = await supabaseClient
            .from('leads')
            .insert([lead]);

        if (error) {
            console.error('Supabase error:', error);
        } else {
            console.log('Lead saved successfully!');
        }
    });
});