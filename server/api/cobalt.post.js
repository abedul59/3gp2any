// server/api/cobalt.post.js
export default defineEventHandler(async (event) => {
  // 讀取前端傳過來的資料
  const body = await readBody(event)

  try {
    // 由 Vercel 伺服器代為向 Cobalt 發出請求 (無 CORS 限制)
    const response = await fetch('https://co.wuk.sh/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        // 加上 User-Agent 偽裝，降低被對方伺服器拒絕的機率
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`伺服器回應錯誤: ${response.status}`)
    }

    // 將結果原封不動回傳給前端
    const data = await response.json()
    return data

  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: '解析代理伺服器錯誤: ' + error.message
    })
  }
})