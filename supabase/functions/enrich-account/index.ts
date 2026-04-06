const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { accounts } = await req.json() as {
      accounts: Array<{ id: string; account_name: string; country: string }>;
    };

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'accounts array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (accounts.length > 20) {
      return new Response(
        JSON.stringify({ error: 'Maximum 20 accounts per request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountList = accounts.map((a, i) => `${i + 1}. "${a.account_name}" (country: ${a.country})`).join('\n');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a business research assistant. For each company, find:
1. ec_link: The company's official website URL (e.g. https://www.nike.com). Must be a valid URL.
2. industry: The company's primary industry. Must be one of: Retail, Fashion, Gaming, F&B, Beauty, Finance, Travel, Media, SaaS, Telco, Health, Education, Automotive, Real Estate, Other
3. platform: The e-commerce platform the company uses (e.g. Shopify, Shopline, 91APP, CYBERBIZ, WooCommerce, Magento, custom, or unknown if not determinable)

Return results using the provided tool.`
          },
          {
            role: 'user',
            content: `Research the following companies and find their website URL, industry, and e-commerce platform:\n\n${accountList}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_enrichment',
              description: 'Return enrichment data for accounts',
              parameters: {
                type: 'object',
                properties: {
                  results: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        index: { type: 'number', description: '1-based index matching the input list' },
                        ec_link: { type: 'string', description: 'Official website URL' },
                        industry: { type: 'string', enum: ['Retail', 'Fashion', 'Gaming', 'F&B', 'Beauty', 'Finance', 'Travel', 'Media', 'SaaS', 'Telco', 'Health', 'Education', 'Automotive', 'Real Estate', 'Other'] },
                        platform: { type: 'string', description: 'E-commerce platform used' },
                        confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
                      },
                      required: ['index', 'ec_link', 'industry', 'platform', 'confidence']
                    }
                  }
                },
                required: ['results']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'return_enrichment' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: '請求過於頻繁，請稍後再試' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI 額度不足，請聯繫管理員' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: 'AI did not return structured data' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    
    // Map results back to account IDs
    const enriched = (parsed.results || []).map((r: any) => {
      const account = accounts[r.index - 1];
      return {
        id: account?.id,
        ec_link: r.ec_link,
        industry: r.industry,
        platform: r.platform,
        confidence: r.confidence,
      };
    }).filter((r: any) => r.id);

    return new Response(JSON.stringify({ results: enriched }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Enrich error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
