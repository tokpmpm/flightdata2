/**
 * Vercel Serverless Function: API Proxy for Affiliates.One Deep Link Generation
 * URL path: /api/generate
 */

module.exports = async (req, res) => {
  // 僅允許 POST 請求
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const { api_key, offer_id, data } = req.body;

    // 基礎參數驗證
    if (!api_key) {
      return res.status(400).json({ error: 'Missing api_key parameter.' });
    }
    if (!offer_id) {
      return res.status(400).json({ error: 'Missing offer_id parameter.' });
    }
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid data array parameter.' });
    }

    // 限流防呆：一次請求最多 50 組連結
    if (data.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 URLs allowed per request.' });
    }

    // 構建請求給聯盟網 API 的 payload
    const payload = {
      api_key,
      offer_id: Number(offer_id),
      data
    };

    // 將 api_key 同步放入 query param 以防 API 規格之特殊要求
    const targetUrl = `https://api.pub.affiliates.one/api/v2/affiliates/deep_links/generate.json?api_key=${encodeURIComponent(api_key)}`;

    // 使用原生 fetch 轉發請求
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();

    // 將聯盟網的響應狀態碼與資料回傳給前端
    return res.status(response.status).json(responseData);

  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error while forwarding request to Affiliate API.',
      message: error.message
    });
  }
};
