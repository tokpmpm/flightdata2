/**
 * Test script to verify api/generate.js locally
 */
const generateHandler = require('../api/generate.js');

async function runTest() {
  console.log('🚀 開始本地驗證 api/generate.js API 代理功能...');

  // 模擬 Express/Vercel 的 response 物件
  let responseStatus = 200;
  let responseHeaders = {};
  let jsonResult = null;

  const mockRes = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(data) {
      jsonResult = data;
      return this;
    },
    setHeader(key, value) {
      responseHeaders[key] = value;
      return this;
    }
  };

  // 1. 模擬正常的 POST 請求
  const mockReq = {
    method: 'POST',
    body: {
      api_key: 'ce215512ced21900a92d00f2e7a0e9f1',
      offer_id: 2328, // Klook
      data: [
        {
          target_url: 'https://www.klook.com/zh-TW/activity/90306-islet-one-day-tour-guishan-island/',
          aff_uniq_id: 'test_uniq_id',
          subid_1: 'test_sub1'
        }
      ]
    }
  };

  try {
    await generateHandler(mockReq, mockRes);
    
    console.log('--------------------------------------------------');
    console.log(`HTTP 回應狀態碼 (Status Code): ${responseStatus}`);
    console.log('JSON 回應結果:');
    console.log(JSON.stringify(jsonResult, null, 2));
    console.log('--------------------------------------------------');

    if (responseStatus === 200 && jsonResult && jsonResult.data) {
      console.log('✅ 本地轉發與 API 串接測試成功！');
    } else {
      console.log('❌ 測試未達預期成功標準。');
      console.log(`原因說明: 狀態碼 ${responseStatus}`);
      
      // 如果是 API Key 過期或不正確，聯盟網可能會回傳錯誤
      if (jsonResult && jsonResult.meta) {
        console.log(`API Meta 回應:`, jsonResult.meta);
      }
    }

  } catch (error) {
    console.error('❌ 執行 Handler 出錯：', error);
  }
}

runTest();
