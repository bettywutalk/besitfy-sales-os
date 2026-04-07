const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { websites, org_type } = await req.json();

    if (!websites || !Array.isArray(websites) || websites.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Websites array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to 5 at a time
    const batch = websites.slice(0, 5);
    const results = [];

    for (const site of batch) {
      try {
        let formattedUrl = site.url?.trim() || '';
        if (!formattedUrl) continue;
        if (!formattedUrl.startsWith('http')) formattedUrl = `https://${formattedUrl}`;

        // Scrape with Firecrawl
        const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: formattedUrl,
            formats: ['markdown'],
            onlyMainContent: true,
          }),
        });

        const scrapeData = await scrapeRes.json();
        const markdown = scrapeData?.data?.markdown || scrapeData?.markdown || '';
        const truncated = markdown.substring(0, 3000);

        // Use AI to extract structured info
        let extraPrompt = '';
        if (org_type === 'besitfy') {
          extraPrompt = `- line_id: LINE 官方帳號 ID（例如 @abc123，如果頁面有 line.me 或 @帳號 連結，否則填 null）
- facebook_page: Facebook 粉絲專頁完整 URL（如果有 facebook.com 連結，否則填 null）`;
        } else {
          extraPrompt = `- monthly_traffic: 估算月流量（如果頁面有提到的話，否則填 null）
- tech_stack: 使用的技術或平台（如果能看出來的話）`;
        }

        // Also extract all emails via regex from raw markdown
        const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
        const allEmails = [...new Set(markdown.match(emailRegex) || [])].filter(e =>
          !e.includes('example.com') && !e.includes('sentry') && !e.includes('wix') && !e.includes('wordpress')
        );

        const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `從網頁內容中提取公司資訊，回傳 JSON：
{
  "company_name": "公司名稱",
  "industry": "產業分類",
  "description": "簡短描述",
  "email": "主要聯繫 email（如有）",
  "emails": ["所有找到的 email 陣列，可能有多個"],
  "phone": "電話（如有）",
  "address": "地址（如有）",
  ${extraPrompt}
}`
              },
              { role: 'user', content: `網站：${formattedUrl}\n\n內容：\n${truncated}` },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
          }),
        });

        const aiData = await aiRes.json();
        const enriched = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');

        // Merge AI emails + regex emails, deduplicate
        const aiEmails: string[] = enriched.emails || (enriched.email ? [enriched.email] : []);
        const mergedEmails = [...new Set([...aiEmails, ...allEmails])];

        results.push({
          original_index: site.index,
          url: formattedUrl,
          ...enriched,
          emails: mergedEmails,
          email: mergedEmails[0] || enriched.email || null,
          scraped: true,
        });
      } catch (err) {
        console.error(`Error enriching ${site.url}:`, err);
        results.push({
          original_index: site.index,
          url: site.url,
          scraped: false,
          error: err instanceof Error ? err.message : 'Failed',
        });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scraper enrich error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
