document.addEventListener('DOMContentLoaded', async () => {
  if (!supabaseClient) {
    return;
  }

  const { data, error } = await supabaseClient
    .from('website_content')
    .select('content_key, content_value')
    .eq('page', 'home');

  if (error) {
    console.error('Could not load website content:', error);
    return;
  }

  const content = Object.fromEntries(
    data.map((item) => [item.content_key, item.content_value])
  );

  document.querySelectorAll('[data-content]').forEach((element) => {
    const key = element.dataset.content;
    const value = content[key];

    if (typeof value === 'string' && value.trim() !== '') {
      element.textContent = value;
    }
  });
});
