const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { industry, region, keywords, org_type } = await req.json();

    if (!industry && !keywords) {
      return new Response(
        JSON.stringify({ error: 'Industry or keywords required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build search prompt based on org type
    let extraInfo = '';
    if (org_type === 'besitfy') {
      extraInfo = '請特別找出有經營 LINE 官方帳號的公司，並估算其 LINE 粉絲數。';
    } else {
      extraInfo = '請估算每間公司的網站月流量 (monthly traffic)。';
    }

    const systemPrompt = `你是一位專業的商業情報分析師。用戶會提供產業和地區，你需要找出該領域的潛在客戶公司。
請回傳 JSON 格式的公司清單。每間公司包含：
- company_name: 公司名稱
- website: 公司官網 URL
- industry: 產業分類
- description: 簡短描述（50字內）
- region: 所在地區
- phone: 公司電話（如果知道的話，否則填 null）
- email: 公司 email（如果知道的話，否則填 null）
- extra_data: 額外資訊物件
${extraInfo}

回傳格式：{ "companies": [...] }
請盡量找 10-20 間真實存在的公司。`;

    const userPrompt = `請幫我找出以下條件的公司：
產業：${industry || '不限'}
地區：${region || '不限'}
${keywords ? `關鍵字：${keywords}` : ''}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI API error:', errText);
      return new Response(
        JSON.stringify({ error: `AI search failed: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    let companies = [];
    try {
      const parsed = JSON.parse(content);
      companies = parsed.companies || [];
    } catch {
      console.error('Failed to parse AI response:', content);
      return new Response(
        JSON.stringify({ error: 'Failed to parse search results' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ companies }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scraper search error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
